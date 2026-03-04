# Multi-Agent Workflow

一个面向多 Worker 并行开发的调度仓库。  
本仓库只负责任务编排、状态管理和调度，不承载项目业务代码。

## 架构总览

- `workflow/`：调度仓库（当前仓库），包含调度逻辑和状态文件
- `project/`：项目主仓库（真实业务代码仓）
- `workers/w1...wN`：从 `project/` 切出的 `git worktree`，用于 Agent 并行开发

核心原则：

1. **调度与执行解耦**：调度逻辑在 `workflow/`，代码开发在 `workers/w*`
2. **状态统一管理**：使用 `dev-tasks.json` 和 `agent-status.json` 管理状态
3. **乐观锁机制**：Agent 在执行前动态规划文件锁 (`dev-task.lock`)，调度器仅做冲突预警，Agent 自主解决 Git 冲突
4. **非阻塞通信**：Worker 与 Scheduler 通过状态文件异步通信，避免管道阻塞

## 目录结构

```text
zhaopinweb/
├─ workflow/
│  ├─ config/workflow.env      # 配置文件
│  ├─ dev-tasks.json           # 任务列表与状态
│  ├─ dev-task.lock            # 动态文件锁
│  ├─ agent-status.json        # Agent 实时状态监控
│  ├─ AGENT.md                 # Agent 操作指南
│  ├─ PLAN.md                  # 待开发项目的规划文档
│  ├─ logs/                    # 运行日志
│  └─ scripts/
│     ├─ init.sh               # 初始化环境
│     ├─ loop.sh               # 核心调度循环
│     ├─ reboot.sh             # 一键重置（强力推荐）
│     ├─ git-reset.sh          # 代码回滚
│     └─ reset.sh              # 状态重置
├─ project/                    # 业务代码主仓库
└─ workers/                    # Agent 工作区
   ├─ w1/
   ├─ w2/
   └─ ...
```

## 快速开始

### 1) 一键初始化与重置 (推荐)

```bash
bash scripts/reboot.sh
```
此命令会依次执行：代码回滚 -> 状态重置 -> 环境初始化。适合每次测试新流程前使用。

### 2) 启动调度循环

```bash
# 标准模式（任务跑完即退出）
bash scripts/loop.sh

# 无限模式（推荐，持续监听新任务）
bash scripts/loop.sh --inf
```
启动后，调度器会：
- 自动读取 `dev-tasks.json`
- 动态规划文件锁
- 分配任务给空闲 Worker
- 自动合并完成的代码到 dev 分支

### 3) 监控状态

- **实时看板**: 查看 `agent-status.json`（或使用 GUI Dashboard）
- **任务进度**: 查看 `dev-tasks.json`
- **详细日志**: `tail -f logs/loop.log` 或 `logs/w*.log`

### 4) 启动 GUI Dashboard (可选)

本项目包含一个可视化的任务监控面板。

```bash
cd task-gui
npm install
npm run dev
```
启动后访问 `http://localhost:5173`，即可实时查看任务状态和 Agent 工作流。

## 任务开发流程

1. **定义任务**: 在 `dev-tasks.json` 中定义任务，支持 `dependencies` 设置依赖。
2. **自动规划**: 任务开始时，Agent 会分析 Prompt 并规划需要修改的文件。
3. **乐观锁并发**: 调度器记录文件锁并预警冲突，但不强制阻塞；Agent 需自主处理 Git Rebase 冲突。
4. **自动集成**: 任务完成后，Loop 会自动将代码 Merge/Rebase 回主分支。

## 关键文件说明

- **`dev-tasks.json`**: 任务的单一数据源。
- **`agent-status.json`**: 记录 Worker 的当前动作（Planning, Working, Idle）和历史操作日志。
- **`PLAN.md`**: 全局技术规划，所有 Agent 都会参考此文件。
- **`AGENT.md`**: Agent 的行为准则和操作手册。

## 常见问题

- **Git 冲突**: 系统采用乐观锁，如果多个 Agent 修改同一文件，后提交的 Agent 需负责解决 Rebase 冲突。
- **Kimi 响应慢**: `loop.sh` 可能会在规划阶段等待 Kimi API 响应，请耐心等待或检查网络。
- **环境清理**: 遇到任何奇怪问题，直接运行 `bash scripts/reboot.sh`。
