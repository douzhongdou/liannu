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
      <div className="h-full flex items-center justify-center text-gray-500">
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p>选择一个任务查看详情</p>
        </div>
      </div>
    );
  }

  const worker = getWorkerForTask(locks, task.id);

  return (
    <div className="h-full overflow-auto">
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-mono text-gray-500">{task.id}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full text-white ${statusColors[task.status]}`}>
              {statusLabels[task.status]}
            </span>
          </div>
          <h2 className="text-xl font-semibold text-white">{task.title}</h2>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-800/50 rounded-lg p-3">
            <label className="text-xs text-gray-500 block mb-1">执行者</label>
            <span className="text-sm text-gray-300">{worker || '未分配'}</span>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3">
            <label className="text-xs text-gray-500 block mb-1">工作分支</label>
            <span className="text-sm text-gray-300">{task.work_branch || 'N/A'}</span>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3">
            <label className="text-xs text-gray-500 block mb-1">Plan 模式</label>
            <span className="text-sm text-gray-300">{task.plan_mode ? '是' : '否'}</span>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3">
            <label className="text-xs text-gray-500 block mb-1">错误次数</label>
            <span className={`text-sm ${task.error_count > 0 ? 'text-red-400' : 'text-gray-300'}`}>
              {task.error_count}
            </span>
          </div>
        </div>

        {/* Dependencies */}
        {task.dependencies.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-400 mb-2">依赖任务</h3>
            <div className="flex flex-wrap gap-2">
              {task.dependencies.map(dep => (
                <span key={dep} className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300">
                  {dep}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Prompt */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-400 mb-2">任务描述</h3>
          <div className="bg-gray-800/50 rounded-lg p-4">
            <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
              {task.prompt}
            </pre>
          </div>
        </div>

        {/* Error Message */}
        {task.error_msg && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-red-400 mb-2">错误信息</h3>
            <div className="bg-red-900/20 border border-red-900/50 rounded-lg p-4">
              <pre className="text-sm text-red-300 whitespace-pre-wrap font-mono">
                {task.error_msg}
              </pre>
            </div>
          </div>
        )}

        {/* Timestamps */}
        <div className="text-xs text-gray-500 space-y-1">
          {task.started_at && (
            <p>开始时间: {new Date(task.started_at).toLocaleString()}</p>
          )}
          {task.completed_at && (
            <p>完成时间: {new Date(task.completed_at).toLocaleString()}</p>
          )}
        </div>
      </div>
    </div>
  );
}
