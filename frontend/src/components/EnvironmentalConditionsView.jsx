import React from 'react';
import { useTranslation } from 'react-i18next';
import { 
  CloudRain, Mountain, Layers, AlertTriangle, Clock, 
  CheckCircle2, AlertCircle, ShieldAlert, ShieldCheck, 
  Navigation, Gauge
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

export const EnvironmentalConditionsView = ({
  activeCorridor,
  weatherData,
  weatherLoading,
  weatherError,
  incidents = []
}) => {
  const { t } = useTranslation();

  const hasLiveWeather = !!weatherData && !weatherError;
  const rainfallMmHr = hasLiveWeather
    ? (weatherData.rainfall_mm_hr ?? weatherData.precipitation_mm ?? weatherData.rain_mm ?? 0.0)
    : null;
  const weatherCondition = weatherData?.weather_condition || weatherData?.condition || 'Mainly Clear';
  const weatherTimestamp = formatObservationTime(weatherData?.updated_at || weatherData?.observed_at || weatherData?.fetched_at);

  const distNum = parseFloat(activeCorridor?.dist) || 100;
  const elevGainNum = parseFloat(String(activeCorridor?.elevGain || '').replace(/[^0-9.]/g, '')) || 0;
  
  const calculatedGrade = distNum > 0 && elevGainNum > 0
    ? ((elevGainNum / (distNum * 1000)) * 100).toFixed(1)
    : null;

  const routeCodeMatch = activeCorridor?.route?.match(/NH-[0-9A-Z]+/i);
  const roadCode = routeCodeMatch ? routeCodeMatch[0] : (activeCorridor?.route?.split(' ')[0] || 'Trunk Highway');
  const is4Lane = (activeCorridor?.road || '').toLowerCase().includes('4-lane');
  const is2Lane = (activeCorridor?.road || '').toLowerCase().includes('2-lane');
  const laneCount = is4Lane ? 4 : (is2Lane ? 2 : 2);
  const roadSurface = (activeCorridor?.road || '').toLowerCase().includes('paved') ? 'Paved' : 'Mixed';

  // Matching incidents & hazard detection
  const matchingIncident = Array.isArray(incidents) ? incidents.find(inc => {
    const loc = `${inc.location_name || ''} ${inc.district_name || ''} ${inc.description || ''}`.toLowerCase();
    const fromCity = (activeCorridor?.from || '').toLowerCase();
    const toCity = (activeCorridor?.to || '').toLowerCase();
    const roadTag = roadCode.toLowerCase();
    return loc.includes(fromCity) || loc.includes(toCity) || loc.includes(roadTag);
  }) : null;

  let hazardLevel = 'LOW';
  let hazardTitle = 'No verified hazard';
  let hazardSource = 'CALCULATED • Environmental factors';

  if (matchingIncident) {
    hazardLevel = matchingIncident.severity === 'CRITICAL' ? 'CRITICAL' : (matchingIncident.severity === 'HIGH' ? 'HIGH' : 'MODERATE');
    hazardTitle = `${matchingIncident.incident_type || 'Incident'} Reported`;
    hazardSource = 'LIVE • Verified Incident Feeds';
  } else if (rainfallMmHr !== null) {
    const gradeVal = calculatedGrade ? parseFloat(calculatedGrade) : 0;
    if (rainfallMmHr >= 8.0 && gradeVal >= 2.0) {
      hazardLevel = 'MODERATE';
      hazardTitle = 'Slope Saturation';
      hazardSource = 'CALCULATED • Weather + Terrain';
    } else if (rainfallMmHr >= 8.0 && gradeVal < 2.0) {
      hazardLevel = 'MODERATE';
      hazardTitle = 'Waterlogging Risk';
      hazardSource = 'CALCULATED • Weather + Terrain';
    }
  }

  // Accessibility & delay formulas
  let weatherPenalty = 0;
  let weatherDelay = 0;
  if (rainfallMmHr !== null) {
    if (rainfallMmHr > 15.0) { weatherPenalty = 18; weatherDelay = 25; }
    else if (rainfallMmHr >= 8.0) { weatherPenalty = 12; weatherDelay = 15; }
    else if (rainfallMmHr >= 2.0) { weatherPenalty = 6; weatherDelay = 8; }
    else if (rainfallMmHr >= 0.5) { weatherPenalty = 2; weatherDelay = 3; }
  }

  let terrainPenalty = 0;
  let terrainDelay = 0;
  if (calculatedGrade !== null) {
    const g = parseFloat(calculatedGrade);
    if (g >= 3.0 || elevGainNum >= 1200) { terrainPenalty = 10; terrainDelay = 12; }
    else if (g >= 2.0 || elevGainNum >= 600) { terrainPenalty = 6; terrainDelay = 6; }
    else { terrainPenalty = 2; terrainDelay = 0; }
  }

  const roadPenalty = !is4Lane ? 6 : 1;
  const roadDelay = !is4Lane ? 8 : 0;

  let hazardPenalty = 0;
  let hazardDelay = 0;
  if (hazardLevel === 'CRITICAL') { hazardPenalty = 40; hazardDelay = 60; }
  else if (hazardLevel === 'HIGH') { hazardPenalty = 25; hazardDelay = 30; }
  else if (hazardLevel === 'MODERATE') { hazardPenalty = 12; hazardDelay = 12; }

  const calculatedScore = Math.max(0, Math.min(100, Math.round(100 - (weatherPenalty + terrainPenalty + roadPenalty + hazardPenalty))));
  const totalDelayMin = weatherDelay + terrainDelay + roadDelay + hazardDelay;
  
  let delayRangeStr = '0 min';
  if (totalDelayMin > 0) {
    const minDelay = Math.max(5, totalDelayMin - 5);
    const maxDelay = totalDelayMin + 5;
    delayRangeStr = `+${minDelay}–${maxDelay} min`;
  }

  let primaryRiskShort = 'NONE';
  if (hazardPenalty >= 25) primaryRiskShort = 'INCIDENT';
  else if (weatherPenalty >= 12) primaryRiskShort = 'HEAVY RAIN';
  else if (terrainPenalty >= 10) primaryRiskShort = 'STEEP GRADE';
  else if (roadPenalty >= 6) primaryRiskShort = '2-LANE ROAD';
  else if (hazardPenalty >= 12) primaryRiskShort = 'WATERLOGGING';
  else if (weatherPenalty >= 6) primaryRiskShort = 'WET SURFACE';

  let overallRisk = 'LOW RISK';
  let overallRiskBadgeClass = 'bg-emerald-50 border-emerald-200 text-[#198754]';
  if (hazardLevel === 'CRITICAL' || calculatedScore < 40) {
    overallRisk = 'CRITICAL RISK';
    overallRiskBadgeClass = 'bg-rose-50 border-rose-200 text-[#C62828]';
  } else if (hazardLevel === 'HIGH' || calculatedScore < 60) {
    overallRisk = 'HIGH RISK';
    overallRiskBadgeClass = 'bg-rose-50 border-rose-200 text-[#C62828]';
  } else if (hazardLevel === 'MODERATE' || calculatedScore < 80 || (rainfallMmHr !== null && rainfallMmHr >= 4.0) || (calculatedGrade && parseFloat(calculatedGrade) >= 2.5)) {
    overallRisk = 'MODERATE RISK';
    overallRiskBadgeClass = 'bg-amber-50 border-amber-200 text-[#D98C00]';
  }

  const routeImpactBullets = [];
  if (rainfallMmHr !== null && rainfallMmHr >= 10.0) {
    routeImpactBullets.push({ label: 'Heavy rain', impact: 'visibility and road traction significantly reduced' });
  } else if (rainfallMmHr !== null && rainfallMmHr >= 5.0) {
    routeImpactBullets.push({ label: 'Moderate rainfall', impact: 'wet road surfaces, expect minor delays' });
  } else {
    routeImpactBullets.push({ label: 'Visibility & traction', impact: 'NORMAL' });
  }

  if (calculatedGrade !== null && parseFloat(calculatedGrade) >= 2.5) {
    routeImpactBullets.push({ label: 'Steep climb', impact: 'heavy vehicles may experience slower climbing speed' });
  } else {
    routeImpactBullets.push({ label: 'Terrain profile', impact: 'level road profile, standard cruising speed' });
  }

  if (!is4Lane) {
    routeImpactBullets.push({ label: '2-lane undivided', impact: 'slower overtaking and single-lane transit' });
  } else {
    routeImpactBullets.push({ label: '4-lane divided highway', impact: 'standard freight speeds' });
  }

  const precautions = [];
  if (rainfallMmHr !== null && rainfallMmHr >= 5.0) {
    precautions.push('Reduce speed on wet sections');
    precautions.push('Maintain safe following distance');
  } else if (rainfallMmHr !== null && rainfallMmHr >= 1.0) {
    precautions.push('Reduce speed on wet sections');
    precautions.push('Maintain safe following distance');
  }

  if (calculatedGrade !== null && parseFloat(calculatedGrade) >= 2.0) {
    precautions.push('Use lower gears on steep descents');
  }

  if (!is4Lane) {
    precautions.push('Overtake only in designated clear passing zones');
  }

  if (precautions.length === 0) {
    precautions.push('Maintain standard speed and safe distance');
    precautions.push('Perform routine vehicle pre-trip check');
  }

  const finalPrecautions = precautions.slice(0, 4);

  let decisionTitle = 'PROCEED WITH CAUTION';
  let decisionBadgeClass = 'bg-amber-50 border-amber-200 text-[#D98C00]';
  let decisionText = 'Conditions may cause minor transit delays.';

  if (hazardLevel === 'CRITICAL' || calculatedScore < 35) {
    decisionTitle = 'ROUTE RESTRICTED';
    decisionBadgeClass = 'bg-rose-50 border-rose-200 text-[#C62828]';
    decisionText = 'Active blockage detected. Review alternate detour route.';
  } else if (hazardLevel === 'HIGH' || calculatedScore < 55) {
    decisionTitle = 'ROUTE REVIEW';
    decisionBadgeClass = 'bg-rose-50 border-rose-200 text-[#C62828]';
    decisionText = 'Current conditions may significantly disrupt transport.';
  } else if (overallRisk === 'MODERATE RISK' && calculatedScore < 75) {
    decisionTitle = 'MONITOR CONDITIONS';
    decisionBadgeClass = 'bg-amber-50 border-amber-200 text-[#D98C00]';
    decisionText = 'Proceed carefully. Monitor rainfall and road restrictions.';
  } else if (calculatedScore >= 85 && overallRisk === 'LOW RISK') {
    decisionTitle = 'CLEAR TO PROCEED';
    decisionBadgeClass = 'bg-emerald-50 border-emerald-200 text-[#198754]';
    decisionText = 'Normal conditions. No major disruption detected.';
  }

  let dataQuality = 'HIGH';
  if (!hasLiveWeather && !Array.isArray(incidents)) dataQuality = 'LIMITED';
  else if (!hasLiveWeather || weatherError) dataQuality = 'PARTIAL';

  return (
    <div className="space-y-4 my-auto text-left text-[#13261D]">
      
      {/* ── SECTION 1: ROUTE CONTEXT HEADER ── */}
      <div className="bg-white border border-[#D5E4DB] rounded-lg p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-[#3E5649] font-bold mb-1 flex items-center gap-1.5">
            <Navigation className="w-3.5 h-3.5 text-[#15803D]" />
            <span>{t('conditions.title', 'CORRIDOR OPERATIONS BRIEFING')}</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[#0B3B24]">
            {activeCorridor?.from} <span className="text-[#627B6E]">→</span> {activeCorridor?.to}
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-[#3E5649] mt-1 font-medium">
            <span className="text-[#15803D] font-semibold">{activeCorridor?.dist || '103 km'}</span>
            <span className="text-[#D5E4DB]">|</span>
            <span className="text-[#0B3B24] font-semibold">{roadCode}</span>
            <span className="text-[#D5E4DB]">|</span>
            <span>{t('common.time', 'Est. travel')}: <strong className="text-[#13261D]">{activeCorridor?.timeA || '3h 20m'}</strong></span>
          </div>
        </div>

        <div className="flex sm:flex-col items-end justify-between sm:justify-center gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#D5E4DB]">
          <div className={`px-2.5 py-1 rounded text-xs font-bold tracking-wide border ${overallRiskBadgeClass}`}>
            {overallRisk}
          </div>
          <div className="text-xs text-[#3E5649]">
            {t('accessibility.dataQuality', 'DATA QUALITY')}: <strong className={dataQuality === 'HIGH' ? 'text-[#198754]' : 'text-[#D98C00]'}>{dataQuality}</strong>
          </div>
        </div>
      </div>

      {/* ── SECTION 2: CURRENT CONDITIONS ── */}
      <div className="bg-white border border-[#D5E4DB] rounded-lg p-4 sm:p-5 space-y-3 shadow-xs">
        <div className="flex items-center justify-between border-b border-[#D5E4DB] pb-2">
          <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#0B3B24]">
            {t('conditions.currentConditions', 'Current Conditions')}
          </span>
          <span className="text-xs text-[#3E5649] flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-[#627B6E]" />
            {t('common.updated', 'Updated')} {weatherTimestamp}
          </span>
        </div>

        {/* 4 Telemetry Blocks */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          
          {/* Weather */}
          <div className="p-3 rounded-md bg-[#F7FAF8] border border-[#D5E4DB]">
            <div className="flex items-center justify-between text-xs text-[#3E5649] mb-1">
              <span className="font-bold text-[#13261D] flex items-center gap-1">
                <CloudRain className="w-3.5 h-3.5 text-[#15803D]" /> {t('conditions.weather', 'WEATHER')}
              </span>
              <span className="text-[10px] text-[#15803D] font-semibold">Open-Meteo</span>
            </div>
            <div className="text-lg font-bold text-[#0B3B24]">
              {hasLiveWeather ? (rainfallMmHr !== null ? `${rainfallMmHr.toFixed(1)} mm/hr` : '0.0 mm/hr') : (weatherLoading ? 'Loading...' : 'Unavailable')}
            </div>
            <div className="text-xs text-[#3E5649] truncate mt-0.5 font-medium">
              {weatherCondition}
            </div>
          </div>

          {/* Terrain */}
          <div className="p-3 rounded-md bg-[#F7FAF8] border border-[#D5E4DB]">
            <div className="flex items-center justify-between text-xs text-[#3E5649] mb-1">
              <span className="font-bold text-[#13261D] flex items-center gap-1">
                <Mountain className="w-3.5 h-3.5 text-[#15803D]" /> {t('conditions.terrain', 'TERRAIN')}
              </span>
              <span className="text-[10px] text-[#3E5649] font-semibold">Elevation</span>
            </div>
            <div className="text-lg font-bold text-[#0B3B24]">
              {calculatedGrade !== null ? `${calculatedGrade}%` : 'Unavailable'}
            </div>
            <div className="text-xs text-[#3E5649] truncate mt-0.5 font-medium">
              {elevGainNum > 0 ? `+${elevGainNum.toLocaleString()} m gain` : 'Average grade'}
            </div>
          </div>

          {/* Road */}
          <div className="p-3 rounded-md bg-[#F7FAF8] border border-[#D5E4DB]">
            <div className="flex items-center justify-between text-xs text-[#3E5649] mb-1">
              <span className="font-bold text-[#13261D] flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-[#15803D]" /> {t('conditions.roadCondition', 'ROAD')}
              </span>
              <span className="text-[10px] text-[#3E5649] font-semibold">OSM</span>
            </div>
            <div className="text-lg font-bold text-[#0B3B24]">
              {roadCode}
            </div>
            <div className="text-xs text-[#3E5649] truncate mt-0.5 font-medium">
              {laneCount} {t('conditions.lanes', 'lanes')} • {roadSurface}
            </div>
          </div>

          {/* Hazard */}
          <div className="p-3 rounded-md bg-[#F7FAF8] border border-[#D5E4DB]">
            <div className="flex items-center justify-between text-xs text-[#3E5649] mb-1">
              <span className="font-bold text-[#13261D] flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-[#D98C00]" /> {t('conditions.hazards', 'HAZARD')}
              </span>
              <span className={`text-[10px] font-bold ${hazardLevel === 'CRITICAL' ? 'text-[#C62828]' : (hazardLevel === 'HIGH' ? 'text-[#C62828]' : 'text-[#D98C00]')}`}>{hazardLevel}</span>
            </div>
            <div className="text-lg font-bold text-[#0B3B24] truncate">
              {hazardTitle}
            </div>
            <div className="text-xs text-[#3E5649] truncate mt-0.5 font-medium">
              {hazardSource}
            </div>
          </div>

        </div>
      </div>

      {/* ── SECTION 3: ROUTE IMPACT ── */}
      <div className="bg-white border border-[#D5E4DB] rounded-lg p-4 sm:p-5 space-y-3 shadow-xs">
        <div className="flex items-center justify-between border-b border-[#D5E4DB] pb-2">
          <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#0B3B24]">
            {t('conditions.routeImpact', 'Route Impact Analysis')}
          </span>
          <span className="text-xs text-[#3E5649]">
            Deterministic Assessment
          </span>
        </div>

        <div className="space-y-1.5">
          {routeImpactBullets.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 text-xs leading-snug">
              <span className="text-[#15803D] font-bold">•</span>
              <span>
                <strong className="text-[#13261D] font-bold">{item.label}</strong>
                <span className="text-[#627B6E] mx-1.5">—</span>
                <span className="text-[#3E5649] font-medium">{item.impact}</span>
              </span>
            </div>
          ))}
        </div>

        {/* 4 Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3 border-t border-[#D5E4DB] text-left">
          
          <div className="p-3 rounded-md bg-[#F7FAF8] border border-[#D5E4DB]">
            <div className="text-[10px] uppercase text-[#3E5649] font-semibold">{t('accessibility.score', 'ACCESSIBILITY')}</div>
            <div className="text-xl sm:text-2xl font-bold text-[#198754] mt-0.5">
              {calculatedScore} <span className="text-xs font-normal text-[#3E5649]">/ 100</span>
            </div>
          </div>

          <div className="p-3 rounded-md bg-[#F7FAF8] border border-[#D5E4DB]">
            <div className="text-[10px] uppercase text-[#3E5649] font-semibold">{t('conditions.delayRisk', 'DELAY RISK')}</div>
            <div className="text-xl sm:text-2xl font-bold text-[#0B3B24] mt-0.5">
              {delayRangeStr}
            </div>
          </div>

          <div className="p-3 rounded-md bg-[#F7FAF8] border border-[#D5E4DB]">
            <div className="text-[10px] uppercase text-[#3E5649] font-semibold">{t('conditions.roadStatus', 'ROAD STATUS')}</div>
            <div className="text-xl font-bold text-[#0B3B24] mt-0.5">
              {is4Lane ? 'NORMAL' : 'CAUTION'}
            </div>
          </div>

          <div className="p-3 rounded-md bg-[#F7FAF8] border border-[#D5E4DB]">
            <div className="text-[10px] uppercase text-[#3E5649] font-semibold">{t('accessibility.primaryRisk', 'PRIMARY RISK')}</div>
            <div className="text-base font-bold text-[#0B3B24] mt-0.5 truncate">
              {primaryRiskShort}
            </div>
          </div>

        </div>
      </div>

      {/* ── SECTION 4: RECOMMENDED PRECAUTIONS ── */}
      <div className="bg-white border border-[#D5E4DB] rounded-lg p-4 sm:p-5 space-y-2.5 shadow-xs">
        <div className="flex items-center justify-between border-b border-[#D5E4DB] pb-2">
          <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#0B3B24]">
            {t('conditions.recommendedPrecautions', 'Recommended Precautions')}
          </span>
          <span className="text-xs text-[#3E5649]">
            Standard Operating Procedure
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#13261D]">
          {finalPrecautions.map((precaution, idx) => (
            <div key={idx} className="flex items-center gap-2 p-2 rounded-md bg-[#F7FAF8] border border-[#D5E4DB] font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#198754] shrink-0" />
              <span className="leading-snug">{precaution}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── SECTION 5: OPERATIONAL RECOMMENDATION ── */}
      <div className="bg-white border border-[#D5E4DB] rounded-lg p-4 sm:p-5 shadow-xs">
        <div className="text-xs uppercase tracking-wider text-[#3E5649] font-bold mb-1">
          {t('conditions.operationalDecision', 'OPERATIONAL RECOMMENDATION')}
        </div>
        
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <span className={`inline-block px-3 py-1 rounded-md border text-xs font-bold tracking-wide ${decisionBadgeClass}`}>
            {decisionTitle}
          </span>
          <p className="text-xs sm:text-sm font-medium text-[#13261D]">
            {decisionText}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-[#D5E4DB] mt-3 text-xs text-[#3E5649]">
          <span>Source: LIVE • Open-Meteo • OpenStreetMap • State Feeds</span>
          <span>{t('common.updated', 'Last environmental update')}: {weatherTimestamp}</span>
        </div>
      </div>

    </div>
  );
};

export default EnvironmentalConditionsView;
