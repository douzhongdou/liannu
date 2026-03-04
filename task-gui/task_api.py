#!/usr/bin/env python3
"""
Task GUI Flask API
提供任务和执行者数据给前端
"""

import json
import os
from datetime import datetime
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
# 配置 CORS - 允许所有来源
CORS(app, resources={
    r"/api/*": {
        "origins": "*",
        "methods": ["GET", "OPTIONS"],
        "allow_headers": ["Content-Type", "Accept"]
    }
})

# 数据文件路径（读取上级目录的数据文件）
TASKS_FILE = os.path.join(os.path.dirname(__file__), "..", "dev-tasks.json")
LOCK_FILE = os.path.join(os.path.dirname(__file__), "..", "dev-task.lock")

# 状态映射：后端状态 -> 前端状态
STATUS_MAPPING = {
    "pending": "pending",
    "in_progress": "running",
    "done": "completed",
    "error": "failed",
    "ready_to_integrate": "ready_to_integrate",
    # 前端状态也保留
    "running": "running",
    "completed": "completed",
    "failed": "failed"
}


def load_json_file(filepath):
    """加载 JSON 文件"""
    if not os.path.exists(filepath):
        print(f"[API] File not found: {filepath}")
        return None
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
            print(f"[API] Loaded file: {filepath}, size: {len(content)} bytes")
            return json.loads(content)
    except (json.JSONDecodeError, IOError) as e:
        print(f"[API] Error loading {filepath}: {e}")
        return None


def convert_task_status(task):
    """转换任务状态为前端期望的格式"""
    backend_status = task.get("status", "pending")
    frontend_status = STATUS_MAPPING.get(backend_status, backend_status)
    task["status"] = frontend_status
    return task


def get_tasks():
    """获取所有任务"""
    data = load_json_file(TASKS_FILE)
    if data and "tasks" in data:
        # 转换所有任务的状态
        tasks = [convert_task_status(task) for task in data["tasks"]]
        return {
            "version": data.get("version", "1.0"),
            "tasks": tasks
        }
    return {"version": "1.0", "tasks": []}


def get_locks():
    """获取所有锁（执行者）信息"""
    data = load_json_file(LOCK_FILE)
    if data:
        return data
    return {"version": "1.0", "locks": []}


@app.before_request
def log_request():
    """记录请求日志"""
    if request.path.startswith('/api/'):
        print(f"[API] {request.method} {request.path} from {request.remote_addr}")


@app.route("/api/tasks", methods=["GET"])
def api_tasks():
    """获取任务列表 API"""
    result = get_tasks()
    print(f"[API] Returning {len(result['tasks'])} tasks")
    return jsonify(result)


@app.route("/api/locks", methods=["GET"])
def api_locks():
    """获取执行者锁信息 API"""
    result = get_locks()
    print(f"[API] Returning {len(result['locks'])} locks")
    return jsonify(result)


@app.route("/api/dashboard", methods=["GET"])
def api_dashboard():
    """获取仪表盘数据（任务 + 执行者）"""
    tasks_data = get_tasks()
    locks_data = get_locks()
    
    # 计算统计信息
    tasks = tasks_data.get("tasks", [])
    stats = {
        "total": len(tasks),
        "pending": sum(1 for t in tasks if t["status"] == "pending"),
        "running": sum(1 for t in tasks if t["status"] == "running"),
        "completed": sum(1 for t in tasks if t["status"] == "completed"),
        "failed": sum(1 for t in tasks if t["status"] == "failed"),
        "ready_to_integrate": sum(1 for t in tasks if t["status"] == "ready_to_integrate"),
    }
    
    # 获取工作中的执行者
    workers = {}
    for lock in locks_data.get("locks", []):
        worker_id = lock.get("worker")
        if worker_id not in workers:
            workers[worker_id] = {
                "id": worker_id,
                "name": worker_id,
                "tasks": [],
                "paths": lock.get("paths", [])
            }
        workers[worker_id]["tasks"].append(lock.get("task_id"))
    
    return jsonify({
        "tasks": tasks_data,
        "locks": locks_data,
        "stats": stats,
        "workers": list(workers.values()),
        "timestamp": datetime.utcnow().isoformat() + "Z"
    })


@app.route("/api/health", methods=["GET"])
def api_health():
    """健康检查"""
    return jsonify({
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat() + "Z"
    })


if __name__ == "__main__":
    print("=" * 50)
    print("Task API Server")
    print("=" * 50)
    print(f"Tasks file: {TASKS_FILE}")
    print(f"Lock file: {LOCK_FILE}")
    print("")
    print("API endpoints:")
    print("  - GET http://localhost:5000/api/tasks     - 任务列表")
    print("  - GET http://localhost:5000/api/locks     - 执行者锁信息")
    print("  - GET http://localhost:5000/api/dashboard - 仪表盘数据")
    print("  - GET http://localhost:5000/api/health    - 健康检查")
    print("=" * 50)
    print("")
    
    # 测试加载数据
    tasks_test = get_tasks()
    locks_test = get_locks()
    print(f"[Startup] Loaded {len(tasks_test['tasks'])} tasks, {len(locks_test['locks'])} locks")
    
    app.run(host="0.0.0.0", port=5000, debug=True)
