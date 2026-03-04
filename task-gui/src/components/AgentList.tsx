import { useMemo } from 'react';
import type { Task } from '../types/task';
import type { AgentStatusData, AgentWorker } from '../types/agent';
import { agentStatusColors } from '../types/agent';
import {
  PauseCircle,
  Activity,
  AlertCircle,
  Power,
  Clock,
  MessageSquare
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
    <div className="flex flex-col h-full min-w-[260px] w-full">
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

      {/* Agent 卡片列表 */}
      <div className="flex-1 space-y-3 overflow-y-auto">
        {agents.map(([agentId, agentData]) => (
          <AgentCard 
            key={agentId}
            agentId={agentId}
            agentData={agentData}
            tasks={tasks}
          />
        ))}
        {agents.length === 0 && (
          <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center bg-slate-50/50">
            <p className="text-xs text-slate-400">暂无执行者</p>
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
    <div className="h-full overflow-x-auto">
      <div className="flex gap-4 min-w-fit h-full pb-2">
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
      </div>
    </div>
  );
}
