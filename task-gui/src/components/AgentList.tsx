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
    <div className="space-y-4">
      <h2 className="text-sm font-medium text-gray-400 mb-3">
        执行者列表 ({agents.length})
      </h2>
      
      {agents.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <p>暂无执行者</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {agents.map(agent => (
            <div key={agent.worker} className="bg-gray-800/30 border border-gray-700/50 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-700/50 bg-gray-800/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                      <span className="text-white font-medium">{agent.worker}</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-white">{agent.worker}</h3>
                      <p className="text-xs text-gray-500">
                        {agent.tasks.length} 个任务
                      </p>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    <span className="bg-gray-700 px-2 py-1 rounded">
                      {agent.lockedPaths.join(', ')}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-medium text-gray-400">任务列表:</span>
                  <div className="flex flex-wrap gap-2">
                    {agent.tasks.map(task => (
                      <span key={task.id} className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300">
                        {task.id}: {task.title}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
