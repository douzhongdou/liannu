export interface AgentWorker {
  status: 'idle' | 'working' | 'planning' | 'integrating' | 'error';
  current_task_id: string | null;
  current_task_title: string | null;
  message: string;
  updated_at: string;
}

export interface AgentStatusData {
  updated_at: string;
  workers: Record<string, AgentWorker>;
  history: AgentHistoryEvent[];
}

export interface AgentHistoryEvent {
  timestamp: string;
  worker: string;
  event: string;
  task_id: string | null;
  detail: string;
}

// 前端使用的 Agent 类型（兼容现有组件）
export interface Agent {
  id: string;
  name: string;
  avatar: string;
  status: 'idle' | 'working' | 'error' | 'offline';
  currentTask: string | null;
  completedTasks: number;
  description: string;
}

// 状态颜色映射
export const agentStatusColors: Record<string, { bg: string; text: string; label: string }> = {
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
  planning: {
    bg: 'bg-amber-500',
    text: 'text-amber-600',
    label: '规划中'
  },
  integrating: {
    bg: 'bg-purple-500',
    text: 'text-purple-600',
    label: '集成中'
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
