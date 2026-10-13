import React from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

/**
 * NerPanel — Contextual Operational Inspector Panel
 * Floats or slides in beside a map/table to reveal details without card wall clutter.
 */
export const NerPanel = ({
  title,
  subtitle,
  badge,
  onClose,
  actions,
  children,
  className = '',
  width = 'w-full md:w-96',
  isOpen = true
}) => {
  const { t } = useTranslation();
  if (!isOpen) return null;

  return (
    <div
      className={`bg-white border border-ner-border rounded-lg shadow-elevated flex flex-col overflow-hidden text-xs text-ner-text select-none ${width} ${className}`}
    >
      {/* Header */}
      <div className="p-3 bg-ner-subtle/70 border-b border-ner-border flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-ner-primary text-xs uppercase tracking-wider truncate">
              {title}
            </span>
            {badge}
          </div>
          {subtitle && (
            <div className="text-[11px] text-ner-muted truncate mt-0.5 font-medium">
              {subtitle}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {actions}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded text-ner-muted hover:text-ner-text hover:bg-white transition-colors cursor-pointer"
              title={t('common.close', 'Close')}
              aria-label={t('common.close', 'Close')}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>


      {/* Body */}
      <div className="p-3.5 space-y-3 overflow-y-auto max-h-[calc(85vh-80px)]">
        {children}
      </div>
    </div>
  );
};

export default NerPanel;
