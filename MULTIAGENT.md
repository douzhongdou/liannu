# MULTIAGENT.md - Ralph Loop 多 Agent 架构设计

## 1. 目录结构（同级设计）
~/workspace/
├── workflow/              # 中央控制塔（主仓库）
│   ├── dev-tasks.json     # 任务队列真身（JSON 数据库）
│   ├── loop.sh            # Ralph Loop 调度器
│   ├── .lock/             # 文件锁（并发控制）
│   └── logs/              # 集中日志
│
├── agent-w1/              # Worker 1（Git Worktree）
│   ├── .git/              # 指向 workflow/.git
│   ├── dev-tasks.json -> ../workflow/dev-tasks.json  # Symlink（读写任务）
│   ├── STATUS.txt         # Worker 本地状态（idle/busy/done）
│   └── AGENT.md           # Worker 行为指南
│
├── agent-w2/              # Worker 2
├── agent-w3/
├── agent-w4/
└── agent-w5/
plain
复制

**设计原则：控制平面与执行平面分离**
- `workflow/`：只负责调度，不执行代码
- `agent-w*/`：只负责执行，不感知全局（通过 symlink 读取任务）

---

## 2. 核心组件

### 2.1 中央状态文件（dev-tasks.json）
```json
{
  "tasks": [
    {
      "id": "T1",
      "title": "任务名",
      "prompt": "详细需求...",
      "status": "pending|running|done|error",
      "dependencies": ["T2"],
      "assigned_to": "agent-w1",
      "started_at": "2026-03-02T10:00:00Z"
    }
  ]
}
2.2 Worker 状态文件（STATUS.txt）
纯文本，一行表示状态：
idle - 空闲，可接任务
busy:T1 - 正在执行 T1
done:T1 - T1 已完成（等待 Loop 回收）
error:T1 - T1 失败（等待 Loop 处理）
3. 通信机制
3.1 单向数据流（Loop → Worker）
Loop 写入 dev-tasks.json（标记任务为 running + 分配 Worker）
Loop 写入 ../agent-w1/STATUS.txt（busy:T1）
Worker 通过 symlink 读取 ./dev-tasks.json（看到任务详情）
Worker 启动 Kimi Code 执行
3.2 反向信号流（Worker → Loop）
Worker 完成代码开发
Worker 写入 ./STATUS.txt（done:T1 或 error:T1）
Loop 轮询检测（每 5 秒检查所有 STATUS.txt）
Loop 读取 done:T1 后：
更新 dev-tasks.json（标记任务为 done）
重置 STATUS.txt（改为 idle）
Worker 释放，可接新任务
为什么 Worker 不直接写 JSON？
避免并发冲突：5 个 Worker 同时写 JSON 会损坏文件
单点控制：只有 Loop 写 JSON，确保一致性
4. 工作流程（完整生命周期）
plain
复制
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Pending   │────▶│   Running   │────▶│    Done     │
│   (待执行)   │     │   (执行中)   │     │   (已完成)   │
└─────────────┘     └─────────────┘     └─────────────┘
      ▲                                          │
      │                                          ▼
      └──────────── Loop 重置 Worker ◀── Worker 写 STATUS
Phase 1: 任务分配（Loop 执行）
bash
复制
1. Loop 读取 dev-tasks.json，找 pending 且依赖满足的任务
2. Loop 读取 agent-w*/STATUS.txt，找 idle 的 Worker
3. Loop 原子更新 JSON: task.status = "running", task.assigned_to = "agent-w1"
4. Loop 写入 STATUS: echo "busy:T1" > ../agent-w1/STATUS.txt
5. Loop 后台启动 Kimi: cd ../agent-w1 && kimi --yolo -p "..."
Phase 2: 任务执行（Worker 执行）
bash
复制
1. Kimi 启动，读取 ./dev-tasks.json（通过 symlink）
2. Kimi 看到 assigned_to 是自己的任务，开始执行
3. Kimi 在当前目录写代码、运行测试、git commit
4. 完成后，Kimi 写入: echo "done:T1" > STATUS.txt
5. Kimi 进程退出
Phase 3: 状态同步（Loop 检测）
bash
复制
1. Loop 下一轮检查，读取 agent-w1/STATUS.txt 发现 "done:T1"
2. Loop 原子更新 JSON: task.status = "done", task.completed_at = "时间"
3. Loop 重置 Worker: echo "idle" > agent-w1/STATUS.txt
4. Worker 重新进入可用池，可接新任务
5. 并发安全策略
5.1 文件锁（.lock 目录）
谁持有锁：只有 Loop 写 JSON 时需要加锁
实现方式：mkdir .lock（原子操作，Linux 保证互斥）
Worker 不需要锁：Worker 只读 JSON，不写入
5.2 竞态条件防护
plain
复制
场景：Worker 刚写完 done:T1，Loop 还没读取，又接了 T2

防护：
- Worker 状态机：done → idle 转换只能由 Loop 执行
- Loop 单线程：一个时刻只有一个 Loop 实例在运行
- 原子检查：Loop 先读 STATUS，再写 JSON，最后重置 STATUS，三步连续执行
5.3 崩溃恢复
Worker 崩溃：STATUS.txt 保持 busy，Loop 检测到进程不存在后自动重置为 idle
Loop 崩溃：Worker 继续运行直到完成，手动重启 Loop 后继续同步
6. 职责矩阵
表格
职责	Loop (workflow)	Worker (agent-w*)
读取任务	✅ 扫描 JSON	✅ 通过 Symlink
更新任务状态	✅ 唯一写入者	❌ 禁止写入
分配 Worker	✅	❌
执行代码	❌	✅
写 STATUS	✅（重置）	✅（完成时）
Git 提交	❌	✅
日志收集	✅ 集中存储	✅ 本地生成
7. 扩展设计（未来）
7.1 水平扩展
添加 Worker：只需执行 git worktree add ../agent-w6 worker-6
Loop 自动识别：for i in {1..20} 支持任意数量 Worker
7.2 优先级队列
JSON 中添加 priority: 1-5
Loop 排序：sorted(tasks, key=lambda x: (-x['priority'], x['created_at']))
7.3 失败重试
error_count 字段
当 error_count >= 3 时标记为 failed，不再自动重试，人工介入
7.4 Web GUI
独立进程读取 dev-tasks.json（只读，不干扰 Loop）
WebSocket 实时推送状态变更
8. 故障排查 Checklist
表格
现象	原因	解决
Worker 空闲但不分配任务	STATUS 是 error 不是 idle	重置 STATUS
JSON 损坏	并发写入冲突	恢复备份，检查锁机制
Kimi 不启动	PATH 问题	which kimi 检查安装
依赖任务不触发	dependencies 未满足	检查前置任务是否 done
Loop 显示 0 running 但 Kimi 在跑	STATUS 和实际进程不同步	检查 pgrep 逻辑
9. 关键命令速查
bash
复制
# 查看所有 Worker 状态
for i in {1..5}; do echo "w$i: $(cat ../agent-w$i/STATUS.txt)"; done

# 查看任务队列
cat dev-tasks.json | jq '.tasks[] | {id, status, assigned_to}'

# 手动重置所有 Worker
for i in {1..5}; do echo "idle" > ../agent-w$i/STATUS.txt; done

# 查看实时日志
tail -f logs/agent-w*.log

# 检查文件锁（如果 Loop 崩溃残留）
ls -la .lock && rmdir .lock
10. 架构优势
无状态 Worker：Worker 可随时销毁重建，状态全在 JSON
去中心化存储：不需要 Redis/MySQL，文件系统即数据库
可观测性：STATUS.txt + JSON + 日志，三层可见
容错性：单点故障不影响整体（Worker 挂掉换另一个）
扩展性：纯 Bash + Python，无复杂依赖