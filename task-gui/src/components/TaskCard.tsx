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
        relative p-6 rounded-2xl border cursor-pointer transition-all duration-300 overflow-hidden
        ${isSelected
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 ring-2 ring-primary-500/30 shadow-xl'
          : 'border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-800 hover:bg-secondary-50 dark:hover:bg-secondary-700 hover:shadow-2xl transition-shadow hover:-translate-y-1.5'
        }
        animate-fade-in
      `}
    >
      {/* Status indicator */}
      <div className={`absolute left-0 top-0 bottom-0 w-2 ${statusColors[task.status]}`} />

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-mono text-secondary-500 dark:text-secondary-400 bg-secondary-100 dark:bg-secondary-700 px-3 py-1 rounded-lg">{task.id}</span>
          <span className={`text-xs px-3 py-1 rounded-full text-white font-medium ${statusColors[task.status]}`}>
            {statusLabels[task.status]}
          </span>
          {worker && (
            <span className="text-xs px-3 py-1 rounded-full bg-accent-50 dark:bg-accent-900/30 text-accent-600 dark:text-accent-400 border border-accent-200 dark:border-accent-800 font-medium">
              {worker}
            </span>
          )}
        </div>
        
        <h3 className="text-xs font-semibold text-secondary-900 dark:text-secondary-100 truncate">{task.title}</h3>
        
        <p className="text-xs text-secondary-600 dark:text-secondary-400 line-clamp-2 leading-relaxed">{task.prompt}</p>

        {/* Footer info */}
        <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
          {task.dependencies.length > 0 && (
            <span className="flex items-center gap-1.5 bg-secondary-100 dark:bg-secondary-700 px-3 py-1.5 rounded-lg text-secondary-700 dark:text-secondary-300 border border-secondary-200 dark:border-secondary-600">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
              </svg>
              依赖: {task.dependencies.join(', ')}
            </span>
          )}
          {hasError && (
            <span className="flex items-center gap-1.5 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-lg text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              错误 {task.error_count} 次
            </span>
          )}
          {task.plan_mode && (
            <span className="flex items-center gap-1.5 bg-primary-50 dark:bg-primary-900/20 px-3 py-1.5 rounded-lg text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-800">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Plan模式
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
