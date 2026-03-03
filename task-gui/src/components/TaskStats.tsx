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
    <div className="flex">
      {statItems.map(item => (
        <div key={item.label} className="flex flex-col items-center gap-1 p-3 rounded-lg bg-secondary-50 dark:bg-secondary-700/50 hover:bg-secondary-100 dark:hover:bg-secondary-700 transition-all duration-300 hover:scale-105">

            <span className="text-xs font-medium text-secondary-600 dark:text-secondary-400 text-center">{item.label}</span>
            <span className="font-bold text-base">{item.value}</span>
      
          
        </div>
      ))}
    </div>
  );
}
