import type { Task, TaskLockData } from '../types/task';
import { statusLabels, statusColors } from '../types/task';

interface TaskTableProps {
  tasks: Task[];
  locks: TaskLockData;
  onSelect: (taskId: string) => void;
}

export function TaskTable({ tasks, locks, onSelect }: TaskTableProps) {
  return (
    <div className="bg-white dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-2xl overflow-hidden shadow-lg">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-secondary-50 dark:bg-secondary-700 border-b border-secondary-200 dark:border-secondary-600">
            <tr>
              <th className="px-6 py-4 text-xs font-semibold text-secondary-600 dark:text-secondary-400 uppercase tracking-wider">ID</th>
              <th className="px-6 py-4 text-xs font-semibold text-secondary-600 dark:text-secondary-400 uppercase tracking-wider">标题</th>
              <th className="px-6 py-4 text-xs font-semibold text-secondary-600 dark:text-secondary-400 uppercase tracking-wider">状态</th>
              <th className="px-6 py-4 text-xs font-semibold text-secondary-600 dark:text-secondary-400 uppercase tracking-wider">执行者</th>
              <th className="px-6 py-4 text-xs font-semibold text-secondary-600 dark:text-secondary-400 uppercase tracking-wider">依赖</th>
              <th className="px-6 py-4 text-xs font-semibold text-secondary-600 dark:text-secondary-400 uppercase tracking-wider">错误</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-secondary-200 dark:divide-secondary-700">
            {tasks.map(task => (
              <tr
                key={task.id}
                onClick={() => onSelect(task.id)}
                className="hover:bg-secondary-50 dark:hover:bg-secondary-700/50 cursor-pointer transition-colors"
              >
                <td className="px-6 py-4 text-xs text-secondary-500 dark:text-secondary-400 font-mono">{task.id}</td>
                <td className="px-6 py-4 text-xs font-medium text-secondary-900 dark:text-secondary-100">{task.title}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${statusColors[task.status]} text-white`}>
                    {statusLabels[task.status]}
                  </span>
                </td>
                <td className="px-6 py-4 text-xs text-secondary-700 dark:text-secondary-300">
                  {locks.locks.find(l => l.task_id === task.id)?.worker || '未分配'}
                </td>
                <td className="px-6 py-4 text-xs text-secondary-600 dark:text-secondary-400">
                  {task.dependencies.length > 0 ? task.dependencies.join(', ') : '-'}
                </td>
                <td className="px-6 py-4 text-xs">
                  {task.error_count > 0 ? (
                    <span className="text-red-600 dark:text-red-400 font-medium">{task.error_count}</span>
                  ) : (
                    '-' 
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
