import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  X, RotateCcw, Send, Sparkles, AlertCircle, 
  MapPin, CheckCircle2, ArrowRight, CornerDownLeft
} from 'lucide-react';
import { askAssistant88, getAssistantHealth } from '../../services/assistantService';

/**
 * Assistant 88 — Operational Intelligence Assistant for NER88
 * 
 * Specifications:
 * - Floating panel appearing over the Command Center (right side of viewport below navbar)
 * - Size: Desktop width 380–440px (420px), height 560–680px (640px)
 * - Header: ✦ Assistant 88 with real ● Connected status & close button
 * - Welcome message & 6 core suggested questions
 * - Real data via POST /api/v1/assistant/chat
 * - Supports general factual, current time, corridor reasoning, and live operational queries
 * - Safe interactive map/navigation actions
 */
export const Assistant88 = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [contextEntity, setContextEntity] = useState({ last_corridor: null, last_district: null });
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const initialWelcome = {
    id: 'welcome-initial',
    role: 'assistant',
    title: 'Assistant 88',
    content: t('assistant.welcome', 'Hello. I can help you understand NER88 operations, routes, vehicles, incidents, accessibility, weather and regional information.'),
    sources: ['NER88_INTELLIGENCE_SYSTEM'],
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' IST',
    actions: []
  };

  const [messages, setMessages] = useState([initialWelcome]);

  // Suggested questions specified in Section 4
  const suggestedQuestions = [
    t('assistant.qNetwork', "What is the current network status?"),
    t('assistant.qRestricted', "Which corridors are restricted?"),
    t('assistant.qIncidents', "Show active incidents"),
    t('assistant.qWeather', "What is the weather risk?"),
    t('assistant.qVehicles', "How many vehicles are affected?"),
    t('assistant.qFactual', "What is the capital of Nagaland?")
  ];

  // Global open / close / toggle event listeners
  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    const handleToggle = () => setIsOpen(prev => !prev);
    const handleClose = () => setIsOpen(false);

    window.addEventListener('open_assistant_88', handleOpen);
    window.addEventListener('toggle_assistant_88', handleToggle);
    window.addEventListener('close_assistant_88', handleClose);

    // Escape key closes floating panel
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('open_assistant_88', handleOpen);
      window.removeEventListener('toggle_assistant_88', handleToggle);
      window.removeEventListener('close_assistant_88', handleClose);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Check health on mount and when panel opens
  useEffect(() => {
    if (isOpen) {
      getAssistantHealth().then(res => {
        setIsOnline(res.isOnline);
      }).catch(() => setIsOnline(false));

      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (queryText) => {
    const textToSend = queryText || input;
    if (!textToSend.trim() || isLoading) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' IST'
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await askAssistant88(
        textToSend,
        {
          current_route: location.pathname,
          last_corridor: contextEntity.last_corridor,
          last_district: contextEntity.last_district
        },
        i18n.language || 'en'
      );

      if (res.success && res.data) {
        // Track last corridor or entity in conversation context for follow-up questions
        if (res.data.metrics?.corridor || res.data.metrics?.corridor_code) {
          setContextEntity(prev => ({
            ...prev,
            last_corridor: res.data.metrics.corridor || res.data.metrics.corridor_code
          }));
        }

        const assistantMsg = {
          id: `asst-${Date.now()}`,
          role: 'assistant',
          title: 'Assistant 88',
          content: res.data.message || res.data.answer || t('assistant.intelligenceRetrieved', 'Operational intelligence retrieved.'),
          sources: res.data.sources || ['NER88_OPERATIONS'],
          metrics: res.data.metrics || {},
          recommendations: res.data.recommendations || [],
          actions: res.data.actions || [],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' IST'
        };
        setMessages(prev => [...prev, assistantMsg]);
      } else {
        const errorMsg = {
          id: `asst-${Date.now()}`,
          role: 'assistant',
          title: 'Assistant 88',
          isError: true,
          content: res.error || t('assistant.dataUnavailable', 'NER88 operational data is currently unavailable.'),
          sources: ['SYSTEM'],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' IST'
        };
        setMessages(prev => [...prev, errorMsg]);
      }
    } catch (err) {
      const errorMsg = {
        id: `asst-${Date.now()}`,
        role: 'assistant',
        title: 'Assistant 88',
        isError: true,
        content: err.message || t('assistant.dataUnavailable', 'NER88 operational data is currently unavailable.'),
        sources: ['SYSTEM'],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' IST'
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Safe UI Actions triggered from assistant responses
  const handleActionClick = (action) => {
    if (!action) return;
    if (action.type === 'NAVIGATE' && action.payload?.route) {
      navigate(action.payload.route);
    } else if (action.type === 'FOCUS_CORRIDOR') {
      window.dispatchEvent(new CustomEvent('assistant_focus_corridor', { detail: action.payload }));
      if (location.pathname !== '/command-center' && location.pathname !== '/network') {
        navigate('/command-center');
      }
    } else if (action.type === 'VIEW_INCIDENT') {
      window.dispatchEvent(new CustomEvent('assistant_view_incident', { detail: action.payload }));
      if (location.pathname !== '/incidents') {
        navigate('/incidents');
      }
    } else if (action.type === 'FILTER_MAP') {
      window.dispatchEvent(new CustomEvent('assistant_filter_map', { detail: action.payload }));
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed top-18 right-2 sm:right-6 z-50 w-[96vw] sm:w-[420px] h-[640px] max-h-[85vh] bg-white border border-[#C7DCCB] rounded-xl shadow-elevated flex flex-col overflow-hidden text-xs text-[#173D2A] select-none"
      role="dialog"
      aria-label="Assistant 88 Operational Intelligence Panel"
    >
      {/* ── PANEL HEADER ── */}
      <div className="px-4 py-3 bg-[#DDEFE3] border-b border-[#C7DCCB] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          {/* Light-green identity icon */}
          <div className="w-7 h-7 rounded bg-[#123C27] flex items-center justify-center text-white shrink-0 shadow-xs">
            <span className="font-mono font-bold text-xs">88</span>
          </div>
          <div className="flex flex-col text-left leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-[13px] text-[#123C27]">
                ✦ Assistant 88
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-[#258A52] animate-pulse' : 'bg-red-500'}`} />
              <span className="text-[10px] font-medium text-[#4F6B59]">
                {isOnline ? t('assistant.statusConnected', 'Connected') : t('assistant.statusOffline', 'Offline')}
              </span>
              <span className="text-[10px] text-[#4F6B59]/60">·</span>
              <span className="text-[10px] text-[#4F6B59] font-mono">{t('assistant.intelligenceBadge', 'NER88 Intelligence')}</span>
            </div>
          </div>
        </div>

        {/* Top Header Actions */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setMessages([initialWelcome]);
              setContextEntity({ last_corridor: null, last_district: null });
            }}
            className="p-1.5 rounded text-[#4F6B59] hover:text-[#123C27] hover:bg-[#D2E9D8] transition-colors cursor-pointer"
            title={t('assistant.resetConversation', 'Reset conversation')}
            aria-label={t('assistant.resetConversation', 'Reset conversation')}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded text-[#4F6B59] hover:text-[#123C27] hover:bg-[#D2E9D8] transition-colors cursor-pointer"
            title={t('assistant.closeAssistant', 'Close Assistant 88 (Esc)')}
            aria-label={t('assistant.closeAssistant', 'Close Assistant')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── CONVERSATION AREA (White Surface) ── */}
      <div className="flex-1 p-3.5 overflow-y-auto space-y-3 bg-[#F7F8F6]">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            {m.role === 'assistant' && (
              <div className="flex items-center gap-1.5 mb-1 pl-0.5 text-[10.5px] font-bold text-[#123C27]">
                <Sparkles className="w-3 h-3 text-[#258A52]" />
                <span>{m.title || 'Assistant 88'}</span>
              </div>
            )}

            <div
              className={`p-3 rounded-xl max-w-[92%] text-xs leading-relaxed ${
                m.role === 'user'
                  ? 'bg-[#173D2A] text-white font-medium rounded-tr-none shadow-xs'
                  : m.isError
                  ? 'bg-red-50 border border-red-200 text-red-900 rounded-tl-none shadow-xs'
                  : 'bg-white border border-[#C7DCCB] text-[#173D2A] rounded-tl-none shadow-xs'
              }`}
            >
              <div className="whitespace-pre-line font-sans text-xs">
                {m.content}
              </div>

              {/* Action Buttons (Section 15, 16 & 17) */}
              {m.actions && m.actions.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-[#DDEFE3] flex flex-wrap gap-1.5">
                  {m.actions.map((act, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleActionClick(act)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#DDEFE3] hover:bg-[#B9DCC3] text-[#173D2A] border border-[#BDD5C3] text-[11px] font-semibold transition-colors cursor-pointer shadow-2xs"
                    >
                      <span>{act.type === 'FOCUS_CORRIDOR' ? t('common.viewOnMap', 'View on Map') : act.type === 'NAVIGATE' ? t('common.rerouteConsole', 'Reroute Console') : act.type.replace(/_/g, ' ')}</span>
                      <ArrowRight className="w-3 h-3 text-[#173D2A]" />
                    </button>
                  ))}
                </div>
              )}

              {/* Provenance / Sources (Section 18) */}
              {m.sources && m.sources.length > 0 && m.role === 'assistant' && (
                <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[9.5px] text-[#4F6B59]">
                  <div className="flex items-center gap-1 truncate">
                    <span>{t('assistant.source', 'Source:')}</span>
                    <span className="font-mono text-[#173D2A] font-semibold truncate">
                      {m.sources.join(', ')}
                    </span>
                  </div>
                  <span className="font-mono text-[#4F6B59]/70 shrink-0 ml-1">{m.timestamp}</span>
                </div>
              )}
            </div>

            {m.role === 'user' && (
              <span className="text-[10px] text-[#4F6B59] mt-1 px-1 font-mono">
                {m.timestamp}
              </span>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 p-2.5 bg-white border border-[#C7DCCB] rounded-lg text-xs text-[#173D2A] w-fit shadow-xs animate-pulse">
            <span className="w-3.5 h-3.5 border-2 border-[#173D2A] border-t-transparent rounded-full animate-spin" />
            <span className="font-medium">{t('assistant.queryingTelemetry', 'Querying NER88 operational telemetry...')}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── SUGGESTED QUESTIONS (Section 4 & 22) ── */}
      <div className="px-3 py-2 bg-[#F5F7F5] border-t border-[#C7DCCB] flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
        {suggestedQuestions.map((q, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSendMessage(q)}
            disabled={isLoading}
            className="px-2.5 py-1 rounded bg-white hover:bg-[#DDEFE3] hover:text-[#173D2A] border border-[#BDD5C3] text-[11px] font-medium text-[#173D2A] whitespace-nowrap transition-colors cursor-pointer shrink-0 shadow-2xs disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>

      {/* ── INPUT BAR ── */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="p-3 bg-white border-t border-[#C7DCCB] flex items-center gap-2 shrink-0"
      >
        <input
          ref={inputRef}
          type="text"
          placeholder={t('assistant.inputPlaceholder', 'Ask Assistant 88 about corridors, vehicles, weather...')}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading}
          className="flex-1 px-3 py-2 rounded-md bg-[#F7FAF7] border border-[#BDD5C3] text-xs text-[#173D2A] placeholder-[#4F6B59] focus:outline-none focus:ring-1 focus:ring-[#173D2A] focus:border-[#173D2A]"
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="p-2 rounded-md bg-[#173D2A] hover:bg-[#123C27] text-white transition-colors cursor-pointer disabled:opacity-40 shadow-xs"
          title={t('assistant.sendQuery', 'Send query')}
          aria-label={t('assistant.sendQuery', 'Send query')}
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};

export default Assistant88;
