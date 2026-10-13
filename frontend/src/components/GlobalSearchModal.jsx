import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, X, Navigation, MapPin, Truck, Package, 
  Waves, AlertTriangle, CloudRain, ArrowRight, ShieldCheck,
  CornerDownLeft
} from 'lucide-react';

const SEARCH_DATABASE = [
  // Routes & Corridors
  { id: 'r1', type: 'route', group: 'Corridors & Highways', title: 'Guwahati → Imphal (NH-27 / NH-37)', subtitle: 'Primary Trunk Corridor · 485 km', path: '/routes', category: 'Route', risk: 'LOW' },
  { id: 'r2', type: 'route', group: 'Corridors & Highways', title: 'NH-37 Western Bypass (Silchar / Jiribam)', subtitle: 'Alternate Detour Corridor B · 512 km', path: '/routes', category: 'Route', risk: 'HIGH' },
  { id: 'r3', type: 'route', group: 'Corridors & Highways', title: 'Siliguri → Gangtok (NH-10)', subtitle: 'Sikkim High-Altitude Transit · 114 km', path: '/routes', category: 'Route', risk: 'MODERATE' },
  { id: 'r4', type: 'route', group: 'Corridors & Highways', title: 'Guwahati → Shillong (NH-40 Expressway)', subtitle: 'Meghalaya Plateau Route · 99 km', path: '/routes', category: 'Route', risk: 'LOW' },
  { id: 'r5', type: 'route', group: 'Corridors & Highways', title: 'NH-6 (Meghalaya - Assam Border)', subtitle: 'Primary Logistics Artery · East Khasi Hills', path: '/routes', category: 'Route', risk: 'CRITICAL' },
  
  // Districts & Cities
  { id: 'd1', type: 'district', group: 'Districts & Cities', title: 'Shillong (Meghalaya)', subtitle: 'East Khasi Hills · Accessibility: 74/100', path: '/districts', category: 'District', risk: 'MODERATE' },
  { id: 'd2', type: 'district', group: 'Districts & Cities', title: 'Senapati District (Manipur)', subtitle: 'Accessibility: 51/100 · Mountain Pass Hazard', path: '/districts', category: 'District', risk: 'MODERATE' },
  { id: 'd3', type: 'district', group: 'Districts & Cities', title: 'Imphal West (Manipur)', subtitle: 'Accessibility: 43/100 · Valley Distribution Center', path: '/districts', category: 'District', risk: 'HIGH' },
  { id: 'd4', type: 'district', group: 'Districts & Cities', title: 'Kamrup Metropolitan (Assam)', subtitle: 'Accessibility: 88/100 · Regional Logistics Hub', path: '/districts', category: 'District', risk: 'LOW' },
  { id: 'd5', type: 'district', group: 'Districts & Cities', title: 'East Sikkim (Sikkim)', subtitle: 'Accessibility: 39/100 · Teesta Basin Flood Alert', path: '/districts', category: 'District', risk: 'CRITICAL' },
  { id: 'd6', type: 'district', group: 'Districts & Cities', title: 'Dimapur (Nagaland)', subtitle: 'Accessibility: 78/100 · Railhead Freight Terminal', path: '/districts', category: 'District', risk: 'LOW' },

  // Incidents
  { id: 'i1', type: 'incident', group: 'Incidents & Disruptions', title: 'NER-0241 · Landslide on NH-6', subtitle: 'Meghalaya Sector · Detected: 20:54 IST · Partially Blocked', path: '/incidents', category: 'Incident', risk: 'CRITICAL' },
  { id: 'i2', type: 'incident', group: 'Incidents & Disruptions', title: 'NER-0242 · Senapati Pass Road Slump (NH-27)', subtitle: 'Manipur Sector · Severity: HIGH · Heavy delay', path: '/incidents', category: 'Incident', risk: 'CRITICAL' },
  { id: 'i3', type: 'incident', group: 'Incidents & Disruptions', title: 'NER-0243 · Teesta Basin Flash Flooding', subtitle: 'Sikkim NH-10 · Bridge Clearance Alert', path: '/incidents', category: 'Incident', risk: 'HIGH' },

  // Vehicles
  { id: 'v1', type: 'vehicle', group: 'Vehicles & Fleet', title: 'NER-V001 (Heavy 16T Freight Carrier)', subtitle: 'In Transit · Dimapur sector · Speed: 42 km/h', path: '/vehicles', category: 'Vehicle', risk: 'LOW' },
  { id: 'v2', type: 'vehicle', group: 'Vehicles & Fleet', title: 'NER-V002 (Refrigerated Cold-Chain Van)', subtitle: 'In Transit · Siliguri gateway · Speed: 54 km/h', path: '/vehicles', category: 'Vehicle', risk: 'LOW' },
  { id: 'v3', type: 'vehicle', group: 'Vehicles & Fleet', title: 'NER-V004 (Emergency Relief Cargo Truck)', subtitle: 'Standby Hub · Guwahati Central Depot', path: '/vehicles', category: 'Vehicle', risk: 'LOW' },

  // Weather
  { id: 'w1', type: 'weather', group: 'Weather Stations', title: 'Shillong Weather Station (AWS-04)', subtitle: 'Rainfall: 42 mm/hr · Visibility: 4.2 km · Road Impact: MODERATE', path: '/weather', category: 'Weather', risk: 'MODERATE' },
  { id: 'w2', type: 'weather', group: 'Weather Stations', title: 'Senapati Mountain Radar', subtitle: 'Rainfall: 75 mm/hr · Slope Saturation Alert', path: '/weather', category: 'Weather', risk: 'CRITICAL' },

  // Infrastructure Bridges
  { id: 'b1', type: 'bridge', group: 'Strategic Bridges', title: 'Teesta River Bridge (NH-10 Sikkim Gateway)', subtitle: 'Status: RESTRICTED · Water Level +1.8m · Load: 30T Limit', path: '/bridges', category: 'Bridge', risk: 'HIGH' },
  { id: 'b2', type: 'bridge', group: 'Strategic Bridges', title: 'Saraighat Bridge (Brahmaputra, Guwahati)', subtitle: 'Status: OPERATIONAL · Dual Rail-Road · Load: 60T OK', path: '/bridges', category: 'Bridge', risk: 'LOW' }
];

export const GlobalSearchModal = ({ isOpen, onClose, onSelectResult }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const resultsContainerRef = useRef(null);

  // Body scroll lock while modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Focus input and reset query on open
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      setQuery('');
      setSelectedIndex(0);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const filteredResults = useMemo(() => {
    if (query.trim() === '') {
      return SEARCH_DATABASE.slice(0, 8);
    }
    const q = query.toLowerCase();
    return SEARCH_DATABASE.filter(item => 
      item.title.toLowerCase().includes(q) ||
      item.subtitle.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.group.toLowerCase().includes(q)
    );
  }, [query]);

  // Group filtered results by type for structured display
  const groupedResults = useMemo(() => {
    const groups = {};
    filteredResults.forEach((item, index) => {
      if (!groups[item.group]) {
        groups[item.group] = [];
      }
      groups[item.group].push({ item, globalIndex: index });
    });
    return groups;
  }, [filteredResults]);

  const handleSelect = (item) => {
    onClose();
    if (onSelectResult) {
      onSelectResult(item);
    }
    navigate(item.path);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1 < filteredResults.length ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 >= 0 ? prev - 1 : filteredResults.length - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredResults[selectedIndex]) {
          handleSelect(filteredResults[selectedIndex]);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, filteredResults, selectedIndex]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-16 sm:pt-20 p-4">
          
          {/* Backdrop Layer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#0B2744]/60 backdrop-blur-sm pointer-events-auto"
            aria-hidden="true"
          />

          {/* Modal Dialog Surface */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -8 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            className="relative z-[110] w-full max-w-2xl max-h-[80vh] bg-white border border-[#D9E0E7] rounded-[8px] shadow-elevated overflow-hidden text-[#17202A] flex flex-col pointer-events-auto"
          >
            {/* Search Input Bar */}
            <div className="p-3.5 bg-[#F6F8FA] border-b border-[#D9E0E7]">
              <div className="relative rounded-[6px] bg-white border border-[#D9E0E7] p-2.5 flex items-center gap-3 shadow-inner">
                <Search className="w-4 h-4 text-[#185A8D] shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search district, route, incident or vehicle..."
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
                  className="w-full bg-transparent text-sm text-[#17202A] placeholder-[#5B6570] focus:outline-none font-medium"
                />
                {query && (
                  <button 
                    onClick={() => setQuery('')} 
                    className="text-[#5B6570] hover:text-[#17202A] p-1 rounded hover:bg-[#F6F8FA] transition cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-mono font-semibold text-[#5B6570] bg-[#E7EBEF] px-2 py-0.5 rounded-[4px] border border-[#D9E0E7] hidden sm:inline">
                    ESC to close
                  </span>
                  <button
                    onClick={onClose}
                    className="sm:hidden text-[#5B6570] hover:text-[#17202A] p-1 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Results List Area - Grouped By Type */}
            <div 
              ref={resultsContainerRef}
              className="flex-1 overflow-y-auto p-3 space-y-3 max-h-[55vh]"
            >
              {filteredResults.length > 0 ? (
                Object.entries(groupedResults).map(([groupTitle, items]) => (
                  <div key={groupTitle} className="space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#5B6570] px-2 py-0.5">
                      {groupTitle}
                    </div>
                    <div className="space-y-1">
                      {items.map(({ item, globalIndex }) => {
                        const isSelected = globalIndex === selectedIndex;
                        const isCritical = item.risk === 'CRITICAL';
                        const isHigh = item.risk === 'HIGH';

                        return (
                          <div
                            key={item.id}
                            onClick={() => handleSelect(item)}
                            onMouseEnter={() => setSelectedIndex(globalIndex)}
                            className={`p-2.5 rounded-[6px] transition-colors cursor-pointer flex items-center justify-between gap-3 border ${
                              isSelected 
                                ? 'bg-[#185A8D]/10 border-[#185A8D] text-[#0B2744]' 
                                : 'bg-white hover:bg-[#F6F8FA] border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`w-7 h-7 rounded-[4px] flex items-center justify-center shrink-0 border ${
                                isSelected ? 'bg-white border-[#185A8D] text-[#185A8D]' : 'bg-[#F6F8FA] border-[#D9E0E7] text-[#5B6570]'
                              }`}>
                                {item.type === 'route' ? <Navigation className="w-3.5 h-3.5" /> :
                                 item.type === 'district' ? <MapPin className="w-3.5 h-3.5" /> :
                                 item.type === 'vehicle' ? <Truck className="w-3.5 h-3.5" /> :
                                 item.type === 'bridge' ? <Waves className="w-3.5 h-3.5" /> :
                                 item.type === 'weather' ? <CloudRain className="w-3.5 h-3.5" /> :
                                 <AlertTriangle className="w-3.5 h-3.5 text-[#C62828]" />}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-xs text-[#17202A] truncate">{item.title}</span>
                                  <span className="text-[10px] uppercase font-mono font-bold px-1.5 py-0.2 rounded-[4px] bg-[#E7EBEF] text-[#5B6570] border border-[#D9E0E7]">
                                    {item.category}
                                  </span>
                                </div>
                                <p className="text-[11px] text-[#5B6570] truncate mt-0.5">{item.subtitle}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {item.risk && (
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-[4px] ${
                                  isCritical ? 'bg-[#C62828]/10 text-[#C62828] border border-[#C62828]/20' :
                                  isHigh ? 'bg-[#D99A00]/10 text-[#D99A00] border border-[#D99A00]/20' :
                                  'bg-[#16834B]/10 text-[#16834B] border border-[#16834B]/20'
                                }`}>
                                  {item.risk}
                                </span>
                              )}
                              <ArrowRight className="w-3.5 h-3.5 text-[#5B6570]" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-xs text-[#5B6570]">
                  No matching results found for "{query}".
                </div>
              )}
            </div>

            {/* Modal Footer Key Hints */}
            <div className="p-3 bg-[#F6F8FA] border-t border-[#D9E0E7] flex items-center justify-between text-[11px] text-[#5B6570]">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-white border border-[#D9E0E7] text-[10px] font-mono font-bold text-[#17202A]">↑</kbd>
                  <kbd className="px-1.5 py-0.5 rounded bg-white border border-[#D9E0E7] text-[10px] font-mono font-bold text-[#17202A]">↓</kbd>
                  Navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-white border border-[#D9E0E7] text-[10px] font-mono font-bold text-[#17202A]">ENTER</kbd>
                  Select & Jump
                </span>
              </div>
              <span className="font-semibold text-[#185A8D]">NER88 Global Intelligence Directory</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default GlobalSearchModal;
