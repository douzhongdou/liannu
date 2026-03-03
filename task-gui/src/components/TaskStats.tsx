import type { Task } from '../types/task';
import { statusColors } from '../types/task';

interface TaskStatsProps {
  tasks: Task[];
}

export function TaskStats({ tasks }: TaskStatsProps) {
  const stats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    running: tasks.filter(t => t.status === 'running').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    failed: tasks.filter(t => t.status === 'failed').length,
  };

  const statItems = [
    { label: '总计', value: stats.total, color: 'bg-secondary-500' },
    { label: '进行中', value: stats.running, color: statusColors.running },
    { label: '待处理', value: stats.pending, color: statusColors.pending },
    { label: '已完成', value: stats.completed, color: statusColors.completed },
    { label: '失败', value: stats.failed, color: statusColors.failed },
  ];

  return (
    <div className="flex flex-wrap items-center gap-8 p-6 bg-white dark:bg-secondary-800 rounded-2xl border border-secondary-200 dark:border-secondary-700 shadow-md transition-all duration-300 hover:shadow-lg">
      {statItems.map(item => (
        <div key={item.label} className="flex items-center gap-3 transition-all duration-300 hover:scale-105">
          <div className={`w-3 h-3 rounded-full ${item.color} transition-all duration-300 hover:scale-110`} />
          <span className="text-sm font-medium text-secondary-600 dark:text-secondary-400">{item.label}:</span>
          <span className="text-lg font-semibold text-secondary-900 dark:text-secondary-100 transition-all duration-300 hover:text-primary-500">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
