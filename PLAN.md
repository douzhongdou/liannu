# PLAN.md - Agent Workflow Dashboard

# 1. 项目定位与核心功能

## 产品定位

一个轻量级的本地化Agent编排监控面板，用于可视化多智能体协作开发流程的状态。

## 核心功能模块

- **Task Orchestration View**: 任务看板（按状态分栏）、依赖关系简化展示、任务拖拽分配管理

- **Agent Cluster View**: Worker看板（按状态分栏）、实时活动日志流、资源调度简化操作

- **Interactive Control**: 任务手动分配、状态标记、Worker强制空闲

# 2. 技术架构

## 2.1 技术栈

- **Framework**: React 18 + TypeScript 5

- **Build Tool**: Vite 5

- **Styling**: Tailwind CSS + CSS Variables (主题系统)

- **State Management**: Zustand (轻量级，适合本地文件状态)

- **Icons**: Lucide React

- **Time Format**: date-fns

## 2.2 项目结构

```markdown
gui/
├── public/                    # 静态资源（如果需要）
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx         # 顶部导航 + 标签切换 + 全局刷新（极简设计）
│   │   │   ├── MainLayout.tsx     # 两栏布局（内容区 + 详情抽屉），贴合Vercel留白风格
│   │   │   └── ThemeToggle.tsx    # 明暗主题切换（极简按钮）
│   │   ├── tasks/
│   │   │   ├── TaskKanban.tsx     # 任务看板容器（按状态分栏，核心看板组件）
│   │   │   ├── TaskCard.tsx       # 任务卡片（简约圆角，贴合看板风格）
│   │   │   ├── TaskStatusBadge.tsx # 状态徽章组件（简约低饱和）
│   │   │   ├── TaskDetailPanel.tsx # 右侧任务详情抽屉（极简半透明）
│   │   │   ├── DependencyIndicator.tsx # 依赖提示（简化虚线，hover显示）
│   │   │   └── TaskFilters.tsx    # 状态过滤器工具栏（极简无多余装饰）
│   │   └── agents/
│   │       ├── WorkerKanban.tsx   # Worker看板容器（按状态分栏，核心看板组件）
│   │       ├── WorkerCard.tsx     # Worker状态卡片（简约扁平，无多余动画）
│   │       ├── ActivityStream.tsx # 实时活动日志（简约时间轴，贴合整体风格）
│   │       └── WorkerAssignmentDialog.tsx # 手动分配任务弹窗（极简设计）
│   ├── hooks/
│   │   ├── usePolling.ts          # 轮询Hook（2秒间隔刷新JSON）
│   │   ├── useTasks.ts            # 任务数据管理（适配看板分栏逻辑）
│   │   └── useAgents.ts           # Agent状态管理（适配看板分栏逻辑）
│   ├── stores/
│   │   └── dashboardStore.ts      # Zustand全局状态（选中项、过滤器）
│   ├── types/
│   │   ├── task.ts                # Task类型定义
│   │   └── agent.ts               # Agent/Worker类型定义
│   ├── utils/
│   │   ├── api.ts                 # 文件读取API封装（fetch with error handling）
│   │   └── formatters.ts          # 时间、状态格式化
│   └── App.tsx
├── task.json               # 源数据文件（项目根目录）
├── agent-status.json            # 源数据文件（项目根目录）
└── vite.config.ts               # 配置server.fs.allow允许访问上级目录
```

## 2.3 数据访问策略

由于浏览器安全限制，使用Vite Dev Server代理配置：

```typescript
// vite.config.ts
server: {
  fs: {
    allow: ['..', './']  // 允许访问项目根目录的JSON文件
  }
}
```

**数据获取**: 通过`fetch('/task.json')`读取，配合`usePolling`实现实时同步。

# 3. 数据结构定义

## 3.1 Task Model

```typescript
interface Task {
  id: string;                    // T1, T2...
  title: string;
  prompt: string;                // Markdown渲染支持
  status: 'pending' | 'planning' | 'working' | 'completed' | 'failed' | 'integrating';
  dependencies: string[];        // 依赖任务ID列表
  assigned_to: string | null;    // Worker ID
  worktree: string | null;
  plan_mode: boolean;
  started_at: string | null;     // ISO 8601
  completed_at: string | null;
  error_count: number;
  error_msg: string | null;
  work_branch: string | null;
}

// 派生状态
interface TaskWithMeta extends Task {
  isBlocked: boolean;            // 依赖未完成
  isCritical: boolean;           // 被多个任务依赖
  duration?: number;             // 执行时长（秒）
}
```

## 3.2 Agent Model

```typescript
type WorkerStatus = 'idle' | 'planning' | 'working' | 'integrating' | 'error';

interface Worker {
  id: string;                    // w1, w2...
  status: WorkerStatus;
  current_task_id: string | null;
  current_task_title: string | null;
  message: string;               // 当前活动描述
  updated_at: string;            // 最后心跳时间
  activity_score: number;        // 活跃度评分（计算得出）
}

interface HistoryEvent {
  timestamp: string;
  worker: string;
  event: WorkerStatus | 'assigned' | 'unassigned';
  task_id: string | null;
  detail: string;
}
```

# 4. UI/UX 设计规范

## 4.1 视觉风格

- **风格**: 简洁明快风（参考Vercel视觉效果），主打干净、轻盈、现代感，弱化厚重边框，强调留白和层次，配色清爽柔和

- **配色**: 
              

- 背景: 纯白色（Light）/ 深灰900（Dark），无多余纹理，简洁干净

- 状态色: 低饱和柔和色调，贴合Vercel简约质感
                  

- Pending: 浅灰400

- Planning: 淡蓝500

- Working: 浅黄500（轻微呼吸动画，不夸张）

- Integrating: 淡紫500

- Completed: 浅绿500

- Failed: 浅红500

**字体**: Inter（贴合Vercel风格），标题粗体清晰，正文轻盈，日志和ID使用等宽字体但保持简约感

- **风格**: 工业风控制台（Industrial Dashboard）

- **配色**: 
        

    - 背景: Slate 950 (Dark) / Slate 50 (Light)

    - 状态色: 
                

        - Pending: Slate 500

        - Planning: Blue 500

        - Working: Amber 500 (脉冲动画)

        - Integrating: Purple 500

        - Completed: Emerald 500

        - Failed: Rose 500

- **字体**: System UI + Monospace（用于日志和ID显示）

## 4.2 布局架构

### 全局布局

```markdown
+------------------+------------------+
|     Header       |   Refresh Btn    |
+------------------+------------------+
|  [Tasks] [Agents]|                  |
+------------------+------------------+
|                                    |
|         Main Content Area          |
|        (Grid or List View)         |
|                                    |
+------------------------------------+
|  Detail Drawer (Collapsible)       |
+------------------------------------+
```

### Tasks Tab 布局（看板结构）

- **顶部工具栏**: 简洁无多余装饰，包含视图切换（仅看板视图，保留筛选/搜索）、状态筛选（Checkbox Group）、搜索框，按钮采用圆角极简设计

- **主内容区（看板核心）**: 
              

- 看板列: 按任务状态分栏（Pending、Planning、Working、Integrating、Completed、Failed），每列独立滚动，列宽自适应

- 任务卡片: 轻盈简约，无厚重边框，圆角设计，内部显示任务ID、标题、依赖数量、指派Worker，hover时有轻微阴影提升层次感

- 依赖可视化: 简化连线，仅在卡片悬停时显示关联依赖任务的轻量虚线，不破坏看板简洁性

**右侧抽屉**: 滑出式，简约半透明背景，内部布局清晰，仅展示核心信息（完整Prompt、依赖详情、错误日志），操作按钮统一排列，风格贴合Vercel极简感

- **顶部工具栏**: 视图切换(Grid/List)、状态筛选(Checkbox Group)、搜索框

- **主内容区**: 
        

    - Grid视图: 卡片 masonry 布局，显示任务ID、标题、状态徽章、依赖数量、指派头像

    - 依赖可视化: 使用 CSS Grid + 连接线展示任务链

- **右侧抽屉**: 点击任务后滑出，显示完整Prompt、依赖详情、错误日志、操作按钮(Claim/Complete/Fail)

### Agents Tab 布局（看板结构）

- **主内容区（看板核心）**: 按Worker状态分栏（Idle、Planning、Working、Integrating、Error），看板列布局，每列对应一种状态，Worker卡片按状态归类
              

- Worker卡片: 简约扁平设计，圆角，无多余装饰，显示Worker ID、当前任务标题（截断）、最后消息，顶部有对应状态的细条标识

- 状态提示: 取消呼吸灯动画，改为状态细条+文字标识，简洁直观，仅在hover时显示轻微高亮

- 操作按钮: 隐藏式设计，hover卡片时显示Assign Task / Set Idle按钮，按钮样式极简，与卡片风格统一

**右侧活动流**: 简约时间轴，无多余装饰，文字清晰，按时间倒序排列，event类型用对应状态色区分，整体轻盈不突兀

**底部统计栏**: 极简设计，仅显示核心统计数据（总任务数、完成率、活跃Worker数），无多余边框，文字对齐整齐，贴合整体风格

- **左侧Worker矩阵**: 2x3或自适应网格，每张卡片显示：
        

    - Worker ID大字体显示

    - 状态指示灯（呼吸灯效果）

    - 当前任务标题（截断）

    - 最后消息（滚动显示）

    - 操作按钮（Assign Task / Set Idle）

- **右侧活动流**: 时间轴形式展示History，支持过滤特定Worker

- **底部统计栏**: 总任务数、完成率、活跃Worker数、系统吞吐量

# 5. 交互设计详解

## 5.1 任务管理交互

1. **快速分配**: 看板内拖拽任务卡片到对应Worker所在状态列，或点击Assign弹出极简Worker选择器，贴合Vercel简洁操作逻辑

2. **依赖高亮**: 悬停任务时，高亮显示其上游依赖（黄色）和下游被依赖（蓝色）

3. **批量操作**: 支持多选任务，批量分配给同一Worker或批量标记状态

4. **错误重试**: Failed状态任务显示红色边框，点击可查看error_msg并Retry

## 5.2 Worker监控交互

1. **实时状态提示**: 取消脉冲动画，Worker卡片顶部状态细条实时同步状态，hover时显示更新时间，简洁直观

2. **任务劫持**: 右键Worker可选择"Force Idle"（模拟任务中断）

3. **日志追踪**: 点击Worker展开专属日志视图，显示该Worker的历史event

4. **负载均衡提示**: 当某Worker任务堆积时，显示警告徽章

## 5.3 数据同步

- **自动刷新**: 每1000ms轮询JSON文件，对比hash避免无效重渲染

- **手动刷新**: Header右上角刷新按钮，带旋转动画

- **最后更新**: 显示"Synced at 12:34:56"时间戳

# 6. 关键组件规格

## TaskCard 组件

```typescript
interface TaskCardProps {
  task: TaskWithMeta;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onAssign: (taskId: string, workerId: string) => void;
  dependentTasks: string[];  // 依赖此任务的其他任务
}
// 视觉: 简约圆角卡片，无厚重边框，顶部细条表示状态，右上角依赖数量徽章，整体轻盈，hover有轻微阴影
```

## WorkerCard 组件

```typescript
interface WorkerCardProps {
  worker: Worker;
  isOnline: boolean;  // 根据updated_at判断，>30s视为离线
  onAssignTask: (workerId: string) => void;
  onForceIdle: (workerId: string) => void;
}
// 视觉: 简约扁平卡片，圆角设计，顶部状态细条，中间内容区，操作按钮hover显示，无多余动画，贴合Vercel简洁风格
```

## ActivityStream 组件

- 类似终端输出的反向滚动列表（最新在上）

- 颜色编码不同event类型

- 支持暂停滚动（鼠标悬停）

- 搜索/过滤功能

# 7. 开发里程碑

## Phase 1: 基础架构 (30%)

- [] Vite + React + Tailwind 初始化

- [] 配置vite.server.fs.allow读取上级目录JSON

- [] 类型定义文件 (types/*.ts)

- [] 基础API层 (utils/api.ts) 实现文件读取

- [] Polling机制实现

## Phase 2: 任务视图 (40%)

- [] TaskList + TaskCard 组件

- [] 状态过滤与搜索

- [] 依赖关系可视化（简单连线）

- [] TaskDetailPanel抽屉

- [] 视图状态管理（Zustand）

## Phase 3: 智能体视图 (20%)

- [] WorkerGrid布局

- [] WorkerCard状态动画

- [] ActivityStream日志组件

- [] Worker-Task分配交互

## Phase 4:  polish (10%)

- [] 主题切换（Dark/Light）

- [] 响应式适配（移动端简化视图）

- [] 键盘快捷键（R刷新、数字键切换Tab）

- [] 空状态与错误边界

# 8. 配置说明

## vite.config.ts 关键配置

```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    fs: {
      // 允许访问项目根目录的JSON文件
      allow: ['..']
    }
  },
  // 确保构建后也能找到JSON（开发模式直接fetch，生产模式需要copy）
  publicDir: '../'  // 或者手动配置复制规则
});
```

## 开发时数据准备

在项目根目录（gui的上级）放置：

- `task.json`（用户提供格式）

- `agent-status.json`（用户提供格式）

App内访问路径：`/task.json`（通过Vite代理映射到上级目录）

---

**下一步**: 确认PLAN后，我将生成完整的项目代码，包括所有组件实现和类型定义。是否需要调整任何设计细节？
> （注：文档部分内容可能由 AI 生成）