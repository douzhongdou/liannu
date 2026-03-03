import type { Task, TaskLockData } from '../types/task';
import { statusLabels, statusColors } from '../types/task';

interface TaskTableProps {
  tasks: Task[];
  locks: TaskLockData;
  onSelect: (taskId: string) => void;
}

export function TaskTable({ tasks, locks, onSelect }: TaskTableProps) {
  return (
    <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-800/50 border-b border-gray-700">
            <tr>
              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">ID</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">标题</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">状态</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">执行者</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">依赖</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">错误</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {tasks.map(task => (
              <tr
                key={task.id}
                onClick={() => onSelect(task.id)}
                className="hover:bg-gray-700/30 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3 text-sm text-gray-500 font-mono">{task.id}</td>
                <td className="px-4 py-3 text-sm text-gray-200">{task.title}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColors[task.status]} text-white`}>
                    {statusLabels[task.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-300">
                  {locks.locks.find(l => l.task_id === task.id)?.worker || '未分配'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-400">
                  {task.dependencies.length > 0 ? task.dependencies.join(', ') : '-'}
                </td>
                <td className="px-4 py-3 text-sm">
                  {task.error_count > 0 ? (
                    <span className="text-red-400">{task.error_count}</span>
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
