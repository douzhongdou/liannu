import { useState } from 'react';
import type { Task } from '../types/task';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (task: Omit<Task, 'id' | 'status' | 'started_at' | 'completed_at' | 'error_count' | 'error_msg'>) => void;
}

export function TaskModal({ isOpen, onClose, onSubmit }: TaskModalProps) {
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [dependencies, setDependencies] = useState('');
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [planMode, setPlanMode] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      title,
      prompt,
      dependencies: dependencies.split(',').map(d => d.trim()).filter(d => d),
      assigned_to: assignedTo === '' ? null : assignedTo,
      worktree: null,
      plan_mode: planMode,
      work_branch: undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-fade-in transition-all duration-300" onClick={onClose}>
      <div className="w-full max-w-lg bg-white dark:bg-secondary-800 rounded-2xl border border-secondary-200 dark:border-secondary-700 shadow-2xl animate-slide-up transition-all duration-500 transform hover:scale-[1.01] active:scale-[0.99] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-secondary-200 dark:border-secondary-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-secondary-900 dark:text-secondary-100">新建任务</h2>
          <button
            onClick={onClose}
            className="p-2 text-secondary-500 dark:text-secondary-400 hover:bg-secondary-100 dark:hover:bg-secondary-700 rounded-lg transition-all duration-300 hover:scale-110"
            title="关闭"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-xs font-medium text-secondary-700 dark:text-secondary-300 mb-2">标题</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-4 py-3 bg-white dark:bg-secondary-900 border border-secondary-200 dark:border-secondary-700 rounded-lg text-secondary-900 dark:text-secondary-100 placeholder-secondary-500 dark:placeholder-secondary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-300 hover:border-primary-300 dark:hover:border-primary-700 shadow-sm"
              placeholder="任务标题"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-secondary-700 dark:text-secondary-300 mb-2">描述</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              required
              rows={5}
              className="w-full px-4 py-3 bg-white dark:bg-secondary-900 border border-secondary-200 dark:border-secondary-700 rounded-lg text-secondary-900 dark:text-secondary-100 placeholder-secondary-500 dark:placeholder-secondary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-300 resize-none hover:border-primary-300 dark:hover:border-primary-700 shadow-sm"
              placeholder="任务描述..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-secondary-700 dark:text-secondary-300 mb-2">依赖任务 (用逗号分隔)</label>
            <input
              type="text"
              value={dependencies}
              onChange={(e) => setDependencies(e.target.value)}
              className="w-full px-4 py-3 bg-white dark:bg-secondary-900 border border-secondary-200 dark:border-secondary-700 rounded-lg text-secondary-900 dark:text-secondary-100 placeholder-secondary-500 dark:placeholder-secondary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-300 hover:border-primary-300 dark:hover:border-primary-700 shadow-sm"
              placeholder="T1, T2"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-secondary-700 dark:text-secondary-300 mb-2">执行者</label>
            <input
              type="text"
              value={assignedTo || ''}
              onChange={(e) => setAssignedTo(e.target.value || null)}
              className="w-full px-4 py-3 bg-white dark:bg-secondary-900 border border-secondary-200 dark:border-secondary-700 rounded-lg text-secondary-900 dark:text-secondary-100 placeholder-secondary-500 dark:placeholder-secondary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-300 hover:border-primary-300 dark:hover:border-primary-700 shadow-sm"
              placeholder="w1, w2"
            />
          </div>

          <div className="flex items-center gap-3 p-4 bg-secondary-50 dark:bg-secondary-700/50 rounded-xl">
            <input
              type="checkbox"
              id="planMode"
              checked={planMode}
              onChange={(e) => setPlanMode(e.target.checked)}
              className="w-5 h-5 rounded text-primary-600 focus:ring-primary-500 bg-white dark:bg-secondary-900 border-secondary-300 dark:border-secondary-600 transition-all duration-300 cursor-pointer"
            />
            <label htmlFor="planMode" className="text-xs font-medium text-secondary-700 dark:text-secondary-300 cursor-pointer">Plan 模式</label>
          </div>

          <div className="flex gap-4 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-secondary-100 dark:bg-secondary-700 text-secondary-900 dark:text-secondary-100 border border-secondary-200 dark:border-secondary-600 rounded-lg hover:bg-secondary-200 dark:hover:bg-secondary-600 transition-all duration-300 font-medium shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-secondary-800 transform hover:scale-105 active:scale-95"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-all duration-300 font-medium shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-secondary-900 transform hover:scale-105 active:scale-95"
            >
              创建
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
