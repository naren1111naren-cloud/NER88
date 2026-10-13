import React from 'react';
import { useTranslation } from 'react-i18next';
import { Compass, Eye } from 'lucide-react';
import { NerButton } from './NerButton';
import { resolveIncidentConfig } from './NerIncidentVisual';

/**
 * NerCriticalAlert — High-Priority Operational Disruption Banner
 * Satisfies Section 1, 8, 9 & 12:
 * - Large visual incident symbol (e.g. ⛰️, 🌊, 🚧)
 * - Less text, more visual clarity
 * - Compact values: 🛣️ Corridor, 📍 Location, 🚛 Affected Fleet, ⏱️ Estimated Delay
 * - Clear action triggers: [VIEW INCIDENT] [REROUTE NOW]
 */
export const NerCriticalAlert = ({
  corridor = 'NH-10',
  hazard = 'Landslide Debris Obstruction',
  location = 'Sevoke – Teesta Sector (Sikkim)',
  affectedVehicles = 12,
  estimatedDelay = '+2h 20m',
  severity = 'CRITICAL',
  onViewIncident,
  onReroute,
  className = ''
}) => {
  const { t } = useTranslation();
  const incConfig = resolveIncidentConfig(hazard);

  return (
    <div
      role="alert"
      className={`bg-ner-blocked-bg border border-ner-blocked/40 rounded-lg p-3 sm:p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs text-xs text-ner-text ${className}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {/* Large Incident Visual Symbol (Section 8) */}
        <div className="w-10 h-10 rounded-md bg-white border border-ner-blocked/30 flex items-center justify-center shrink-0 shadow-2xs text-2xl" role="img" aria-label={incConfig.label}>
          {incConfig.emoji}
        </div>

        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-black text-ner-blocked tracking-tight uppercase text-xs flex items-center gap-1">
              <span>{t('alerts.criticalDisruption', 'CRITICAL DISRUPTION')}</span>
            </span>
            <span className="px-1.5 py-0.2 rounded bg-white text-ner-blocked font-mono font-extrabold text-[11px] border border-ner-blocked/30">
              {corridor}
            </span>
            <span className="text-ner-muted font-medium">·</span>
            <span className="font-bold text-ner-text truncate">
              {hazard}
            </span>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 mt-1 text-xs text-ner-text-secondary flex-wrap">
            <span className="inline-flex items-center gap-1">
              <span role="img" aria-label="Location">📍</span>
              <strong className="text-ner-text font-semibold">{location}</strong>
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <span role="img" aria-label="Vehicles">🚛</span>
              <span>{t('common.fleet', 'Fleet')}: <strong className="text-ner-text font-bold">{affectedVehicles}</strong></span>
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <span role="img" aria-label="Delay">⏱️</span>
              <span>{t('common.delay', 'Delay')}: <strong className="text-ner-blocked font-black">{estimatedDelay}</strong></span>
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
        {onViewIncident && (
          <NerButton
            variant="outline"
            size="sm"
            onClick={onViewIncident}
            icon={Eye}
          >
            {t('common.viewDetails', 'VIEW INCIDENT')}
          </NerButton>
        )}
        {onReroute && (
          <NerButton
            variant="danger"
            size="sm"
            onClick={onReroute}
            icon={Compass}
          >
            {t('common.rerouteNow', 'REROUTE NOW')}
          </NerButton>
        )}
      </div>
    </div>
  );
};

export default NerCriticalAlert;

