#!/bin/bash
# scripts/reset-all.sh - 重置所有分支和任务状态

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "========================================="
echo "      重置所有分支和任务状态"
echo "========================================="
echo ""

# 1. 获取最新的 main 分支
echo "[1/4] 获取 main 分支最新状态..."
git fetch origin main

# 2. 重置所有远程分支为 main
echo "[2/4] 重置远程分支为 main..."
for branch in dev worker-1 worker-2 worker-3 worker-4 worker-5; do
    echo "  - 重置 $branch 分支..."
    git push origin origin/main:$branch --force 2>/dev/null || echo "    (分支 $branch 可能不存在，跳过)"
done

# 3. 重置本地分支
echo "[3/4] 重置本地分支..."
git checkout main 2>/dev/null || git checkout -b main origin/main

# 删除本地 worker 分支
for i in {1..5}; do
    git branch -D worker-$i 2>/dev/null || true
done
git branch -D dev 2>/dev/null || true

# 4. 重置 dev-tasks.json 任务状态
echo "[4/4] 重置任务状态..."
python3 << 'PYEOF'
import json
from datetime import datetime

try:
    with open('dev-tasks.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # 重置所有任务状态
    for task in data.get('tasks', []):
        task['status'] = 'pending'
        task['assigned_to'] = None
        task['worktree'] = None
        task['started_at'] = None
        task['completed_at'] = None
        task['error_count'] = 0
        # 保留: id, title, prompt, dependencies, plan_mode
    
    with open('dev-tasks.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"  ✓ 已重置 {len(data.get('tasks', []))} 个任务状态")
except Exception as e:
    print(f"  ✗ 重置失败: {e}")
PYEOF

# 5. 重置所有 worker 的 STATUS.txt
echo "[额外] 重置 Worker 状态..."
for i in {1..5}; do
    WORKER_DIR="$PROJECT_ROOT/../agent-w$i"
    if [[ -f "$WORKER_DIR/STATUS.txt" ]]; then
        echo "idle" > "$WORKER_DIR/STATUS.txt"
        echo "  ✓ agent-w$i 已重置为 idle"
    fi
done

# 6. 清理可能的锁文件
rm -f "$PROJECT_ROOT/dev-task.lock"

echo ""
echo "========================================="
echo "           重置完成！"
echo "========================================="
echo ""
echo "当前状态:"
echo "  - 所有分支已重置为 main"
echo "  - 所有任务状态已重置为 pending"
echo "  - 所有 worker 已重置为 idle"
echo ""
echo "可以重新运行 ./scripts/loop.sh 开始新任务"
