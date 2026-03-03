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
  { id: 'ready_to_integrate', title: '待集成' },
  { id: 'completed', title: '已完成' },
  { id: 'failed', title: '失败' },
];

export function TaskKanban({ tasks, locks, onSelect }: TaskKanbanProps) {
  return (
    <div className="flex gap-6 overflow-x-auto pb-6">
      {columns.map(column => {
        const columnTasks = tasks.filter(t => t.status === column.id);
        return (
          <div key={column.id} className="min-w-[300px] flex-1">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold text-secondary-700 dark:text-secondary-300">{column.title}</h3>
              <span className="text-xs text-secondary-500 dark:text-secondary-400 bg-secondary-100 dark:bg-secondary-700 px-3 py-1 rounded-full">
                {columnTasks.length}
              </span>
            </div>
            <div className="space-y-4">
              {columnTasks.map(task => {
                const worker = locks.locks.find(l => l.task_id === task.id)?.worker;
                return (
                  <div
                    key={task.id}
                    onClick={() => onSelect(task.id)}
                    className="bg-white dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-xl p-4 cursor-pointer hover:border-primary-500/50 transition-all hover:shadow-xl hover:shadow-primary-500/10"
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className="text-xs font-mono text-secondary-500 dark:text-secondary-400 bg-secondary-100 dark:bg-secondary-700 px-2.5 py-1 rounded-lg">{task.id}</span>
                      <span className={`text-xs px-3 py-1 rounded-full text-white font-medium ${statusColors[task.status]}`}>
                        {statusLabels[task.status]}
                      </span>
                      {worker && (
                        <span className="text-xs px-3 py-1 rounded-full bg-accent-50 dark:bg-accent-900/30 text-accent-600 dark:text-accent-400 border border-accent-200 dark:border-accent-800 font-medium">
                          {worker}
                        </span>
                      )}
                    </div>
                    <h4 className="text-xs font-semibold text-secondary-900 dark:text-secondary-100 mb-2">{task.title}</h4>
                    <p className="text-xs text-secondary-600 dark:text-secondary-400 line-clamp-2">{task.prompt}</p>
                  </div>
                );
              })}
              {columnTasks.length === 0 && (
                <div className="border-2 border-dashed border-secondary-200 dark:border-secondary-700 rounded-xl p-8 text-center bg-secondary-50 dark:bg-secondary-700/50">
                  <div className="w-12 h-12 bg-secondary-100 dark:bg-secondary-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <p className="text-xs text-secondary-500 dark:text-secondary-400">暂无任务</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
