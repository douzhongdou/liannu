#!/bin/bash
# 任务生命周期管理工具

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

case "$1" in
    "add")
        # 添加新任务：./scripts/task-lifecycle.sh add "任务标题" "详细prompt" "src/a.ts,src/b.ts"
        TASK_ID="T$(date +%s)"
        TITLE="$2"
        PROMPT="$3"
        LOCK_PATHS_RAW="$4"
        
        python3 << PYEOF
import json
with open('task.json', 'r') as f:
    data = json.load(f)

raw_lock_paths = """$LOCK_PATHS_RAW"""
lock_paths = []
for part in raw_lock_paths.replace(';', ',').split(','):
    item = part.strip()
    if item:
        lock_paths.append(item)

data['tasks'].append({
    "id": "$TASK_ID",
    "title": "$TITLE", 
    "prompt": "$PROMPT",
    "lock_paths": lock_paths,
    "status": "pending",
    "dependencies": [],
    "assigned_to": None,
    "worktree": None,
    "plan_mode": False,
    "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "started_at": None,
    "completed_at": None,
    "error_count": 0
})

with open('task.json', 'w') as f:
    json.dump(data, f, indent=2)
print(f"添加任务: $TASK_ID")
PYEOF
        ;;
        
    "reset")
        # 重置所有任务为pending（重新开始）
        python3 << 'PYEOF'
import json
with open('task.json', 'r') as f:
    data = json.load(f)

for t in data['tasks']:
    t['status'] = 'pending'
    t['assigned_to'] = None
    t['worktree'] = None
    t['started_at'] = None
    t['completed_at'] = None
    t['error_count'] = 0

with open('task.json', 'w') as f:
    json.dump(data, f, indent=2)
print("所有任务已重置为pending")
PYEOF
        cat > "$PROJECT_ROOT/task.lock" << 'EOF'
{
  "version": "1.0",
  "locks": []
}
EOF
        rm -f "$PROJECT_ROOT/task.lock.guard"
        
        # 重置所有worker状态
        for i in {1..5}; do
            if [ -f "../workers/w$i/STATUS.txt" ]; then
                echo "idle" > "../workers/w$i/STATUS.txt"
            fi
        done
        ;;
        
    "status")
        # 查看状态
        python3 << 'PYEOF'
import json
from datetime import datetime

with open('task.json', 'r') as f:
    data = json.load(f)

print(f"{'ID':<8} {'Status':<10} {'Worker':<8} {'Title'}")
print("-" * 60)
for t in data['tasks']:
    lock_paths = ",".join(t.get('lock_paths', []))
    print(f"{t['id']:<8} {t['status']:<10} {str(t.get('assigned_to','')):<8} {t['title'][:24]} [{lock_paths}]")
PYEOF
        ;;
        
    "retry")
        # 重置失败/错误的任务为 pending，允许重试
        python3 << 'PYEOF'
import json
with open('task.json', 'r') as f:
    data = json.load(f)

reset_count = 0
for t in data['tasks']:
    if t['status'] in ['error', 'failed']:
        t['status'] = 'pending'
        t['assigned_to'] = None
        t['worktree'] = None
        t['started_at'] = None
        t['completed_at'] = None
        reset_count += 1

with open('task.json', 'w') as f:
    json.dump(data, f, indent=2)
print(f"已重置 {reset_count} 个失败任务为 pending")
PYEOF
        cat > "$PROJECT_ROOT/task.lock" << 'EOF'
{
  "version": "1.0",
  "locks": []
}
EOF
        rm -f "$PROJECT_ROOT/task.lock.guard"
        
        # 重置所有 worker 状态
        for i in {1..5}; do
            if [ -f "../workers/w$i/STATUS.txt" ]; then
                echo "idle" > "../workers/w$i/STATUS.txt"
            fi
        done
        ;;
        
    *)
        echo "用法: $0 {add|reset|retry|status}"
        echo "  add \"标题\" \"prompt\" \"lock_paths\" - 添加任务，可选锁文件列表"
        echo "  reset               - 重置所有任务为 pending"
        echo "  retry               - 重置失败任务为 pending，允许重试"
        echo "  status              - 查看任务状态"
        ;;
esac
