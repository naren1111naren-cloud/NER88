import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import emblemSvg from '../assets/emblem.svg';

/**
 * NER88 Government Footer
 * Standardized institutional footer with provenance, system synchronization, and platform links.
 */
export const GovernmentFooter = () => {
  const { t } = useTranslation();

  return (
    <footer className="w-full bg-white border-t border-ner-border text-ner-muted text-xs py-3.5 px-4 lg:px-6 mt-auto select-none">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        
        {/* Left: Government Identity */}
        <div className="flex items-center gap-2.5">
          <img src={emblemSvg} alt="Emblem of India" className="w-4 h-6 object-contain opacity-80" />
          <div className="flex flex-col">
            <span className="font-bold text-ner-primary text-[11.5px]">
              {t('footer.ministry', 'Government of India · Ministry of Development of North Eastern Region (MDoNER)')}
            </span>
            <span className="text-[10.5px] text-ner-muted">
              {t('footer.platform', 'NER88 — Regional Logistics Intelligence & Decision Platform (SIH26002)')}
            </span>
          </div>
        </div>

        {/* Center: Institutional Links */}
        <div className="flex items-center gap-3 text-[11.5px] font-medium text-ner-muted flex-wrap justify-center">
          <Link to="/network" className="hover:text-ner-secondary transition-colors">{t('footer.network', 'Network')}</Link>
          <span>·</span>
          <Link to="/routes" className="hover:text-ner-secondary transition-colors">{t('footer.corridors', 'Corridors')}</Link>
          <span>·</span>
          <Link to="/how-to-use" className="hover:text-ner-secondary transition-colors">{t('footer.operationalGuide', 'Operational Guide')}</Link>
          <span>·</span>
          <Link to="/settings" className="hover:text-ner-secondary transition-colors">{t('footer.accessibility', 'Accessibility')}</Link>
          <span>·</span>
          <Link to="/government-integrations" className="hover:text-ner-secondary transition-colors">{t('footer.dataSources', 'Data Sources')}</Link>
        </div>

        {/* Right: Telemetry Synchronization */}
        <div className="flex items-center gap-2 text-[11px] font-mono text-ner-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-ner-open" />
          <span>{t('footer.synchronized', { time: '21:08 IST' })}</span>
        </div>

      </div>
    </footer>
  );
};

export default GovernmentFooter;
