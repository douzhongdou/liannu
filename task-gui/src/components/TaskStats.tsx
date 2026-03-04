import type { Task } from '../types/task';

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
    ready_to_integrate: tasks.filter(t => t.status === 'ready_to_integrate').length,
  };

  const statItems = [
    { label: '总计', value: stats.total, color: 'bg-slate-500' },
    { label: '进行中', value: stats.running, color: 'bg-blue-500' },
    { label: '待处理', value: stats.pending, color: 'bg-slate-400' },
    { label: '待集成', value: stats.ready_to_integrate, color: 'bg-purple-500' },
    { label: '已完成', value: stats.completed, color: 'bg-emerald-500' },
    { label: '失败', value: stats.failed, color: 'bg-red-500' },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {statItems.map(item => (
        <div key={item.label} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
          <div className={`w-2 h-2 rounded-full ${item.color}`} />
          <span className="text-xs font-medium text-slate-600">{item.label}</span>
          <span className="text-sm font-bold text-slate-800">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
