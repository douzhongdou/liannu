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
    <div className="flex flex-wrap items-center gap-6 p-5 bg-white dark:bg-secondary-800 rounded-xl border border-secondary-200 dark:border-secondary-700 shadow-sm">
      {statItems.map(item => (
        <div key={item.label} className="flex items-center gap-2.5">
          <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
          <span className="text-sm text-secondary-600 dark:text-secondary-400">{item.label}:</span>
          <span className="text-base font-semibold text-secondary-900 dark:text-secondary-100">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
