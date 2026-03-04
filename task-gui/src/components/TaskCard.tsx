import type { Task, TaskLockData } from '../types/task';
import { statusLabels, statusColors, type TaskStatus } from '../types/task';
import { getWorkerForTask } from '../services/taskService';
import { Calendar, User, AlertCircle, GitBranch, CheckCircle2 } from 'lucide-react';

interface TaskCardProps {
  task: Task;
  locks: TaskLockData;
  isSelected: boolean;
  onClick: () => void;
}

// 默认颜色配置（用于未知状态）
const defaultStatusColor = {
  bg: 'bg-slate-100',
  text: 'text-slate-600',
  border: 'border-slate-200',
  label: '未知'
};

export function TaskCard({ task, locks, isSelected, onClick }: TaskCardProps) {
  const worker = getWorkerForTask(locks, task.id);
  const statusColor = statusColors[task.status as TaskStatus] || defaultStatusColor;

  // 格式化日期
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  // 获取负责人显示
  const getAssignee = () => {
    if (!task.assigned_to) return '未分配';
    return task.assigned_to;
  };

  return (
    <div
      onClick={onClick}
      className={`
        bg-white rounded-xl border cursor-pointer transition-all duration-200 group
        ${isSelected
          ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-lg'
          : 'border-slate-200 hover:shadow-md hover:border-slate-300'
        }
      `}
    >
      <div className="p-4">
        {/* 任务标题 */}
        <h3 className="font-medium text-slate-800 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
          {task.title}
        </h3>

        {/* 任务描述预览 */}
        <p className="text-xs text-slate-500 mb-3 line-clamp-2 leading-relaxed">
          {task.prompt.split('\n')[0]}
        </p>

        {/* 状态标签 */}
        <div className="flex items-center gap-2 mb-3">
          <span className={`text-xs px-2 py-1 rounded-md ${statusColor.bg} ${statusColor.text} font-medium`}>
            {statusLabels[task.status as TaskStatus] || task.status}
          </span>
          {task.error_count > 0 && (
            <span className="text-xs px-2 py-1 rounded-md bg-red-50 text-red-600 font-medium flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {task.error_count} 错误
            </span>
          )}
          {worker && (
            <span className="text-xs px-2 py-1 rounded-md bg-purple-50 text-purple-600 font-medium">
              {worker}
            </span>
          )}
        </div>

        {/* 元信息 */}
        <div className="flex flex-col gap-1.5 text-xs text-slate-400">
          {/* 负责人 */}
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" />
            <span>{getAssignee()}</span>
          </div>

          {/* 分支信息 */}
          {task.work_branch && (
            <div className="flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5" />
              <span className="truncate">{task.work_branch}</span>
            </div>
          )}

          {/* 时间信息 */}
          <div className="flex items-center justify-between pt-1">
            {task.started_at ? (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>{formatDate(task.started_at)}</span>
              </div>
            ) : (
              <span>-</span>
            )}

            {task.completed_at && (
              <div className="flex items-center gap-1.5 text-emerald-500">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{formatDate(task.completed_at)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
