import React, { useEffect } from 'react';
import { AlertTriangle, Trash2, CheckCircle2, X } from 'lucide-react';

export const ConfirmationModal = ({
  isOpen,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed with this action?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'danger', // 'danger' | 'warning' | 'primary'
  onConfirm,
  onCancel,
  loading = false
}) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !loading) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onCancel]);

  if (!isOpen) return null;

  let btnClass = 'bg-rose-600 hover:bg-rose-700 text-white';
  let icon = <Trash2 className="w-5 h-5 text-rose-600" />;

  if (type === 'primary') {
    btnClass = 'bg-gradient-to-r from-purple-600 via-violet-600 to-teal-500 hover:opacity-90 text-white';
    icon = <CheckCircle2 className="w-5 h-5 text-purple-600" />;
  } else if (type === 'warning') {
    btnClass = 'bg-amber-600 hover:bg-amber-700 text-white';
    icon = <AlertTriangle className="w-5 h-5 text-amber-600" />;
  }

  return (
    <div
      className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onCancel();
      }}
    >
      <div className="w-full max-w-md bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
              {icon}
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#1F2937]">{title}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{message}</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            disabled={loading}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="pt-3 border-t border-[#E5E7EB] flex items-center justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 rounded-xl font-bold transition shadow-xs active:scale-95 disabled:opacity-50 ${btnClass}`}
          >
            {loading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
