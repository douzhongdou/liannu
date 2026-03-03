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
    { label: '总计', value: stats.total, color: 'bg-gray-500' },
    { label: '进行中', value: stats.running, color: statusColors.running },
    { label: '待处理', value: stats.pending, color: statusColors.pending },
    { label: '已完成', value: stats.completed, color: statusColors.completed },
    { label: '失败', value: stats.failed, color: statusColors.failed },
  ];

  return (
    <div className="flex items-center gap-4 p-4 bg-gray-800/30 rounded-lg border border-gray-700/50">
      {statItems.map(item => (
        <div key={item.label} className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${item.color}`} />
          <span className="text-xs text-gray-400">{item.label}:</span>
          <span className="text-sm font-medium text-gray-200">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
