# PLAN.md - Ralph Loop 多 Agent 架构

## 目标
构建一个去中心化的多 Agent 协作框架，让多个 AI Worker 并行协作完成复杂软件项目，实现任务自动调度、状态同步和并发控制。

## 技术选型
- **调度器**: Bash + Python (轻量，无需额外依赖)
- **状态存储**: JSON 文件 (dev-tasks.json) + 文本文件 (STATUS.txt)
- **并发控制**: 文件锁 (mkdir .lock)
- **Worker 隔离**: Git Worktree (独立工作目录)
- **通信机制**: Symlink + 文件轮询
- **Web GUI**: Python + Flask + 原生 HTML/JS

## 模块拆解

### Phase 1: 核心基础设施 (25%)
1. **目录结构设计**
   - `workflow/` - 中央控制塔（主仓库）
   - `agent-w1/` ~ `agent-w5/` - Worker 工作目录（同级目录）
   - `logs/` - 集中日志存储
   - `.lock/` - 文件锁目录

2. **状态文件设计**
   - `dev-tasks.json` - 任务队列 (JSON 格式)
   - `STATUS.txt` - Worker 状态 (纯文本)
   - `dev-task.lock` - 锁文件
   - Symlink 连接 Worker 到中央任务文件

3. **初始化脚本** (`scripts/init.sh`)
   - 创建 5 个 Git Worktree
   - 创建 Symlink 共享文件
   - 初始化 Worker Git 配置
   - 创建 STATUS.txt

### Phase 2: 调度器实现 (35%)
1. **Ralph Loop 主循环** (`scripts/loop.sh`)
   - 每 5 秒轮询检查
   - 读取 dev-tasks.json 获取任务状态
   - 扫描 5 个 Worker 的 STATUS.txt
   - 自动同步 Worker 完成状态到 JSON

2. **任务分配逻辑**
   - 找 `pending` 且依赖满足的任务
   - 找 `idle` 状态的 Worker
   - 原子更新 JSON: status → running
   - 写入 STATUS.txt: busy:T1
   - 后台启动 Kimi Agent

3. **状态同步机制**
   - 检测 Worker 完成的 `done:T1` 状态
   - 更新 JSON: status → done, 记录 completed_at
   - 重置 Worker: STATUS.txt → idle
   - 处理错误状态 `error:T1`

4. **并发控制**
   - 最大并发数限制 (MAX_WORKERS=3)
   - 进程存在性检查 (pgrep)
   - 崩溃恢复逻辑
   - 文件锁机制 (mkdir .lock)

### Phase 3: 任务生命周期管理 (15%)
1. **任务管理脚本** (`scripts/task-lifecycle.sh`)
   - `add` - 添加新任务
   - `reset` - 重置所有任务为 pending
   - `status` - 查看任务状态列表

2. **状态查询脚本** (`scripts/status.sh`)
   - 快速查看所有 Worker 状态

### Phase 4: Worker 实现 (15%)
1. **Agent 行为指南** (`AGENT.md`)
   - 读取分配给自己的任务
   - 规划 → 开发 → 测试 → 提交
   - 完成后写入 STATUS.txt

2. **Git Worktree 管理**
   - 每个 Worker 独立工作目录
   - 通过 Symlink 读取中央任务
   - 本地 Git 提交，合并到主线

3. **Worker 状态机**
   - `idle` → 可接任务
   - `busy:T1` → 执行中
   - `done:T1` → 已完成 (等待 Loop 回收)
   - `error:T1` → 失败

### Phase 5: Web GUI (10%)
1. **Flask 后端** (`task-gui/app.py`)
   - `GET /api/tasks` - 获取所有任务
   - `POST /api/tasks` - 创建新任务
   - `PUT /api/tasks/<id>` - 更新任务
   - `DELETE /api/tasks/<id>` - 删除任务
   - CORS 支持

2. **前端界面** (`task-gui/index.html`)
   - 任务列表展示
   - 任务 CRUD 操作
   - 状态实时显示

## 接口契约

### dev-tasks.json 结构
```json
{
  "version": "1.0",
  "tasks": [
    {
      "id": "T1",
      "title": "任务名",
      "prompt": "详细需求...",
      "status": "pending|running|done|error",
      "dependencies": ["T2"],
      "assigned_to": "agent-w1",
      "worktree": null,
      "plan_mode": false,
      "started_at": "2026-03-02T10:00:00Z",
      "completed_at": null,
      "error_count": 0
    }
  ]
}
```

### STATUS.txt 格式
```
idle          # 空闲，可接任务
busy:T1       # 正在执行 T1
done:T1       # T1 已完成 (等待 Loop 回收)
error:T1      # T1 失败
```

### 通信流程
```
Loop → dev-tasks.json (写入: status=running, assigned_to=agent-w1)
Loop → STATUS.txt (写入: busy:T1)
Worker → dev-tasks.json (读取: 通过 Symlink)
Worker → STATUS.txt (写入: done:T1)
Loop → STATUS.txt (读取: done:T1)
Loop → dev-tasks.json (写入: status=done, completed_at)
Loop → STATUS.txt (写入: idle)
```

## 文件清单

| 文件 | 说明 |
|------|------|
| `scripts/init.sh` | 初始化 5 个 Worker Worktree |
| `scripts/loop.sh` | Ralph Loop 主调度器 |
| `scripts/status.sh` | 快速查看 Worker 状态 |
| `scripts/task-lifecycle.sh` | 任务生命周期管理 |
| `task-gui/app.py` | Web GUI Flask 后端 |
| `task-gui/index.html` | Web GUI 前端页面 |
| `task-gui/requirements.txt` | Python 依赖 |
| `AGENT.md` | Worker 行为指南 |
| `dev-tasks.json` | 任务队列数据 |

## 验收标准
- [x] 支持 5 个 Worker 并行运行
- [x] 任务依赖自动解析 (T3 等待 T1+T2 完成)
- [x] 并发安全 (文件锁保护 JSON 写入)
- [x] Worker 崩溃自动恢复
- [x] 纯文件系统存储 (无需 Redis/MySQL)
- [x] 水平扩展 (添加 Worker 只需 git worktree add)
- [x] 实时进度报告 (done/pending/running 统计)
- [x] Web GUI 任务管理
- [x] 任务生命周期管理脚本

## 风险评估

| 风险 | 影响 | 对策 |
|------|------|------|
| JSON 并发写入损坏 | 高 | 文件锁机制 (mkdir .lock) |
| Worker 挂起无响应 | 中 | pgrep 检测进程存在性 |
| Loop 崩溃 | 中 | Worker 继续运行，手动重启 Loop |
| 依赖死锁 | 低 | 启动前检查循环依赖 |
| 磁盘 IO 瓶颈 | 低 | JSON 文件小，轮询间隔 5 秒 |

## 使用流程

### 1. 初始化
```bash
./scripts/init.sh
```

### 2. 启动调度器
```bash
./scripts/loop.sh
```

### 3. 管理任务
```bash
# 添加任务
./scripts/task-lifecycle.sh add "任务标题" "详细prompt"

# 查看状态
./scripts/task-lifecycle.sh status

# 重置所有任务
./scripts/task-lifecycle.sh reset
```

### 4. 查看 Worker 状态
```bash
./scripts/status.sh
```

### 5. 启动 Web GUI
```bash
cd task-gui
pip install -r requirements.txt
python app.py
# 访问 http://localhost:5000
```

## 关键命令速查
```bash
# 查看所有 Worker 状态
for i in {1..5}; do echo "w$i: $(cat ../agent-w$i/STATUS.txt)"; done

# 查看任务队列
cat dev-tasks.json | jq '.tasks[] | {id, status, assigned_to}'

# 手动重置所有 Worker
for i in {1..5}; do echo "idle" > ../agent-w$i/STATUS.txt; done

# 查看实时日志
tail -f logs/agent-w*.log logs/ralph.log

# 检查文件锁
ls -la .lock && rmdir .lock
```

## 架构优势
- **无状态 Worker**: 可随时销毁重建，状态全在 JSON
- **去中心化存储**: 文件系统即数据库
- **可观测性**: STATUS.txt + JSON + 日志三层可见
- **容错性**: 单点故障不影响整体
- **扩展性**: 纯 Bash + Python，无复杂依赖
