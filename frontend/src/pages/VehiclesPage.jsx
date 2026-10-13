import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { safeArray } from '../utils/apiHelpers';
import { 
  NerHeader, NerButton, NerStatus, NerTable, NerPanel, NerMetric 
} from '../components/ner';
import { 
  Truck, Navigation, AlertTriangle, ShieldCheck, Search, Filter, 
  MapPin, Clock, Eye, Radio, RefreshCw, Compass, ArrowRight, CheckCircle2 
} from 'lucide-react';

/**
 * NER88 Vehicles Page (/vehicles)
 */
export const VehiclesPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('21:08 IST');

  const fetchVehicles = async () => {
    setRefreshing(true);
    try {
      const res = await api.get('/vehicles');
      const data = safeArray(res.data);
      setVehicles(data);
      if (data.length > 0) {
        if (!selectedVehicle) setSelectedVehicle(data[0]);
      } else {
        setSelectedVehicle(null);
      }
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' IST');
    } catch (err) {
      setVehicles([]);
      setSelectedVehicle(null);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  const displayFleet = vehicles;

  // Filter vehicles
  const filteredFleet = displayFleet.filter((v) => {
    const code = (v.vehicle_code || '').toLowerCase();
    const reg = (v.registration || v.plate_number || '').toLowerCase();
    const loc = (v.location || v.current_location || '').toLowerCase();
    const route = (v.route || '').toLowerCase();
    const query = search.toLowerCase();

    const matchesSearch = !search || code.includes(query) || reg.includes(query) || loc.includes(query) || route.includes(query);
    const vStatus = (v.status || 'EN_ROUTE').toUpperCase();
    const matchesStatus = statusFilter === 'ALL' || vStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const tableColumns = [
    {
      header: t('vehicles.vehicle', 'Vehicle'),
      key: 'vehicle_code',
      render: (val, row) => (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-ner-subtle flex items-center justify-center text-ner-primary font-bold shrink-0">
            <Truck className="w-3.5 h-3.5 text-ner-secondary" />
          </div>
          <div>
            <div className="font-bold text-ner-primary">{val || row.code}</div>
            <div className="text-[10.5px] font-mono text-ner-muted">{row.registration || row.plate_number || 'REG-PENDING'}</div>
          </div>
        </div>
      ),
    },
    {
      header: t('common.status', 'Status'),
      key: 'status',
      render: (val) => {
        let st = (val || 'EN_ROUTE').toUpperCase();
        let statusVariant = 'OPEN';
        let label = t('status.open', 'EN ROUTE');
        if (st.includes('BLOCK') || st === 'STOPPED') {
          statusVariant = 'BLOCKED';
          label = t('status.blocked', 'BLOCKED');
        } else if (st.includes('REROUT') || st.includes('DETOUR')) {
          statusVariant = 'INFO';
          label = t('routes.detour', 'REROUTED');
        } else if (st.includes('RESTRICT') || st.includes('DELAY')) {
          statusVariant = 'RESTRICTED';
          label = t('status.restricted', 'DELAYED');
        }
        return <NerStatus status={statusVariant} labelOverride={label} size="sm" />;
      },
    },
    {
      header: t('common.location', 'Location'),
      key: 'location',
      render: (val, row) => (
        <div>
          <div className="font-medium text-ner-text">{val || row.current_location || 'En route'}</div>
          <div className="text-[10.5px] font-mono text-ner-muted">{row.speed || '40 km/h'}</div>
        </div>
      ),
    },
    {
      header: t('vehicles.routeAndDestination', 'Route & Destination'),
      key: 'route',
      render: (val, row) => (
        <div>
          <div className="font-semibold text-ner-primary">{val || 'Regional Corridor'}</div>
          <div className="text-[10.5px] text-ner-muted truncate max-w-[200px]">{row.destination || 'Hub Transit'}</div>
        </div>
      ),
    },
    {
      header: t('common.estTime', 'ETA'),
      key: 'eta',
      render: (val) => (
        <div className="font-mono font-bold text-ner-text">
          {val || '12:00 IST'}
        </div>
      ),
    },
    {
      header: t('common.risk', 'Risk'),
      key: 'risk',
      render: (val) => {
        const r = (val || 'LOW').toUpperCase();
        let colorClass = 'text-ner-open';
        let localizedRisk = t('common.lowRisk', 'LOW');
        if (r === 'CRITICAL' || r === 'HIGH') {
          colorClass = 'text-ner-blocked font-bold';
          localizedRisk = r === 'CRITICAL' ? t('status.critical', 'CRITICAL') : t('common.highRisk', 'HIGH');
        } else if (r === 'MODERATE' || r === 'MEDIUM') {
          colorClass = 'text-ner-restricted font-bold';
          localizedRisk = t('common.moderate', 'MODERATE');
        }
        return <span className={`text-[11px] font-bold ${colorClass}`}>{localizedRisk}</span>;
      },
    },
  ];


  return (
    <div className="space-y-3.5 pb-8 font-sans text-ner-text select-none">
      
      {/* ── HEADER ── */}
      <NerHeader
        title={t('vehicles.title', 'Fleet & Consignments')}
        subtitle={t('vehicles.subtitle', 'Real-time vehicle telemetry, operational status, and consignment progress across Northeast corridors')}
        badge={t('vehicles.badge', 'VAHAN / Telemetry Stream')}
        lastUpdated={lastUpdated}
        onRefresh={fetchVehicles}
        refreshing={refreshing}
      />

      {/* ── SUMMARY METRIC STRIP (Section 10) ── */}
      <div className="bg-white border border-ner-border rounded-lg p-3.5 shadow-xs">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-ner-border">
          <div className="sm:px-3 first:pl-0">
            <NerMetric
              visualIcon="🚛"
              label={t('vehicles.monitoredFleet', 'Monitored Fleet')}
              value={displayFleet.length}
              supporting={t('vehicles.vahanTelemetry', 'VAHAN & GPS Telemetry')}
              variant="default"
            />
          </div>
          <div className="pt-3 sm:pt-0 sm:px-3">
            <NerMetric
              visualIcon="🟢"
              label={t('vehicles.activeEnRoute', 'Active En Route')}
              value={displayFleet.filter(v => (v.status || '').toUpperCase() === 'EN_ROUTE').length}
              supporting={t('vehicles.corridorsClear', 'Corridors Clear')}
              variant="open"
            />
          </div>
          <div className="pt-3 sm:pt-0 sm:px-3">
            <NerMetric
              visualIcon="🟠"
              label={t('vehicles.delayedRerouted', 'Delayed / Rerouted')}
              value={displayFleet.filter(v => (v.status || '').toUpperCase().includes('RESTRICT') || (v.status || '').toUpperCase().includes('REROUT')).length}
              supporting={t('vehicles.detourDispatched', 'Detour Dispatched')}
              variant="restricted"
            />
          </div>
          <div className="pt-3 sm:pt-0 sm:px-3">
            <NerMetric
              visualIcon="🔴"
              label={t('vehicles.haltedBlocked', 'Halted / Blocked')}
              value={displayFleet.filter(v => (v.status || '').toUpperCase().includes('BLOCK')).length}
              supporting={t('vehicles.atBottlenecks', 'At Disruption Bottlenecks')}
              variant="blocked"
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
              placeholder={t('vehicles.searchPlaceholder', 'Search vehicle code, plate, or corridor...')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-md bg-ner-background border border-ner-border text-xs focus:outline-hidden focus:ring-1 focus:ring-ner-secondary"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-ner-background border border-ner-border p-0.5 rounded-md">
            {['ALL', 'EN_ROUTE', 'REROUTED', 'RESTRICTED', 'BLOCKED'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                  statusFilter === st
                    ? 'bg-white text-ner-primary shadow-xs border border-ner-border'
                    : 'text-ner-muted hover:text-ner-text'
                }`}
              >
                {st === 'ALL'
                  ? t('vehicles.allVehicles', 'All Vehicles')
                  : (st === 'EN_ROUTE' ? t('vehicles.enRoute', 'En Route')
                    : st === 'REROUTED' ? t('vehicles.rerouted', 'Rerouted')
                    : st === 'RESTRICTED' ? t('status.restricted', 'Restricted')
                    : t('status.blocked', 'Blocked'))}
              </button>
            ))}
          </div>
        </div>

        <div className="text-[11px] text-ner-muted font-medium self-end sm:self-auto">
          {t('common.showing', 'Showing')} <strong>{filteredFleet.length}</strong> {t('common.of', 'of')} {displayFleet.length} {t('vehicles.vehiclesCount', 'vehicles')}
        </div>
      </div>

      {/* ── WORKSPACE: OPERATIONAL TABLE + DETAIL DRAWER ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
        
        {/* Main Operational Table (Section 12) */}
        <div className={selectedVehicle ? "lg:col-span-8 space-y-2" : "lg:col-span-12 space-y-2"}>
          <NerTable
            columns={tableColumns}
            data={filteredFleet}
            keyField="id"
            selectedId={selectedVehicle?.id}
            onRowClick={(row) => setSelectedVehicle(row)}
            emptyMessage={t('vehicles.noVehiclesMatch', 'No vehicles matching the filter criteria.')}
          />
        </div>

        {/* Selected Vehicle Contextual Detail Panel (Section 12) */}
        {selectedVehicle && (
          <div className="lg:col-span-4 flex flex-col space-y-3">
            <div className="bg-white border border-ner-border rounded-lg p-3.5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-ner-border pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-ner-primary">
                    {selectedVehicle.vehicle_code || selectedVehicle.code}
                  </span>
                  <span className="text-[11px] font-mono text-ner-muted">· {selectedVehicle.registration}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedVehicle(null)}
                  className="text-ner-muted hover:text-ner-text text-xs p-1 cursor-pointer"
                  title={t('common.close', 'Close')}
                >
                  ✕
                </button>
              </div>

              <div>
                <h3 className="font-bold text-sm text-ner-primary">
                  {selectedVehicle.cargo || (selectedVehicle.name !== undefined ? String(selectedVehicle.name) : 'null')}
                </h3>
                <div className="text-xs text-ner-text-secondary mt-0.5 font-medium">
                  {t('vehicles.driver', 'Driver')}: {selectedVehicle.driver || selectedVehicle.driver_name || 'null'}
                </div>
              </div>

              {/* Detailed Operational Attributes */}
              <div className="grid grid-cols-2 gap-2 bg-ner-background p-2.5 rounded-md border border-ner-border text-xs">
                <div>
                  <span className="text-[10px] text-ner-muted uppercase font-semibold">{t('vehicles.currentLocation', 'Current Location')}</span>
                  <div className="font-bold text-ner-primary truncate">{selectedVehicle.location}</div>
                </div>
                <div>
                  <span className="text-[10px] text-ner-muted uppercase font-semibold">{t('vehicles.speed', 'Speed')}</span>
                  <div className="font-bold text-ner-text font-mono">{selectedVehicle.speed || '42 km/h'}</div>
                </div>
                <div>
                  <span className="text-[10px] text-ner-muted uppercase font-semibold">{t('vehicles.corridor', 'Corridor')}</span>
                  <div className="font-bold text-ner-primary truncate">{selectedVehicle.route}</div>
                </div>
                <div>
                  <span className="text-[10px] text-ner-muted uppercase font-semibold">{t('vehicles.eta', 'ETA')}</span>
                  <div className="font-bold text-ner-text font-mono">{selectedVehicle.eta}</div>
                </div>
              </div>

              {/* Risk & Proximity Notice */}
              <div className="p-2 rounded bg-ner-subtle border border-ner-border text-xs space-y-1">
                <div className="font-bold text-ner-primary flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-ner-restricted" />
                  <span>{t('vehicles.hazardProximity', 'Hazard Proximity & Risk')}</span>
                </div>
                <div className="text-[11.5px] text-ner-text-secondary leading-relaxed">
                  {selectedVehicle.incident_proximity || t('vehicles.noImmediateBottlenecks', 'No immediate structural bottlenecks on corridor path.')}
                </div>
              </div>

              {/* Action Buttons */}
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
                  {t('common.rerouteNow', 'REROUTE FREIGHT')}
                </NerButton>
              </div>
            </div>
          </div>
        )}

      </div>

    </div>
  );
};

export default VehiclesPage;
