#!/bin/bash

# 获取脚本所在目录的上一级目录，即 workflow 根目录
WORKFLOW_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_REPO="$(cd "$WORKFLOW_ROOT/../project" && pwd)"
WORKERS_ROOT="$(cd "$WORKFLOW_ROOT/../workers" && pwd)"
TARGET_COMMIT="3101b8f"

echo "=================================================="
echo "⚠️  WARNING: This will HARD RESET all repositories"
echo "Target Commit: $TARGET_COMMIT"
echo "=================================================="
echo ""

# 1. Reset Main Project Repo
echo "[1/4] Resetting Main Project Repo ($PROJECT_REPO)..."
if [ -d "$PROJECT_REPO" ]; then
    cd "$PROJECT_REPO"
    
    # 确保我们在 main 分支
    git checkout main || git checkout -b main
    
    # 强制 fetch 确保有这个 commit (虽然通常本地就有)
    # git fetch origin main
    
    # Hard Reset
    if git reset --hard "$TARGET_COMMIT"; then
        echo "✅ Local reset successful."
    else
        echo "❌ Failed to reset local repo. Commit $TARGET_COMMIT might not exist."
        exit 1
    fi
    
    # Force Push to Remote
    echo "Pushing to remote (origin main)..."
    if git push origin main --force; then
        echo "✅ Remote push successful."
    else
        echo "⚠️  Remote push failed (maybe no remote or network issue)."
    fi
    
    # 如果有 dev 分支，也重置它，或者删除它
    if git show-ref --verify --quiet refs/heads/dev; then
        echo "Resetting dev branch..."
        git branch -f dev "$TARGET_COMMIT"
        git push origin dev --force 2>/dev/null || true
    fi
else
    echo "❌ Project repo not found at $PROJECT_REPO"
    exit 1
fi

# 2. Reset Workers
echo ""
echo "[2/4] Resetting Workers..."
if [ -d "$WORKERS_ROOT" ]; then
    # 遍历所有 w* 目录
    for d in "$WORKERS_ROOT"/w*; do
        if [ -d "$d" ]; then
            WORKER_NAME=$(basename "$d")
            echo "  - Resetting $WORKER_NAME..."
            # 强制清理 worker 的工作区
            git -C "$d" clean -fdx 2>/dev/null || true
            git -C "$d" reset --hard "$TARGET_COMMIT" 2>/dev/null || true
            # 切换回 worker 分支或者 detach
            # git -C "$d" checkout "$TARGET_COMMIT"
        fi
    done
else
    echo "No workers directory found, skipping."
fi

# 3. Reset Task Status (dev-tasks.json)
echo ""
echo "[3/4] Resetting Task Status (dev-tasks.json)..."
TASKS_FILE="$WORKFLOW_ROOT/dev-tasks.json"
if [ -f "$TASKS_FILE" ]; then
    python3 - "$TASKS_FILE" << 'PY'
import json
import sys

file_path = sys.argv[1]
try:
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    if 'tasks' in data:
        for task in data['tasks']:
            # 重置所有状态字段
            task['status'] = 'pending'
            task['assigned_to'] = None
            task['started_at'] = None
            task['completed_at'] = None
            task['error_count'] = 0
            task['error_msg'] = None
            task['work_branch'] = None
            task['plan_mode'] = True # 确保重置回 plan_mode
            
            # 如果是 T1, T2, T3 等基础任务，确保依赖也被清理（如果需要）
            # 这里只重置状态，不修改任务定义本身
            
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print("✅ dev-tasks.json reset to pending state.")
except Exception as e:
    print(f"❌ Failed to reset dev-tasks.json: {e}")
PY
else
    echo "dev-tasks.json not found."
fi

# 4. Clean Locks
echo ""
echo "[4/4] Cleaning Locks..."
LOCK_FILE="$WORKFLOW_ROOT/dev-task.lock"
echo '{"version": "1.0", "locks": []}' > "$LOCK_FILE"
rm -f "$WORKFLOW_ROOT/dev-task.lock.guard"
echo "✅ Locks cleared."

echo ""
echo "🎉 All Done! Workflow is reset to $TARGET_COMMIT."
