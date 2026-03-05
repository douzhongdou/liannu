# 连弩 · LianNu

**🎯 多 Agent 并行代码开发系统**  
*一令既出，万码齐发 | 智能调度 | 并行执行*

---
**连弩** 是一套面向多 Agent 并行开发的智能调度系统，通过解耦调度逻辑与业务执行、引入动态文件锁机制、实现全生命周期状态监控，最大化开发效率，最小化协作冲突。

无论你是管理多团队并行开发，还是构建自动化 CI/CD 流水线，这套系统都能为你提供稳定、高效、可扩展的任务编排能力。

## 架构总览

- `workflow/`：调度仓库（当前仓库），包含调度逻辑和状态文件
- `project/`：项目主仓库（真实业务代码仓）
- `workers/w1...wN`：从 `project/` 切出的 `git worktree`，用于 Agent 并行开发

核心原则：

1. **调度与执行解耦**：调度逻辑在 `workflow/`，代码开发在 `workers/w*`
2. **状态统一管理**：使用 `task.json` 和 `agent-status.json` 管理状态
3. **乐观锁机制**：Agent 在执行前动态规划文件锁 (`task.lock`)，调度器仅做冲突预警，Agent 自主解决 Git 冲突
4. **非阻塞通信**：Worker 与 Scheduler 通过状态文件异步通信，避免管道阻塞

## 目录结构

```text
dir/
├─ workflow/
│  ├─ config/
│  │  └─ example-workflow.env  # 配置示例（改名为 workflow.env 使用）
│  ├─ example-task.json        # 任务列表示例
│  ├─ example-task.lock        # 文件锁示例
│  ├─ task.json                # 本地任务列表（gitignored）
│  ├─ tasks.lock               # 本地文件锁（gitignored）
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

## 环境准备

本项目采用「示例文件 + 本地配置」模式，便于开源协作同时保护私有配置：

| 文件类型 | 示例文件 | 本地使用 | 说明 |
|---------|---------|---------|------|
| 配置文件 | `config/example-workflow.env` | `config/workflow.env` | 工作流配置 |
| 任务列表 | `example-task.json` | `task.json` | 定义开发任务 |
| 文件锁 | `example-task.lock` | `tasks.lock` | 运行时自动生成 |

**快速准备：**
```bash
# 1. 复制配置文件
cp config/example-workflow.env config/workflow.env

# 2. 复制任务文件
cp example-task.json task.json
cp example-task.lock tasks.lock

# 3. 编辑你自己的配置
code config/workflow.env
```

---

## 配置说明

在使用前，请先编辑 `config/workflow.env` 文件：

```bash
# 工作流仓库的远程地址（用于同步调度逻辑）
WORKFLOW_REMOTE=git@github.com:your-username/your-workflow.git

# 项目主仓库的远程地址（真实业务代码）
PROJECT_REMOTE=git@github.com:your-username/your-project.git

# 项目主分支名称
PROJECT_MAIN_BRANCH=main

# Worker 数量（并行开发的 Agent 数量）
WORKER_COUNT=5
```

**配置项说明：**

| 配置项 | 说明 | 示例 |
|--------|------|------|
| `WORKFLOW_REMOTE` | 当前调度仓库的 Git 远程地址 | `git@github.com:your-username/your-workflow.git` |
| `PROJECT_REMOTE` | 业务代码仓库的 Git 远程地址 | `git@github.com:your-username/your-project.git` |
| `PROJECT_MAIN_BRANCH` | 项目主分支名称 | `main` 或 `master` |
| `WORKER_COUNT` | 并行 Worker 数量 | `3` ~ `10` |

## 选择 LLM 提供商

支持通过环境变量切换 LLM：

```bash
# 使用 Kimi（默认）
bash scripts/loop.sh

# 使用 Claude
LLM_PROVIDER=claude bash scripts/loop.sh

# 或在 workflow.env 中设置
# LLM_PROVIDER=claude
```

## 安装 CLI 工具

- **Kimi**: 安装 [Kimi Code CLI](https://www.kimi.com/code)，执行 `kimi login`
- **Claude**: 安装 Claude Code CLI，执行 `claude login`

确保对应 CLI 已安装并登录，工作流才能自动执行。

## 快速开始

### 1) 一键初始化与重置 (推荐)

```bash
bash scripts/reboot.sh
```
此命令会依次执行：代码回滚 → 状态重置 → 环境初始化。适合每次测试新流程前使用。

### 2) 启动调度循环

```bash
# 标准模式（任务跑完即退出）
bash scripts/loop.sh

# 无限模式（推荐，持续监听新任务）
bash scripts/loop.sh --inf
```
启动后，调度器会：
- 自动读取 `task.json`
- 动态规划文件锁
- 分配任务给空闲 Worker
- 自动合并完成的代码到 dev 分支

### 3) 监控状态

- **实时看板**: 查看 `agent-status.json`（或使用 GUI Dashboard）
- **任务进度**: 查看 `task.json`
- **详细日志**: `tail -f logs/loop.log` 或 `logs/w*.log`

### 4) 启动 GUI Dashboard (可选)

本项目包含一个可视化的任务监控面板。

```bash
cd task-gui
npm install
npm run dev
```
启动后访问 `http://localhost:3000`，即可实时查看任务状态和 Agent 工作流。

## 任务开发流程

1. **定义任务**: 在 `task.json` 中定义任务，支持 `dependencies` 设置依赖。
2. **自动规划**: 任务开始时，Agent 会分析 Prompt 并规划需要修改的文件。
3. **乐观锁并发**: 调度器记录文件锁并预警冲突，但不强制阻塞；Agent 需自主处理 Git Rebase 冲突。
4. **自动集成**: 任务完成后，Loop 会自动将代码 Merge/Rebase 回主分支。

## 关键文件说明

- **`task.json`**: 任务的单一数据源。
- **`agent-status.json`**: 记录 Worker 的当前动作（Planning, Working, Idle）和历史操作日志。
- **`PLAN.md`**: 全局技术规划，所有 Agent 都会参考此文件。
- **`AGENT.md`**: Agent 的行为准则和操作手册。

## 常见问题

**Q: 如何处理文件冲突？**  
A: 本系统采用乐观锁机制。当多个 Worker 尝试修改同一文件时，调度器会在 `task.lock` 中标记冲突，并在日志中预警。Agent 需要自主执行 `git rebase` 解决冲突。

**Q: Worker 崩溃了怎么办？**  
A: 调度器会定期检测 Worker 心跳。若 Worker 异常退出，其持有的文件锁会自动释放，任务会重新进入待分配队列。

**Q: 可以动态添加 Worker 吗？**  
A: 可以。只需在 `config/workflow.env` 中增加 `WORKERS` 列表，然后重启 `loop.sh` 即可。

**Q: 如何调试单个任务？**  
A: 推荐在 `workers/w1` 目录下手动执行命令，模拟 Agent 行为。调试完成后，再集成到自动化流程中。

---

<div align="center">

**🏹 运筹帷幄，万码齐发！**

</div>
