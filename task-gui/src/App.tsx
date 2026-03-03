import { useState, useEffect, useMemo } from 'react'
import type { Task, TaskLockData } from './types/task'
import { fetchTasks, fetchLocks, sortTasks, filterTasksByStatus, searchTasks } from './services/taskService'
import { TaskCard } from './components/TaskCard'
import { TaskDetail } from './components/TaskDetail'
import { TaskStats } from './components/TaskStats'
import { TaskModal } from './components/TaskModal'
import { TaskTable } from './components/TaskTable'
import { TaskKanban } from './components/TaskKanban'
import { AgentList } from './components/AgentList'

type ViewMode = 'task' | 'agent'
type TaskViewType = 'card' | 'table' | 'kanban'
type FilterStatus = Task['status'] | 'all'

function App() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [locks, setLocks] = useState<TaskLockData>({ version: '1.0', locks: [] })
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('task')
  const [taskViewType, setTaskViewType] = useState<TaskViewType>('card')
  const [isModalOpen, setIsModalOpen] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      const [tasksData, locksData] = await Promise.all([
        fetchTasks(),
        fetchLocks()
      ])
      setTasks(tasksData.tasks)
      setLocks(locksData)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 5000)
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

  const selectedTask = useMemo(() =>
    tasks.find(t => t.id === selectedTaskId) || null,
    [tasks, selectedTaskId]
  )

  const handleAddTask = (newTask: Omit<Task, 'id' | 'status' | 'started_at' | 'completed_at' | 'error_count' | 'error_msg'>) => {
    const task: Task = {
      ...newTask,
      id: `T${tasks.length + 1}`,
      status: 'pending',
      started_at: null,
      completed_at: null,
      error_count: 0,
      error_msg: null,
    }
    setTasks(prev => [...prev, task])
    setIsModalOpen(false)
  }

  const filterOptions: { value: FilterStatus; label: string }[] = [
    { value: 'all', label: '全部' },
    { value: 'running', label: '进行中' },
    { value: 'pending', label: '待处理' },
    { value: 'completed', label: '已完成' },
    { value: 'failed', label: '失败' },
  ]

  if (loading && tasks.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">加载中...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="text-red-400 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            重试
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              Task GUI
            </h1>
            <button
              onClick={loadData}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              title="刷新"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>

          <TaskStats tasks={tasks} />

          {/* View Tabs */}
          <div className="flex items-center gap-2 mt-4 mb-4">
            <div className="flex bg-gray-800 rounded-lg p-1">
              {(['task', 'agent'] as ViewMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    viewMode === mode
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {mode === 'task' ? '任务' : '执行者'}
                </button>
              ))}
            </div>

            {viewMode === 'task' && (
              <div className="flex items-center gap-2 ml-4">
                <span className="text-sm text-gray-500">视图:</span>
                <div className="flex bg-gray-800 rounded-lg p-1">
                  {(['card', 'table', 'kanban'] as TaskViewType[]).map(type => (
                    <button
                      key={type}
                      onClick={() => setTaskViewType(type)}
                      className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                        taskViewType === type
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      {type === 'card' ? '卡片' : type === 'table' ? '表格' : '看板'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {viewMode === 'task' && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="ml-auto px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                新建任务
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4">
            {viewMode === 'task' && (
              <>
                <div className="flex items-center gap-2">
                  {filterOptions.map(option => (
                    <button
                      key={option.value}
                      onClick={() => setFilterStatus(option.value)}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        filterStatus === option.value
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className="flex-1" />
                <div className="relative">
                  <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="搜索任务..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {viewMode === 'task' ? (
          <div className="space-y-4">
            {taskViewType === 'card' && (
              <div className="space-y-3">
                <h2 className="text-sm font-medium text-gray-400 mb-3">
                  任务列表 ({filteredTasks.length})
                </h2>
                {filteredTasks.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p>暂无任务</p>
                  </div>
                ) : (
                  filteredTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      locks={locks}
                      isSelected={task.id === selectedTaskId}
                      onClick={() => setSelectedTaskId(task.id)}
                    />
                  ))
                )}
              </div>
            )}

            {taskViewType === 'table' && (
              <TaskTable tasks={filteredTasks} locks={locks} onSelect={setSelectedTaskId} />
            )}

            {taskViewType === 'kanban' && (
              <TaskKanban tasks={filteredTasks} locks={locks} onSelect={setSelectedTaskId} />
            )}
          </div>
        ) : (
          <AgentList locks={locks} tasks={tasks} />
        )}

        <TaskDetail task={selectedTask} locks={locks} />
      </main>

      <TaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleAddTask}
      />
    </div>
  )
}

export default App
