import React, { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, CornerDownLeft, Compass } from 'lucide-react';

export const AssistantInput = ({
  input,
  setInput,
  onSend,
  isLoading,
  placeholder = 'Ask Assistant...',
  disabled = false,
}) => {
  const { t } = useTranslation();
  const textareaRef = useRef(null);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && input.trim()) {
        onSend();
      }
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  return (
    <div className="border-t border-[#D5E4DB] bg-[#F7FAF8] p-3 space-y-2">
      {isLoading && (
        <div className="flex items-center gap-2 px-1 text-xs text-[#15803D] font-medium animate-pulse">
          <div className="flex space-x-1">
            <div className="w-1.5 h-1.5 bg-[#15803D] rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="w-1.5 h-1.5 bg-[#15803D] rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-1.5 h-1.5 bg-[#15803D] rounded-full animate-bounce"></div>
          </div>
          <span>{t('assistant.calculating', 'Assistant is calculating telemetry...')}</span>
        </div>
      )}

      <div className="relative flex items-end gap-2 bg-white border border-[#CCE0D5] focus-within:border-[#15803D] rounded-lg p-2 transition shadow-inner">
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          className="w-full resize-none bg-transparent text-xs text-[#13261D] placeholder-[#627B6E] focus:outline-none max-h-28 py-1 px-1 scrollbar-thin"
        />

        <button
          type="button"
          onClick={onSend}
          disabled={!input.trim() || isLoading || disabled}
          className="shrink-0 p-2 rounded-[6px] bg-[#123B66] hover:bg-[#0B2744] text-white font-bold disabled:bg-[#E7EBEF] disabled:text-[#5B6570] disabled:cursor-not-allowed transition active:scale-95 shadow-subtle cursor-pointer"
          title="Send query (Enter)"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-center justify-between px-1 text-[10px] text-[#5B6570]">
        <span className="flex items-center gap-1">
          <Compass className="w-3 h-3 text-[#185A8D]" />
          <span>NER88 Regional Intelligence Model</span>
        </span>
        <span className="hidden sm:inline-block font-mono">Press Enter ↵ to send</span>
      </div>
    </div>
  );
};

export default AssistantInput;
