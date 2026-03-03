import type { TaskData, TaskLockData, Task } from '../types/task';

export async function fetchTasks(): Promise<TaskData> {
  console.log('[TaskService] Loading tasks from local file');
  try {
    // 使用fetch加载本地JSON文件
    const response = await fetch('dev-tasks.json');
    if (!response.ok) {
      throw new Error(`Failed to fetch tasks: ${response.status}`);
    }
    const data = await response.json();
    console.log('[TaskService] Tasks loaded:', data.tasks?.length || 0);
    return data;
  } catch (err) {
    console.error('[TaskService] Error loading tasks:', err);
    // 返回默认数据结构
    return { version: '1.0', tasks: [] };
  }
}

export async function fetchLocks(): Promise<TaskLockData> {
  console.log('[TaskService] Loading locks from local file');
  try {
    // 使用fetch加载本地JSON文件
    const response = await fetch('dev-task.lock');
    if (!response.ok) {
      throw new Error(`Failed to fetch locks: ${response.status}`);
    }
    const data = await response.json();
    console.log('[TaskService] Locks loaded:', data.locks?.length || 0);
    return data;
  } catch (err) {
    console.error('[TaskService] Error loading locks:', err);
    return { version: '1.0', locks: [] };
  }
}

export function getLockedTaskIds(locks: TaskLockData): Set<string> {
  return new Set(locks.locks.map(lock => lock.task_id));
}

export function getWorkerForTask(locks: TaskLockData, taskId: string): string | null {
  const lock = locks.locks.find(l => l.task_id === taskId);
  return lock?.worker || null;
}

export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const statusOrder = { running: 0, pending: 1, failed: 2, completed: 3 };
    return statusOrder[a.status] - statusOrder[b.status];
  });
}

export function filterTasksByStatus(tasks: Task[], status: Task['status'] | 'all'): Task[] {
  if (status === 'all') return tasks;
  return tasks.filter(task => task.status === status);
}

export function searchTasks(tasks: Task[], query: string): Task[] {
  const lowerQuery = query.toLowerCase();
  return tasks.filter(task =>
    task.title.toLowerCase().includes(lowerQuery) ||
    task.id.toLowerCase().includes(lowerQuery) ||
    task.prompt.toLowerCase().includes(lowerQuery)
  );
}
