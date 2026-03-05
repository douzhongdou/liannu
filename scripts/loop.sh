#!/bin/bash

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# Parse arguments
INF_MODE=0
for arg in "$@"; do
  if [[ "$arg" == "--inf" ]]; then
    INF_MODE=1
  fi
done

mkdir -p logs
LOG_FILE="$PROJECT_ROOT/logs/loop.log"
exec > >(tee -a "$LOG_FILE") 2>&1

STATUS_DIR="$PROJECT_ROOT/runtime-status"
mkdir -p "$STATUS_DIR"
CONFIG_FILE="${WORKFLOW_CONFIG_FILE:-$PROJECT_ROOT/config/workflow.env}"

if [ -f "$CONFIG_FILE" ]; then
    set -a
    . "$CONFIG_FILE"
    set +a
fi

WORKER_COUNT="${WORKER_COUNT:-5}"
PROJECT_REPO="${PROJECT_REPO:-$PROJECT_ROOT/../project}"
PROJECT_MAIN_BRANCH="${PROJECT_MAIN_BRANCH:-main}"
DEV_BRANCH="${DEV_BRANCH:-$PROJECT_MAIN_BRANCH}"

export PATH="$HOME/.local/bin:$PATH"

# LLM Provider configuration: kimi or claude
LLM_PROVIDER="${LLM_PROVIDER:-kimi}"

# LLM CLI wrapper function
llm_call() {
    local provider="$LLM_PROVIDER"
    local session=""
    local prompt=""
    local yolo=0
    local print_mode=0
    local final_only=0
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --session=*)
                session="${1#*=}"
                shift
                ;;
            -p)
                prompt="$2"
                shift 2
                ;;
            --yolo)
                yolo=1
                shift
                ;;
            --print)
                print_mode=1
                shift
                ;;
            --final-message-only)
                final_only=1
                shift
                ;;
            *)
                shift
                ;;
        esac
    done
    
    if [[ "$provider" == "claude" ]]; then
        # Claude CLI doesn't have --yolo, uses non-interactive mode differently
        local cmd="claude"
        if [[ -n "$session" ]]; then
            cmd="$cmd --session=\"$session\""
        fi
        if [[ "$print_mode" == "1" ]]; then
            cmd="$cmd --print"
        fi
        if [[ "$final_only" == "1" ]]; then
            cmd="$cmd --final-message-only"
        fi
        # For claude, --yolo equivalent is non-interactive with -p
        cmd="$cmd -p \"$prompt\""
        eval "$cmd"
    else
        # Kimi CLI
        local cmd="kimi"
        if [[ "$yolo" == "1" ]]; then
            cmd="$cmd --yolo"
        fi
        if [[ -n "$session" ]]; then
            cmd="$cmd --session=\"$session\""
        fi
        if [[ "$print_mode" == "1" ]]; then
            cmd="$cmd --print"
        fi
        if [[ "$final_only" == "1" ]]; then
            cmd="$cmd --final-message-only"
        fi
        cmd="$cmd -p \"$prompt\""
        eval "$cmd"
    fi
}

# Check LLM CLI availability
if [[ "$LLM_PROVIDER" == "claude" ]]; then
    if ! command -v claude &> /dev/null; then
        echo "Error: claude not found"
        exit 1
    fi
    AUTH_SOURCE="claude login session"
else
    if ! command -v kimi &> /dev/null; then
        echo "Error: kimi not found"
        exit 1
    fi
    AUTH_SOURCE="kimi login session"
fi

API_KEY_FILE="$PROJECT_ROOT/api-key.json"
if [ -s "$API_KEY_FILE" ]; then
    AUTH_SOURCE="api-key.json"
fi

STRICT_AUTH_CHECK="${STRICT_AUTH_CHECK:-0}"
if [[ "$STRICT_AUTH_CHECK" == "1" ]]; then
    if ! timeout 15 llm_call --print --final-message-only -p "auth check" >/dev/null 2>&1; then
        echo "Error: $LLM_PROVIDER authentication check failed."
        echo "Tried auth source: $AUTH_SOURCE"
        echo "Fix one of these and retry:"
        if [[ "$LLM_PROVIDER" == "claude" ]]; then
            echo "  1) Run: claude login"
        else
            echo "  1) Run: kimi login"
        fi
        echo "  2) Or provide non-empty: $API_KEY_FILE"
        exit 1
    fi
fi

echo "[$(date '+%H:%M:%S')] Ralph Loop started"

LOCK_TABLE_FILE="$PROJECT_ROOT/task.lock"
LOCK_GUARD_FILE="$PROJECT_ROOT/task.lock.guard"
STATUS_FILE="$PROJECT_ROOT/agent-status.json"


# Worker Session 映射记录
record_worker_session() {
    local WORKER_ID="$1"
    local SESSION_ID="$2"
    local TASK_ID="$3"
    local MAP_FILE="$PROJECT_ROOT/logs/worker-session-map.json"
    
    python3 -W ignore - "$WORKER_ID" "$SESSION_ID" "$TASK_ID" "$MAP_FILE" << 'PY'
import json
import sys
import os
from datetime import datetime, timezone

worker_id, session_id, task_id, map_file = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]

# 读取或创建映射文件
data = {}
if os.path.exists(map_file):
    try:
        with open(map_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except:
        data = {}

# 确保 worker 节点存在
worker_key = f"w{worker_id}"
if worker_key not in data:
    data[worker_key] = {"current_session": None, "history": []}

# 更新当前 session
data[worker_key]["current_session"] = session_id

# 添加到历史记录
history_entry = {
    "session_id": session_id,
    "task_id": task_id,
    "started_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
}
data[worker_key]["history"].insert(0, history_entry)

# 只保留最近 50 条记录
data[worker_key]["history"] = data[worker_key]["history"][:50]

with open(map_file, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
PY
}

cleanup() {
    echo "[$(date '+%H:%M:%S')] Stopping..."
    pkill -f "kimi" 2>/dev/null || true
    rm -f "$LOCK_GUARD_FILE" 2>/dev/null || true
    exit 0
}
trap cleanup SIGINT SIGTERM

lock() {
    while true; do
        if (set -C; echo $$ > "$LOCK_GUARD_FILE") 2>/dev/null; then
            return 0
        fi
        sleep 0.1
    done
}

unlock() {
    rm -f "$LOCK_GUARD_FILE" 2>/dev/null || true
}

update_agent_status() {
    local WORKER_ID="$1"
    local STATUS="$2"
    local TASK_ID="$3"
    local TASK_TITLE="$4"
    local MESSAGE="$5"
    
    lock
    python3 -W ignore - "$STATUS_FILE" "$WORKER_ID" "$STATUS" "$TASK_ID" "$TASK_TITLE" "$MESSAGE" << 'PY'
import json
import sys
import os
from datetime import datetime, timezone

status_file = sys.argv[1]
worker_id = sys.argv[2]
status = sys.argv[3]
task_id = sys.argv[4] if sys.argv[4] and sys.argv[4] != "null" else None
task_title = sys.argv[5] if sys.argv[5] and sys.argv[5] != "null" else None
message = sys.argv[6]

data = {}
if os.path.exists(status_file):
    try:
        with open(status_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except:
        pass

if 'workers' not in data:
    data['workers'] = {}
if 'history' not in data:
    data['history'] = []

now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
data['updated_at'] = now

worker_key = f"w{worker_id}"
data['workers'][worker_key] = {
    "status": status,
    "current_task_id": task_id,
    "current_task_title": task_title,
    "message": message,
    "updated_at": now
}

# Add history
history_entry = {
    "timestamp": now,
    "worker": worker_key,
    "event": status,
    "task_id": task_id,
    "detail": message
}
data['history'].insert(0, history_entry)
data['history'] = data['history'][:50] # Keep last 50 entries

with open(status_file, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
PY
    unlock
}

# Update agent status JSON safely (duplicated function removed)

init_agent_status() {
    echo "{ \"updated_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\", \"workers\": {}, \"history\": [] }" > "$STATUS_FILE"
    for i in $(seq 1 "$WORKER_COUNT"); do
        update_agent_status "$i" "idle" "" "" "Worker initialized"
    done
}

clean_worker_git_state() {
    local WORKER_DIR="$1"
    # Force clean up any unstaged changes and untracked files
    git -C "$WORKER_DIR" reset --hard HEAD 2>/dev/null || true
    git -C "$WORKER_DIR" clean -fd 2>/dev/null || true
    
    # Restore STATUS.txt specifically if needed (though reset --hard usually handles tracked files)
    rm -f "$WORKER_DIR/STATUS.txt" 2>/dev/null || true
    git -C "$WORKER_DIR" restore --worktree --staged STATUS.txt 2>/dev/null || true
    git -C "$WORKER_DIR" checkout -- STATUS.txt 2>/dev/null || true
}

plan_task_lock_paths() {
    local WORKER_DIR="$1"
    local WORKER_ID="$2"
    local TASK_ID="$3"
    local TASK_TITLE="$4"
    local TASK_PROMPT="$5"
    local PLAN_OUTPUT=""
    PLAN_OUTPUT=$(cd "$WORKER_DIR" && kimi --print --final-message-only --session="w$WORKER_ID" -p "You are planning file locks for task $TASK_ID: $TASK_TITLE.
Return only JSON with this shape:
{\"lock_paths\": [\"path/from/repo/root\"]}
Rules:
1) Output valid JSON only, no markdown.
2) Use repo-relative paths.
3) Include only files/directories you expect to modify.
4) lock_paths must not be empty.

Task detail:
$TASK_PROMPT" 2>/dev/null || true)
    PLAN_OUTPUT="$PLAN_OUTPUT" TASK_PROMPT="$TASK_PROMPT" TASK_TITLE="$TASK_TITLE" python3 -W ignore << 'PY'
import json
import os
import re
import sys
from datetime import datetime, timezone

text = (os.environ.get("PLAN_OUTPUT") or "").strip()
task_prompt = (os.environ.get("TASK_PROMPT") or "").strip()
task_title = (os.environ.get("TASK_TITLE") or "").strip()

def normalize(path: str) -> str:
    value = (path or "").strip().replace("\\", "/").lower()
    while value.startswith("./"):
        value = value[2:]
    value = value.strip("/")
    return value

def is_path_conflict(a: str, b: str) -> bool:
    if a == b:
        return True
    # 简单的目录包含检测
    if a.startswith(b + "/") or b.startswith(a + "/"):
        return True
    return False

def parse_obj(raw: str):
    raw = raw.strip()
    if not raw:
        return None
    try:
        return json.loads(raw)
    except Exception:
        m = re.search(r"\{[\s\S]*\}", raw)
        if not m:
            return None
        try:
            return json.loads(m.group(0))
        except Exception:
            return None

candidates = []
if text:
    candidates.append(text)
candidates.extend(re.findall(r"```(?:json)?\s*([\s\S]*?)```", text, flags=re.IGNORECASE))

for candidate in candidates:
    obj = parse_obj(candidate)
    if not isinstance(obj, dict):
        continue
    paths = obj.get("lock_paths") or obj.get("paths") or []
    if not isinstance(paths, list):
        continue
    normalized = []
    for p in paths:
        n = normalize(str(p))
        if n and n not in normalized:
            normalized.append(n)
    if normalized:
        print(";".join(normalized))
        sys.exit(0)

heuristic_paths = []
raw_text = f"{task_title}\n{task_prompt}"
for m in re.findall(r"(?i)(?:^|[\s`'\"(])((?:\./)?(?:[A-Za-z0-9_.-]+/)*[A-Za-z0-9_.-]+\.[A-Za-z0-9_.-]+)(?:$|[\s`'\"),])", raw_text):
    n = normalize(m)
    if n and n not in heuristic_paths:
        heuristic_paths.append(n)
for m in re.findall(r"(?i)(?:^|[\s`'\"(])((?:\./)?(?:[A-Za-z0-9_.-]+/)+)(?:$|[\s`'\"),])", raw_text):
    n = normalize(m)
    if n and n not in heuristic_paths:
        heuristic_paths.append(n)
for keyword in ("src", "test", "tests", "docs"):
    if re.search(rf"(?i)\b{keyword}\b", raw_text):
        n = normalize(keyword)
        if n and n not in heuristic_paths:
            heuristic_paths.append(n)
if heuristic_paths:
    print(";".join(heuristic_paths))
    sys.exit(0)

sys.exit(1)
PY
}

init_lock_table() {
    python3 -W ignore << PY
import json
import os

path = r"$LOCK_TABLE_FILE"
if not os.path.exists(path):
    with open(path, "w", encoding="utf-8") as f:
        json.dump({"version": "1.0", "locks": []}, f, indent=2, ensure_ascii=False)
PY
}

register_task_lock() {
    local TASK_ID="$1"
    local WORKER_NAME="$2"
    local TASK_LOCK_PATHS="$3"
    local RESULT=""

    lock
    # Use temporary file to capture python output to avoid pipe issues
    TMP_OUT=$(mktemp)
    
    python3 -W ignore - "$LOCK_TABLE_FILE" "$TASK_ID" "$WORKER_NAME" "$TASK_LOCK_PATHS" > "$TMP_OUT" 2>&1 << 'PY'
import json
import os
import sys
from datetime import datetime, timezone

lock_file, task_id, worker_name, raw_paths = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]

def normalize(path: str) -> str:
    value = (path or "").strip().replace("\\", "/").lower()
    while value.startswith("./"):
        value = value[2:]
    value = value.strip("/")
    return value

def is_path_conflict(a: str, b: str) -> bool:
    if a == b: return True
    return a.startswith(b + "/") or b.startswith(a + "/")

if raw_paths:
    paths = [normalize(p) for p in raw_paths.split(";") if normalize(p)]
else:
    paths = []

if not paths:
    # If no paths specified, default to global lock for safety
    paths = ["__global__"]

if os.path.exists(lock_file):
    try:
        with open(lock_file, "r", encoding="utf-8") as f:
            content = f.read().strip()
        data = json.loads(content) if content else {"version": "1.0", "locks": []}
    except:
        data = {"version": "1.0", "locks": []}
else:
    data = {"version": "1.0", "locks": []}

locks = data.get("locks", [])
# Remove stale locks for same task if any (e.g. from failed run)
locks = [entry for entry in locks if entry.get("task_id") != task_id]

request_set = set(paths)
conflict_messages = []

for entry in locks:
    existing_set = {normalize(p) for p in entry.get("paths", []) if normalize(p)}
    
    # Global lock conflict check
    if "__global__" in existing_set:
        conflict_messages.append(f"- Task {entry.get('task_id')} (Global Lock)")
    elif "__global__" in request_set:
        conflict_messages.append(f"- Task {entry.get('task_id')} (Global Lock Requested)")
    else:
        for req in request_set:
            for ex in existing_set:
                if is_path_conflict(req, ex):
                    conflict_messages.append(f"- Task {entry.get('task_id')} (File: {ex})")
                    break

# Always register the lock (Optimistic Locking)
now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
locks.append({
    "task_id": task_id,
    "worker": worker_name,
    "paths": paths,
    "locked_at": now,
    "heartbeat_at": now
})
data["locks"] = locks

with open(lock_file, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

if conflict_messages:
    print("\n".join(conflict_messages))
else:
    print("None")
PY
    
    RESULT=$(cat "$TMP_OUT")
    rm -f "$TMP_OUT"
    unlock

    echo "$RESULT"
}

release_task_lock() {
    local TASK_ID="$1"
    lock
    python3 -W ignore - "$LOCK_TABLE_FILE" "$TASK_ID" << 'PY'
import json
import os
import sys

lock_file, task_id = sys.argv[1], sys.argv[2]

if not os.path.exists(lock_file):
    raise SystemExit(0)

with open(lock_file, "r", encoding="utf-8") as f:
    content = f.read().strip()

if not content:
    data = {"version": "1.0", "locks": []}
else:
    data = json.loads(content)

locks = data.get("locks", [])
data["locks"] = [entry for entry in locks if entry.get("task_id") != task_id]

with open(lock_file, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
PY
    unlock
}

MAX_WORKERS=3
init_lock_table
init_agent_status

while true; do
    # ========== 集成已完成的任务（由 loop 统一调度） ==========
    READY_TASKS=$(python3 -W ignore << 'PY'
import json
with open('task.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
for task in data.get('tasks', []):
    if task.get('status') == 'ready_to_integrate':
        worker = (task.get('assigned_to') or '').strip()
        worker_id = worker[1:] if worker.startswith('w') else ''
        print(f"{task.get('id','')}|{worker_id}|{task.get('work_branch') or ''}")
PY
)
    while IFS='|' read -r TASK_ID READY_WORKER_ID TASK_WORK_BRANCH; do
        [[ -z "$TASK_ID" || -z "$READY_WORKER_ID" ]] && continue
        WORKER_DIR="$PROJECT_ROOT/../workers/w$READY_WORKER_ID"
        [[ -z "$TASK_WORK_BRANCH" ]] && TASK_WORK_BRANCH="worker-$READY_WORKER_ID"
        echo "[$(date '+%H:%M:%S')] Sync $TASK_ID from Worker $READY_WORKER_ID -> integrate"
        update_agent_status "$READY_WORKER_ID" "integrating" "$TASK_ID" "" "Syncing code to integration branch" "sync"
        echo "[$(date '+%H:%M:%S')] Integrating $TASK_WORK_BRANCH -> $DEV_BRANCH..."
        update_agent_status "$READY_WORKER_ID" "integrating" "$TASK_ID" "" "Merging to dev..."
        clean_worker_git_state "$WORKER_DIR"
        if git -C "$WORKER_DIR" fetch origin "$DEV_BRANCH" && \
           (git -C "$WORKER_DIR" fetch origin "$TASK_WORK_BRANCH" 2>/dev/null || true) && \
           git -C "$WORKER_DIR" checkout "$TASK_WORK_BRANCH" 2>/dev/null; then
            if git -C "$WORKER_DIR" rebase "origin/$DEV_BRANCH"; then
                git -C "$WORKER_DIR" push --force-with-lease origin "$TASK_WORK_BRANCH" || true
                if git -C "$WORKER_DIR" push origin "$TASK_WORK_BRANCH:$DEV_BRANCH"; then
                    lock
                    python3 -W ignore << PY
import json
from datetime import datetime, timezone
with open('task.json', 'r') as f:
    data = json.load(f)
for task in data['tasks']:
    if task['id'] == '$TASK_ID':
        task['status'] = 'done'
        task['completed_at'] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        task['error_count'] = 0
        task['error_msg'] = None
        task['work_branch'] = None
        break
with open('task.json', 'w') as f:
    json.dump(data, f, indent=2)
PY
                    unlock
                    release_task_lock "$TASK_ID"
                    echo "[$(date '+%H:%M:%S')] Successfully integrated $TASK_WORK_BRANCH to $DEV_BRANCH"
                    update_agent_status "$READY_WORKER_ID" "idle" "null" "null" "Task $TASK_ID integrated successfully" "completed"
                    if [[ "$TASK_WORK_BRANCH" == task/* ]]; then
                        git -C "$WORKER_DIR" checkout "worker-$READY_WORKER_ID" 2>/dev/null || git -C "$WORKER_DIR" checkout "$DEV_BRANCH" 2>/dev/null || true
                        git -C "$WORKER_DIR" branch -D "$TASK_WORK_BRANCH" 2>/dev/null || true
                        git -C "$WORKER_DIR" push origin --delete "$TASK_WORK_BRANCH" 2>/dev/null || true
                    fi
                else
                    echo "[$(date '+%H:%M:%S')] ERROR: Push $TASK_WORK_BRANCH to $DEV_BRANCH failed."
                    lock
                    python3 -W ignore << PY
import json
with open('task.json', 'r') as f:
    data = json.load(f)
for task in data['tasks']:
    if task['id'] == '$TASK_ID':
        task['status'] = 'error'
        task['error_msg'] = 'Push task branch to integration branch failed'
        break
with open('task.json', 'w') as f:
    json.dump(data, f, indent=2)
PY
                    unlock
                    update_agent_status "$READY_WORKER_ID" "error" "$TASK_ID" "" "Push failed"
                fi
            else
                echo "[$(date '+%H:%M:%S')] ERROR: Rebase conflict! Aborting rebase."
                git -C "$WORKER_DIR" rebase --abort 2>/dev/null || true
                lock
                python3 -W ignore << PY
import json
with open('task.json', 'r') as f:
    data = json.load(f)
for task in data['tasks']:
    if task['id'] == '$TASK_ID':
        task['status'] = 'error'
        task['error_msg'] = 'Rebase conflict to integration branch'
        break
with open('task.json', 'w') as f:
    json.dump(data, f, indent=2)
PY
                unlock
                update_agent_status "$READY_WORKER_ID" "error" "$TASK_ID" "" "Rebase conflict"
            fi
        else
            echo "[$(date '+%H:%M:%S')] ERROR: Task branch sync failed."
            lock
            python3 -W ignore << PY
import json
with open('task.json', 'r') as f:
    data = json.load(f)
for task in data['tasks']:
    if task['id'] == '$TASK_ID':
        task['status'] = 'error'
        task['error_msg'] = 'Task branch sync failed'
        break
with open('task.json', 'w') as f:
    json.dump(data, f, indent=2)
PY
            unlock
            update_agent_status "$READY_WORKER_ID" "error" "$TASK_ID" "" "Task branch sync failed"
        fi
    done <<< "$READY_TASKS"
    # =================================================

    # 找空闲 Worker（仅由任务状态和进程判断）
    IDLE_WORKERS=()
    for i in $(seq 1 "$WORKER_COUNT"); do
        WORKER_DIR="$PROJECT_ROOT/../workers/w$i"
        # 检查 Worker 是否运行中（通过状态文件）
RUNNING_PID=""
if [[ -f "$PROJECT_ROOT/logs/w$i.status" ]]; then
    RUNNING_PID="running"
fi
        RUNNING_TASK_ID=$(python3 -W ignore - "$i" << 'PY'
import json
import sys

worker = f"w{sys.argv[1]}"
with open('task.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
for task in data.get('tasks', []):
    if task.get('status') in ('running', 'ready_to_integrate') and task.get('assigned_to') == worker:
        print(task.get('id', ''))
        break
PY
)
        if [[ -n "$RUNNING_TASK_ID" ]]; then
            echo "[$(date '+%H:%M:%S')] Worker $i task $RUNNING_TASK_ID is running, waiting..."
            continue
        fi
        if [[ -n "$RUNNING_PID" ]]; then
            continue
        fi
        IDLE_WORKERS+=("$i")
    done

    PENDING_TASKS=$(python3 -W ignore << 'PY'
import json
with open('task.json', 'r') as f:
    data = json.load(f)
done_ids = {t['id'] for t in data['tasks'] if t['status'] == 'done'}
for task in data['tasks']:
    if task['status'] == 'pending':
        if all(dep in done_ids for dep in task.get('dependencies', [])):
            print(f"{task['id']}|{task['title']}")
PY
)

    TASK_IDX=0
    for WORKER_ID in "${IDLE_WORKERS[@]}"; do
        TASK_LINE=$(echo "$PENDING_TASKS" | sed -n "$((TASK_IDX+1))p" || true)
        [[ -z "$TASK_LINE" ]] && break
        
        IFS='|' read -r TASK_ID TASK_TITLE <<< "$TASK_LINE"
        
        echo "[$(date '+%H:%M:%S')] Assign $TASK_ID -> Worker $WORKER_ID"
        WORKER_DIR="$PROJECT_ROOT/../workers/w$WORKER_ID"
        TASK_WORK_BRANCH="task/${TASK_ID}-w${WORKER_ID}"
        update_agent_status "$WORKER_ID" "planning" "$TASK_ID" "$TASK_TITLE" "Planning lock paths..."
        echo "[$(date '+%H:%M:%S')] Preparing task branch $TASK_WORK_BRANCH from $DEV_BRANCH..."
        clean_worker_git_state "$WORKER_DIR"
        
        if ! git -C "$WORKER_DIR" fetch origin "$DEV_BRANCH"; then
            echo "[$(date '+%H:%M:%S')] Warning: Fetch origin/$DEV_BRANCH failed, skip $TASK_ID"
            release_task_lock "$TASK_ID"
            TASK_IDX=$((TASK_IDX + 1))
            continue
        fi
        
        if ! git -C "$WORKER_DIR" checkout "worker-$WORKER_ID" 2>/dev/null; then
            if git -C "$WORKER_DIR" show-ref --verify --quiet "refs/heads/worker-$WORKER_ID"; then
                echo "[$(date '+%H:%M:%S')] Warning: Switch to worker-$WORKER_ID failed, skip $TASK_ID"
                release_task_lock "$TASK_ID"
                TASK_IDX=$((TASK_IDX + 1))
                continue
            fi
            if ! git -C "$WORKER_DIR" checkout -b "worker-$WORKER_ID" "origin/$DEV_BRANCH" 2>/dev/null; then
                if ! git -C "$WORKER_DIR" checkout -b "worker-$WORKER_ID"; then
                    echo "[$(date '+%H:%M:%S')] Warning: Create worker-$WORKER_ID failed, skip $TASK_ID"
                    release_task_lock "$TASK_ID"
                    TASK_IDX=$((TASK_IDX + 1))
                    continue
                fi
            fi
        fi
        
        if ! git -C "$WORKER_DIR" rebase "origin/$DEV_BRANCH"; then
            echo "[$(date '+%H:%M:%S')] Warning: Rebase $DEV_BRANCH to worker-$WORKER_ID failed, skip $TASK_ID"
            git -C "$WORKER_DIR" rebase --abort 2>/dev/null || true
            release_task_lock "$TASK_ID"
            TASK_IDX=$((TASK_IDX + 1))
            continue
        fi
        if git -C "$WORKER_DIR" show-ref --verify --quiet "refs/heads/$TASK_WORK_BRANCH"; then
            git -C "$WORKER_DIR" branch -D "$TASK_WORK_BRANCH" 2>/dev/null || true
        fi
        if ! git -C "$WORKER_DIR" checkout -b "$TASK_WORK_BRANCH" "origin/$DEV_BRANCH" 2>/dev/null; then
            if ! git -C "$WORKER_DIR" checkout -b "$TASK_WORK_BRANCH"; then
                echo "[$(date '+%H:%M:%S')] Warning: Create task branch $TASK_WORK_BRANCH failed, skip $TASK_ID"
                TASK_IDX=$((TASK_IDX + 1))
                continue
            fi
        fi
        
        TASK_PROMPT=$(python3 -W ignore - "$TASK_ID" << 'PY'
import json
import sys
task_id = sys.argv[1]
with open('task.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
for task in data.get('tasks', []):
    if task.get('id') == task_id:
        print(task.get('prompt', ''))
        break
PY
)
        PLANNED_LOCK_PATHS=""
        # update_agent_status "$WORKER_ID" "planning" "$TASK_ID" "$TASK_TITLE" "Planning lock paths..." "planning"
        if ! PLANNED_LOCK_PATHS=$(plan_task_lock_paths "$WORKER_DIR" "$WORKER_ID" "$TASK_ID" "$TASK_TITLE" "$TASK_PROMPT"); then
            echo "[$(date '+%H:%M:%S')] Warning: Plan lock paths failed for $TASK_ID, skip assignment"
            lock
            python3 -W ignore - "$TASK_ID" << 'PY'
import json
import sys
task_id = sys.argv[1]
with open('task.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
for task in data.get('tasks', []):
    if task.get('id') == task_id:
        task['status'] = 'pending'
        task['assigned_to'] = None
        task['started_at'] = None
        task['error_msg'] = 'Plan lock paths failed'
        break
with open('task.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
PY
            unlock
            TASK_IDX=$((TASK_IDX + 1))
            update_agent_status "$WORKER_ID" "error" "$TASK_ID" "$TASK_TITLE" "Plan lock paths failed"
            continue
        fi
        
        # Register lock and get potential conflicts (non-blocking)
        EXISTING_LOCKS=$(register_task_lock "$TASK_ID" "w$WORKER_ID" "$PLANNED_LOCK_PATHS")

        git -C "$WORKER_DIR" push --force-with-lease origin "$TASK_WORK_BRANCH" 2>/dev/null || true
        
        lock
        python3 -W ignore - "$TASK_ID" "$WORKER_ID" "$TASK_WORK_BRANCH" << 'PY'
import json
import sys
from datetime import datetime, timezone

task_id, worker_id, work_branch = sys.argv[1], sys.argv[2], sys.argv[3]
with open('task.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
for task in data.get('tasks', []):
    if task.get('id') == task_id:
        task['status'] = 'running'
        task['assigned_to'] = f'w{worker_id}'
        task['started_at'] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        task['completed_at'] = None
        task['error_msg'] = None
        task['work_branch'] = work_branch
        break
with open('task.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
PY
        unlock

        update_agent_status "$WORKER_ID" "working" "$TASK_ID" "$TASK_TITLE" "Coding & Testing..."
        
        export -f update_agent_status
        export -f lock
export -f unlock
export PROJECT_ROOT
export LOCK_GUARD_FILE
export AGENT_STATUS_FILE
export LOCK_TABLE_FILE

        (
            cd "$WORKER_DIR"
            
            # 生成 UUID 作为 session ID
            SESSION_ID=$(python3 -c "import uuid; print(str(uuid.uuid4()))")
            
            # 记录 Worker-Session 映射
            record_worker_session "$WORKER_ID" "$SESSION_ID" "$TASK_ID"
            
            # 启动 Worker，使用 UUID 作为 session 名
            if llm_call --yolo --session="$SESSION_ID" -p "Task: $TASK_ID - $TASK_TITLE.
Current task branch: $TASK_WORK_BRANCH.
Do not switch branches.

CRITICAL: Read AGENT.md first to understand the workflow and constraints.

WARNING: The following files are currently locked by other agents:
$EXISTING_LOCKS
If your task requires modifying these files, you MUST:
1. Proceed with caution.
2. Before pushing, perform a 'git pull --rebase origin dev' to sync latest changes.
3. Resolve any merge conflicts autonomously.

Then read task.json for task details.

Execute the complete task lifecycle:
1. Plan (if complex)
2. Develop in worktree
3. Test thoroughly
4. **CRITICAL: Git commit required** - Run 'git add . && git commit -m \"feat($TASK_ID): $TASK_TITLE\"' before marking done
5. Do not write any runtime status file; scheduler updates workflow state automatically.

Do not skip the git commit step."; then
                echo "SUCCESS" > "$PROJECT_ROOT/logs/w$WORKER_ID.status"
            else
                echo "FAILURE" > "$PROJECT_ROOT/logs/w$WORKER_ID.status"
            fi
        ) >> "$PROJECT_ROOT/logs/w$WORKER_ID.log" 2>&1 &
        WORKER_PID=$!

        # 启动一个后台监听器，等待 Worker 完成
        (
            while kill -0 $WORKER_PID 2>/dev/null; do sleep 1; done
            STATUS_FILE="$PROJECT_ROOT/logs/w$WORKER_ID.status"
            if [[ -f "$STATUS_FILE" ]]; then
                STATUS=$(cat "$STATUS_FILE")
                rm -f "$STATUS_FILE"
                if [[ "$STATUS" == "SUCCESS" ]]; then
                    lock
                    python3 -W ignore - "$PROJECT_ROOT/task.json" "$TASK_ID" << 'PY'
import json
import sys
task_file, task_id = sys.argv[1], sys.argv[2]
with open(task_file, 'r', encoding='utf-8') as f:
    data = json.load(f)
for task in data['tasks']:
    if task['id'] == task_id:
        task['status'] = 'ready_to_integrate'
        task['error_msg'] = None
        break
with open(task_file, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
PY
                    unlock
                    update_agent_status "$WORKER_ID" "idle" "$TASK_ID" "$TASK_TITLE" "Task execution completed, ready for integrate"
                elif [[ "$STATUS" == "FAILURE" ]]; then
                    lock
                    python3 -W ignore - "$PROJECT_ROOT/task.json" "$TASK_ID" << 'PY'
import json
import sys
task_file, task_id = sys.argv[1], sys.argv[2]
with open(task_file, 'r', encoding='utf-8') as f:
    data = json.load(f)
for task in data['tasks']:
    if task['id'] == task_id:
        task['error_count'] = task.get('error_count', 0) + 1
        task['error_msg'] = 'Worker execution failed'
        task['status'] = 'failed' if task['error_count'] >= 3 else 'error'
        break
with open(task_file, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
PY
                    unlock
                    release_task_lock "$TASK_ID"
                    update_agent_status "$WORKER_ID" "error" "$TASK_ID" "$TASK_TITLE" "Worker execution failed"
                fi
            fi
        ) &
        
        TASK_IDX=$((TASK_IDX + 1))
        
        while [[ $(pgrep -fc "${LLM_PROVIDER}$") -ge $MAX_WORKERS ]]; do sleep 2; done
        sleep 1
    done

    PROGRESS=$(python3 -W ignore << 'PY'
import json
with open('task.json', 'r') as f:
    data = json.load(f)
tasks = data.get('tasks', [])
total = len(tasks)
done = sum(1 for t in tasks if t['status'] in ('done', 'failed'))
pending = sum(1 for t in tasks if t['status'] == 'pending')
running = sum(1 for t in tasks if t['status'] == 'running')
print(f"{done}|{total}|{pending}|{running}")
PY
)

    IFS='|' read -r DONE TOTAL PENDING RUNNING <<< "$PROGRESS"
    echo "[$(date '+%H:%M:%S')] Progress: $DONE/$TOTAL done, $PENDING pending, $RUNNING running"
    
    if [[ $DONE -eq $TOTAL && $TOTAL -gt 0 ]]; then
        echo "[$(date '+%H:%M:%S')] All tasks completed!"
        if [[ "$INF_MODE" == "1" ]]; then
            echo "[$(date '+%H:%M:%S')] Infinite mode enabled. Waiting for new tasks..."
            sleep 10
            continue
        fi
        break
    fi

    sleep 5
done
