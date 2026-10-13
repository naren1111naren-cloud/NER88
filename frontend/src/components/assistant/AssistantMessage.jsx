import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check, Terminal, ExternalLink, AlertTriangle, ArrowRight, ShieldCheck } from 'lucide-react';

export const AssistantMessage = ({ message, onActionClick, onRetry }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const isError = message.isError;

  const handleCopy = () => {
    if (!message.content) return;
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderContent = (content) => {
    if (!content) return null;
    const lines = content.split('\n');

    return lines.map((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return <div key={idx} className="h-2" />;
      }

      // Main header
      if (trimmed.startsWith('**') && trimmed.endsWith('**') && !trimmed.includes('•')) {
        const title = trimmed.replace(/\*\*/g, '');
        return (
          <div key={idx} className="font-bold text-[#0B3B24] text-xs tracking-wide pt-1 pb-0.5 border-b border-[#D5E4DB] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#15803D] inline-block"></span>
            <span>{title}</span>
          </div>
        );
      }

      // Bullet points
      if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
        const itemText = trimmed.replace(/^[•\-]\s*/, '');
        return (
          <div key={idx} className="flex items-start gap-2 pl-1 py-0.5 text-xs text-[#13261D] leading-relaxed">
            <span className="text-[#15803D] font-bold select-none">•</span>
            <div className="flex-1" dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(itemText) }} />
          </div>
        );
      }

      // Numbered list
      if (/^\d+\.\s/.test(trimmed)) {
        const num = trimmed.match(/^(\d+)\.\s/)[1];
        const text = trimmed.replace(/^\d+\.\s*/, '');
        return (
          <div key={idx} className="flex items-start gap-2 pl-1 py-0.5 text-xs text-[#13261D] leading-relaxed">
            <span className="font-mono text-[#15803D] text-[11px] select-none font-semibold">{num}.</span>
            <div className="flex-1" dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(text) }} />
          </div>
        );
      }

      // Sub-bullet / indented note
      if (trimmed.startsWith('*') && trimmed.endsWith('*') && !trimmed.startsWith('**')) {
        return (
          <div key={idx} className="pl-3 text-[11px] text-[#3E5649] italic py-0.5">
            {trimmed.replace(/\*/g, '')}
          </div>
        );
      }

      // Standard text line
      return (
        <div
          key={idx}
          className="text-xs text-[#13261D] leading-relaxed"
          dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(trimmed) }}
        />
      );
    });
  };

  const formatInlineMarkdown = (text) => {
    let out = text;
    out = out.replace(/\*\*(.*?)\*\*/g, '<strong class="text-[#0B3B24] font-semibold">$1</strong>');
    out = out.replace(/`(.*?)`/g, '<code class="bg-white text-[#15803D] px-1.5 py-0.5 rounded text-[11px] font-mono border border-[#CCE0D5]">$1</code>');
    return out;
  };

  if (isUser) {
    return (
      <div className="flex justify-end mb-3">
        <div className="max-w-[85%] bg-[#15803D] text-white px-3.5 py-2.5 rounded-xl rounded-tr-none shadow-sm text-xs leading-relaxed">
          <p className="whitespace-pre-wrap">{message.content}</p>
          <div className="text-[10px] text-emerald-100 text-right mt-1 font-mono">
            {message.timestamp || t('common.justNow', 'Just now')}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start mb-3 max-w-[95%]">
      {/* Assistant bubble header */}
      <div className="flex items-center gap-2 mb-1 pl-1">
        <div className="flex items-center justify-center w-5 h-5 rounded-md bg-[#123C27] text-white text-[10px] font-mono font-bold">
          88
        </div>
        <span className="text-[11px] font-bold text-[#123C27] tracking-wider">{t('assistant.title', 'ASSISTANT 88')}</span>
        {message.timestamp && (
          <span className="text-[10px] text-[#627B6E] font-mono">
            {message.timestamp}
          </span>
        )}
      </div>

      {/* Main card */}
      <div className={`w-full bg-[#F7FAF8] rounded-xl rounded-tl-none p-3.5 border ${isError ? 'border-[#C62828]/40 bg-[#C62828]/10' : 'border-[#D5E4DB]'} shadow-sm transition-all`}>
        {isError ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[#C62828] text-xs font-semibold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{message.content || t('errors.generic', 'Assistant is temporarily unable to retrieve current data.')}</span>
            </div>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="text-[11px] font-semibold text-[#15803D] hover:text-[#0B3B24] bg-white px-2.5 py-1 rounded border border-[#CCE0D5] transition-colors cursor-pointer"
              >
                {t('assistant.retry', 'Retry Request')}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {renderContent(message.content)}

            {/* Metrics Chips */}
            {message.metrics && Object.keys(message.metrics).length > 0 && (
              <div className="pt-2 mt-2 border-t border-[#D5E4DB] flex flex-wrap gap-1.5">
                {Object.entries(message.metrics).map(([k, v]) => (
                  <div
                    key={k}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-[#CCE0D5] text-[10px] font-mono text-[#3E5649]"
                  >
                    <span className="capitalize">{k.replace(/_/g, ' ')}:</span>
                    <span className="text-[#15803D] font-bold">{String(v)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Interactive Actions */}
            {message.actions && message.actions.length > 0 && (
              <div className="pt-2 mt-1 flex flex-wrap gap-1.5">
                {message.actions.map((act, i) => {
                  const label = act.type === 'VIEW_MAP' 
                    ? t('common.viewOnMap', 'View on Map')
                    : act.type === 'REROUTE' 
                      ? t('common.rerouteNow', 'Reroute Now')
                      : act.type.replace(/_/g, ' ');
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onActionClick && onActionClick(act)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white hover:bg-[#EEF5F1] text-[#15803D] border border-[#CCE0D5] text-[11px] font-semibold transition cursor-pointer shadow-sm"
                    >
                      <span>{label}</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  );
                })}
              </div>
            )}

            {/* Source Transparency & Copy Bar */}
            <div className="pt-2 mt-2 border-t border-[#D5E4DB] flex items-center justify-between text-[10px] text-[#627B6E]">
              <div className="flex items-center gap-1 flex-wrap">
                <span>{t('assistant.sourcePrefix', 'Source:')}</span>
                {(message.sources || ['DATABASE']).map((src, i) => (
                  <span
                    key={i}
                    className="px-1.5 py-0.5 rounded bg-white text-[#3E5649] font-mono text-[9px] border border-[#D5E4DB]"
                  >
                    {src}
                  </span>
                ))}
              </div>

              <button
                type="button"
                onClick={handleCopy}
                title={t('assistant.copy', 'Copy response')}
                className="flex items-center gap-1 text-[#627B6E] hover:text-[#13261D] px-1.5 py-0.5 rounded hover:bg-white transition-colors cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-[#198754]" />
                    <span className="text-[#198754] text-[10px]">{t('assistant.copied', 'Copied')}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span className="text-[10px]">{t('assistant.copy', 'Copy')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssistantMessage;
