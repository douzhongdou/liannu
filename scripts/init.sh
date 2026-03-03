#!/bin/bash
# scripts/init.sh

set -e
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "🚀 初始化 Ralph Loop 架构..."

# 确保锁文件存在（文件占用表）
if [ ! -f "$PROJECT_ROOT/dev-task.lock" ]; then
    cat > "$PROJECT_ROOT/dev-task.lock" << 'EOF'
{
  "version": "1.0",
  "locks": []
}
EOF
    echo "✅ 创建锁表: dev-task.lock"
fi

# 创建5个同级 Worktree（在主仓库同级目录）
for i in {1..5}; do
    WORKTREE_NAME="agent-w$i"
    WORKTREE_PATH="../$WORKTREE_NAME"  # 关键：放到父目录
    BRANCH="worker-$i"
    
    if [ ! -d "$WORKTREE_PATH" ]; then
        # 创建分支
        git branch "$BRANCH" 2>/dev/null || true
        
        # 创建 Worktree（在父目录）
        git worktree add "$WORKTREE_PATH" "$BRANCH"
        
        cd "$WORKTREE_PATH"
        
        # 创建隔离数据目录
        mkdir -p data
        
        # Symlink 共享文件（指向主仓库）
        ln -sf "../workflow/dev-tasks.json" .
        ln -sf "../workflow/dev-task.lock" .
        [ -f "../workflow/api-key.json" ] && ln -sf "../workflow/api-key.json" .
        
        # Symlink AGENT.md（所有 agent 实时读取最新规范）
        ln -sf "../workflow/AGENT.md" .
        
        # NOTE: PROGRESS.md 不在 worktree 里
        # Agent 必须通过 'git -C ../../workflow' 编辑主仓库的 PROGRESS.md
        
        # 初始化状态
        echo "idle" > STATUS.txt
        
        # Git 配置
        git config user.email "worker-$i@ralph.loop"
        git config user.name "Worker $i"
        
        cd "$PROJECT_ROOT"
        
        echo "✅ Worker-$i 就绪 -> $WORKTREE_PATH"
    fi
done

echo ""
echo "目录结构："
echo "  主仓库: $(pwd)"
echo "  Agents: $(cd .. && pwd)/agent-w1 ... agent-w5"
echo ""
echo "启动: ./scripts/loop.sh"
