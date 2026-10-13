import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  // Body scroll lock
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !loading) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onCancel]);

  if (!isOpen || typeof document === 'undefined') return null;

  let btnClass = 'bg-[#C62828] hover:bg-[#A31D1D] text-white';
  let icon = <Trash2 className="w-5 h-5 text-[#C62828]" />;

  if (type === 'primary') {
    btnClass = 'bg-[#15803D] hover:bg-[#0B3B24] text-white font-bold';
    icon = <CheckCircle2 className="w-5 h-5 text-[#15803D]" />;
  } else if (type === 'warning') {
    btnClass = 'bg-[#D98C00] hover:bg-[#B27200] text-white';
    icon = <AlertTriangle className="w-5 h-5 text-[#D98C00]" />;
  }

  return createPortal(
    <div
      className="fixed inset-0 bg-[#13261D]/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onCancel();
      }}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="relative z-[110] w-full max-w-md bg-white border border-[#D5E4DB] rounded-xl p-6 space-y-4 shadow-xl animate-in fade-in zoom-in-95 duration-150 text-[#13261D]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#F7FAF8] border border-[#D5E4DB] flex items-center justify-center shrink-0">
              {icon}
            </div>
            <div>
              <h3 className="text-base font-bold text-[#0B3B24]">{title}</h3>
              <p className="text-xs text-[#3E5649] mt-0.5">{message}</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            disabled={loading}
            className="text-[#627B6E] hover:text-[#13261D] p-1 rounded-lg transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="pt-3 border-t border-[#D5E4DB] flex items-center justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-[#F7FAF8] hover:bg-[#EEF5F1] text-[#3E5649] hover:text-[#13261D] font-semibold border border-[#CCE0D5] transition cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 rounded-lg font-bold transition shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer ${btnClass}`}
          >
            {loading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmationModal;
