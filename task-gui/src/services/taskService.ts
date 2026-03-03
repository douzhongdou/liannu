import type { TaskData, TaskLockData, Task } from '../types/task';

const TASKS_FILE = '/api/tasks';
const LOCKS_FILE = '/api/locks';

export async function fetchTasks(): Promise<TaskData> {
  console.log('[TaskService] Fetching tasks from:', TASKS_FILE);
  const response = await fetch(TASKS_FILE);
  console.log('[TaskService] Response status:', response.status, response.statusText);
  console.log('[TaskService] Response URL:', response.url);
  console.log('[TaskService] Content-Type:', response.headers.get('content-type'));
  
  if (!response.ok) {
    const text = await response.text();
    console.error('[TaskService] Error response body:', text.substring(0, 200));
    throw new Error(`Failed to fetch tasks: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  console.log('[TaskService] Tasks loaded:', data.tasks?.length || 0);
  return data;
}

export async function fetchLocks(): Promise<TaskLockData> {
  console.log('[TaskService] Fetching locks from:', LOCKS_FILE);
  try {
    const response = await fetch(LOCKS_FILE);
    console.log('[TaskService] Locks response status:', response.status);
    
    if (!response.ok) {
      console.log('[TaskService] Locks file not found, returning empty');
      return { version: '1.0', locks: [] };
    }
    return response.json();
  } catch (err) {
    console.log('[TaskService] Locks fetch error:', err);
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
