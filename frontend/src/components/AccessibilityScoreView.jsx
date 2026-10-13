import React from 'react';
import { useTranslation } from 'react-i18next';
import { 
  CloudRain, Mountain, Layers, AlertTriangle, Clock, 
  CheckCircle2, AlertCircle, ShieldAlert, ShieldCheck, 
  HelpCircle, ChevronDown, Check, Info, Calculator
} from 'lucide-react';

function formatObservationTime(timestamp) {
  if (!timestamp) return 'Live';
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      if (typeof timestamp === 'string' && timestamp.includes('T')) {
        const timePart = timestamp.split('T')[1]?.slice(0, 5);
        return `${timePart} IST`;
      }
      return timestamp;
    }
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes} IST`;
  } catch {
    return 'Live';
  }
}

export const AccessibilityScoreView = ({
  activeCorridor,
  weatherData,
  weatherLoading,
  weatherError,
  incidents = [],
  assessmentData = null
}) => {
  const { t } = useTranslation();

  const hasLiveWeather = !!weatherData && !weatherError;
  const rainfallMmHr = hasLiveWeather
    ? (weatherData.rainfall_mm_hr ?? weatherData.precipitation_mm ?? weatherData.rain_mm ?? 0.0)
    : null;
  const weatherTimestamp = formatObservationTime(weatherData?.updated_at || weatherData?.observed_at || weatherData?.fetched_at);

  const distNum = parseFloat(activeCorridor?.dist) || 100;
  const elevGainNum = parseFloat(String(activeCorridor?.elevGain || '').replace(/[^0-9.]/g, '')) || 0;
  const gradePct = distNum > 0 && elevGainNum > 0
    ? (elevGainNum / (distNum * 1000.0)) * 100.0
    : 0.0;

  const routeCodeMatch = activeCorridor?.route?.match(/NH-[0-9A-Z]+/i);
  const roadCode = routeCodeMatch ? routeCodeMatch[0] : (activeCorridor?.route?.split(' ')[0] || 'Trunk Highway');
  const is4Lane = (activeCorridor?.road || '').toLowerCase().includes('4-lane');

  // Matching incidents in corridor
  const matchingIncident = Array.isArray(incidents) ? incidents.find(inc => {
    const loc = `${inc.location_name || ''} ${inc.district_name || ''} ${inc.description || ''}`.toLowerCase();
    const fromCity = (activeCorridor?.from || '').toLowerCase();
    const toCity = (activeCorridor?.to || '').toLowerCase();
    const roadTag = roadCode.toLowerCase();
    return loc.includes(fromCity) || loc.includes(toCity) || loc.includes(roadTag);
  }) : null;

  // Weather factor
  let wImpact = 0;
  let wCond = 'Normal dry conditions';
  let wSource = 'LIVE • Open-Meteo';
  if (rainfallMmHr !== null) {
    if (rainfallMmHr > 15.0) { wImpact = -18; wCond = `Heavy rainfall (${rainfallMmHr.toFixed(1)} mm/hr)`; }
    else if (rainfallMmHr >= 8.0) { wImpact = -12; wCond = `Moderate-heavy rain (${rainfallMmHr.toFixed(1)} mm/hr)`; }
    else if (rainfallMmHr >= 2.0) { wImpact = -10; wCond = `Moderate rainfall (${rainfallMmHr.toFixed(1)} mm/hr)`; }
    else if (rainfallMmHr >= 0.5) { wImpact = -4; wCond = `Light drizzle (${rainfallMmHr.toFixed(1)} mm/hr)`; }
    else { wImpact = 0; wCond = 'Normal dry conditions'; }
  } else {
    wImpact = 0;
    wCond = 'Weather data unavailable';
    wSource = 'DATA UNAVAILABLE';
  }

  // Terrain factor
  let tImpact = 0;
  let tCond = 'Level terrain profile';
  if (gradePct >= 3.0 || elevGainNum >= 1200.0) { tImpact = -15; tCond = `Steep terrain (${gradePct.toFixed(1)}% grade)`; }
  else if (gradePct >= 2.0 || elevGainNum >= 600.0) { tImpact = -10; tCond = `Moderate grade (${gradePct.toFixed(1)}%)`; }
  else if (gradePct >= 1.0 || elevGainNum >= 300.0) { tImpact = -4; tCond = 'Gentle incline'; }
  else { tImpact = 0; tCond = 'Level terrain profile'; }

  // Road factor
  const rImpact = is4Lane ? 5 : -4;
  const rCond = is4Lane ? 'Good road condition (4-lane paved)' : '2-lane road (undivided)';

  // Hazard factor
  let hImpact = 0;
  let hCond = 'No verified hazard detected';
  let hSource = 'CALCULATED • Environmental factors';
  if (matchingIncident) {
    if (matchingIncident.road_status in ['BLOCKED', 'CLOSED']) {
      hImpact = -40;
      hCond = `Road blockage: ${matchingIncident.incident_type}`;
      hSource = 'LIVE • Verified Incident Feeds';
    } else {
      hImpact = -20;
      hCond = `Active disruption: ${matchingIncident.incident_type}`;
      hSource = 'LIVE • Verified Incident Feeds';
    }
  } else if (rainfallMmHr !== null && rainfallMmHr >= 8.0 && gradePct >= 2.0) {
    hImpact = -8;
    hCond = 'Local hazard detected (Slope saturation)';
    hSource = 'CALCULATED • Weather + Terrain';
  } else if (rainfallMmHr !== null && rainfallMmHr >= 8.0 && gradePct < 2.0) {
    hImpact = -8;
    hCond = 'Waterlogging risk detected';
    hSource = 'CALCULATED • Weather + Terrain';
  }

  // Combine factors
  const fallbackFactors = [
    { category: 'road', name: 'Road Condition', condition: rCond, impact: rImpact, source_type: 'MAP DATA • OpenStreetMap' },
    { category: 'weather', name: 'Weather Impact', condition: wCond, impact: wImpact, source_type: wSource },
    { category: 'terrain', name: 'Terrain Profile', condition: tCond, impact: tImpact, source_type: 'CALCULATED • Elevation' },
    { category: 'hazard', name: 'Disruption Risk', condition: hCond, impact: hImpact, source_type: hSource }
  ];

  const baseScore = 100;
  const factors = assessmentData?.factors || fallbackFactors;
  const factorSum = factors.reduce((sum, f) => sum + (f.impact || 0), 0);
  const calculatedScore = Math.max(0, Math.min(100, assessmentData?.score ?? (baseScore + factorSum)));

  // Risk Level Mapping
  let riskLevel = 'ACCESSIBLE';
  let riskBadgeColor = 'bg-emerald-50 border-emerald-200 text-[#198754]';
  let scoreColor = 'text-[#198754]';

  if (calculatedScore >= 85) {
    riskLevel = 'ACCESSIBLE';
    riskBadgeColor = 'bg-emerald-50 border-emerald-200 text-[#198754]';
    scoreColor = 'text-[#198754]';
  } else if (calculatedScore >= 70) {
    riskLevel = 'MODERATE ACCESSIBILITY';
    riskBadgeColor = 'bg-emerald-50 border-emerald-200 text-[#15803D]';
    scoreColor = 'text-[#15803D]';
  } else if (calculatedScore >= 50) {
    riskLevel = 'MODERATE RISK';
    riskBadgeColor = 'bg-amber-50 border-amber-200 text-[#D98C00]';
    scoreColor = 'text-[#D98C00]';
  } else if (calculatedScore >= 30) {
    riskLevel = 'HIGH RISK';
    riskBadgeColor = 'bg-orange-50 border-orange-200 text-[#F97316]';
    scoreColor = 'text-[#F97316]';
  } else {
    riskLevel = 'CRITICAL / BLOCKED';
    riskBadgeColor = 'bg-rose-50 border-rose-200 text-[#C62828]';
    scoreColor = 'text-[#C62828]';
  }

  // Primary Risk Identification
  const negFactors = factors.filter(f => f.impact < 0);
  let primaryRisk = 'None';
  if (negFactors.length > 0) {
    const worst = [...negFactors].sort((a, b) => a.impact - b.impact)[0];
    primaryRisk = worst.name === 'Terrain Profile' ? 'Steep terrain' : (worst.name === 'Weather Impact' ? 'Heavy rainfall' : (worst.name === 'Disruption Risk' ? 'Active hazard' : '2-lane undivided road'));
  }

  // Summary Explanation
  let summaryExplanation = assessmentData?.summary_explanation;
  if (!summaryExplanation) {
    if (negFactors.length >= 2) {
      const [f1, f2] = [...negFactors].sort((a, b) => a.impact - b.impact);
      summaryExplanation = `Main constraints: ${f1.name.toLowerCase()} and ${f2.name.toLowerCase()}.`;
    } else if (negFactors.length === 1) {
      summaryExplanation = `Road accessibility is favorable; ${negFactors[0].name.toLowerCase()} is the primary operational constraint.`;
    } else {
      summaryExplanation = 'Current road conditions and weather are optimal across all monitored parameters.';
    }
  }

  // Operational Recommendation
  let recTitle = 'CLEAR TO PROCEED';
  let recDetail = 'Normal operating conditions across corridor.';
  if (calculatedScore >= 85) { recTitle = 'CLEAR TO PROCEED'; recDetail = 'Normal operating conditions across corridor.'; }
  else if (calculatedScore >= 70) { recTitle = 'PROCEED WITH CAUTION'; recDetail = 'Minor environmental or road variations present.'; }
  else if (calculatedScore >= 50) { recTitle = 'MONITOR CONDITIONS'; recDetail = 'Moderate risk detected. Monitor weather and speed limits.'; }
  else if (calculatedScore >= 30) { recTitle = 'REVIEW ALTERNATE ROUTE'; recDetail = 'Significant delays expected. Evaluate bypass routes.'; }
  else { recTitle = 'ROUTE RESTRICTED'; recDetail = 'Severe obstruction detected. Detour via verified alternate route.'; }

  const circumference = 2 * Math.PI * 48;
  const strokeDashoffset = circumference - (calculatedScore / 100) * circumference;

  return (
    <div className="space-y-4 my-auto text-left text-[#13261D]">
      
      {/* ── TOP SECTION: GAUGE & ACCESSIBILITY SCORE BREAKDOWN ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        
        {/* Left Column: Big Circular Gauge & Decision */}
        <div className="lg:col-span-5 bg-white border border-[#D5E4DB] rounded-lg p-5 flex flex-col items-center justify-between text-center shadow-xs">
          <div className="w-full flex items-center justify-between text-xs text-[#3E5649] border-b border-[#D5E4DB] pb-2">
            <span className="font-bold text-[#0B3B24] uppercase">{t('accessibility.routeAssessment', 'Corridor Assessment')}</span>
            <span className="font-semibold text-[#13261D]">{activeCorridor?.from} → {activeCorridor?.to}</span>
          </div>

          <div className="relative w-36 h-36 sm:w-40 sm:h-40 my-3 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="48" stroke="#EEF5F1" strokeWidth="8" fill="transparent" />
              <circle
                cx="60"
                cy="60"
                r="48"
                stroke={calculatedScore >= 75 ? '#198754' : (calculatedScore >= 50 ? '#D98C00' : '#C62828')}
                strokeWidth="8"
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-700 ease-out"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#3E5649]">{t('accessibility.score', 'ACCESSIBILITY')}</span>
              <span className={`text-3xl sm:text-4xl font-extrabold ${scoreColor} tracking-tight my-0.5`}>
                {calculatedScore}
              </span>
              <span className="text-xs font-semibold text-[#627B6E]">/ 100</span>
            </div>
          </div>

          <div className="w-full space-y-2">
            <div className={`inline-block px-3 py-1 rounded-md border text-xs sm:text-sm font-bold tracking-wide ${riskBadgeColor}`}>
              {riskLevel}
            </div>
            <p className="text-xs text-[#3E5649] font-medium px-2 leading-relaxed">
              "{summaryExplanation}"
            </p>
          </div>
        </div>

        {/* Right Column: Factor Breakdown Rows ("WHAT AFFECTS THIS SCORE?") */}
        <div className="lg:col-span-7 bg-white border border-[#D5E4DB] rounded-lg p-5 flex flex-col justify-between shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-[#D5E4DB] pb-2">
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#0B3B24]">
              {t('accessibility.whatAffects', 'ACCESSIBILITY FACTOR BREAKDOWN')}
            </span>
            <span className="text-xs text-[#3E5649]">
              {t('accessibility.conditionImpact', 'Condition → Impact')}
            </span>
          </div>

          {/* 4 Compact Rows */}
          <div className="space-y-2">
            {factors.map((f) => {
              const isBonus = f.impact > 0;
              const isNeutral = f.impact === 0;
              const impactColor = isBonus ? 'text-[#198754]' : (isNeutral ? 'text-[#3E5649]' : 'text-[#C62828]');
              const barColor = isBonus ? 'bg-[#198754]' : (isNeutral ? 'bg-[#94A3B8]' : 'bg-[#C62828]');
              const barWidth = Math.min(100, Math.abs(f.impact) * 4.5);

              return (
                <div key={f.category} className="p-2.5 rounded-md bg-[#F7FAF8] border border-[#D5E4DB] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#13261D] uppercase tracking-wider">{f.name !== undefined && f.name !== null ? f.name : 'null'}</span>
                      <span className="text-[10px] text-[#3E5649] bg-white px-1.5 py-0.5 rounded border border-[#D5E4DB] font-semibold">{f.source_type || f.source}</span>
                    </div>
                    <div className="text-xs text-[#3E5649] mt-0.5 truncate font-medium">
                      {f.condition}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    {/* Visual impact bar */}
                    <div className="w-16 sm:w-20 h-2 bg-[#E2EFE7] rounded-full overflow-hidden flex items-center">
                      <div 
                        className={`h-full rounded-full ${barColor}`} 
                        style={{ width: `${barWidth || 5}%` }}
                      />
                    </div>
                    {/* Impact number */}
                    <span className={`text-sm sm:text-base font-bold font-mono w-10 text-right ${impactColor}`}>
                      {isBonus ? `+${f.impact}` : (isNeutral ? '0' : `${f.impact}`)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[#D5E4DB] text-xs text-[#3E5649]">
            <span>{t('accessibility.primaryRisk', 'Primary Constraint')}: <strong className="text-[#13261D] uppercase">{primaryRisk}</strong></span>
            <span>{t('accessibility.dataQuality', 'DATA QUALITY')}: <strong className="text-[#198754]">LIVE</strong></span>
          </div>
        </div>

      </div>

      {/* ── MIDDLE SECTION: MATHEMATICAL CALCULATION PROVABILITY TABLE ── */}
      <div className="bg-white border border-[#D5E4DB] rounded-lg p-4 sm:p-5 shadow-xs">
        <div className="flex items-center justify-between border-b border-[#D5E4DB] pb-2 mb-3">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-[#15803D]" />
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#0B3B24]">
              {t('accessibility.scoreCalculation', 'Score Provenance & Calculation')}
            </span>
          </div>
          <span className="text-[11px] text-[#198754] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold flex items-center gap-1">
            <Check className="w-3 h-3" /> {t('accessibility.consistent', 'Deterministic Formula')}
          </span>
        </div>

        {/* Breakdown Calculation Row */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center text-xs">
          <div className="p-2 rounded bg-[#F7FAF8] border border-[#D5E4DB]">
            <div className="text-[#3E5649] text-[10px] uppercase font-semibold">{t('accessibility.baseScore', 'Base Score')}</div>
            <div className="text-base font-bold text-[#13261D] mt-0.5">100</div>
          </div>
          
          {factors.map((f) => (
            <div key={f.category} className="p-2 rounded bg-[#F7FAF8] border border-[#D5E4DB]">
              <div className="text-[#3E5649] text-[10px] uppercase font-semibold truncate">{f.name}</div>
              <div className={`text-base font-bold mt-0.5 font-mono ${f.impact > 0 ? 'text-[#198754]' : (f.impact === 0 ? 'text-[#3E5649]' : 'text-[#C62828]')}`}>
                {f.impact > 0 ? `+${f.impact}` : (f.impact === 0 ? '0' : f.impact)}
              </div>
            </div>
          ))}

          <div className="p-2 rounded bg-[#EAF7EE] border border-emerald-200">
            <div className="text-[#0B3B24] text-[10px] uppercase font-bold">{t('accessibility.finalScore', 'Final Score')}</div>
            <div className="text-base font-extrabold text-[#0B3B24] mt-0.5">{calculatedScore}</div>
          </div>
        </div>

        <div className="mt-2.5 text-xs text-[#3E5649] text-center sm:text-left flex flex-wrap items-center justify-between gap-1">
          <span>Formula: 100 {factors.map(f => f.impact >= 0 ? `+ ${f.impact}` : `- ${Math.abs(f.impact)}`).join(' ')} = <strong className="text-[#13261D]">{calculatedScore} / 100</strong></span>
          <span>Data: Open-Meteo • OpenStreetMap • State Transport Feeds</span>
        </div>
      </div>

      {/* ── BOTTOM SECTION: ROUTE DECISION ── */}
      <div className="bg-white border border-[#D5E4DB] rounded-lg p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-[#3E5649] font-bold mb-1">
            {t('accessibility.routeDecision', 'OPERATIONAL RECOMMENDATION')}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`px-2.5 py-1 rounded-md border text-xs font-bold tracking-wider ${riskBadgeColor}`}>
              {recTitle}
            </span>
            <span className="text-xs sm:text-sm font-medium text-[#13261D]">
              "{recDetail}"
            </span>
          </div>
        </div>

        <div className="text-xs text-[#3E5649] shrink-0 self-start sm:self-center">
          {t('common.updated', 'Last updated')}: <strong className="text-[#13261D]">{weatherTimestamp}</strong>
        </div>
      </div>

    </div>
  );
};

export default AccessibilityScoreView;
