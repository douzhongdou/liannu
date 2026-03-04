import { useState, useEffect, useMemo } from 'react'
import type { Task, TaskLockData } from './types/task'
import type { AgentStatusData } from './types/agent'
import { fetchTasks, fetchLocks, fetchAgents, sortTasks, filterTasksByStatus, searchTasks } from './services/taskService'
import { TaskCard } from './components/TaskCard'
import { TaskKanban } from './components/TaskKanban'
import { AgentList } from './components/AgentList'
import { TaskDetailDialog } from './components/TaskDetailDialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  LayoutDashboard,
  Bot,
  CheckCircle2,
  Clock,
  AlertCircle,
  PlayCircle,
  RefreshCw,
  Lightbulb,
  Search,
  ListTodo
} from 'lucide-react'

type ViewMode = 'task' | 'agent'
type TaskViewType = 'card' | 'kanban'
type FilterStatus = Task['status'] | 'all'

function App() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [locks, setLocks] = useState<TaskLockData>({ version: '1.0', locks: [] })
  const [agentStatus, setAgentStatus] = useState<AgentStatusData | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('task')
  const [taskViewType, setTaskViewType] = useState<TaskViewType>('kanban')

  const loadData = async (isBackground = false) => {
    try {
      // 只在非后台刷新时显示 loading
      if (!isBackground) {
        setLoading(true)
      }
      const [tasksData, locksData, agentsData] = await Promise.all([
        fetchTasks(),
        fetchLocks(),
        fetchAgents()
      ])
      // 只在成功获取数据时更新状态
      if (tasksData.tasks) {
        setTasks(tasksData.tasks)
      }
      if (locksData) {
        setLocks(locksData)
      }
      if (agentsData) {
        setAgentStatus(agentsData)
      }
      setError(null)
    } catch (err) {
      console.error('Error loading data:', err)
      // 后台刷新失败不显示错误，保持现有数据
      if (!isBackground) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      }
    } finally {
      if (!isBackground) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    // 首次加载（显示 loading）
    loadData(false)
    // 后台定时刷新（不显示 loading）
    const interval = setInterval(() => loadData(true), 1000)
    return () => clearInterval(interval)
  }, [])

  const filteredTasks = useMemo(() => {
    let result = tasks
    if (filterStatus !== 'all') {
      result = filterTasksByStatus(result, filterStatus)
    }
    if (searchQuery) {
      result = searchTasks(result, searchQuery)
    }
    return sortTasks(result)
  }, [tasks, filterStatus, searchQuery])

  // 计算任务统计
  const taskStats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    planning: tasks.filter(t => t.status === 'planning').length,
    running: tasks.filter(t => t.status === 'running').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    failed: tasks.filter(t => t.status === 'failed').length,
    ready_to_integrate: tasks.filter(t => t.status === 'ready_to_integrate').length,
  }

  // 计算执行者统计
  const { totalAgents, workingAgents } = useMemo(() => {
    if (!agentStatus?.workers) return { totalAgents: 0, workingAgents: 0 };
    const workers = Object.values(agentStatus.workers);
    return {
      totalAgents: workers.length,
      workingAgents: workers.filter(w => 
        ['working', 'planning', 'integrating'].includes(w.status)
      ).length
    };
  }, [agentStatus])

  // 处理任务点击
  const handleTaskClick = (task: Task) => {
    setSelectedTask(task)
    setDialogOpen(true)
  }

  const filterOptions: { value: FilterStatus; label: string }[] = [
    { value: 'all', label: '全部' },
    { value: 'pending', label: '待处理' },
    { value: 'planning', label: '规划中' },
    { value: 'running', label: '进行中' },
    { value: 'ready_to_integrate', label: '待集成' },
    { value: 'completed', label: '已完成' },
    { value: 'failed', label: '错误' },
  ]

  if (loading && tasks.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-sm">加载中...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <AlertCircle className="w-16 h-16 mx-auto" />
          </div>
          <p className="text-red-500 text-sm mb-4">{error}</p>
          <button
            onClick={() => loadData(false)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            重试
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 顶部导航 */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center">
                <LayoutDashboard className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-800">Task GUI</h1>
                <p className="text-xs text-slate-400">任务管理面板</p>
              </div>
            </div>

            {/* 全局统计 */}
            <div className="hidden md:flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-sm text-slate-600">
                  <span className="font-semibold">{workingAgents}</span> 个执行者工作中
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-sm text-slate-600">
                  <span className="font-semibold">{taskStats.completed}</span> 个任务已完成
                </span>
              </div>
            </div>

            {/* 刷新按钮 */}
            <button
              onClick={() => loadData(false)}
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
              title="刷新"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={viewMode} onValueChange={(v: string) => setViewMode(v as ViewMode)} className="w-full">
          {/* 标签页头部 */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <TabsList className="bg-slate-100 p-1">
              <TabsTrigger
                value="task"
                className="px-4 py-2 min-w-[100px]"
              >
                <ListTodo className="w-4 h-4 mr-2" />
                任务
                <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 min-w-[20px] text-center">
                  {taskStats.total}
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="agent"
                className="px-4 py-2 min-w-[100px]"
              >
                <Bot className="w-4 h-4 mr-2" />
                执行者
                <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 min-w-[20px] text-center">
                  {totalAgents}
                </span>
              </TabsTrigger>
            </TabsList>

            {/* 任务视图切换 */}
            {viewMode === 'task' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTaskViewType('card')}
                  className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                    taskViewType === 'card'
                      ? 'bg-blue-50 text-blue-600 font-medium'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  卡片
                </button>
                <button
                  onClick={() => setTaskViewType('kanban')}
                  className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                    taskViewType === 'kanban'
                      ? 'bg-blue-50 text-blue-600 font-medium'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  看板
                </button>
              </div>
            )}
          </div>

          {/* 任务标签页 */}
          <TabsContent value="task" className="mt-0 space-y-6 [scrollbar-gutter:stable]">
   

            {/* 筛选和搜索 */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                {filterOptions.map(option => (
                  <button
                    key={option.value}
                    onClick={() => setFilterStatus(option.value)}
                    className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
                      filterStatus === option.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="搜索任务..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* 任务列表 */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              {taskViewType === 'card' ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-800">
                      任务列表 ({filteredTasks.length})
                    </h2>
                  </div>
                  {filteredTasks.length === 0 ? (
                    <div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      <ListTodo className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-500 text-sm">暂无任务</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredTasks.map(task => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          locks={locks}
                          isSelected={selectedTask?.id === task.id}
                          onClick={() => handleTaskClick(task)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <TaskKanban tasks={sortTasks(tasks)} locks={locks} onSelect={(id) => {
                  const task = tasks.find(t => t.id === id)
                  if (task) handleTaskClick(task)
                }} />
              )}
            </div>
          </TabsContent>

          {/* 执行者标签页 */}
          <TabsContent value="agent" className="mt-0 [scrollbar-gutter:stable]">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <AgentList agentStatus={agentStatus} tasks={tasks} />
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* 任务详情弹窗 */}
      <TaskDetailDialog
        task={selectedTask}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  )
}

// 统计徽章组件
interface StatBadgeProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}



export default App
