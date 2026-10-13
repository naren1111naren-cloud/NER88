import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, ChevronDown, ChevronUp, AlertTriangle, Truck, Waves, CloudRain, Clock, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const WhatChangedStream = ({ changes = [], onSelectChange }) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const navigate = useNavigate();

  if (!changes || changes.length === 0) {
    return (
      <div className="bg-white border border-[#D9E0E7] px-4 py-2 rounded-[8px] text-xs text-[#5B6570] flex items-center justify-between shadow-subtle">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-[#185A8D]" />
          <span className="font-mono font-bold uppercase text-[10px] text-[#0B2744]">TELEMETRY STREAM</span>
          <span>No recent corridor disruption events recorded</span>
        </div>
      </div>
    );
  }

  const latestChange = changes[0];

  return (
    <div className="bg-white border border-[#D9E0E7] rounded-[8px] text-xs overflow-hidden shadow-subtle transition">
      {/* Header bar */}
      <div className="px-4 py-2 flex items-center justify-between gap-3 bg-white hover:bg-[#F6F8FA] transition">
        <div 
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2.5 min-w-0 cursor-pointer flex-1"
        >
          <div className="w-2 h-2 rounded-full bg-[#185A8D] shrink-0" />
          <span className="font-mono font-bold uppercase text-[10px] tracking-wider text-[#0B2744] shrink-0">
            RECENT EVENTS
          </span>
          <span className="text-[#5B6570] font-mono text-xs shrink-0">
            {latestChange.time}
          </span>
          <span className="text-[#17202A] font-semibold truncate text-xs">
            {latestChange.title} — <span className="text-[#5B6570] font-normal">{latestChange.desc}</span>
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-2.5 py-0.5 rounded-[4px] bg-[#F6F8FA] hover:bg-[#E7EBEF] text-[#5B6570] text-[11px] font-mono border border-[#D9E0E7] flex items-center gap-1 cursor-pointer transition shadow-subtle"
          >
            <span>{changes.length} events</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expandable change log stream */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="border-t border-[#D9E0E7] bg-[#F6F8FA] p-3 space-y-2 overflow-hidden"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {changes.slice(0, 4).map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    if (item.path) navigate(item.path);
                    if (onSelectChange) onSelectChange(item);
                  }}
                  className="p-3 rounded-[6px] bg-white hover:bg-[#E7EBEF] border border-[#D9E0E7] cursor-pointer transition space-y-1 group shadow-subtle"
                >
                  <div className="flex items-center justify-between text-[10px] font-mono text-[#5B6570]">
                    <span className="text-[#185A8D] font-bold">{item.time}</span>
                    <span className={`px-1.5 py-0.2 rounded-[4px] font-bold uppercase text-[9px] ${
                      item.type === 'WARNING' ? 'bg-[#D99A00]/10 text-[#D99A00] border border-[#D99A00]/20' :
                      item.type === 'RESTRICTION' ? 'bg-[#C62828]/10 text-[#C62828] border border-[#C62828]/20' :
                      item.type === 'SUCCESS' ? 'bg-[#16834B]/10 text-[#16834B] border border-[#16834B]/20' :
                      'bg-[#185A8D]/10 text-[#185A8D] border border-[#185A8D]/20'
                    }`}>
                      {item.type}
                    </span>
                  </div>
                  <div className="font-bold text-[#17202A] text-xs truncate group-hover:text-[#185A8D] transition">
                    {item.title}
                  </div>
                  <p className="text-[#5B6570] text-[11px] truncate">{item.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WhatChangedStream;
