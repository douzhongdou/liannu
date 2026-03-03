import type { Task, TaskLockData } from '../types/task';
import { statusLabels, statusColors } from '../types/task';
import { getWorkerForTask } from '../services/taskService';

interface TaskDetailProps {
  task: Task | null;
  locks: TaskLockData;
}

export function TaskDetail({ task, locks }: TaskDetailProps) {
  if (!task) {
    return (
      <div className="h-full flex items-center justify-center text-secondary-400">
        <div className="text-center animate-fade-in">
          <svg className="w-16 h-16 mx-auto mb-4 opacity-40 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-secondary-500 dark:text-secondary-400">选择一个任务查看详情</p>
        </div>
      </div>
    );
  }

  const worker = getWorkerForTask(locks, task.id);

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 animate-fade-in">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-sm font-mono text-secondary-500 dark:text-secondary-400 bg-secondary-100 dark:bg-secondary-700 px-2.5 py-1 rounded">{task.id}</span>
            <span className={`text-xs px-3 py-1 rounded-full text-white ${statusColors[task.status]}`}>
              {statusLabels[task.status]}
            </span>
          </div>
          <h2 className="text-2xl font-semibold text-secondary-900 dark:text-secondary-100">{task.title}</h2>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div className="bg-white dark:bg-secondary-800 rounded-xl p-4 border border-secondary-200 dark:border-secondary-700 shadow-sm">
            <label className="text-xs font-medium text-secondary-500 dark:text-secondary-400 block mb-2">执行者</label>
            <span className="text-sm text-secondary-900 dark:text-secondary-100">{worker || '未分配'}</span>
          </div>
          <div className="bg-white dark:bg-secondary-800 rounded-xl p-4 border border-secondary-200 dark:border-secondary-700 shadow-sm">
            <label className="text-xs font-medium text-secondary-500 dark:text-secondary-400 block mb-2">工作分支</label>
            <span className="text-sm text-secondary-900 dark:text-secondary-100">{task.work_branch || 'N/A'}</span>
          </div>
          <div className="bg-white dark:bg-secondary-800 rounded-xl p-4 border border-secondary-200 dark:border-secondary-700 shadow-sm">
            <label className="text-xs font-medium text-secondary-500 dark:text-secondary-400 block mb-2">Plan 模式</label>
            <span className="text-sm text-secondary-900 dark:text-secondary-100">{task.plan_mode ? '是' : '否'}</span>
          </div>
          <div className="bg-white dark:bg-secondary-800 rounded-xl p-4 border border-secondary-200 dark:border-secondary-700 shadow-sm">
            <label className="text-xs font-medium text-secondary-500 dark:text-secondary-400 block mb-2">错误次数</label>
            <span className={`text-sm ${task.error_count > 0 ? 'text-red-600 dark:text-red-400' : 'text-secondary-900 dark:text-secondary-100'}`}>
              {task.error_count}
            </span>
          </div>
        </div>

        {/* Dependencies */}
        {task.dependencies.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-3">依赖任务</h3>
            <div className="flex flex-wrap gap-2.5">
              {task.dependencies.map(dep => (
                <span key={dep} className="text-xs px-3 py-1.5 rounded-lg bg-secondary-100 dark:bg-secondary-700 text-secondary-700 dark:text-secondary-300">
                  {dep}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Prompt */}
        <div className="mb-8">
          <h3 className="text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-3">任务描述</h3>
          <div className="bg-white dark:bg-secondary-800 rounded-xl p-5 border border-secondary-200 dark:border-secondary-700 shadow-sm">
            <pre className="text-sm text-secondary-800 dark:text-secondary-200 whitespace-pre-wrap font-mono leading-relaxed">
              {task.prompt}
            </pre>
          </div>
        </div>

        {/* Error Message */}
        {task.error_msg && (
          <div className="mb-8">
            <h3 className="text-sm font-medium text-red-600 dark:text-red-400 mb-3">错误信息</h3>
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-5 shadow-sm">
              <pre className="text-sm text-red-700 dark:text-red-300 whitespace-pre-wrap font-mono leading-relaxed">
                {task.error_msg}
              </pre>
            </div>
          </div>
        )}

        {/* Timestamps */}
        <div className="text-xs text-secondary-500 dark:text-secondary-400 space-y-2">
          {task.started_at && (
            <p className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              开始时间: {new Date(task.started_at).toLocaleString()}
            </p>
          )}
          {task.completed_at && (
            <p className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              完成时间: {new Date(task.completed_at).toLocaleString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
