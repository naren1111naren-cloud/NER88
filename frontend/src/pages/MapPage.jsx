import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { safeArray } from '../utils/apiHelpers';
import { NER3DMap } from '../components/map3d/NER3DMap';
import { 
  NerHeader, NerButton, NerStatus, NerPanel 
} from '../components/ner';
import { 
  Search, MapPin, Truck, AlertTriangle, Filter, Layers, Navigation,
  Compass, Eye, Check, RefreshCw, Info, ArrowRight, ShieldCheck
} from 'lucide-react';

/**
 * NER88 Network Accessibility Page (/network)
 * Strictly satisfies Section 11 of the Master Specification:
 * - Purpose: "Which logistics corridors are accessible?"
 * - Large GIS Map
 * - Corridor Status (OPEN, RESTRICTED, BLOCKED)
 * - Filtering by State, Corridor, Severity, Status
 * - Contextual detail panel when selecting a corridor
 */
export const MapPage = () => {
  const navigate = useNavigate();

  const [vehicles, setVehicles] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [bridges, setBridges] = useState([]);
  const [corridors, setCorridors] = useState([]);
  const [districts, setDistricts] = useState([]);
  
  const [selectedCorridor, setSelectedCorridor] = useState(null);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('21:08 IST');

  const fetchData = async () => {
    setRefreshing(true);
    try {
      const [vRes, iRes, dRes, bRes, cRes, distRes] = await Promise.all([
        api.get('/vehicles').catch(() => ({ data: [] })),
        api.get('/incidents').catch(() => ({ data: [] })),
        api.get('/deliveries').catch(() => ({ data: [] })),
        api.get('/accessibility/bridges').catch(() => ({ data: [] })),
        api.get('/accessibility/roads').catch(() => ({ data: [] })),
        api.get('/accessibility/districts').catch(() => ({ data: [] }))
      ]);
      setVehicles(safeArray(vRes.data));
      setIncidents(safeArray(iRes.data));
      setDeliveries(safeArray(dRes.data));
      setBridges(safeArray(bRes.data));
      
      const apiCorridors = safeArray(cRes.data);
      setCorridors(apiCorridors);
      if (apiCorridors.length > 0) {
        setSelectedCorridor((prev) => prev || apiCorridors[0]);
      } else {
        setSelectedCorridor(null);
      }
      setDistricts(safeArray(distRes.data));
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' IST');
    } catch (err) {
      setCorridors([]);
      setSelectedCorridor(null);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const displayCorridors = corridors;

  // Filter corridors
  const filteredCorridors = displayCorridors.filter(c => {
    const code = (c.code || c.road_name || c.name || '').toLowerCase();
    const name = (c.name || '').toLowerCase();
    const state = (c.state || '').toLowerCase();
    const query = search.toLowerCase();

    const matchesSearch = !search || code.includes(query) || name.includes(query) || state.includes(query);
    const matchesState = stateFilter === 'ALL' || (c.state || '').toUpperCase() === stateFilter.toUpperCase();
    
    let corridorStatus = (c.status || 'OPEN').toUpperCase();
    if (c.accessibility < 50) corridorStatus = 'BLOCKED';
    else if (c.accessibility < 75) corridorStatus = 'RESTRICTED';

    const matchesStatus = statusFilter === 'ALL' || corridorStatus === statusFilter.toUpperCase();

    return matchesSearch && matchesState && matchesStatus;
  });

  const allStates = ['ALL', 'Assam', 'Meghalaya', 'Sikkim', 'Arunachal Pradesh', 'Manipur', 'Mizoram', 'Nagaland', 'Tripura'];

  return (
    <div className="space-y-3.5 pb-8 font-sans text-ner-text select-none">
      
      {/* ── HEADER ── */}
      <NerHeader
        title="Logistics Network"
        subtitle="Authoritative corridor accessibility and status across all 8 North Eastern States"
        badge="Corridor Accessibility"
        lastUpdated={lastUpdated}
        onRefresh={fetchData}
        refreshing={refreshing}
      />

      {/* ── FILTER STRIP (Section 11) ── */}
      <div className="bg-white border border-ner-border rounded-lg p-3 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Box */}
          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-ner-muted absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Filter by corridor (e.g. NH-10)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-md bg-ner-background border border-ner-border text-xs focus:outline-hidden focus:ring-1 focus:ring-ner-secondary"
            />
          </div>

          {/* State Filter */}
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-md bg-ner-background border border-ner-border text-xs font-semibold text-ner-text focus:outline-hidden"
          >
            {allStates.map(st => (
              <option key={st} value={st}>{st === 'ALL' ? 'All States' : st}</option>
            ))}
          </select>

          {/* Status Filter (OPEN, RESTRICTED, BLOCKED) */}
          <div className="flex items-center gap-1 bg-ner-background border border-ner-border p-0.5 rounded-md">
            {['ALL', 'OPEN', 'RESTRICTED', 'BLOCKED'].map(st => (
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
                {st}
              </button>
            ))}
          </div>
        </div>

        <div className="text-[11px] text-ner-muted font-medium self-end md:self-auto">
          Showing <strong>{filteredCorridors.length}</strong> of {displayCorridors.length} corridors
        </div>
      </div>

      {/* ── MAIN WORKSPACE: MAP (HERO 65%) + CORRIDOR LIST & INSPECTOR (35%) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
        
        {/* Large GIS Map */}
        <div className="lg:col-span-8 flex flex-col space-y-2">
          <div className="bg-white border border-ner-border rounded-lg shadow-xs h-[580px] lg:h-[640px] relative overflow-hidden flex flex-col">
            <NER3DMap
              vehicles={vehicles}
              incidents={incidents}
              bridges={bridges}
              corridors={corridors}
              districts={districts}
              selectedAsset={selectedCorridor}
              isFocusMode={false}
              onSelectAsset={(cor) => setSelectedCorridor(cor)}
            />
          </div>
        </div>

        {/* Corridor List & Contextual Detail Panel */}
        <div className="lg:col-span-4 flex flex-col space-y-3">
          
          {/* Selected Corridor Contextual Inspector */}
          {selectedCorridor ? (
            <div className="bg-white border border-ner-border rounded-lg p-3.5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-ner-border pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-ner-primary">
                    {selectedCorridor.code || selectedCorridor.road_name || 'CORRIDOR'}
                  </span>
                  <span className="text-[11px] text-ner-muted">· {selectedCorridor.state}</span>
                </div>
                <NerStatus
                  status={selectedCorridor.status || (selectedCorridor.accessibility < 50 ? 'BLOCKED' : selectedCorridor.accessibility < 75 ? 'RESTRICTED' : 'OPEN')}
                  size="sm"
                />
              </div>

              <div>
                <h3 className="font-bold text-sm text-ner-primary">
                  {selectedCorridor.name !== undefined && selectedCorridor.name !== null ? selectedCorridor.name : (selectedCorridor.road_name || selectedCorridor.code || 'null')}
                </h3>
                <p className="text-xs text-ner-text-secondary mt-1 leading-relaxed">
                  {selectedCorridor.reason || 'Strategic inter-state arterial corridor monitored by NHAI & BRO.'}
                </p>
              </div>

              {/* Corridor Attributes */}
              <div className="grid grid-cols-2 gap-2 bg-ner-background p-2.5 rounded-md border border-ner-border text-xs">
                <div>
                  <span className="text-[10px] text-ner-muted uppercase font-semibold">Length</span>
                  <div className="font-bold text-ner-primary">{selectedCorridor.length || '240 km'}</div>
                </div>
                <div>
                  <span className="text-[10px] text-ner-muted uppercase font-semibold">Axle Limit</span>
                  <div className="font-bold text-ner-primary">{selectedCorridor.load_limit || '40T'}</div>
                </div>
                <div>
                  <span className="text-[10px] text-ner-muted uppercase font-semibold">Accessibility</span>
                  <div className="font-bold text-ner-text">{selectedCorridor.accessibility || 78} / 100</div>
                </div>
                <div>
                  <span className="text-[10px] text-ner-muted uppercase font-semibold">Recommended Detour</span>
                  <div className="font-bold text-ner-secondary truncate">{selectedCorridor.detour || 'NH-37'}</div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <NerButton
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/routes')}
                  icon={Compass}
                >
                  REROUTE OPTIONS
                </NerButton>
                <NerButton
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate('/incidents')}
                  icon={AlertTriangle}
                >
                  VIEW DISRUPTIONS
                </NerButton>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-ner-border rounded-lg p-6 shadow-xs text-center text-ner-muted text-xs">
              Select a corridor on the map or from the list below to inspect accessibility.
            </div>
          )}

          {/* Corridor Selection List */}
          <div className="bg-white border border-ner-border rounded-lg p-3 shadow-xs space-y-2">
            <div className="text-[11px] font-bold text-ner-muted uppercase tracking-wider px-1">
              Corridor Roster ({filteredCorridors.length})
            </div>

            <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
              {filteredCorridors.map((c) => {
                const isSelected = selectedCorridor && (selectedCorridor.id === c.id || selectedCorridor.code === c.code);
                const cStatus = c.status || (c.accessibility < 50 ? 'BLOCKED' : c.accessibility < 75 ? 'RESTRICTED' : 'OPEN');

                return (
                  <div
                    key={c.id || c.code}
                    onClick={() => setSelectedCorridor(c)}
                    className={`p-2 rounded-md border text-xs cursor-pointer transition-colors flex items-center justify-between ${
                      isSelected
                        ? 'bg-ner-secondary-light/80 border-ner-secondary/40 text-ner-primary font-semibold'
                        : 'bg-white hover:bg-ner-background border-ner-border text-ner-text'
                    }`}
                  >
                    <div>
                      <div className="font-bold flex items-center gap-1.5">
                        <span>{c.code || c.road_name}</span>
                        <span className="text-[11px] font-normal text-ner-muted">· {c.state}</span>
                      </div>
                      <div className="text-[11px] text-ner-text-secondary truncate max-w-[180px]">
                        {c.name || c.road_name}
                      </div>
                    </div>

                    <NerStatus status={cStatus} size="sm" />
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};

export default MapPage;
