import type { Task, TaskLockData, TaskStatus } from '../types/task';
import { statusLabels, statusColors } from '../types/task';
import { getWorkerForTask } from '../services/taskService';
import { Calendar, User, AlertCircle, CheckCircle2 } from 'lucide-react';

interface TaskKanbanProps {
  tasks: Task[];
  locks: TaskLockData;
  onSelect: (taskId: string) => void;
}

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
  locks: TaskLockData;
  onSelect: (taskId: string) => void;
}

// 默认颜色配置（用于未知状态）
const defaultStatusColor = {
  bg: 'bg-slate-100',
  text: 'text-slate-600',
  border: 'border-slate-200',
  label: '未知'
};

// 格式化日期
const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const KanbanTaskCard = ({ task, locks, onSelect }: { task: Task; locks: TaskLockData; onSelect: (taskId: string) => void }) => {
  const worker = getWorkerForTask(locks, task.id);
  const statusColor = statusColors[task.status] || defaultStatusColor;

  return (
    <div
      onClick={() => onSelect(task.id)}
      className="bg-white rounded-lg border border-slate-200 p-3 cursor-pointer hover:shadow-md hover:border-slate-300 transition-all duration-200 group"
    >
      {/* 任务标题 */}
      <h3 className="font-medium text-slate-800 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors text-sm">
        {task.title}
      </h3>

      {/* 任务描述预览 */}
      <p className="text-xs text-slate-500 mb-2 line-clamp-2 leading-relaxed">
        {task.prompt.split('\n')[0]}
      </p>

      {/* 状态标签 */}
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        <span className={`text-xs px-2 py-0.5 rounded ${statusColor.bg} ${statusColor.text} font-medium`}>
          {statusLabels[task.status] || task.status}
        </span>
        {task.error_count > 0 && (
          <span className="text-xs px-2 py-0.5 rounded bg-red-50 text-red-600 font-medium flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {task.error_count}
          </span>
        )}
        {worker && (
          <span className="text-xs px-2 py-0.5 rounded bg-purple-50 text-purple-600 font-medium">
            {worker}
          </span>
        )}
      </div>

      {/* 元信息 */}
      <div className="flex flex-col gap-1 text-xs text-slate-400">
        {/* 负责人 */}
        <div className="flex items-center gap-1">
          <User className="w-3 h-3" />
          <span className="truncate">{task.assigned_to || '未分配'}</span>
        </div>

        {/* 时间信息 */}
        <div className="flex items-center justify-between pt-1">
          {task.started_at ? (
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>{formatDate(task.started_at)}</span>
            </div>
          ) : (
            <span>-</span>
          )}

          {task.completed_at && (
            <div className="flex items-center gap-1 text-emerald-500">
              <CheckCircle2 className="w-3 h-3" />
              <span>{formatDate(task.completed_at)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const KanbanColumn = ({ status, tasks, locks, onSelect }: KanbanColumnProps) => {
  const colors = statusColors[status] || defaultStatusColor;

  return (
    <div className="flex flex-col">
      {/* 列标题 */}
      <div className={`flex items-center justify-between px-3 py-2 rounded-lg ${colors.bg} border ${colors.border} mb-3`}>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${colors.text}`}>
            {colors.label}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full bg-white/80 ${colors.text}`}>
            {tasks.length}
          </span>
        </div>
      </div>

      {/* 任务卡片列表 */}
      <div className="space-y-2">
        {tasks.map((task) => (
          <KanbanTaskCard key={task.id} task={task} locks={locks} onSelect={onSelect} />
        ))}
        {tasks.length === 0 && (
          <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center bg-slate-50/50">
            <p className="text-xs text-slate-400">暂无任务</p>
          </div>
        )}
      </div>
    </div>
  );
};

export function TaskKanban({ tasks, locks, onSelect }: TaskKanbanProps) {
  // 按状态分组任务
  const columns: TaskStatus[] = ['pending', 'planning', 'running', 'ready_to_integrate', 'completed', 'failed'];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {columns.map((status) => (
        <KanbanColumn
          key={status}
          status={status}
          tasks={tasks.filter(t => t.status === status)}
          locks={locks}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
