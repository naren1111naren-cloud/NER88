import React, { useState, useRef, useEffect, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, ChevronDown, Check, Search } from 'lucide-react';
import { supportedLanguages, setAppLanguage } from '../i18n';

export const LanguageSelector = ({ variant = 'header', className = '' }) => {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const triggerButtonRef = useRef(null);

  const currentLangCode = i18n.language || 'en';
  const currentLang = supportedLanguages.find(l => l.code === currentLangCode) || supportedLanguages[0];

  const filteredLanguages = supportedLanguages.filter(l => 
    l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.nativeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (l.region && l.region.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    const handleGlobalKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        triggerButtonRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [isOpen]);

  const toggleDropdown = () => {
    if (!isOpen) {
      setSearchQuery('');
      setHighlightedIndex(
        supportedLanguages.findIndex(l => l.code === currentLangCode)
      );
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  const handleSelect = (code) => {
    setAppLanguage(code);
    setIsOpen(false);
    triggerButtonRef.current?.focus();
  };

  const handleTriggerKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleDropdown();
    }
  };

  const handleDropdownKeyDown = (e) => {
    if (!isOpen) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => 
        prev < filteredLanguages.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => 
        prev > 0 ? prev - 1 : filteredLanguages.length - 1
      );
    } else if (e.key === 'Enter' && highlightedIndex >= 0 && filteredLanguages[highlightedIndex]) {
      e.preventDefault();
      handleSelect(filteredLanguages[highlightedIndex].code);
    }
  };

  // GRID VARIANT (For Settings)
  if (variant === 'grid') {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {supportedLanguages.map((lang) => {
          const isSelected = currentLangCode === lang.code;
          return (
            <button
              key={lang.code}
              type="button"
              onClick={() => handleSelect(lang.code)}
              className={`p-3.5 rounded-lg border text-left transition flex flex-col justify-between cursor-pointer ${
                isSelected
                  ? 'bg-[#15803D]/10 border-[#15803D] text-[#0B3B24] shadow-sm'
                  : 'bg-white border-[#D5E4DB] text-[#13261D] hover:border-[#15803D] hover:bg-[#F7FAF8]'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-bold text-[#13261D]">
                  {lang.nativeName}
                </span>
                {isSelected && <Check className="w-4 h-4 text-[#15803D]" />}
              </div>
              <div className="flex items-center justify-between mt-2 pt-1 border-t border-[#D5E4DB]">
                <span className="text-[10px] font-mono text-[#3E5649]">{lang.name}</span>
                {lang.region && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#EEF5F1] text-[#3E5649]">
                    {lang.region}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  // HEADER / COMPACT SWITCHER VARIANT
  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        ref={triggerButtonRef}
        type="button"
        onClick={toggleDropdown}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={t('language.changeLanguage', 'Change Platform Language')}
        className="inline-flex items-center gap-2 px-3.5 py-1.5 h-9 rounded-full bg-[#f0f7f2] hover:bg-[#e2f0e6] text-[#13261D] border border-[#c7dccb] transition cursor-pointer select-none shrink-0"
        title={t('language.changeLanguage', 'Change Platform Language')}
      >
        <Globe className="w-4 h-4 text-[#15803D] shrink-0" />
        <span className="font-semibold text-xs text-[#13261D]">
          {currentLang.nativeName}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-[#627B6E] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* LANGUAGE DROPDOWN POPOVER */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            role="listbox"
            aria-label="Languages list"
            tabIndex={-1}
            onKeyDown={handleDropdownKeyDown}
            className="absolute right-0 mt-2 w-64 rounded-xl bg-white border border-[#D5E4DB] shadow-xl z-[999] p-2 divide-y divide-[#D5E4DB] text-[#13261D]"
          >
            {/* Header & Quick Search Bar */}
            <div className="pb-2">
              <div className="flex items-center justify-between px-2 py-1 mb-1.5">
                <span className="text-[11px] font-bold text-[#0B3B24] uppercase tracking-wider">
                  {t('settings.selectLanguage', 'Select Language')}
                </span>
                <span className="text-[10px] text-[#627B6E]">
                  {supportedLanguages.length} {t('settings.languages', 'Languages')}
                </span>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#627B6E] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={t('common.search', 'Search...')}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setHighlightedIndex(0);
                  }}
                  className="w-full bg-[#F7FAF8] border border-[#CCE0D5] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#13261D] placeholder-[#627B6E] focus:outline-none focus:border-[#15803D]"
                />
              </div>
            </div>

            {/* Language List */}
            <div className="pt-1.5 max-h-56 overflow-y-auto space-y-0.5 scrollbar-thin">
              {filteredLanguages.length > 0 ? (
                filteredLanguages.map((lang, idx) => {
                  const isSelected = currentLangCode === lang.code;
                  const isHighlighted = idx === highlightedIndex;

                  return (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => handleSelect(lang.code)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer text-left ${
                        isSelected
                          ? 'bg-[#15803D]/10 text-[#0B3B24] font-bold'
                          : isHighlighted
                          ? 'bg-[#F7FAF8] text-[#13261D]'
                          : 'text-[#3E5649]'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="font-semibold text-xs text-[#13261D]">
                          {lang.nativeName}
                        </span>
                        <span className="text-[10px] text-[#627B6E]">
                          {lang.name} {lang.region ? `• ${lang.region}` : ''}
                        </span>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-[#15803D]" />}
                    </button>
                  );
                })
              ) : (
                <div className="py-4 text-center text-xs text-[#627B6E]">
                  {t('common.noData', 'No matching language found.')}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LanguageSelector;
