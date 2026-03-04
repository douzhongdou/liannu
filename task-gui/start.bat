@echo off
chcp 65001 >nul
REM Task GUI 启动脚本 - 同时启动前后端 (Windows)

echo ==========================================
echo   Task GUI 启动脚本
echo ==========================================

REM 检查 Python
echo.
echo [1/3] 检查 Python 环境...
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误: 未找到 python，请先安装 Python 3
    exit /b 1
)
for /f "tokens=*" %%a in ('python --version') do set PYTHON_VERSION=%%a
echo ✅ Python 版本: %PYTHON_VERSION%

REM 检查并安装 Python 依赖
echo.
echo [2/3] 检查 Python 依赖...
python -c "import flask, flask_cors" >nul 2>&1
if errorlevel 1 (
    echo 📦 安装 Python 依赖...
    pip install -q -r requirements.txt
)
echo ✅ Python 依赖已就绪

REM 检查 Node 依赖
echo.
echo [3/3] 检查 Node 依赖...
if not exist "node_modules" (
    echo 📦 安装 Node 依赖...
    pnpm install
)
echo ✅ Node 依赖已就绪

REM 启动服务
echo.
echo ==========================================
echo   启动服务...
echo ==========================================
echo.
echo 🌐 前端: http://localhost:3000
echo 🔌 后端 API: http://localhost:5000
echo.
echo 按 Ctrl+C 停止所有服务
echo.

REM 使用 concurrently 启动
pnpm concurrently "python task_api.py" "vite" --names "API,WEB" --prefix-colors "bgBlue.bold,bgGreen.bold"
