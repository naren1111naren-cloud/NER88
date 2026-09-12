import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { safeArray } from '../utils/apiHelpers';
import { StatusBadge } from '../components/StatusBadge';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { useToast } from '../context/ToastContext';
import { 
  Package, Plus, Search, Filter, Clock, ArrowRight, ShieldAlert, 
  Eye, Trash2, CheckCircle2, AlertTriangle, X, HeartPulse, Shield
} from 'lucide-react';

export const DeliveriesPage = () => {
  const { showToast } = useToast();
  const [deliveries, setDeliveries] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showModal, setShowModal] = useState(false);
  const [viewingDelivery, setViewingDelivery] = useState(null);
  
  const [rerouteDeliveryId, setRerouteDeliveryId] = useState(null);
  const [deleteDeliveryId, setDeleteDeliveryId] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [formData, setFormData] = useState({
    cargo_name: '',
    cargo_type: 'Medical Supplies',
    cargo_category: 'Medicines',
    priority: 'EMERGENCY',
    origin_city: 'Guwahati',
    destination_city: 'Imphal'
  });

  const fetchDeliveries = async () => {
    try {
      const res = await api.get('/deliveries');
      setDeliveries(safeArray(res.data));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchDeliveries();
    window.addEventListener('sih_demo_triggered', fetchDeliveries);
    window.addEventListener('sih_demo_reset', fetchDeliveries);
    return () => {
      window.removeEventListener('sih_demo_triggered', fetchDeliveries);
      window.removeEventListener('sih_demo_reset', fetchDeliveries);
    };
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/deliveries', formData);
      setShowModal(false);
      fetchDeliveries();
      showToast('Shipment dispatched successfully!', 'success');
      setFormData({
        cargo_name: '',
        cargo_type: 'Medical Supplies',
        cargo_category: 'Medicines',
        priority: 'EMERGENCY',
        origin_city: 'Guwahati',
        destination_city: 'Imphal'
      });
    } catch (err) {
      showToast('Failed to dispatch shipment.', 'error');
    }
  };

  const handleConfirmReroute = async () => {
    setActionLoading(true);
    try {
      if (rerouteDeliveryId) {
        await api.post(`/deliveries/${rerouteDeliveryId}/reroute`);
        fetchDeliveries();
        showToast('✅ Alternate Route B approved! Corridor trajectory rerouted.', 'success');
      }
    } catch (err) {
      showToast('Failed to approve reroute action.', 'error');
    } finally {
      setActionLoading(false);
      setRerouteDeliveryId(null);
    }
  };

  const handleConfirmDelete = async () => {
    setActionLoading(true);
    try {
      if (deleteDeliveryId) {
        setDeliveries((prev) => prev.filter((d) => d.id !== deleteDeliveryId));
        showToast('Shipment record deleted.', 'info');
      }
    } catch (err) {
      showToast('Failed to delete delivery record.', 'error');
    } finally {
      setActionLoading(false);
      setDeleteDeliveryId(null);
    }
  };

  const filteredDeliveries = deliveries.filter((d) => {
    const matchesSearch =
      d.delivery_code.toLowerCase().includes(search.toLowerCase()) ||
      d.cargo_name.toLowerCase().includes(search.toLowerCase()) ||
      d.destination_city.toLowerCase().includes(search.toLowerCase()) ||
      d.priority.toLowerCase().includes(search.toLowerCase()) ||
      (d.cargo_category && d.cargo_category.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus =
      statusFilter === 'ALL'
        ? true
        : statusFilter === 'DELAYED'
        ? d.estimated_delay_mins > 0
        : d.status.toUpperCase().includes(statusFilter);

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-5 pb-8">
      {/* Page Header */}
      <div className="bg-white border border-[#E5E7EB] p-5 rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-extrabold text-[#1F2937] flex items-center gap-2">
            <Package className="w-5 h-5 text-purple-600" />
            Essential Goods Logistics & Delivery Management
          </h1>
          <p className="text-xs text-[#6B7280] mt-0.5">
            Monitor essential logistics (Medicines, Vaccines, Oxygen, Food) and preferential emergency routing across NER.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-violet-600 to-teal-500 hover:opacity-90 text-white font-bold text-xs shadow-xs transition active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" /> Dispatch New Essential Shipment
        </button>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white border border-[#E5E7EB] p-3.5 rounded-2xl shadow-xs flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto flex-1">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-[#6B7280] absolute left-3 top-2.5" />
            <input 
              type="text"
              placeholder="Search code, cargo, category, priority..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#F7F7FB] border border-[#E5E7EB] rounded-xl pl-9 pr-3 py-2 text-[#1F2937] placeholder-[#6B7280] focus:outline-none focus:border-purple-600"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-[#6B7280]" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#F7F7FB] border border-[#E5E7EB] text-[#1F2937] text-xs font-semibold rounded-xl px-3 py-2 focus:outline-none focus:border-purple-600 cursor-pointer"
            >
              <option value="ALL">Status: All Statuses</option>
              <option value="IN TRANSIT">Status: In Transit</option>
              <option value="REROUTED">Status: Rerouted</option>
              <option value="DELAYED">Status: Delayed (+mins)</option>
              <option value="DELIVERED">Status: Delivered</option>
            </select>
          </div>
        </div>

        <div className="text-[#6B7280] font-semibold text-xs shrink-0">
          Showing <span className="font-extrabold text-[#1F2937]">{filteredDeliveries.length}</span> essential shipments
        </div>
      </div>

      {/* Enterprise Deliveries Table */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-[#F7F7FB] border-b border-[#E5E7EB] text-[11px] font-extrabold text-[#6B7280] uppercase tracking-wider">
                <th className="p-3.5">Delivery ID / Cargo</th>
                <th className="p-3.5">Cargo Category</th>
                <th className="p-3.5">Route (Origin ➔ Dest)</th>
                <th className="p-3.5">Priority</th>
                <th className="p-3.5">Route Risk</th>
                <th className="p-3.5">Status / Delay</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB] text-xs text-[#1F2937]">
              {filteredDeliveries.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-10 text-center text-[#6B7280]">
                    No essential deliveries matching search criteria.
                  </td>
                </tr>
              ) : (
                filteredDeliveries.map((d) => (
                  <tr key={d.id} className="hover:bg-[#F7F7FB] transition">
                    <td className="p-3.5">
                      <div className="font-extrabold text-purple-700">{d.delivery_code}</div>
                      <div className="font-bold text-[#1F2937]">{d.cargo_name}</div>
                      <div className="text-[10px] text-[#6B7280]">{d.cargo_type}</div>
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-purple-50 text-purple-800 border border-purple-200">
                        {d.cargo_category || 'Medicines'}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <div className="font-bold text-[#1F2937]">{d.origin_city} ➔ {d.destination_city}</div>
                      <div className="text-[10px] text-[#6B7280]">Driver: {d.driver_name || 'Assigned Driver'}</div>
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-extrabold ${
                        d.priority === 'EMERGENCY' ? 'bg-rose-600 text-white animate-pulse shadow-xs' : d.priority === 'URGENT' ? 'bg-rose-100 text-rose-800 border border-rose-200' : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {d.priority}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-2">
                        <StatusBadge level={d.route_risk_category} size="sm" />
                        <span className="font-mono font-bold text-[#1F2937]">({d.route_risk_score}/100)</span>
                      </div>
                    </td>
                    <td className="p-3.5">
                      <div className="font-bold text-[#1F2937]">{d.status}</div>
                      {d.estimated_delay_mins > 0 ? (
                        <div className="text-[11px] text-rose-600 font-bold flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" /> +{d.estimated_delay_mins}m Delay
                        </div>
                      ) : (
                        <div className="text-[11px] text-emerald-600 font-bold mt-0.5">On Schedule</div>
                      )}
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setViewingDelivery(d)}
                          title="View Details"
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-purple-50 text-slate-600 hover:text-purple-700 transition"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {(d.route_risk_category === 'CRITICAL' || d.route_risk_category === 'HIGH') && (
                          <button
                            onClick={() => setRerouteDeliveryId(d.id)}
                            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 via-violet-600 to-teal-500 hover:opacity-90 text-white font-extrabold text-[11px] shadow-xs active:scale-95"
                          >
                            Reroute
                          </button>
                        )}

                        <button
                          onClick={() => setDeleteDeliveryId(d.id)}
                          title="Delete Record"
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Delivery Details Modal */}
      {viewingDelivery && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-[#E5E7EB] pb-3">
              <div>
                <span className="text-[10px] font-extrabold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                  {viewingDelivery.delivery_code}
                </span>
                <h3 className="text-base font-extrabold text-[#1F2937] mt-1">{viewingDelivery.cargo_name}</h3>
              </div>
              <button
                onClick={() => setViewingDelivery(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-[#F7F7FB] p-3 rounded-xl border border-[#E5E7EB]">
                <div className="text-[10px] text-[#6B7280] font-bold uppercase">Cargo Category</div>
                <div className="font-extrabold text-purple-800 text-sm">{viewingDelivery.cargo_category || 'Medicines'}</div>
              </div>
              <div className="bg-[#F7F7FB] p-3 rounded-xl border border-[#E5E7EB]">
                <div className="text-[10px] text-[#6B7280] font-bold uppercase">Priority Tier</div>
                <div className="font-extrabold text-rose-600 text-sm">{viewingDelivery.priority}</div>
              </div>
              <div className="bg-[#F7F7FB] p-3 rounded-xl border border-[#E5E7EB]">
                <div className="text-[10px] text-[#6B7280] font-bold uppercase">Origin City</div>
                <div className="font-extrabold text-[#1F2937] text-sm">{viewingDelivery.origin_city}</div>
              </div>
              <div className="bg-[#F7F7FB] p-3 rounded-xl border border-[#E5E7EB]">
                <div className="text-[10px] text-[#6B7280] font-bold uppercase">Destination City</div>
                <div className="font-extrabold text-[#1F2937] text-sm">{viewingDelivery.destination_city}</div>
              </div>
              <div className="bg-[#F7F7FB] p-3 rounded-xl border border-[#E5E7EB]">
                <div className="text-[10px] text-[#6B7280] font-bold uppercase">Risk Score</div>
                <div className="font-extrabold text-rose-600 text-sm">{viewingDelivery.route_risk_score} / 100</div>
              </div>
              <div className="bg-[#F7F7FB] p-3 rounded-xl border border-[#E5E7EB]">
                <div className="text-[10px] text-[#6B7280] font-bold uppercase">ETA Delay</div>
                <div className="font-extrabold text-amber-600 text-sm">+{viewingDelivery.estimated_delay_mins} mins</div>
              </div>
            </div>

            <div className="pt-3 border-t border-[#E5E7EB] flex justify-end">
              <button
                onClick={() => setViewingDelivery(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Delivery Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="border-b border-[#E5E7EB] pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-base font-extrabold text-[#1F2937]">Dispatch Essential Cargo Shipment</h3>
                <p className="text-xs text-[#6B7280]">Select cargo category & priority tier for NER corridor tracking.</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="text-[#1F2937] font-semibold block mb-1">Cargo Name</label>
                <input
                  type="text"
                  value={formData.cargo_name}
                  onChange={(e) => setFormData({ ...formData, cargo_name: e.target.value })}
                  required
                  placeholder="e.g. Covid Vaccines & Oxygen Tanks"
                  className="w-full bg-[#F7F7FB] border border-[#E5E7EB] rounded-xl px-3 py-2 text-[#1F2937] focus:outline-none focus:border-purple-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#1F2937] font-semibold block mb-1">Cargo Category</label>
                  <select
                    value={formData.cargo_category}
                    onChange={(e) => setFormData({ ...formData, cargo_category: e.target.value })}
                    className="w-full bg-[#F7F7FB] border border-[#E5E7EB] rounded-xl px-3 py-2 text-[#1F2937] focus:outline-none focus:border-purple-600"
                  >
                    <option value="Medicines">Medicines</option>
                    <option value="Vaccines">Vaccines</option>
                    <option value="Oxygen">Oxygen Cylinders</option>
                    <option value="Food supplies">Food & Relief Packs</option>
                    <option value="Agricultural produce">Agricultural Produce</option>
                    <option value="Construction materials">Construction Materials</option>
                    <option value="Emergency supplies">Emergency Supplies</option>
                  </select>
                </div>

                <div>
                  <label className="text-[#1F2937] font-semibold block mb-1">Priority Level</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full bg-[#F7F7FB] border border-[#E5E7EB] rounded-xl px-3 py-2 text-[#1F2937] focus:outline-none focus:border-purple-600"
                  >
                    <option value="EMERGENCY">EMERGENCY (Preferential Routing)</option>
                    <option value="URGENT">URGENT</option>
                    <option value="HIGH">HIGH</option>
                    <option value="NORMAL">NORMAL</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#1F2937] font-semibold block mb-1">Origin City</label>
                  <input
                    type="text"
                    value={formData.origin_city}
                    onChange={(e) => setFormData({ ...formData, origin_city: e.target.value })}
                    className="w-full bg-[#F7F7FB] border border-[#E5E7EB] rounded-xl px-3 py-2 text-[#1F2937] focus:outline-none focus:border-purple-600"
                  />
                </div>
                <div>
                  <label className="text-[#1F2937] font-semibold block mb-1">Destination City</label>
                  <input
                    type="text"
                    value={formData.destination_city}
                    onChange={(e) => setFormData({ ...formData, destination_city: e.target.value })}
                    className="w-full bg-[#F7F7FB] border border-[#E5E7EB] rounded-xl px-3 py-2 text-[#1F2937] focus:outline-none focus:border-purple-600"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E5E7EB]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-violet-600 to-teal-500 text-white font-bold text-xs shadow-xs"
                >
                  Dispatch Essential Shipment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reroute Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!rerouteDeliveryId}
        title="Approve Detour for Shipment?"
        message="This action will recalculate the active delivery route via Alternate Route B (Silchar / Jiribam NH37)."
        confirmText="Approve Reroute"
        type="primary"
        loading={actionLoading}
        onConfirm={handleConfirmReroute}
        onCancel={() => setRerouteDeliveryId(null)}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!deleteDeliveryId}
        title="Delete Shipment Record?"
        message="Are you sure you want to delete this shipment record from active tracking? This action cannot be undone."
        confirmText="Delete Record"
        type="danger"
        loading={actionLoading}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteDeliveryId(null)}
      />
    </div>
  );
};
