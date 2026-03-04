import { useMemo } from 'react';
import type { Task } from '../types/task';
import type { AgentStatusData, AgentWorker, AgentHistoryEvent } from '../types/agent';
import { agentStatusColors } from '../types/agent';
import {
  PauseCircle,
  Activity,
  AlertCircle,
  Power,
  Clock,
  History,
  User,
  CheckCircle2,
  GitCommit
} from 'lucide-react';

interface AgentListProps {
  agentStatus: AgentStatusData | null;
  tasks: Task[];
}

interface AgentColumnProps {
  status: string;
  statusLabel: string;
  agents: [string, AgentWorker][];
  tasks: Task[];
  color: { bg: string; text: string; border: string };
}

// 格式化时间
const formatTime = (timeStr: string) => {
  const date = new Date(timeStr);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};

const formatDateTime = (timeStr: string) => {
  const date = new Date(timeStr);
  return `${date.getMonth() + 1}/${date.getDate()} ${formatTime(timeStr)}`;
};

// 获取状态图标
const getStatusIcon = (status: string) => {
  switch (status) {
    case 'idle': return <PauseCircle className="w-4 h-4" />;
    case 'working': return <Activity className="w-4 h-4" />;
    case 'error': return <AlertCircle className="w-4 h-4" />;
    case 'offline': return <Power className="w-4 h-4" />;
    default: return null;
  }
};

const AgentCard = ({ 
  agentId, 
  agentData, 
  tasks 
}: { 
  agentId: string; 
  agentData: AgentWorker; 
  tasks: Task[] 
}) => {
  const statusColor = agentStatusColors[agentData.status] || agentStatusColors.offline;
  
  // 获取当前任务信息
  const getCurrentTaskInfo = () => {
    if (!agentData.current_task_id) return null;
    const task = tasks.find(t => t.id === agentData.current_task_id);
    return task ? task.title : agentData.current_task_title || agentData.current_task_id;
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3 cursor-pointer hover:shadow-md hover:border-slate-300 transition-all duration-200 group">
      {/* 头部：ID和状态 */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded">
          {agentId}
        </span>
        <div className={`w-2 h-2 rounded-full ${statusColor.bg}`} />
      </div>

      {/* 当前任务 */}
      {agentData.current_task_id && (
        <div className="mb-2">
          <div className="flex items-center gap-1 text-xs text-slate-400 mb-0.5">
            <Clock className="w-3 h-3" />
            <span>当前任务</span>
          </div>
          <div className="text-sm font-medium text-slate-700 line-clamp-1 group-hover:text-blue-600 transition-colors">
            {getCurrentTaskInfo()}
          </div>
        </div>
      )}

      {/* 状态消息 */}
      <div className="mb-2">
        <div className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
          {agentData.message || '-'}
        </div>
      </div>

      {/* 底部：时间 */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-400">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>{formatTime(agentData.updated_at)}</span>
        </div>
        {agentData.current_task_id && (
          <span className="text-blue-600 font-medium">{agentData.current_task_id}</span>
        )}
      </div>
    </div>
  );
};

const AgentColumn = ({ status, statusLabel, agents, tasks, color }: AgentColumnProps) => {
  return (
    <div className="flex flex-col w-[260px] flex-shrink-0">
      {/* 列标题 */}
      <div className={`flex items-center justify-between px-3 py-2 rounded-lg ${color.bg} border ${color.border} mb-3`}>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${color.text}`}>
            {statusLabel}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full bg-white/80 ${color.text}`}>
            {agents.length}
          </span>
        </div>
        {getStatusIcon(status)}
      </div>

      {/* Agent 卡片列表 - 瀑布流，高度自适应 */}
      <div className="space-y-3 pr-1">
        {agents.map(([agentId, agentData]) => (
          <AgentCard 
            key={agentId}
            agentId={agentId}
            agentData={agentData}
            tasks={tasks}
          />
        ))}
        {agents.length === 0 && (
          <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center bg-slate-50/50">
            <p className="text-xs text-slate-400">暂无执行者</p>
          </div>
        )}
      </div>
    </div>
  );
};

// History 时间线组件
const HistoryTimeline = ({ history }: { history: AgentHistoryEvent[] }) => {
  // 只显示最近 20 条
  const recentHistory = history.slice(0, 20);

  // 按 worker 分组颜色
  const workerColors: Record<string, string> = {
    'w1': 'bg-blue-500',
    'w2': 'bg-emerald-500',
    'w3': 'bg-purple-500',
  };

  const getEventIcon = (event: string) => {
    switch (event) {
      case 'idle': return <PauseCircle className="w-3 h-3" />;
      case 'working':
      case 'planning': return <Activity className="w-3 h-3" />;
      case 'integrating': return <CheckCircle2 className="w-3 h-3" />;
      default: return <GitCommit className="w-3 h-3" />;
    }
  };

  const getEventColor = (event: string) => {
    switch (event) {
      case 'idle': return 'text-emerald-600 bg-emerald-50';
      case 'working': return 'text-blue-600 bg-blue-50';
      case 'planning': return 'text-amber-600 bg-amber-50';
      case 'integrating': return 'text-purple-600 bg-purple-50';
      case 'error': return 'text-red-600 bg-red-50';
      default: return 'text-slate-600 bg-slate-50';
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 h-full w-[350px] flex-shrink-0">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
        <History className="w-4 h-4 text-slate-500" />
        <h3 className="font-semibold text-slate-800">执行历史</h3>
        <span className="text-xs text-slate-400 ml-auto">最近 {recentHistory.length} 条</span>
      </div>

      <div className="space-y-3 pr-2">
        {recentHistory.map((event, index) => (
          <div key={index} className="flex gap-3 group">
            {/* 时间线 */}
            <div className="flex flex-col items-center">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${getEventColor(event.event)}`}>
                {getEventIcon(event.event)}
              </div>
              {index < recentHistory.length - 1 && (
                <div className="w-0.5 h-full bg-slate-200 mt-1" />
              )}
            </div>

            {/* 内容 */}
            <div className="flex-1 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-medium px-2 py-0.5 rounded text-white ${workerColors[event.worker] || 'bg-slate-500'}`}>
                  {event.worker}
                </span>
                <span className="text-xs text-slate-400">{formatDateTime(event.timestamp)}</span>
              </div>
              <div className="text-sm text-slate-700">
                {event.detail}
              </div>
              {event.task_id && (
                <div className="text-xs text-blue-600 mt-1">
                  任务: {event.task_id}
                </div>
              )}
            </div>
          </div>
        ))}

        {recentHistory.length === 0 && (
          <div className="text-center py-8 text-slate-400 text-sm">
            暂无历史记录
          </div>
        )}
      </div>
    </div>
  );
};

export function AgentList({ agentStatus, tasks }: AgentListProps) {
  // 按状态分组 agent
  const columns = useMemo(() => {
    const workers = agentStatus?.workers || {};
    const allAgents = Object.entries(workers);
    
    // 映射状态到分组
    const mapStatus = (status: string) => {
      switch (status) {
        case 'idle': return 'idle';
        case 'working':
        case 'planning':
        case 'integrating': return 'working';
        case 'error': return 'error';
        default: return 'offline';
      }
    };

    return {
      idle: allAgents.filter(([, a]) => mapStatus(a.status) === 'idle'),
      working: allAgents.filter(([, a]) => mapStatus(a.status) === 'working'),
      error: allAgents.filter(([, a]) => mapStatus(a.status) === 'error'),
      offline: allAgents.filter(([, a]) => mapStatus(a.status) === 'offline'),
    };
  }, [agentStatus]);

  // 列配置
  const columnConfigs = [
    {
      status: 'idle',
      label: '空闲中',
      color: {
        bg: 'bg-emerald-50',
        text: 'text-emerald-600',
        border: 'border-emerald-200'
      }
    },
    {
      status: 'working',
      label: '工作中',
      color: {
        bg: 'bg-blue-50',
        text: 'text-blue-600',
        border: 'border-blue-200'
      }
    },
    {
      status: 'error',
      label: '异常',
      color: {
        bg: 'bg-red-50',
        text: 'text-red-600',
        border: 'border-red-200'
      }
    },
    {
      status: 'offline',
      label: '离线',
      color: {
        bg: 'bg-slate-100',
        text: 'text-slate-600',
        border: 'border-slate-200'
      }
    }
  ];

  return (
    <div className="h-full overflow-x-auto overflow-y-hidden">
      <div className="flex gap-4 h-full min-w-max px-1">
        {/* 看板列 */}
        {columnConfigs.map((col) => (
          <AgentColumn
            key={col.status}
            status={col.status}
            statusLabel={col.label}
            agents={columns[col.status as keyof typeof columns]}
            tasks={tasks}
            color={col.color}
          />
        ))}

        {/* History 时间线 */}
        {agentStatus?.history && (
          <HistoryTimeline history={agentStatus.history} />
        )}
      </div>
    </div>
  );
}
