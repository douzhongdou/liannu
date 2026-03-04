#!/bin/bash
# Task GUI 启动脚本 - 同时启动前后端

echo "=========================================="
echo "  Task GUI 启动脚本"
echo "=========================================="

# 检查 Python
echo ""
echo "[1/3] 检查 Python 环境..."
if ! command -v python3 &> /dev/null; then
    echo "❌ 错误: 未找到 python3，请先安装 Python 3"
    exit 1
fi
PYTHON_VERSION=$(python3 --version)
echo "✅ Python 版本: $PYTHON_VERSION"

# 检查并安装 Python 依赖
echo ""
echo "[2/3] 检查 Python 依赖..."
if ! python3 -c "import flask, flask_cors" 2>/dev/null; then
    echo "📦 安装 Python 依赖..."
    pip3 install -q -r requirements.txt
    if [ $? -ne 0 ]; then
        echo "⚠️  pip 安装失败，尝试使用 pip3..."
        pip3 install -q -r requirements.txt
    fi
fi
echo "✅ Python 依赖已就绪"

# 安装 Node 依赖（如果需要）
echo ""
echo "[3/3] 检查 Node 依赖..."
if [ ! -d "node_modules" ]; then
    echo "📦 安装 Node 依赖..."
    pnpm install
fi
echo "✅ Node 依赖已就绪"

# 启动服务
echo ""
echo "=========================================="
echo "  启动服务..."
echo "=========================================="
echo ""
echo "🌐 前端: http://localhost:3000"
echo "🔌 后端 API: http://localhost:5000"
echo ""
echo "按 Ctrl+C 停止所有服务"
echo ""

# 使用 concurrently 启动
pnpm concurrently \
    "python3 task_api.py" \
    "vite" \
    --names "API,WEB" \
    --prefix-colors "bgBlue.bold,bgGreen.bold"
