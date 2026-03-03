export interface Task {
  id: string;
  title: string;
  prompt: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  dependencies: string[];
  assigned_to: string | null;
  worktree: string | null;
  plan_mode: boolean;
  started_at: string | null;
  completed_at: string | null;
  error_count: number;
  error_msg: string | null;
  work_branch?: string;
}

export interface TaskLock {
  task_id: string;
  worker: string;
  paths: string[];
  locked_at: string;
  heartbeat_at: string;
}

export interface TaskData {
  version: string;
  tasks: Task[];
}

export interface TaskLockData {
  version: string;
  locks: TaskLock[];
}

export type TaskStatus = Task['status'];

export const statusLabels: Record<TaskStatus, string> = {
  pending: '待处理',
  running: '进行中',
  completed: '已完成',
  failed: '失败'
};

export const statusColors: Record<TaskStatus, string> = {
  pending: 'bg-secondary-500',
  running: 'bg-primary-500',
  completed: 'bg-green-500',
  failed: 'bg-red-500'
};
