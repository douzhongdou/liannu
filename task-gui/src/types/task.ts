export interface Task {
  id: string;
  title: string;
  prompt: string;
  status: 'pending' | 'planning' | 'running' | 'completed' | 'failed' | 'ready_to_integrate';
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

// 状态标签映射
export const statusLabels: Record<TaskStatus, string> = {
  pending: '待处理',
  planning: '规划中',
  running: '进行中',
  completed: '已完成',
  failed: '错误',
  ready_to_integrate: '待集成'
};

// 状态颜色映射 - slate 配色方案
export const statusColors: Record<TaskStatus, { bg: string; text: string; border: string; label: string }> = {
  pending: {
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    border: 'border-slate-200',
    label: '待处理'
  },
  planning: {
    bg: 'bg-amber-50',
    text: 'text-amber-600',
    border: 'border-amber-200',
    label: '规划中'
  },
  running: {
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    border: 'border-blue-200',
    label: '进行中'
  },
  completed: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-600',
    border: 'border-emerald-200',
    label: '已完成'
  },
  failed: {
    bg: 'bg-red-50',
    text: 'text-red-600',
    border: 'border-red-200',
    label: '错误'
  },
  ready_to_integrate: {
    bg: 'bg-purple-50',
    text: 'text-purple-600',
    border: 'border-purple-200',
    label: '待集成'
  }
};

// 智能体状态类型
export type AgentStatus = 'idle' | 'working' | 'error' | 'offline';

// 智能体状态颜色映射
export const agentStatusColors: Record<AgentStatus, { bg: string; text: string; label: string }> = {
  idle: {
    bg: 'bg-emerald-500',
    text: 'text-emerald-600',
    label: '空闲'
  },
  working: {
    bg: 'bg-blue-500',
    text: 'text-blue-600',
    label: '工作中'
  },
  error: {
    bg: 'bg-red-500',
    text: 'text-red-600',
    label: '异常'
  },
  offline: {
    bg: 'bg-slate-400',
    text: 'text-slate-500',
    label: '离线'
  }
};

// 智能体数据结构
export interface Agent {
  id: string;
  name: string;
  avatar: string;
  status: AgentStatus;
  currentTask: string | null;
  completedTasks: number;
  description: string;
}
