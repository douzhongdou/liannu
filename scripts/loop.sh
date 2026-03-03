#!/bin/bash

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"
mkdir -p logs
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

if ! command -v kimi &> /dev/null; then
    echo "Error: kimi not found"
    exit 1
fi

API_KEY_FILE="$PROJECT_ROOT/api-key.json"
if [ -s "$API_KEY_FILE" ]; then
    AUTH_SOURCE="api-key.json"
else
    AUTH_SOURCE="kimi login session"
fi

STRICT_AUTH_CHECK="${STRICT_AUTH_CHECK:-0}"
if [[ "$STRICT_AUTH_CHECK" == "1" ]]; then
    if ! timeout 15 kimi --print --final-message-only -p "auth check" >/dev/null 2>&1; then
        echo "Error: Kimi authentication check failed."
        echo "Tried auth source: $AUTH_SOURCE"
        echo "Fix one of these and retry:"
        echo "  1) Run: kimi login"
        echo "  2) Or provide non-empty: $API_KEY_FILE"
        exit 1
    fi
fi

echo "[$(date '+%H:%M:%S')] Ralph Loop started"

LOCK_TABLE_FILE="$PROJECT_ROOT/dev-task.lock"
LOCK_GUARD_FILE="$PROJECT_ROOT/dev-task.lock.guard"

cleanup() {
    echo "[$(date '+%H:%M:%S')] Stopping..."
    pkill -f "kimi.*--session=w" 2>/dev/null || true
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

clean_worker_git_state() {
    local WORKER_DIR="$1"
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
    PLAN_OUTPUT="$PLAN_OUTPUT" TASK_PROMPT="$TASK_PROMPT" TASK_TITLE="$TASK_TITLE" python3 << 'PY'
import json
import os
import re
import sys

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
    return a.startswith(b + "/") or b.startswith(a + "/")

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
    python3 << PY
import json
import os

path = r"$LOCK_TABLE_FILE"
if not os.path.exists(path):
    with open(path, "w", encoding="utf-8") as f:
        json.dump({"version": "1.0", "locks": []}, f, indent=2, ensure_ascii=False)
PY
}

acquire_task_lock() {
    local TASK_ID="$1"
    local WORKER_NAME="$2"
    local TASK_LOCK_PATHS="$3"
    local RESULT=""

    lock
    RESULT=$(python3 - "$LOCK_TABLE_FILE" "$TASK_ID" "$WORKER_NAME" "$TASK_LOCK_PATHS" << 'PY'
import json
import os
import sys
from datetime import datetime

lock_file, task_id, worker_name, raw_paths = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]

def normalize(path: str) -> str:
    value = (path or "").strip().replace("\\", "/").lower()
    while value.startswith("./"):
        value = value[2:]
    value = value.strip("/")
    return value

if raw_paths:
    paths = [normalize(p) for p in raw_paths.split(";") if normalize(p)]
else:
    paths = []

if not paths:
    paths = ["__global__"]

if os.path.exists(lock_file):
    with open(lock_file, "r", encoding="utf-8") as f:
        content = f.read().strip()
    if content:
        data = json.loads(content)
    else:
        data = {"version": "1.0", "locks": []}
else:
    data = {"version": "1.0", "locks": []}

locks = data.get("locks", [])
locks = [entry for entry in locks if entry.get("task_id") != task_id]

request_set = set(paths)
for entry in locks:
    existing_set = {normalize(p) for p in entry.get("paths", []) if normalize(p)}
    if "__global__" in existing_set or "__global__" in request_set:
        print(f"CONFLICT:{entry.get('task_id','unknown')}")
        raise SystemExit(2)
    for req in request_set:
        for ex in existing_set:
            if is_path_conflict(req, ex):
                print(f"CONFLICT:{entry.get('task_id','unknown')}")
                raise SystemExit(2)

now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
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

print("ACQUIRED")
PY
)
    local EXIT_CODE=$?
    unlock

    if [[ $EXIT_CODE -eq 0 ]]; then
        return 0
    fi

    echo "$RESULT"
    return 1
}

release_task_lock() {
    local TASK_ID="$1"
    lock
    python3 - "$LOCK_TABLE_FILE" "$TASK_ID" << 'PY'
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

while true; do
    # ========== 集成已完成的任务（由 loop 统一调度） ==========
    READY_TASKS=$(python3 << 'PY'
import json
with open('dev-tasks.json', 'r', encoding='utf-8') as f:
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
        echo "[$(date '+%H:%M:%S')] Integrating $TASK_WORK_BRANCH -> $DEV_BRANCH..."
        clean_worker_git_state "$WORKER_DIR"
        if git -C "$WORKER_DIR" fetch origin "$DEV_BRANCH" && \
           (git -C "$WORKER_DIR" fetch origin "$TASK_WORK_BRANCH" 2>/dev/null || true) && \
           git -C "$WORKER_DIR" checkout "$TASK_WORK_BRANCH" 2>/dev/null; then
            if git -C "$WORKER_DIR" rebase "origin/$DEV_BRANCH"; then
                git -C "$WORKER_DIR" push --force-with-lease origin "$TASK_WORK_BRANCH" || true
                if git -C "$WORKER_DIR" push origin "$TASK_WORK_BRANCH:$DEV_BRANCH"; then
                    lock
                    python3 << PY
import json
with open('dev-tasks.json', 'r') as f:
    data = json.load(f)
for task in data['tasks']:
    if task['id'] == '$TASK_ID':
        task['status'] = 'done'
        task['completed_at'] = '$(date -u +%Y-%m-%dT%H:%M:%SZ)'
        task['error_count'] = 0
        task['error_msg'] = None
        task['work_branch'] = None
        break
with open('dev-tasks.json', 'w') as f:
    json.dump(data, f, indent=2)
PY
                    unlock
                    release_task_lock "$TASK_ID"
                    echo "[$(date '+%H:%M:%S')] Successfully integrated $TASK_WORK_BRANCH to $DEV_BRANCH"
                    if [[ "$TASK_WORK_BRANCH" == task/* ]]; then
                        git -C "$WORKER_DIR" checkout "worker-$READY_WORKER_ID" 2>/dev/null || git -C "$WORKER_DIR" checkout "$DEV_BRANCH" 2>/dev/null || true
                        git -C "$WORKER_DIR" branch -D "$TASK_WORK_BRANCH" 2>/dev/null || true
                        git -C "$WORKER_DIR" push origin --delete "$TASK_WORK_BRANCH" 2>/dev/null || true
                    fi
                else
                    echo "[$(date '+%H:%M:%S')] ERROR: Push $TASK_WORK_BRANCH to $DEV_BRANCH failed."
                    lock
                    python3 << PY
import json
with open('dev-tasks.json', 'r') as f:
    data = json.load(f)
for task in data['tasks']:
    if task['id'] == '$TASK_ID':
        task['status'] = 'error'
        task['error_msg'] = 'Push task branch to integration branch failed'
        break
with open('dev-tasks.json', 'w') as f:
    json.dump(data, f, indent=2)
PY
                    unlock
                fi
            else
                echo "[$(date '+%H:%M:%S')] ERROR: Rebase conflict! Aborting rebase."
                git -C "$WORKER_DIR" rebase --abort 2>/dev/null || true
                lock
                python3 << PY
import json
with open('dev-tasks.json', 'r') as f:
    data = json.load(f)
for task in data['tasks']:
    if task['id'] == '$TASK_ID':
        task['status'] = 'error'
        task['error_msg'] = 'Rebase conflict to integration branch'
        break
with open('dev-tasks.json', 'w') as f:
    json.dump(data, f, indent=2)
PY
                unlock
            fi
        else
            echo "[$(date '+%H:%M:%S')] ERROR: Task branch sync failed."
            lock
            python3 << PY
import json
with open('dev-tasks.json', 'r') as f:
    data = json.load(f)
for task in data['tasks']:
    if task['id'] == '$TASK_ID':
        task['status'] = 'error'
        task['error_msg'] = 'Task branch sync failed'
        break
with open('dev-tasks.json', 'w') as f:
    json.dump(data, f, indent=2)
PY
            unlock
        fi
    done <<< "$READY_TASKS"
    # =================================================

    # 找空闲 Worker（仅由任务状态和进程判断）
    IDLE_WORKERS=()
    for i in $(seq 1 "$WORKER_COUNT"); do
        WORKER_DIR="$PROJECT_ROOT/../workers/w$i"
        RUNNING_PID=$(pgrep -f "kimi.*--session=w$i" | head -1 || true)
        RUNNING_TASK_ID=$(python3 - "$i" << 'PY'
import json
import sys

worker = f"w{sys.argv[1]}"
with open('dev-tasks.json', 'r', encoding='utf-8') as f:
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

    PENDING_TASKS=$(python3 << 'PY'
import json
with open('dev-tasks.json', 'r') as f:
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
        
        TASK_PROMPT=$(python3 - "$TASK_ID" << 'PY'
import json
import sys
task_id = sys.argv[1]
with open('dev-tasks.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
for task in data.get('tasks', []):
    if task.get('id') == task_id:
        print(task.get('prompt', ''))
        break
PY
)
        PLANNED_LOCK_PATHS=""
        if ! PLANNED_LOCK_PATHS=$(plan_task_lock_paths "$WORKER_DIR" "$WORKER_ID" "$TASK_ID" "$TASK_TITLE" "$TASK_PROMPT"); then
            echo "[$(date '+%H:%M:%S')] Warning: Plan lock paths failed for $TASK_ID, skip assignment"
            lock
            python3 - "$TASK_ID" << 'PY'
import json
import sys
task_id = sys.argv[1]
with open('dev-tasks.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
for task in data.get('tasks', []):
    if task.get('id') == task_id:
        task['status'] = 'pending'
        task['assigned_to'] = None
        task['started_at'] = None
        task['error_msg'] = 'Plan lock paths failed'
        break
with open('dev-tasks.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
PY
            unlock
            TASK_IDX=$((TASK_IDX + 1))
            continue
        fi
        if ! CONFLICT_REASON=$(acquire_task_lock "$TASK_ID" "w$WORKER_ID" "$PLANNED_LOCK_PATHS" 2>/dev/null); then
            if [[ -z "$CONFLICT_REASON" ]]; then
                CONFLICT_REASON="CONFLICT:unknown"
            fi
            echo "[$(date '+%H:%M:%S')] Skip $TASK_ID for Worker $WORKER_ID, $CONFLICT_REASON"
            lock
            python3 - "$TASK_ID" "$CONFLICT_REASON" << 'PY'
import json
import sys
task_id = sys.argv[1]
reason = sys.argv[2]
with open('dev-tasks.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
for task in data.get('tasks', []):
    if task.get('id') == task_id:
        task['status'] = 'pending'
        task['assigned_to'] = None
        task['started_at'] = None
        task['error_msg'] = reason
        break
with open('dev-tasks.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
PY
            unlock
            TASK_IDX=$((TASK_IDX + 1))
            continue
        fi

        git -C "$WORKER_DIR" push --force-with-lease origin "$TASK_WORK_BRANCH" 2>/dev/null || true
        
        lock
        python3 - "$TASK_ID" "$WORKER_ID" "$TASK_WORK_BRANCH" << 'PY'
import json
import sys

task_id, worker_id, work_branch = sys.argv[1], sys.argv[2], sys.argv[3]
with open('dev-tasks.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
for task in data.get('tasks', []):
    if task.get('id') == task_id:
        task['status'] = 'running'
        task['assigned_to'] = f'w{worker_id}'
        task['started_at'] = '$(date -u +%Y-%m-%dT%H:%M:%SZ)'
        task['completed_at'] = None
        task['error_msg'] = None
        task['work_branch'] = work_branch
        break
with open('dev-tasks.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
PY
        unlock
        
        (
            cd "$WORKER_DIR"
            if kimi --print --session=w$WORKER_ID -p "Task: $TASK_ID - $TASK_TITLE.
Current task branch: $TASK_WORK_BRANCH.
Do not switch branches.

CRITICAL: Read AGENT.md first to understand the workflow and constraints.

Then read dev-tasks.json for task details.

Execute the complete task lifecycle:
1. Plan (if complex)
2. Develop in worktree
3. Test thoroughly
4. **CRITICAL: Git commit required** - Run 'git add . && git commit -m \"feat($TASK_ID): $TASK_TITLE\"' before marking done
5. Do not write any runtime status file; scheduler updates workflow state automatically.

Do not skip the git commit step."; then
                lock
                python3 << PY
import json
with open('dev-tasks.json', 'r') as f:
    data = json.load(f)
for task in data['tasks']:
    if task['id'] == '$TASK_ID':
        task['status'] = 'ready_to_integrate'
        task['error_msg'] = None
        break
with open('dev-tasks.json', 'w') as f:
    json.dump(data, f, indent=2)
PY
                unlock
            else
                lock
                python3 << PY
import json
with open('dev-tasks.json', 'r') as f:
    data = json.load(f)
for task in data['tasks']:
    if task['id'] == '$TASK_ID':
        task['error_count'] = task.get('error_count', 0) + 1
        task['error_msg'] = 'Worker execution failed'
        task['status'] = 'failed' if task['error_count'] >= 3 else 'error'
        break
with open('dev-tasks.json', 'w') as f:
    json.dump(data, f, indent=2)
PY
                unlock
                release_task_lock "$TASK_ID"
            fi
        ) >> "$PROJECT_ROOT/logs/w$WORKER_ID.log" 2>&1 &
        
        TASK_IDX=$((TASK_IDX + 1))
        
        while [[ $(pgrep -fc "kimi.*--session=w") -ge $MAX_WORKERS ]]; do sleep 2; done
        sleep 1
    done

    PROGRESS=$(python3 << 'PY'
import json
with open('dev-tasks.json', 'r') as f:
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
        break
    fi

    sleep 5
done
