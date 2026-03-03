# Multi-Agent Workflow

一个面向多 Worker 并行开发的调度仓库。  
本仓库只负责任务编排、状态管理和调度，不承载项目业务代码。

## 架构总览

- `workflow/`：调度仓库（当前仓库）
- `project/`：项目主仓库（真实业务代码仓）
- `workers/w1...wN`：从 `project/` 切出的 `git worktree`

核心原则：

1. 调度逻辑在 `workflow/`
2. 代码开发在 `workers/w*`
3. 分支与集成都发生在 `project/workers` 这条链路，不直接在 `workflow` 仓库里做业务代码合并

## 目录结构

```text
zhaopinweb/
├─ workflow/
│  ├─ config/workflow.env
│  ├─ dev-tasks.json
│  ├─ dev-task.lock
│  ├─ logs/
│  └─ scripts/
│     ├─ init.sh
│     ├─ loop.sh
│     ├─ status.sh
│     ├─ reset.sh
│     └─ task-lifecycle.sh
├─ project/
└─ workers/
   ├─ w1/
   ├─ w2/
   └─ ...
```

## 配置

配置文件路径：

- `workflow/config/workflow.env`
- 也可通过环境变量 `WORKFLOW_CONFIG_FILE` 指定其他配置文件

推荐配置示例：

```bash
WORKFLOW_REMOTE=git@github.com:douzhongdou/multiagent-workflow.git
PROJECT_REMOTE=git@github.com:douzhongdou/zhaopinweb.git
PROJECT_MAIN_BRANCH=main
WORKER_COUNT=1
```

可选配置：

- `PROJECT_REPO`：默认 `../project`
- `DEV_BRANCH`：`loop.sh` 的集成目标分支，默认等于 `PROJECT_MAIN_BRANCH`

## 快速开始

以下命令都在 `workflow/` 目录执行。

### 1) 初始化

```bash
bash scripts/init.sh
```

初始化会完成：

- 校准 `workflow`、`project` 的 `origin`
- 克隆/复用 `project` 仓库
- 按 `WORKER_COUNT` 创建 `workers/w*` worktree
- 为每个 worker 建立 `STATUS.txt`、软链接 `dev-tasks.json` / `dev-task.lock`

### 2) 查看状态

```bash
bash scripts/status.sh
```

### 3) 启动调度循环

```bash
bash scripts/loop.sh
```

### 4) 重置环境

```bash
bash scripts/reset.sh
```

`reset.sh` 只重置项目代码链路（`project + workers`）和任务状态，不重置 `workflow` 仓库代码。

## 任务文件

`dev-tasks.json` 中每个任务至少包含：

- `id`
- `title`
- `prompt`
- `status`（`pending/running/done/error/failed`）
- `dependencies`（可选依赖任务）
- `lock_paths`（可选锁路径，避免并发冲突）

调度器会按依赖与锁冲突规则分配任务，并把 worker 状态写入 `workers/w*/STATUS.txt`。

## 常用任务管理命令

```bash
bash scripts/task-lifecycle.sh add "标题" "详细 prompt" "src/a.ts,src/b.ts"
bash scripts/task-lifecycle.sh status
bash scripts/task-lifecycle.sh retry
bash scripts/task-lifecycle.sh reset
```

## 排障建议

- `loop.sh` 只输出进度不分配任务：
  - 检查 `WORKER_COUNT` 与 `workers/w*` 是否匹配
  - 检查 `workers/w*/STATUS.txt` 是否存在
  - 运行 `bash scripts/status.sh` 查看 worker 进程与状态
- 分支同步失败：
  - 检查 `PROJECT_REMOTE`、`PROJECT_MAIN_BRANCH`、`DEV_BRANCH` 配置
  - 在 `workers/w*` 手动执行 `git fetch` 验证远程可达
- 任务卡死：
  - 运行 `bash scripts/reset.sh` 清理任务状态和 worker 工作区后重试
