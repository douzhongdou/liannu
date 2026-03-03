import type { Task, TaskLockData } from '../types/task';
import { statusLabels, statusColors } from '../types/task';
import { getWorkerForTask } from '../services/taskService';

interface TaskCardProps {
  task: Task;
  locks: TaskLockData;
  isSelected: boolean;
  onClick: () => void;
}

export function TaskCard({ task, locks, isSelected, onClick }: TaskCardProps) {
  const worker = getWorkerForTask(locks, task.id);
  const hasError = task.error_count > 0;

  return (
    <div
      onClick={onClick}
      className={`
        relative p-4 rounded-lg border cursor-pointer transition-all duration-200
        ${isSelected
          ? 'border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/50'
          : 'border-gray-700 bg-gray-800/50 hover:bg-gray-800 hover:border-gray-600'
        }
      `}
    >
      {/* Status indicator */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg ${statusColors[task.status]}`} />

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-gray-500">{task.id}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full text-white ${statusColors[task.status]}`}>
              {statusLabels[task.status]}
            </span>
            {worker && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                {worker}
              </span>
            )}
          </div>
          <h3 className="text-sm font-medium text-gray-200 truncate">{task.title}</h3>
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{task.prompt}</p>
        </div>
      </div>

      {/* Footer info */}
      <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
        {task.dependencies.length > 0 && (
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
            </svg>
            依赖: {task.dependencies.join(', ')}
          </span>
        )}
        {hasError && (
          <span className="flex items-center gap-1 text-red-400">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            错误 {task.error_count} 次
          </span>
        )}
        {task.plan_mode && (
          <span className="flex items-center gap-1 text-blue-400">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Plan模式
          </span>
        )}
      </div>
    </div>
  );
}
