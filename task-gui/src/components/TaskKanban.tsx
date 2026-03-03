import type { Task, TaskLockData } from '../types/task';
import { statusLabels, statusColors } from '../types/task';

interface TaskKanbanProps {
  tasks: Task[];
  locks: TaskLockData;
  onSelect: (taskId: string) => void;
}

const columns: { id: Task['status']; title: string }[] = [
  { id: 'pending', title: '待处理' },
  { id: 'running', title: '进行中' },
  { id: 'completed', title: '已完成' },
  { id: 'failed', title: '失败' },
];

export function TaskKanban({ tasks, locks, onSelect }: TaskKanbanProps) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map(column => {
        const columnTasks = tasks.filter(t => t.status === column.id);
        return (
          <div key={column.id} className="min-w-[280px] flex-1">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-400">{column.title}</h3>
              <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
                {columnTasks.length}
              </span>
            </div>
            <div className="space-y-3">
              {columnTasks.map(task => {
                const worker = locks.locks.find(l => l.task_id === task.id)?.worker;
                return (
                  <div
                    key={task.id}
                    onClick={() => onSelect(task.id)}
                    className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 cursor-pointer hover:border-blue-500/50 transition-all hover:shadow-lg hover:shadow-blue-500/10"
                  >
                    <div className="flex items-center gap-2 mb-2">
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
                    <h4 className="text-sm font-medium text-gray-200 mb-1">{task.title}</h4>
                    <p className="text-xs text-gray-500 line-clamp-2">{task.prompt}</p>
                  </div>
                );
              })}
              {columnTasks.length === 0 && (
                <div className="border-2 border-dashed border-gray-700/50 rounded-lg p-4 text-center">
                  <p className="text-xs text-gray-600">空</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
