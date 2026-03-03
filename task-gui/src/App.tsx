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
    { value: 'ready_to_integrate', label: '待集成' },
    { value: 'completed', label: '已完成' },
    { value: 'failed', label: '失败' },
  ]

  if (loading && tasks.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary-900">
        <div className="text-center animate-fade-in">
          <div className="w-10 h-10 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
          <p className="text-secondary-400 text-xs">加载中...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary-900">
        <div className="text-center animate-fade-in">
          <div className="text-red-400 mb-6">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-red-400 text-xs mb-6">{error}</p>
          <button
            onClick={loadData}
            className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-all duration-300 font-medium shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-secondary-900 transform hover:scale-105 active:scale-95"
          >
            重试
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-secondary-50 dark:bg-secondary-900 text-secondary-900 dark:text-secondary-100 font-inter">
      {/* Header */}
      <header className="border-b border-secondary-200 dark:border-secondary-800 bg-white dark:bg-secondary-900 top-0 z-10 shadow-sm transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center shadow-md">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-secondary-900 dark:text-secondary-100">Task GUI</h1>
            </div>
            <button
              onClick={loadData}
              className="p-2 text-secondary-500 dark:text-secondary-400 hover:bg-secondary-100 dark:hover:bg-secondary-700 rounded-lg transition-all duration-300 hover:scale-110 shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-secondary-900"
              title="刷新"
            >
              <svg className="w-4 h-4 transition-transform duration-500 hover:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>

          <TaskStats tasks={tasks} />

          {/* View Tabs */}
          <div className="flex flex-wrap items-center gap-3 mt-4 mb-4">
            <div className="flex bg-secondary-100 dark:bg-secondary-800 rounded-lg p-1 shadow-sm">
              {(['task', 'agent'] as ViewMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-4 py-2 rounded-md text-xs font-medium transition-all duration-300 ${
                    viewMode === mode
                      ? 'bg-primary-500 text-white shadow-md focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-secondary-900'
                      : 'bg-white dark:bg-secondary-800 text-secondary-600 dark:text-secondary-400 hover:bg-secondary-200 dark:hover:bg-secondary-700 focus:ring-2 focus:ring-secondary-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-secondary-900'
                  }`}
                >
                  {mode === 'task' ? '任务' : '执行者'}
                </button>
              ))}
            </div>

            {viewMode === 'task' && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-secondary-600 dark:text-secondary-400">视图:</span>
                <div className="flex bg-secondary-100 dark:bg-secondary-800 rounded-lg p-1 shadow-sm">
                  {(['card', 'table', 'kanban'] as TaskViewType[]).map(type => (
                    <button
                      key={type}
                      onClick={() => setTaskViewType(type)}
                      className={`px-3 py-1.5 rounded-md text-xs transition-all duration-300 ${
                        taskViewType === type
                          ? 'bg-primary-500 text-white shadow-md focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-secondary-900'
                          : 'bg-white dark:bg-secondary-800 text-secondary-600 dark:text-secondary-400 hover:bg-secondary-200 dark:hover:bg-secondary-700 focus:ring-2 focus:ring-secondary-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-secondary-900'
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
                className="ml-auto px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-xs font-medium transition-all duration-300 flex items-center gap-2 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-secondary-900 transform hover:scale-105 active:scale-95"
              >
                <svg className="w-4 h-4 transition-transform duration-300 hover:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                新建任务
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            {viewMode === 'task' && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  {filterOptions.map(option => (
                    <button
                      key={option.value}
                      onClick={() => setFilterStatus(option.value)}
                      className={`px-3 py-1.5 text-xs rounded-lg transition-all duration-300 ${
                        filterStatus === option.value
                          ? 'bg-primary-500 text-white shadow-sm focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-secondary-900'
                          : 'bg-white dark:bg-secondary-800 text-secondary-600 dark:text-secondary-400 hover:bg-secondary-100 dark:hover:bg-secondary-700 border border-secondary-200 dark:border-secondary-700 shadow-sm hover:shadow-md focus:ring-2 focus:ring-secondary-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-secondary-900'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className="flex-1 min-w-[200px]" />
                <div className="relative w-full sm:w-auto max-w-md">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="搜索任务..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 bg-white dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-lg text-xs text-secondary-900 dark:text-secondary-100 placeholder-secondary-500 dark:placeholder-secondary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-300 hover:border-primary-300 dark:hover:border-primary-700 shadow-sm"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="">
          {/* Task List */}
          <div className="lg:col-span-2">
            {viewMode === 'task' ? (
              <div className="space-y-8">
                {taskViewType === 'card' && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-semibold text-secondary-900 dark:text-secondary-100">
                        任务列表 ({filteredTasks.length})
                      </h2>
                    </div>
                    {filteredTasks.length === 0 ? (
                      <div className="text-center py-24 bg-white dark:bg-secondary-800 rounded-2xl border border-secondary-200 dark:border-secondary-700 animate-fade-in shadow-lg">
                        <div className="w-20 h-20 bg-secondary-100 dark:bg-secondary-700 rounded-full flex items-center justify-center mx-auto mb-6">
                          <svg className="w-10 h-10 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                        </div>
                        <p className="text-secondary-500 dark:text-secondary-400 text-xs">暂无任务</p>
                        <button
                          onClick={() => setIsModalOpen(true)}
                          className="mt-6 px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-xs font-medium transition-all duration-300 flex items-center gap-2 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-secondary-900 transform hover:scale-105 active:scale-95"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          新建任务
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {filteredTasks.map(task => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            locks={locks}
                            isSelected={task.id === selectedTaskId}
                            onClick={() => setSelectedTaskId(task.id)}
                          />
                        ))}
                      </div>
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
          </div>

          {/* Task Detail */}
          <div className="lg:col-span-2">
            <div className="top-24">
              <TaskDetail task={selectedTask} locks={locks} />
            </div>
          </div>
        </div>
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
