#!/bin/bash
# scripts/reset-all.sh - 重置所有分支和任务状态

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG_FILE="${WORKFLOW_CONFIG_FILE:-$PROJECT_ROOT/config/workflow.env}"

if [ -f "$CONFIG_FILE" ]; then
    set -a
    . "$CONFIG_FILE"
    set +a
fi

PROJECT_MAIN_BRANCH="${PROJECT_MAIN_BRANCH:-main}"
PROJECT_REPO="${PROJECT_REPO:-$PROJECT_ROOT/../project}"
DEV_BRANCH="${DEV_BRANCH:-$PROJECT_MAIN_BRANCH}"
WORKER_COUNT="${WORKER_COUNT:-5}"

echo "========================================="
echo "      重置所有分支和任务状态"
echo "========================================="
echo ""

if ! git -C "$PROJECT_REPO" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "ERROR: 无效项目仓库路径: $PROJECT_REPO"
    exit 1
fi

echo "[1/6] 获取项目仓库最新状态..."
git -C "$PROJECT_REPO" fetch origin "$PROJECT_MAIN_BRANCH"
git -C "$PROJECT_REPO" fetch origin "$DEV_BRANCH" 2>/dev/null || true

echo "[2/6] 重置项目远程分支..."
if [[ "$DEV_BRANCH" != "$PROJECT_MAIN_BRANCH" ]]; then
    for branch in "$DEV_BRANCH"; do
        echo "  - 重置 $branch 分支..."
        git -C "$PROJECT_REPO" push origin "origin/$PROJECT_MAIN_BRANCH:$branch" --force 2>/dev/null || echo "    (分支 $branch 可能不存在，跳过)"
    done
fi
for i in $(seq 1 "$WORKER_COUNT"); do
    branch="worker-$i"
    echo "  - 重置 $branch 分支..."
    git -C "$PROJECT_REPO" push origin "origin/$PROJECT_MAIN_BRANCH:$branch" --force 2>/dev/null || echo "    (分支 $branch 可能不存在，跳过)"
done

echo "[3/6] 重置项目本地分支和工作区..."
git -C "$PROJECT_REPO" checkout "$PROJECT_MAIN_BRANCH" 2>/dev/null || git -C "$PROJECT_REPO" checkout -b "$PROJECT_MAIN_BRANCH" "origin/$PROJECT_MAIN_BRANCH"
git -C "$PROJECT_REPO" reset --hard "origin/$PROJECT_MAIN_BRANCH" 2>/dev/null || true
git -C "$PROJECT_REPO" clean -fd

for i in $(seq 1 "$WORKER_COUNT"); do
    git -C "$PROJECT_REPO" branch -D worker-$i 2>/dev/null || true
done
if [[ "$DEV_BRANCH" != "$PROJECT_MAIN_BRANCH" ]]; then
    git -C "$PROJECT_REPO" branch -D "$DEV_BRANCH" 2>/dev/null || true
fi

echo "[4/6] 重置 worker 工作树代码..."
for i in $(seq 1 "$WORKER_COUNT"); do
    WORKER_DIR="$PROJECT_ROOT/../workers/w$i"
    if [[ -e "$WORKER_DIR/.git" ]]; then
        git -C "$WORKER_DIR" fetch origin "worker-$i" 2>/dev/null || true
        git -C "$WORKER_DIR" checkout "worker-$i" 2>/dev/null || true
        git -C "$WORKER_DIR" reset --hard "origin/worker-$i" 2>/dev/null || git -C "$WORKER_DIR" reset --hard "origin/$PROJECT_MAIN_BRANCH" 2>/dev/null || true
        git -C "$WORKER_DIR" clean -fd
    fi
done

echo "[5/6] 重置任务状态..."
cd "$PROJECT_ROOT"
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

echo "[额外] 重置 Worker 状态..."
for i in $(seq 1 "$WORKER_COUNT"); do
    WORKER_DIR="$PROJECT_ROOT/../workers/w$i"
    if [[ -f "$WORKER_DIR/STATUS.txt" ]]; then
        echo "idle" > "$WORKER_DIR/STATUS.txt"
        echo "  ✓ w$i 已重置为 idle"
    fi
done

echo "[6/6] 重置锁表..."
cat > "$PROJECT_ROOT/dev-task.lock" << 'EOF'
{
  "version": "1.0",
  "locks": []
}
EOF
rm -f "$PROJECT_ROOT/dev-task.lock.guard"

echo ""
echo "========================================="
echo "           重置完成！"
echo "========================================="
echo ""
echo "当前状态:"
echo "  - 项目仓库分支已重置为 $PROJECT_MAIN_BRANCH"
echo "  - 所有任务状态已重置为 pending"
echo "  - 所有 worker 已重置为 idle"
echo ""
echo "可以重新运行 ./scripts/loop.sh 开始新任务"
