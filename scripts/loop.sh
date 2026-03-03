#!/bin/bash

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"
mkdir -p logs
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

if ! kimi --print --final-message-only -p "auth check" >/dev/null 2>&1; then
    echo "Error: Kimi authentication check failed."
    echo "Tried auth source: $AUTH_SOURCE"
    echo "Fix one of these and retry:"
    echo "  1) Run: kimi login"
    echo "  2) Or provide non-empty: $API_KEY_FILE"
    exit 1
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
    existing_set = set(entry.get("paths", []))
    if "__global__" in existing_set or "__global__" in request_set:
        print(f"CONFLICT:{entry.get('task_id','unknown')}")
        raise SystemExit(2)
    if request_set.intersection(existing_set):
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
    # ========== 同步 Worker 完成状态到 JSON ==========
    for i in $(seq 1 "$WORKER_COUNT"); do
        WORKER_DIR="$PROJECT_ROOT/../workers/w$i"
        STATUS_FILE="$WORKER_DIR/STATUS.txt"
        if [[ -e "$WORKER_DIR/.git" && ! -f "$STATUS_FILE" ]]; then
            echo "idle" > "$STATUS_FILE"
        fi
        if [[ -f "$STATUS_FILE" ]]; then
            STATUS=$(cat "$STATUS_FILE" 2>/dev/null | tr -d '[:space:]')
            TASK_ID=""
            
            # 解析状态中的任务ID
            if [[ "$STATUS" == done:T* ]]; then
                TASK_ID="${STATUS#done:}"
            elif [[ "$STATUS" == error:T* ]]; then
                TASK_ID="${STATUS#error:}"
            fi
            
            # 如果状态是 done:T1, done:T2 等
            if [[ "$STATUS" == done:T* ]]; then
                echo "[$(date '+%H:%M:%S')] Sync $TASK_ID from Worker $i -> done"
                
                lock
                python3 << PY
import json
with open('dev-tasks.json', 'r') as f:
    data = json.load(f)
for task in data['tasks']:
    if task['id'] == '$TASK_ID':
        task['status'] = 'done'
        task['completed_at'] = '$(date -u +%Y-%m-%dT%H:%M:%SZ)'
        break
with open('dev-tasks.json', 'w') as f:
    json.dump(data, f, indent=2)
PY
                unlock
                release_task_lock "$TASK_ID"
                
                echo "[$(date '+%H:%M:%S')] Integrating worker-$i -> $DEV_BRANCH..."
                WORKER_BRANCH="worker-$i"
                if git -C "$WORKER_DIR" fetch origin "$DEV_BRANCH" && \
                   git -C "$WORKER_DIR" fetch origin "$WORKER_BRANCH" 2>/dev/null && \
                   git -C "$WORKER_DIR" checkout "$WORKER_BRANCH" 2>/dev/null; then
                    if git -C "$WORKER_DIR" rebase "origin/$DEV_BRANCH"; then
                        git -C "$WORKER_DIR" push --force-with-lease origin "$WORKER_BRANCH" || true
                        if git -C "$WORKER_DIR" push origin "$WORKER_BRANCH:$DEV_BRANCH"; then
                            echo "[$(date '+%H:%M:%S')] Successfully integrated worker-$i to $DEV_BRANCH"
                        else
                            echo "[$(date '+%H:%M:%S')] ERROR: Push worker-$i to $DEV_BRANCH failed."
                            lock
                            python3 << PY
import json
with open('dev-tasks.json', 'r') as f:
    data = json.load(f)
for task in data['tasks']:
    if task['id'] == '$TASK_ID':
        task['status'] = 'error'
        task['error_msg'] = 'Push worker branch to integration branch failed'
        break
with open('dev-tasks.json', 'w') as f:
    json.dump(data, f, indent=2)
PY
                            unlock
                            echo "error:$TASK_ID" > "$STATUS_FILE"
                            continue
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
                        echo "error:$TASK_ID" > "$STATUS_FILE"
                        continue
                    fi
                else
                    echo "[$(date '+%H:%M:%S')] ERROR: Worker branch sync failed."
                    lock
                    python3 << PY
import json
with open('dev-tasks.json', 'r') as f:
    data = json.load(f)
for task in data['tasks']:
    if task['id'] == '$TASK_ID':
        task['status'] = 'error'
        task['error_msg'] = 'Worker branch sync failed'
        break
with open('dev-tasks.json', 'w') as f:
    json.dump(data, f, indent=2)
PY
                    unlock
                    echo "error:$TASK_ID" > "$STATUS_FILE"
                    continue
                fi
                
                echo "idle" > "$STATUS_FILE"
            elif [[ "$STATUS" == error:T* ]]; then
                echo "[$(date '+%H:%M:%S')] Worker $i error on $TASK_ID, incrementing error_count"
                lock
                python3 << PY
import json
with open('dev-tasks.json', 'r') as f:
    data = json.load(f)
for task in data['tasks']:
    if task['id'] == '$TASK_ID':
        task['error_count'] = task.get('error_count', 0) + 1
        # 如果错误次数超过3次，标记为 failed
        if task['error_count'] >= 3:
            task['status'] = 'failed'
        break
with open('dev-tasks.json', 'w') as f:
    json.dump(data, f, indent=2)
PY
                unlock
                release_task_lock "$TASK_ID"
                echo "idle" > "$STATUS_FILE"
            fi
        fi
    done
    # =================================================

    # 找空闲 Worker
    IDLE_WORKERS=()
    for i in $(seq 1 "$WORKER_COUNT"); do
        WORKER_DIR="$PROJECT_ROOT/../workers/w$i"
        STATUS_FILE="$WORKER_DIR/STATUS.txt"
        if [[ -e "$WORKER_DIR/.git" && ! -f "$STATUS_FILE" ]]; then
            echo "idle" > "$STATUS_FILE"
        fi
        
        if [[ -f "$STATUS_FILE" ]]; then
            STATUS=$(cat "$STATUS_FILE" 2>/dev/null | tr -d '[:space:]' || echo "unknown")
            RUNNING_PID=$(pgrep -f "kimi.*--session=w$i" | head -1 || true)
            
            if [[ "$STATUS" == "idle" && -z "$RUNNING_PID" ]]; then
                IDLE_WORKERS+=("$i")
            elif [[ "$STATUS" == busy* && -z "$RUNNING_PID" ]]; then
                if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
                    FILE_AGE=$(( $(date +%s) - $(stat -c %Y "$STATUS_FILE" 2>/dev/null || echo 0) ))
                else
                    FILE_AGE=$(( $(date +%s) - $(stat -c %Y "$STATUS_FILE" 2>/dev/null || echo 0) ))
                fi
                
                if [[ $FILE_AGE -gt 30 ]]; then
                    BUSY_TASK_ID="${STATUS#busy:}"
                    if [[ -n "$BUSY_TASK_ID" && "$BUSY_TASK_ID" != "$STATUS" ]]; then
                        release_task_lock "$BUSY_TASK_ID"
                    fi
                    echo "[$(date '+%H:%M:%S')] Worker $i busy but no process for ${FILE_AGE}s, resetting to idle"
                    echo "idle" > "$STATUS_FILE"
                    IDLE_WORKERS+=("$i")
                else
                    echo "[$(date '+%H:%M:%S')] Worker $i starting up (busy for ${FILE_AGE}s), waiting..."
                fi
            fi
        fi
    done

    PENDING_TASKS=$(python3 << 'PY'
import json
with open('dev-tasks.json', 'r') as f:
    data = json.load(f)
done_ids = {t['id'] for t in data['tasks'] if t['status'] == 'done'}
def normalize(path):
    value = (path or "").strip().replace("\\", "/").lower()
    while value.startswith("./"):
        value = value[2:]
    value = value.strip("/")
    return value
for task in data['tasks']:
    if task['status'] == 'pending':
        if all(dep in done_ids for dep in task.get('dependencies', [])):
            raw_paths = task.get('lock_paths') or []
            paths = [normalize(p) for p in raw_paths if normalize(p)]
            print(f"{task['id']}|{task['title']}|{';'.join(paths)}")
PY
)

    TASK_IDX=0
    for WORKER_ID in "${IDLE_WORKERS[@]}"; do
        TASK_LINE=$(echo "$PENDING_TASKS" | sed -n "$((TASK_IDX+1))p" || true)
        [[ -z "$TASK_LINE" ]] && break
        
        IFS='|' read -r TASK_ID TASK_TITLE TASK_LOCK_PATHS <<< "$TASK_LINE"
        
        if ! CONFLICT_REASON=$(acquire_task_lock "$TASK_ID" "w$WORKER_ID" "$TASK_LOCK_PATHS" 2>/dev/null); then
            if [[ -z "$CONFLICT_REASON" ]]; then
                CONFLICT_REASON="CONFLICT:unknown"
            fi
            echo "[$(date '+%H:%M:%S')] Skip $TASK_ID for Worker $WORKER_ID, $CONFLICT_REASON"
            TASK_IDX=$((TASK_IDX + 1))
            continue
        fi
        
        echo "[$(date '+%H:%M:%S')] Assign $TASK_ID -> Worker $WORKER_ID"
        WORKER_DIR="$PROJECT_ROOT/../workers/w$WORKER_ID"
        echo "[$(date '+%H:%M:%S')] Syncing $DEV_BRANCH -> worker-$WORKER_ID..."
        
        if ! git -C "$WORKER_DIR" fetch origin "$DEV_BRANCH"; then
            echo "[$(date '+%H:%M:%S')] Warning: Fetch origin/$DEV_BRANCH failed, skip $TASK_ID"
            release_task_lock "$TASK_ID"
            TASK_IDX=$((TASK_IDX + 1))
            continue
        fi
        
        if ! git -C "$WORKER_DIR" checkout "worker-$WORKER_ID" 2>/dev/null; then
            git -C "$WORKER_DIR" checkout -b "worker-$WORKER_ID" || true
        fi
        
        if ! git -C "$WORKER_DIR" rebase "origin/$DEV_BRANCH"; then
            echo "[$(date '+%H:%M:%S')] Warning: Rebase $DEV_BRANCH to worker-$WORKER_ID failed, skip $TASK_ID"
            git -C "$WORKER_DIR" rebase --abort 2>/dev/null || true
            release_task_lock "$TASK_ID"
            TASK_IDX=$((TASK_IDX + 1))
            continue
        fi
        
        git -C "$WORKER_DIR" push --force-with-lease origin "worker-$WORKER_ID" || true
        
        lock
        python3 << PY
import json
with open('dev-tasks.json', 'r') as f:
    data = json.load(f)
for task in data['tasks']:
    if task['id'] == '$TASK_ID':
        task['status'] = 'running'
        task['assigned_to'] = 'w$WORKER_ID'
        task['started_at'] = '$(date -u +%Y-%m-%dT%H:%M:%SZ)'
with open('dev-tasks.json', 'w') as f:
    json.dump(data, f, indent=2)
PY
        unlock
        
        STATUS_FILE="$WORKER_DIR/STATUS.txt"
        echo "busy:$TASK_ID" > "$STATUS_FILE"
        
        (
            cd "$WORKER_DIR"
            if kimi --print --session=w$WORKER_ID -p "Task: $TASK_ID - $TASK_TITLE.

CRITICAL: Read AGENT.md first to understand the workflow and constraints.

Then read dev-tasks.json for task details.

Execute the complete task lifecycle:
1. Plan (if complex)
2. Develop in worktree
3. Test thoroughly
4. **CRITICAL: Git commit required** - Run 'git add . && git commit -m \"feat($TASK_ID): $TASK_TITLE\"' before marking done
5. Write 'done:$TASK_ID' to STATUS.txt

Do not skip the git commit step."; then
                echo "done:$TASK_ID" > STATUS.txt
            else
                echo "error:$TASK_ID" > STATUS.txt
            fi
        ) >> "$PROJECT_ROOT/logs/w$WORKER_ID.log" 2>&1 &
        
        TASK_IDX=$((TASK_IDX + 1))
        
        while [[ $(pgrep -c kimi) -ge $MAX_WORKERS ]]; do sleep 2; done
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
