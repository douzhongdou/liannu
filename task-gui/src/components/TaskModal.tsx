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
  const [assignedTo, setAssignedTo] = useState('');
  const [planMode, setPlanMode] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      title,
      prompt,
      dependencies: dependencies.split(',').map(d => d.trim()).filter(d => d),
      assigned_to: assignedTo || null,
      worktree: null,
      plan_mode: planMode,
      work_branch: null,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-gray-800 rounded-xl border border-gray-700 shadow-2xl">
        <div className="p-6 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">新建任务</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">标题</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              placeholder="任务标题"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">描述</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              required
              rows={4}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
              placeholder="任务描述..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">依赖任务 (用逗号分隔)</label>
            <input
              type="text"
              value={dependencies}
              onChange={(e) => setDependencies(e.target.value)}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              placeholder="T1, T2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">执行者</label>
            <input
              type="text"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              placeholder="w1, w2"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="planMode"
              checked={planMode}
              onChange={(e) => setPlanMode(e.target.checked)}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-gray-900 border-gray-700"
            />
            <label htmlFor="planMode" className="text-sm text-gray-400">Plan 模式</label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              创建
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
