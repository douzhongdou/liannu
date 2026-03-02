#!/bin/bash
# scripts/status.sh - 查看所有 Worker 状态

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "========================================="
echo "          Ralph Loop Worker 状态         "
echo "========================================="
echo ""

# 检查主仓库任务状态
echo "📋 任务概览:"
python3 << 'PYEOF'
import json
try:
    with open('dev-tasks.json', 'r') as f:
        data = json.load(f)
    tasks = data.get('tasks', [])
    total = len(tasks)
    done = sum(1 for t in tasks if t['status'] == 'done')
    pending = sum(1 for t in tasks if t['status'] == 'pending')
    running = sum(1 for t in tasks if t['status'] == 'running')
    error = sum(1 for t in tasks if t['status'] == 'error')
    print(f"   总计: {total} | 已完成: {done} | 进行中: {running} | 待处理: {pending} | 错误: {error}")
except Exception as e:
    print(f"   无法读取任务文件: {e}")
PYEOF
echo ""

# 显示每个 Worker 状态
echo "👷 Worker 状态:"
echo "-----------------------------------------"
for i in {1..5}; do
    STATUS_FILE="../agent-w$i/STATUS.txt"
    if [[ -f "$STATUS_FILE" ]]; then
        STATUS=$(cat "$STATUS_FILE" 2>/dev/null | tr -d '[:space:]')
        # 检查是否有运行中的 kimi 进程
        RUNNING_PID=$(pgrep -f "kimi.*agent-w$i" | head -1 || true)
        if [[ -n "$RUNNING_PID" ]]; then
            PROC_STATUS="🟢 (PID: $RUNNING_PID)"
        else
            PROC_STATUS="⚫"
        fi
        
        # 根据状态显示不同图标
        case "$STATUS" in
            idle) ICON="⭕" ;;
            busy:*) ICON="🔵" ;;
            done:*) ICON="✅" ;;
            error:*) ICON="❌" ;;
            *) ICON="⚪" ;;
        esac
        
        printf "   %s agent-w%-2s: %-12s %s\n" "$ICON" "$i" "$STATUS" "$PROC_STATUS"
    else
        echo "   ⚠️  agent-w$i: 未初始化"
    fi
done
echo ""
echo "========================================="