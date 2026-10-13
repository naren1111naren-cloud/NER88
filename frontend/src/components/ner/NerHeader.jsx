import React from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';

/**
 * NerHeader — Standardized Institutional Page Header
 * Provides consistent typography, operational badge, metadata, and live telemetry timestamp across all pages.
 */
export const NerHeader = ({
  title,
  subtitle,
  badge,
  lastUpdated = '21:08 IST',
  onRefresh,
  refreshing = false,
  actions,
  children
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-4 border-b border-ner-border">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-xl sm:text-2xl font-bold text-ner-primary tracking-tight">
            {title}
          </h1>
          {badge && (
            <span className="text-[11px] font-semibold text-ner-muted bg-ner-subtle border border-ner-border px-2 py-0.5 rounded">
              {badge}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-xs text-ner-text-secondary mt-1 max-w-3xl leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0 text-xs">
        {lastUpdated && (
          <div className="flex items-center gap-1.5 text-ner-muted font-medium bg-white border border-ner-border px-2.5 py-1 rounded-md shadow-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-ner-open" />
            </span>
            <span className="font-bold text-ner-text">{t('common.live', 'LIVE')}</span>
            <span className="text-ner-border-strong">·</span>
            <span className="text-[11px] font-mono text-ner-muted">{lastUpdated}</span>
          </div>
        )}

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            title={t('common.refreshTooltip', 'Refresh operational telemetry')}
            className="p-1.5 rounded-md bg-white hover:bg-ner-subtle text-ner-muted hover:text-ner-text border border-ner-border transition-colors cursor-pointer disabled:opacity-50"
            aria-label={t('common.refresh', 'Refresh Data')}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        )}

        {actions}
        {children}
      </div>
    </div>
  );
};

export default NerHeader;

