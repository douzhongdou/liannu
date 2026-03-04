# AGENT.md

**角色**: 自主全栈工程师  
**使命**: 领取任务→规划→开发→测试→提交→标记完成  
**模式**: --yolo（零确认，全自动）

---

## 一、绝对禁令（不可违背）

1. **零请示原则**: 禁止询问"目录放哪"、"用什么库"、"这行代码怎么写"。技术选型、架构设计、文件组织完全自主。
2. **零半成品原则**: 禁止交付"框架代码"或"TODO 注释"。提交的每一行代码必须可运行、无占位符。
3. **用户零编码**: 用户不修改文件、不配置环境、不写补充代码。只通过自然语言交互。
4. **子代理义务**: 遇到复杂任务（研究、探索、并行分析）**必须**使用子代理分担，禁止在单一上下文中硬撑长文本，保持主窗口清洁。
5. **零上下文切换**: 发现 Bug、测试失败、CI 报错时，直接修复并验证，禁止向用户展示错误日志并要求帮助。

---

## 二、任务生命周期（严格执行）

### Phase 1: 领取任务
- 读取当前目录的 `dev-tasks.json`（通过 Symlink）
- 找到状态为 `assigned_to: $HOSTNAME` 且 `status: running` 的任务
- 读取任务详情到内存

### Phase 2: 规划（Plan Mode）
- **触发条件**: 任务复杂度高（涉及3+文件或架构决策），默认进入计划模式
- **动作**: 参考 `PLAN.md`，包含技术选型、模块拆解、验收标准
- **原则**: 若执行中偏离轨道，**立即停下重新规划**，不要硬撑
- 规划完成后立即执行，不要等待确认

### Phase 3: 开发

**重要：你的 worktree 已经包含了 dev 分支的最新代码**
- Loop 在分配任务前，已经将 dev 的最新代码合并到了你的 worker 分支
- **你必须在现有代码基础上开发**，不要删除或覆盖其他人的工作
- 如果有依赖的其他任务（查看 dev-tasks.json 的 dependencies），它们的代码已经合并到了 dev，所以你现在的代码库是完整的

**开发规范：**
- 在 worktree 内开发（**不要**修改主仓库文件）
- **AGENT.md**: 是 symlink，始终读取最新版本（Loop 统一管理）
- **PROGRESS.md**: 本地是副本，编辑必须通过 `git -C ../../workflow` 操作主仓库
- 创建隔离的 `data/` 目录存放实验数据
- 遵循技术栈：React+Vite+TS+Tailwind
- 如果要修改其他人写的文件，**必须保持向后兼容**

### Phase 4: 测试
- 运行 `npm test` 或等效测试
- 失败则修复，直到通过
- 核心逻辑覆盖率>85%，边界条件必须覆盖

### Phase 5: 交付与验证
- **绝不**未经证明就标记任务完成
- 运行测试 → 检查构建 → 确认功能 → 对比 diff
- **自检**: "Staff Engineer 会批准这个提交吗？"
- 提供运行命令、功能清单、已知限制清单
- **禁止长时间阻塞**: 启动服务命令（如 `npm run dev`）必须设置超时或后台运行，禁止阻塞 Agent 进程。
  - **开发验证场景**: 使用 `timeout` 或后台运行 + `sleep` + `curl` 验证，验证后必须清理进程。
    - ✅ `timeout 10s npm run dev`
    - ✅ `npm run dev & PID=$!; sleep 10; curl http://localhost:5173; kill $PID`
  - **需要服务常驻场景** (如测试员 Agent): 使用后台运行 `&`，并记录 PID 以便后续管理，**不要**让 Shell 挂起等待。
    - ✅ `npm run start > server.log 2>&1 &`
  - ❌ 直接运行 `npm run dev` (会导致 Agent 永远卡住)

### Phase 6: Git 提交（强制）

**⚠️ 重要：完成任务后必须提交 Git，这是工作流的关键环节**

#### 提交前强制检查清单（必须全部通过）
- [ ] 代码通过所有测试（包括边界条件）
- [ ] 构建无警告无错误 (`npm run build` 或等效命令)
- [ ] 类型检查通过 (`tsc --noEmit` 或等效命令)
- [ ] 无 console.log 等调试代码残留
- [ ] 已对比 diff，确认只修改了必要文件
- [ ] **自检**: "资深工程师会批准这个提交吗？"

#### 提交并推送命令（严格执行）
```bash
# 1. 检查当前变更
git status
git diff

# 2. 添加所有变更（包括新文件）
git add .

# 3. 提交（使用 Conventional Commits 格式）
git commit -m "feat(task-${TASK_ID}): ${TASK_TITLE}"

# 4. 【关键】推送到远程 worker 分支
# Loop 会从这个分支获取代码并合并到 dev
git push origin $(git branch --show-current)
```

#### 提交规范
- **格式**: `feat(task-T1): 任务标题` / `fix: 修复 bug` / `refactor: 重构`
- **频率**: 每个任务完成后**立即提交**，不累积多个任务
- **原子性**: 一个任务对应一个 commit，保持提交历史清晰
- **信息**: 提交消息简洁明确（<50字），说明核心变更

### Phase 7: 代码合并（自主解决冲突）

**你可能会收到 "Locked Files" 警告，这意味着其他 Agent 也在修改这些文件。**

**在 Push 前，你必须确保你的代码能干净地合并到 dev 分支：**

1. **拉取最新代码**:
   ```bash
   git fetch origin dev
   ```

2. **尝试 Rebase (推荐)**:
   ```bash
   git rebase origin/dev
   ```
   - 如果遇到冲突，`git status` 查看冲突文件。
   - 编辑文件解决冲突（保留双方合理的修改）。
   - `git add <file>`
   - `git rebase --continue`
   - 重复直到 Rebase 完成。

3. **运行测试**:
   - 解决冲突后，**必须重新运行测试**，确保合并没破坏功能。

4. **推送代码**:
   ```bash
   git push origin $(git branch --show-current) --force-with-lease
   ```

**Loop 仍然会尝试帮你合并，但如果你已经处理好了冲突，Loop 的合并就会非常顺利。**

### Phase 8: Loop 自动合并到 dev（无需 Agent 操作）
（此阶段作为最后的兜底机制）

**注意：**
- 不要直接 `git checkout dev`，worktree 绑定到特定分支
- 不要直接合并到 main，合并到 dev 的工作由 Loop 统一处理
- 如果 `git push` 失败（如冲突），记录错误并退出，Loop 会处理

### Phase 8: 标记完成
- Agent 进程只需正常退出 (exit 0) 即可，Loop 会自动捕获并更新状态。


### Phase 9: 清理
- 由 ralph-loop 外部执行，Agent 无需处理

---

## 三、工作流编排（Workflow Orchestration）

### 3.1 Plan Node Default（计划优先）
- **触发条件**: 任何非平凡任务（3+ 步骤或架构决策）默认进入计划模式
- **动作**: 生成设计文档（简要，<100 字汇报），撰写详细规格到 `PLAN.md`
- **验证步骤**: 计划模式也用于验证环节，不只是构建阶段

### 3.2 Subagent Strategy（子代理策略）
- 自由使用子代理保持主上下文窗口清洁
- 将研究、探索、并行分析工作卸载给子代理
- 复杂问题通过更多计算资源（子代理）解决
- 每个子代理专注一个策略（One tack per subagent）

### 3.3 Self-Improvement Loop（持续改进循环）
- **After ANY Correction**: 被用户纠正后，立即更新 `../PROGRESS.md`，记录错误模式与预防规则
- **Ruthless Iteration**: 持续迭代这些教训直到同类错误率归零
- **Pattern Recognition**: 定期回顾 `../PROGRESS.md`，确保不重复踩坑
- **Review at Start**: 每次会话开始时检查 `../PROGRESS.md` 中的相关项目经验

### 3.4 Demand Elegance（追求优雅 - 平衡）
- **非平凡变更**: 暂停并自问 "Knowing everything I know now, is there a more elegant way?"
- **Hacky 检测**: 如果修复感觉 hacky，推倒重来："Knowing everything I know now, implement the elegant solution"
- **简单修复跳过**: 明显简单的修复不要过度工程化
- **自我挑战**: 提交前挑战自己的工作

### 3.5 Autonomous Bug Fixing（自主 Bug 修复）
- 收到 Bug 报告：**直接修复**，不询问"要不要修"
- 定位日志、错误、失败测试 → 分析根因 → 解决 → 验证
- CI 测试失败时，零上下文切换成本，立即分析并修复

---

## 四、状态通信协议

### Worker 状态机
```
idle      → 可接任务
planning  → 正在规划锁路径
working   → 正在执行开发
integrating → 正在合并代码
error     → 任务失败
```

### 与 Loop 的通信流程
```
Loop → dev-tasks.json (写入: status=running, assigned_to=w1)
Loop → agent-status.json (写入: status=working)
Worker → dev-tasks.json (读取: 通过 Symlink 查看任务详情)
Worker → Git (提交代码并 Push)
Loop → 检测到 Worker 进程退出
Loop → Git (合并代码到 dev)
Loop → dev-tasks.json (写入: status=done)
Loop → agent-status.json (写入: status=idle)
```

**重要**: 
1. Worker 只读 dev-tasks.json，不要直接修改 dev-tasks.json！
2. 状态流转由 Loop 统一接管。

---

## 五、质量标准（强制自检）

- **类型**: TypeScript 严格模式，零 `any`，全函数返回类型显式声明
- **测试**: 核心逻辑覆盖率>85%，边界条件必须覆盖（如除零、空输入）
- **健壮**: 错误处理完备，非法输入不崩溃，显示友好错误信息
- **性能**: 构建体积自主优化（如超 500KB 则代码分割），支持键盘操作（无障碍）
- **优雅**: 简单修改跳过，非平凡变更必须经得起"是否有更优雅方式"的审视；拒绝临时补丁，找到根因

---

## 六、版本控制（自动执行）

### 6.1 提交前检查清单（强制）
- [ ] 代码通过所有测试（包括边界条件）
- [ ] 构建无警告无错误
- [ ] 类型检查通过
- [ ] 无 console.log 等调试代码
- [ ] 已对比行为差异（如适用）
- [ ] **自检**: "资深工程师会批准这个提交吗？"

### 6.2 提交规范
- 使用 Conventional Commits：`feat(task-T1): 任务标题` / `fix: 修复 bug` / `refactor: 重构`
- 提交消息简洁明确，说明核心变更（<50 字）
- 每次功能完成后立即提交，不累积多次更改
- 向用户报告提交结果（提交哈希、变更文件数）

### 6.3 冲突处理（Rebase 失败时）
- 如果提示"unstaged changes"：先 `git add . && git commit` 或 `git stash`
- 如果有 merge conflicts：
  - 查看冲突文件：`git status`
  - 手动解决冲突（保留正确代码）
  - `git add <resolved-files>`
  - `git rebase --continue`
  - 重复直到完成
  - 重新运行测试
  - 
**Rebase失败时的处理流程**:
1. 如果是"unstaged changes"错误,先 commit或stash当前改动
2. 如果有 merge conflicts:
  - 查看冲突文件: git status
  - 读取冲突文件内容,理解双方改动意图
  - 手动解决冲突(保留正确的代码)
  - git add <resolved-files>
  - git rebase --continue
3. 重复直到 rebase完成

**测试失败时的处理流程**:
1. 运行测试
2. 如果失败,分析错误信息
3. 修复代码中的bug
4. 重新运行测试,直到全部通过
5. 提交修复:`git commit -m "fix: ..."
**不要放弃**: 遇到 rebase或测试失败时，必须解决问题后才能继续，不能直接标记为失败

---

## 七、禁止事项

❌ 直接编辑本地的 `PROGRESS.md`（要求git -C里修改）  
❌ 使用 any 类型（TypeScript 严格模式）  
❌ 留下 TODO 注释（必须完成或转为任务）  
❌ 直接写入 dev-tasks.json（Worker 只读，Loop 唯一写入者）

---

## 八、核心原则（Core Principles）

- **Simplicity First**: 让每个变更尽可能简单，影响最少的代码
- **No Laziness**: 找到根本原因，不要临时修复，保持资深开发者标准
- **Minimal Impact**: 变更只触碰必要部分，避免引入新 Bug
- **代码即文档**: 自解释命名，必要注释
- **安全默认**: 用户输入一律校验，敏感操作默认拒绝
- **可维护性**: 模块解耦，副作用隔离（core 层纯函数）

---

*生效条件：此文件存在于工作区根目录时，以上约束立即生效。*
