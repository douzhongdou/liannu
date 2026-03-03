#!/bin/bash

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"
mkdir -p logs

export PATH="$HOME/.local/bin:$PATH"

if ! command -v kimi &> /dev/null; then
    echo "Error: kimi not found"
    exit 1
fi

echo "[$(date '+%H:%M:%S')] Ralph Loop started"

LOCK_FILE="$PROJECT_ROOT/dev-task.lock"

cleanup() {
    echo "[$(date '+%H:%M:%S')] Stopping..."
    pkill -f "kimi.*agent-w" 2>/dev/null || true
    rm -f "$LOCK_FILE" 2>/dev/null || true
    exit 0
}
trap cleanup SIGINT SIGTERM

# 使用文件锁保护 dev-tasks.json
# 所有 worker 通过 symlink 共享同一个 dev-task.lock 文件
lock() {
    while true; do
        # 尝试创建锁文件（原子操作）
        if (set -C; echo $$ > "$LOCK_FILE") 2>/dev/null; then
            # 成功获取锁
            return 0
        fi
        # 锁被占用，等待
        sleep 0.1
    done
}

unlock() {
    rm -f "$LOCK_FILE" 2>/dev/null || true
}

MAX_WORKERS=3

while true; do
    # ========== 同步 Worker 完成状态到 JSON ==========
    for i in {1..5}; do
        WORKER_DIR="$PROJECT_ROOT/../agent-w$i"
        STATUS_FILE="$WORKER_DIR/STATUS.txt"
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
                
                # 自动更新 dev-tasks.json（加锁保护）
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
                
                # ===== 将 Worker 分支合并到 dev =====
                echo "[$(date '+%H:%M:%S')] Merging worker-$i to dev..."
                cd "$PROJECT_ROOT"
                
                # 获取最新 dev 和 worker 分支
                git fetch origin dev
                git fetch origin worker-$i 2>/dev/null || true
                
                # 切换到 dev 分支
                git checkout dev
                
                # 尝试合并 worker 分支
                if git merge --no-edit origin/worker-$i -m "feat: merge worker-$i ($TASK_ID)"; then
                    # 推送 dev 分支
                    if git push origin dev; then
                        echo "[$(date '+%H:%M:%S')] Successfully merged worker-$i to dev"
                    else
                        echo "[$(date '+%H:%M:%S')] Warning: Failed to push dev branch"
                    fi
                else
                    # 合并失败，回滚并标记错误
                    echo "[$(date '+%H:%M:%S')] ERROR: Merge conflict! Aborting merge."
                    git merge --abort 2>/dev/null || true
                    # 标记任务为错误，需要人工介入
                    lock
                    python3 << PY
import json
with open('dev-tasks.json', 'r') as f:
    data = json.load(f)
for task in data['tasks']:
    if task['id'] == '$TASK_ID':
        task['status'] = 'error'
        task['error_msg'] = 'Merge conflict to dev branch'
        break
with open('dev-tasks.json', 'w') as f:
    json.dump(data, f, indent=2)
PY
                    unlock
                    echo "error:$TASK_ID" > "$STATUS_FILE"
                    continue
                fi
                
                # 重置 Worker 为 idle，让它可以接新任务
                echo "idle" > "$STATUS_FILE"
            elif [[ "$STATUS" == error:T* ]]; then
                # 失败的任务增加 error_count并重置
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
                echo "idle" > "$STATUS_FILE"
            fi
        fi
    done
    # =================================================

    # 找空闲 Worker
    IDLE_WORKERS=()
    for i in {1..5}; do
        WORKER_DIR="$PROJECT_ROOT/../agent-w$i"
        STATUS_FILE="$WORKER_DIR/STATUS.txt"
        
        if [[ -f "$STATUS_FILE" ]]; then
            STATUS=$(cat "$STATUS_FILE" 2>/dev/null | tr -d '[:space:]' || echo "unknown")
            RUNNING_PID=$(pgrep -f "kimi.*--session=agent-w$i" | head -1 || true)
            
            if [[ "$STATUS" == "idle" && -z "$RUNNING_PID" ]]; then
                IDLE_WORKERS+=("$i")
            elif [[ "$STATUS" == busy* && -z "$RUNNING_PID" ]]; then
                # 检查状态文件修改时间，如果在30秒内被修改，可能是进程还没启动完成
                # 使用 stat 命令获取修改时间（跨平台兼容）
                if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
                    # Windows 环境
                    FILE_AGE=$(( $(date +%s) - $(stat -c %Y "$STATUS_FILE" 2>/dev/null || echo 0) ))
                else
                    # Linux/Mac 环境
                    FILE_AGE=$(( $(date +%s) - $(stat -c %Y "$STATUS_FILE" 2>/dev/null || echo 0) ))
                fi
                
                if [[ $FILE_AGE -gt 30 ]]; then
                    # 超过30秒没有进程，认为是僵尸状态，重置为idle
                    echo "[$(date '+%H:%M:%S')] Worker $i busy but no process for ${FILE_AGE}s, resetting to idle"
                    echo "idle" > "$STATUS_FILE"
                    IDLE_WORKERS+=("$i")
                else
                    echo "[$(date '+%H:%M:%S')] Worker $i starting up (busy for ${FILE_AGE}s), waiting..."
                fi
            fi
        fi
    done

    # 找可执行任务
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

    # 分配任务
    TASK_IDX=0
    for WORKER_ID in "${IDLE_WORKERS[@]}"; do
        TASK_LINE=$(echo "$PENDING_TASKS" | sed -n "$((TASK_IDX+1))p" || true)
        [[ -z "$TASK_LINE" ]] && break
        
        IFS='|' read -r TASK_ID TASK_TITLE <<< "$TASK_LINE"
        
        echo "[$(date '+%H:%M:%S')] Assign $TASK_ID -> Worker $WORKER_ID"
        
        # ===== 分配任务前：把 dev 最新代码同步到 worker 分支 =====
        echo "[$(date '+%H:%M:%S')] Syncing dev -> worker-$WORKER_ID..."
        cd "$PROJECT_ROOT"
        
        # 获取最新 dev
        git fetch origin dev || true
        
        # 切换到 worker 分支
        git checkout worker-$WORKER_ID 2>/dev/null || git checkout -b worker-$WORKER_ID
        
        # 把 dev 的最新代码合并到 worker 分支（确保 agent 在最新代码上开发）
        if ! git merge --no-edit origin/dev -m "sync: merge dev before $TASK_ID"; then
            echo "[$(date '+%H:%M:%S')] Warning: Merge dev to worker-$WORKER_ID failed, continuing anyway"
            git merge --abort 2>/dev/null || true
        fi
        
        # 推送 worker 分支（保存同步状态）
        git push origin worker-$WORKER_ID || true
        
        # 更新 JSON 状态
        lock
        python3 << PY
import json
with open('dev-tasks.json', 'r') as f:
    data = json.load(f)
for task in data['tasks']:
    if task['id'] == '$TASK_ID':
        task['status'] = 'running'
        task['assigned_to'] = 'agent-w$WORKER_ID'
        task['started_at'] = '$(date -u +%Y-%m-%dT%H:%M:%SZ)'
with open('dev-tasks.json', 'w') as f:
    json.dump(data, f, indent=2)
PY
        unlock
        
        WORKER_DIR="$PROJECT_ROOT/../agent-w$WORKER_ID"
        STATUS_FILE="$WORKER_DIR/STATUS.txt"
        echo "busy:$TASK_ID" > "$STATUS_FILE"
        
        # 确保 worktree 中的代码是最新的
        cd "$WORKER_DIR" && git pull origin worker-$WORKER_ID 2>/dev/null || true
        
        (
            cd "$WORKER_DIR"
            if kimi --print --session=agent-w$WORKER_ID -p "Task: $TASK_ID - $TASK_TITLE.

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
        ) >> "$PROJECT_ROOT/logs/agent-w$WORKER_ID.log" 2>&1 &
        
        TASK_IDX=$((TASK_IDX + 1))
        
        while [[ $(pgrep -c kimi) -ge $MAX_WORKERS ]]; do sleep 2; done
        sleep 1
    done

    # 进度报告
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