import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { safeArray } from '../utils/apiHelpers';
import { GISMap } from '../components/GISMap';
import { StatusBadge } from '../components/StatusBadge';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { AccessibilityDetailPanel } from '../components/AccessibilityDetailPanel';
import { useToast } from '../context/ToastContext';
import { Search, MapPin, Truck, AlertTriangle, Filter, Layers, Navigation, Waves } from 'lucide-react';

export const MapPage = () => {
  const { showToast } = useToast();
  const [vehicles, setVehicles] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [bridges, setBridges] = useState([]);
  const [corridors, setCorridors] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [search, setSearch] = useState('');
  const [showRerouteModal, setShowRerouteModal] = useState(false);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = async () => {
    try {
      const [vRes, iRes, dRes, bRes, cRes] = await Promise.all([
        api.get('/vehicles').catch(() => ({ data: [] })),
        api.get('/incidents').catch(() => ({ data: [] })),
        api.get('/deliveries').catch(() => ({ data: [] })),
        api.get('/accessibility/bridges').catch(() => ({ data: [] })),
        api.get('/accessibility/roads').catch(() => ({ data: [] }))
      ]);
      setVehicles(safeArray(vRes.data));
      setIncidents(safeArray(iRes.data));
      setDeliveries(safeArray(dRes.data));
      setBridges(safeArray(bRes.data));
      setCorridors(safeArray(cRes.data));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
    window.addEventListener('sih_demo_triggered', fetchData);
    window.addEventListener('sih_demo_reset', fetchData);
    return () => {
      window.removeEventListener('sih_demo_triggered', fetchData);
      window.removeEventListener('sih_demo_reset', fetchData);
    };
  }, []);

  const triggerRerouteApproval = (id) => {
    setSelectedDeliveryId(id);
    setShowRerouteModal(true);
  };

  const handleConfirmReroute = async () => {
    setActionLoading(true);
    try {
      const targetId = selectedDeliveryId || 1;
      await api.post(`/deliveries/${targetId}/reroute`);
      fetchData();
      showToast('✅ Alternate Route B approved! Trajectory rerouted on GIS Map.', 'success');
    } catch (err) {
      showToast('Failed to approve reroute action.', 'error');
    } finally {
      setActionLoading(false);
      setShowRerouteModal(false);
    }
  };

  const activeDeliv = deliveries.find(d => d.delivery_code === 'DEL-2026-001') || deliveries[0];
  const primaryRoute = activeDeliv?.active_route_path ? JSON.parse(activeDeliv.active_route_path) : [];
  const alternateRoute = activeDeliv?.alternate_route_path ? JSON.parse(activeDeliv.alternate_route_path) : [];

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col gap-4 pb-4">
      {/* Search & Filter Header */}
      <div className="bg-white border border-[#E5E7EB] p-4 rounded-2xl shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <Navigation className="w-5 h-5 text-purple-600" />
          <div>
            <h2 className="text-sm font-extrabold text-[#1F2937]">GIS Road, Bridge & Transport Accessibility Map</h2>
            <p className="text-[11px] text-[#6B7280]">Real-time operational status layer for {corridors.length} corridors and {bridges.length} monitored bridges.</p>
          </div>
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
            SIH Gap 1 Intelligence
          </span>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-[#6B7280] absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search city, bridge, vehicle, corridor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#F7F7FB] border border-[#E5E7EB] rounded-xl pl-9 pr-3 py-2 text-xs text-[#1F2937] focus:outline-none focus:border-purple-600"
          />
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 bg-white border border-[#E5E7EB] p-2.5 rounded-2xl shadow-xs overflow-hidden">
        <GISMap
          vehicles={vehicles}
          incidents={incidents}
          bridges={bridges}
          corridors={corridors}
          primaryRoute={primaryRoute}
          alternateRoute={alternateRoute}
          onSelectAsset={setSelectedAsset}
          onReroute={triggerRerouteApproval}
        />
      </div>

      {/* Accessibility Detail Panel */}
      <AccessibilityDetailPanel
        asset={selectedAsset}
        onClose={() => setSelectedAsset(null)}
        onReroute={triggerRerouteApproval}
      />

      {/* Reroute Confirmation Modal */}
      <ConfirmationModal
        isOpen={showRerouteModal}
        title="Approve Alternate Route B Detour?"
        message="This action will update the delivery corridor trajectory from Guwahati ➔ Imphal via Silchar / Jiribam (NH37)."
        confirmText="Approve Reroute"
        type="primary"
        loading={actionLoading}
        onConfirm={handleConfirmReroute}
        onCancel={() => setShowRerouteModal(false)}
      />
    </div>
  );
};
