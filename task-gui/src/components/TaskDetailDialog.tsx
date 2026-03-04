import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import type { Task, TaskStatus } from '@/types/task';
import { statusLabels, statusColors } from '@/types/task';
import {
  User,
  AlertCircle,
  GitBranch,
  CheckCircle2,
  PlayCircle,
  PauseCircle,
  FileText,
  Link2,
  XCircle,
  Clock
} from 'lucide-react';

interface TaskDetailDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// 默认颜色配置（用于未知状态）
const defaultStatusColor = {
  bg: 'bg-slate-100',
  text: 'text-slate-600',
  border: 'border-slate-200',
  label: '未知'
};

export const TaskDetailDialog = ({ task, open, onOpenChange }: TaskDetailDialogProps) => {
  if (!task) return null;

  const statusColor = statusColors[task.status as TaskStatus] || defaultStatusColor;

  // 格式化日期
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '未设置';
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 获取状态图标
  const getStatusIcon = () => {
    switch (task.status) {
      case 'pending':
        return <PauseCircle className="w-4 h-4" />;
      case 'running':
        return <PlayCircle className="w-4 h-4" />;
      case 'completed':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'failed':
        return <XCircle className="w-4 h-4" />;
      case 'ready_to_integrate':
        return <Clock className="w-4 h-4" />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-mono text-muted-foreground">{task.id}</span>
                <span className={`text-xs px-2 py-0.5 rounded-md ${statusColor.bg} ${statusColor.text} font-medium flex items-center gap-1`}>
                  {getStatusIcon()}
                  {statusLabels[task.status as TaskStatus] || task.status}
                </span>
                {task.plan_mode && (
                  <span className="text-xs px-2 py-0.5 rounded-md bg-purple-50 text-purple-600 font-medium">
                    计划模式
                  </span>
                )}
              </div>
              <DialogTitle className="text-xl font-semibold leading-tight">
                {task.title}
              </DialogTitle>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="px-6 py-4 space-y-6">
            {/* 任务描述 */}
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                任务详情
              </h4>
              <div className="bg-muted rounded-lg p-4">
                <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">
                  {task.prompt}
                </pre>
              </div>
            </div>

            <Separator />

            {/* 基本信息网格 */}
            <div className="grid grid-cols-2 gap-4">
              {/* 负责人 */}
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  负责人
                </h4>
                <div className="flex items-center gap-2">
                  {task.assigned_to ? (
                    <>
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-medium">
                        {task.assigned_to.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-sm text-muted-foreground">{task.assigned_to}</span>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">未分配</span>
                  )}
                </div>
              </div>

              {/* 工作分支 */}
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-muted-foreground" />
                  工作分支
                </h4>
                <span className="text-sm text-muted-foreground">
                  {task.work_branch || '-'}
                </span>
              </div>

              {/* 开始时间 */}
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <PlayCircle className="w-4 h-4 text-muted-foreground" />
                  开始时间
                </h4>
                <span className="text-sm text-muted-foreground">
                  {formatDate(task.started_at)}
                </span>
              </div>

              {/* 完成时间 */}
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                  完成时间
                </h4>
                <span className={`text-sm ${task.completed_at ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                  {formatDate(task.completed_at)}
                </span>
              </div>
            </div>

            {/* 依赖任务 */}
            {task.dependencies.length > 0 && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Link2 className="w-4 h-4 text-muted-foreground" />
                    依赖任务
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {task.dependencies.map(depId => (
                      <span
                        key={depId}
                        className="text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground"
                      >
                        {depId}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* 错误信息 */}
            {task.error_count > 0 && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-medium text-red-600 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    错误信息 ({task.error_count} 次)
                  </h4>
                  <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                    <p className="text-sm text-red-600">
                      {task.error_msg || '未知错误'}
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* 工作区 */}
            {task.worktree && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-medium mb-2">
                    工作目录
                  </h4>
                  <code className="text-xs bg-muted px-2 py-1 rounded text-muted-foreground">
                    {task.worktree}
                  </code>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
