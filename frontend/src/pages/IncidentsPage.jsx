import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { safeArray } from '../utils/apiHelpers';
import { useToast } from '../context/ToastContext';
import { 
  NerHeader, NerButton, NerStatus, NerTable, NerPanel, NerMetric 
} from '../components/ner';
import { 
  AlertTriangle, Plus, MapPin, Search, Filter, Trash2, 
  X, Clock, Navigation, CheckCircle2, Eye, Compass, RefreshCw 
} from 'lucide-react';

/**
 * NER88 Incidents Page (/incidents)
 */
export const IncidentsPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [incidents, setIncidents] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [showReportModal, setShowReportModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('21:08 IST');

  const fetchIncidents = async () => {
    setRefreshing(true);
    try {
      const res = await api.get('/incidents');
      const data = safeArray(res.data);
      setIncidents(data);
      if (data.length > 0) {
        if (!selectedIncident) setSelectedIncident(data[0]);
      } else {
        setSelectedIncident(null);
      }
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' IST');
    } catch (err) {
      setIncidents([]);
      setSelectedIncident(null);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, []);

  const displayIncidents = incidents;

  // Filter incidents
  const filteredIncidents = displayIncidents.filter((i) => {
    const code = (i.incident_code || '').toLowerCase();
    const type = (i.incident_type || i.name || '').toLowerCase();
    const loc = (i.location_name || '').toLowerCase();
    const cor = (i.corridor || '').toLowerCase();
    const query = search.toLowerCase();

    const matchesSearch = !search || code.includes(query) || type.includes(query) || loc.includes(query) || cor.includes(query);
    const sev = (i.severity || 'HIGH').toUpperCase();
    const matchesSeverity = severityFilter === 'ALL' || sev === severityFilter;

    return matchesSearch && matchesSeverity;
  });

  const tableColumns = [
    {
      header: t('common.severity', 'Severity'),
      key: 'severity',
      render: (val) => {
        const s = (val || 'HIGH').toUpperCase();
        let variant = 'RESTRICTED';
        if (s === 'CRITICAL') variant = 'CRITICAL';
        else if (s === 'HIGH') variant = 'BLOCKED';
        else if (s === 'LOW') variant = 'OPEN';
        return <NerStatus status={variant} labelOverride={s} size="sm" />;
      },
    },
    {
      header: t('incidents.incident', 'Incident'),
      key: 'name',
      render: (val, row) => {
        const incType = row.incident_type || val || '';
        let iconSymbol = '⚠️';
        if (incType.includes('LAND') || incType.includes('MUD') || incType.includes('SLOPE')) iconSymbol = '⛰️';
        else if (incType.includes('FLOOD') || incType.includes('WATER') || incType.includes('RIVER')) iconSymbol = '🌊';
        else if (incType.includes('STRUCT') || incType.includes('BRIDGE') || incType.includes('BLOCK')) iconSymbol = '🚧';
        else if (incType.includes('ACCIDENT') || incType.includes('COLLIS')) iconSymbol = '⚠️';
        else if (incType.includes('TREE') || incType.includes('FALL')) iconSymbol = '🌲';

        return (
          <div className="flex items-center gap-2.5">
            <span className="text-xl shrink-0" role="img" aria-hidden="true">{iconSymbol}</span>
            <div>
              <div className="font-bold text-ner-primary">{val !== undefined && val !== null ? val : (row.incident_type || 'null')}</div>
              <div className="text-[10.5px] font-mono text-ner-muted">{row.incident_code || (row.id ? `INC-${row.id}` : 'null')}</div>
            </div>
          </div>
        );
      },
    },
    {
      header: t('common.location', 'Location'),
      key: 'location_name',
      render: (val, row) => (
        <div>
          <div className="font-medium text-ner-text">{val}</div>
          <div className="text-[10.5px] text-ner-muted">{row.state || 'Northeast'}</div>
        </div>
      ),
    },
    {
      header: t('common.corridor', 'Corridor'),
      key: 'corridor',
      render: (val) => (
        <span className="font-bold font-mono text-ner-primary bg-ner-subtle px-1.5 py-0.5 rounded border border-ner-border text-[11px]">
          {val || 'Trunk Route'}
        </span>
      ),
    },
    {
      header: t('common.status', 'Status'),
      key: 'road_status',
      render: (val) => {
        const st = (val || 'RESTRICTED').toUpperCase();
        let variant = 'RESTRICTED';
        if (st.includes('BLOCK') || st.includes('CLOSED')) variant = 'BLOCKED';
        else if (st.includes('CLEAR') || st.includes('OPEN')) variant = 'OPEN';
        return <NerStatus status={variant} labelOverride={st} size="sm" />;
      },
    },
    {
      header: t('common.time', 'Time'),
      key: 'time_str',
      render: (val) => (
        <span className="font-mono text-ner-muted text-[11px]">
          {val || 'Recently'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-3.5 pb-8 font-sans text-ner-text select-none">
      
      {/* ── HEADER ── */}
      <NerHeader
        title={t('incidents.title', 'Disruptions & Hazards')}
        subtitle={t('incidents.subtitle', 'Real-time log of verified bottlenecks, landslides, floods, and infrastructure hazards affecting Northeast logistics corridors')}
        badge={t('incidents.registryBadge', 'Incident Registry')}
        lastUpdated={lastUpdated}
        onRefresh={fetchIncidents}
        refreshing={refreshing}
      />

      {/* ── SUMMARY METRIC STRIP ── */}
      <div className="bg-white border border-ner-border rounded-lg p-3.5 shadow-xs">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-ner-border">
          <div className="sm:px-3 first:pl-0">
            <NerMetric
              visualIcon="⚠️"
              label={t('incidents.activeDisruptions', 'Active Disruptions')}
              value={displayIncidents.length}
              supporting={t('incidents.verifiedAcrossStates', 'Verified across 8 states')}
              variant="default"
            />
          </div>
          <div className="pt-3 sm:pt-0 sm:px-3">
            <NerMetric
              visualIcon="🔴"
              label={t('incidents.criticalBlockages', 'Critical Blockages')}
              value={displayIncidents.filter(i => (i.severity || '').toUpperCase() === 'CRITICAL').length}
              supporting={t('incidents.completelyHalted', 'Corridors Completely Halted')}
              variant="blocked"
            />
          </div>
          <div className="pt-3 sm:pt-0 sm:px-3">
            <NerMetric
              visualIcon="🟠"
              label={t('incidents.restrictedCorridors', 'Restricted Corridors')}
              value={displayIncidents.filter(i => ['HIGH', 'MODERATE'].includes((i.severity || '').toUpperCase())).length}
              supporting={t('incidents.slowdownWarning', 'Slowdown or Single Lane')}
              variant="restricted"
            />
          </div>
          <div className="pt-3 sm:pt-0 sm:px-3">
            <NerMetric
              visualIcon="🚛"
              label={t('incidents.affectedFreight', 'Affected Freight')}
              value={displayIncidents.reduce((acc, curr) => acc + (curr.vehicles_affected || 0), 0) || 85}
              supporting={t('incidents.totalVehiclesImpacted', 'Total Vehicles Impacted')}
              variant="info"
            />
          </div>
        </div>
      </div>

      {/* ── SEARCH & FILTER STRIP ── */}
      <div className="bg-white border border-ner-border rounded-lg p-3 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Box */}
          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-ner-muted absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder={t('incidents.searchPlaceholder', 'Search incident, location, or corridor (e.g. NH-10)...')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-md bg-ner-background border border-ner-border text-xs focus:outline-hidden focus:ring-1 focus:ring-ner-secondary"
            />
          </div>

          {/* Severity Filter */}
          <div className="flex items-center gap-1 bg-ner-background border border-ner-border p-0.5 rounded-md">
            {[
              { id: 'ALL', label: t('common.all', 'All Severities') },
              { id: 'CRITICAL', label: t('status.critical', 'CRITICAL') },
              { id: 'HIGH', label: t('common.highRisk', 'HIGH') },
              { id: 'MODERATE', label: t('common.moderate', 'MODERATE') },
              { id: 'LOW', label: t('common.lowRisk', 'LOW') }
            ].map((sev) => (
              <button
                key={sev.id}
                type="button"
                onClick={() => setSeverityFilter(sev.id)}
                className={`px-2 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                  severityFilter === sev.id
                    ? 'bg-white text-ner-primary shadow-xs border border-ner-border'
                    : 'text-ner-muted hover:text-ner-text'
                }`}
              >
                {sev.label}
              </button>
            ))}
          </div>
        </div>

        <div className="text-[11px] text-ner-muted font-medium self-end sm:self-auto">
          {t('incidents.showingCount', 'Showing {{count}} of {{total}} incidents', { count: filteredIncidents.length, total: displayIncidents.length })}
        </div>
      </div>

      {/* ── WORKSPACE: INCIDENT TABLE + CONTEXTUAL INSPECTOR ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
        
        {/* Main Incident Table */}
        <div className={selectedIncident ? "lg:col-span-8 space-y-2" : "lg:col-span-12 space-y-2"}>
          <NerTable
            columns={tableColumns}
            data={filteredIncidents}
            keyField="id"
            selectedId={selectedIncident?.id}
            onRowClick={(row) => setSelectedIncident(row)}
            emptyMessage={t('incidents.noDisruptionsFound', 'No active disruptions found matching your filters.')}
          />
        </div>

        {/* Contextual Incident Inspector */}
        {selectedIncident && (
          <div className="lg:col-span-4 flex flex-col space-y-3">
            <div className="bg-white border border-ner-border rounded-lg p-3.5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-ner-border pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-ner-primary">
                    {selectedIncident.incident_code || `INC-${selectedIncident.id}`}
                  </span>
                  <span className="text-[11px] text-ner-muted">· {t('incidents.detailInspector', 'Detail Inspector')}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedIncident(null)}
                  className="text-ner-muted hover:text-ner-text text-xs p-1 cursor-pointer"
                  title={t('common.close', 'Close')}
                >
                  ✕
                </button>
              </div>

              {/* Hero Incident Visual & Name */}
              <div className="flex items-center gap-3.5 p-3 rounded-lg bg-ner-background border border-ner-border">
                <div className="text-4xl shrink-0" role="img" aria-hidden="true">
                  {selectedIncident.incident_type?.includes('LAND') || selectedIncident.name?.includes('Land') ? '⛰️' :
                   selectedIncident.incident_type?.includes('FLOOD') || selectedIncident.name?.includes('Flood') ? '🌊' :
                   selectedIncident.incident_type?.includes('STRUCT') || selectedIncident.name?.includes('Bridge') ? '🚧' :
                   selectedIncident.incident_type?.includes('ACCIDENT') ? '⚠️' : '🛣️'}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-black text-sm text-ner-primary uppercase tracking-tight truncate">
                    {selectedIncident.name !== undefined ? (selectedIncident.name === null ? 'null' : selectedIncident.name) : (selectedIncident.incident_type || 'null')}
                  </h3>
                  <div className="text-xs font-bold text-ner-secondary mt-0.5">
                    {selectedIncident.corridor} · <span className="text-ner-text-secondary font-medium">{selectedIncident.location_name}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-black uppercase text-ner-blocked px-1.5 py-0.2 rounded bg-ner-blocked-bg border border-ner-blocked-border">
                      {selectedIncident.severity || 'HIGH'} {t('common.severity', 'SEVERITY')}
                    </span>
                    <NerStatus status={selectedIncident.road_status || 'RESTRICTED'} size="sm" />
                  </div>
                </div>
              </div>

              {/* Concise Operational Breakdown */}
              <div className="grid grid-cols-2 gap-2 bg-ner-background p-2.5 rounded-md border border-ner-border text-xs">
                <div>
                  <span className="text-[10px] text-ner-muted uppercase font-bold flex items-center gap-1">
                    <span>⏱️</span>
                    <span>{t('commandCenter.estimatedDelay', 'Estimated Delay')}</span>
                  </span>
                  <div className="font-black text-ner-blocked mt-0.5">{selectedIncident.delay || '+1h 30m'}</div>
                </div>
                <div>
                  <span className="text-[10px] text-ner-muted uppercase font-bold flex items-center gap-1">
                    <span>🚛</span>
                    <span>{t('commandCenter.fleetAffected', 'Fleet Affected')}</span>
                  </span>
                  <div className="font-bold text-ner-text mt-0.5">{selectedIncident.vehicles_affected || 12} {t('common.fleet', 'vehicles')}</div>
                </div>
                <div>
                  <span className="text-[10px] text-ner-muted uppercase font-bold flex items-center gap-1">
                    <span>📍</span>
                    <span>{t('common.state', 'State Sector')}</span>
                  </span>
                  <div className="font-bold text-ner-primary mt-0.5">{selectedIncident.state || 'Northeast'}</div>
                </div>
                <div>
                  <span className="text-[10px] text-ner-muted uppercase font-bold flex items-center gap-1">
                    <span>🕒</span>
                    <span>{t('common.time', 'Verified Time')}</span>
                  </span>
                  <div className="font-bold text-ner-text font-mono mt-0.5">{selectedIncident.time_str || '20:54 IST'}</div>
                </div>
              </div>

              {/* Description without huge text blocks */}
              <div className="p-2.5 rounded bg-ner-subtle border border-ner-border text-xs space-y-1">
                <span className="text-[10.5px] font-bold text-ner-muted uppercase">{t('incidents.operationalAssessment', 'Operational Assessment')}</span>
                <p className="text-ner-text-secondary text-[11.5px] leading-relaxed">
                  {selectedIncident.description}
                </p>
                <div className="text-[10px] font-mono text-ner-muted pt-0.5">
                  Reported by: {selectedIncident.reporter || 'Field Logistics Officer'}
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <NerButton
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/command-center')}
                  icon={Eye}
                >
                  {t('common.viewOnMap', 'VIEW ON MAP')}
                </NerButton>
                <NerButton
                  variant="primary"
                  size="sm"
                  onClick={() => navigate('/routes')}
                  icon={Compass}
                >
                  {t('common.rerouteNow', 'REROUTE NOW')}
                </NerButton>
              </div>
            </div>
          </div>
        )}

      </div>

    </div>
  );
};

export default IncidentsPage;

