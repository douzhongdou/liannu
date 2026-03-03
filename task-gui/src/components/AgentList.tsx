import { useMemo } from 'react';
import type { TaskLockData, Task } from '../types/task';

interface Agent {
  worker: string;
  tasks: Task[];
  lockedPaths: string[];
}

interface AgentListProps {
  locks: TaskLockData;
  tasks: Task[];
}

export function AgentList({ locks, tasks }: AgentListProps) {
  const agents = useMemo(() => {
    const agentMap = new Map<string, Agent>();

    locks.locks.forEach(lock => {
      if (!agentMap.has(lock.worker)) {
        agentMap.set(lock.worker, {
          worker: lock.worker,
          tasks: [],
          lockedPaths: lock.paths,
        });
      }
      agentMap.get(lock.worker)?.tasks.push(
        tasks.find(t => t.id === lock.task_id)!
      );
    });

    return Array.from(agentMap.values());
  }, [locks, tasks]);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-secondary-900 dark:text-secondary-100">
        执行者列表 ({agents.length})
      </h2>
      
      {agents.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-secondary-800 rounded-2xl border border-secondary-200 dark:border-secondary-700 shadow-lg">
          <div className="w-20 h-20 bg-secondary-100 dark:bg-secondary-700 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <p className="text-secondary-500 dark:text-secondary-400 text-xs">暂无执行者</p>
        </div>
      ) : (
        <div className="space-y-6">
          {agents.map(agent => (
            <div key={agent.worker} className="bg-white dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow">
              <div className="px-6 py-4 border-b border-secondary-200 dark:border-secondary-700 bg-secondary-50 dark:bg-secondary-700/50">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary-500 flex items-center justify-center shadow-md">
                      <span className="text-white font-bold">{agent.worker}</span>
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-secondary-900 dark:text-secondary-100">{agent.worker}</h3>
                      <p className="text-xs text-secondary-500 dark:text-secondary-400">
                        {agent.tasks.length} 个任务
                      </p>
                    </div>
                  </div>
                  <div className="text-xs text-secondary-600 dark:text-secondary-400">
                    <span className="bg-secondary-100 dark:bg-secondary-700 px-3 py-1.5 rounded-lg">
                      {agent.lockedPaths.join(', ')}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                <h4 className="text-xs font-semibold text-secondary-700 dark:text-secondary-300 mb-4">任务列表</h4>
                <div className="flex flex-wrap gap-3">
                  {agent.tasks.map(task => (
                    <span key={task.id} className="text-xs px-3 py-2 rounded-lg bg-secondary-100 dark:bg-secondary-700 text-secondary-700 dark:text-secondary-300 border border-secondary-200 dark:border-secondary-600 hover:bg-secondary-200 dark:hover:bg-secondary-600 transition-colors">
                      {task.id}: {task.title}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
