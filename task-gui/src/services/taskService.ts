import type { TaskData, TaskLockData, Task } from '../types/task';
import type { AgentStatusData } from '../types/agent';

// API 基础 URL
const API_BASE_URL = 'http://localhost:3000/api';

export async function fetchTasks(): Promise<TaskData> {
  console.log('[TaskService] Fetching tasks from API:', `${API_BASE_URL}/tasks`);
  
  const response = await fetch(`${API_BASE_URL}/tasks`, {
    headers: {
      'Accept': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const data = await response.json();
  console.log('[TaskService] Tasks loaded:', data.tasks?.length || 0, 'tasks');
  
  if (!data.tasks || !Array.isArray(data.tasks)) {
    throw new Error('Invalid tasks data format');
  }
  
  return data;
}

export async function fetchLocks(): Promise<TaskLockData> {
  console.log('[TaskService] Fetching locks from API:', `${API_BASE_URL}/locks`);
  
  const response = await fetch(`${API_BASE_URL}/locks`, {
    headers: {
      'Accept': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const data = await response.json();
  console.log('[TaskService] Locks loaded:', data.locks?.length || 0, 'locks');
  
  if (!data.locks || !Array.isArray(data.locks)) {
    throw new Error('Invalid locks data format');
  }
  
  return data;
}

export async function fetchAgents(): Promise<AgentStatusData> {
  console.log('[TaskService] Fetching agents from API:', `${API_BASE_URL}/agents`);
  
  const response = await fetch(`${API_BASE_URL}/agents`, {
    headers: {
      'Accept': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const data = await response.json();
  console.log('[TaskService] Agents loaded:', Object.keys(data.workers || {}).length, 'workers');
  
  return data;
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
    const statusOrder = { running: 0, pending: 1, ready_to_integrate: 2, failed: 3, completed: 4 };
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
