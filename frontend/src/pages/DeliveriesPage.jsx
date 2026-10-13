import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { safeArray } from '../utils/apiHelpers';
import { StatusBadge } from '../components/StatusBadge';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { useToast } from '../context/ToastContext';
import { 
  Package, Plus, Search, Filter, Clock, ArrowRight, ShieldAlert, 
  Eye, Trash2, CheckCircle2, AlertTriangle, X, Shield, Navigation
} from 'lucide-react';

export const DeliveriesPage = () => {
  const { t } = useTranslation();
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
      showToast('Consignment recorded and dispatched successfully!', 'success');
      setFormData({
        cargo_name: '',
        cargo_type: 'Medical Supplies',
        cargo_category: 'Medicines',
        priority: 'EMERGENCY',
        origin_city: 'Guwahati',
        destination_city: 'Imphal'
      });
    } catch (err) {
      showToast('Failed to dispatch consignment.', 'error');
    }
  };

  const handleConfirmReroute = async () => {
    setActionLoading(true);
    try {
      if (rerouteDeliveryId) {
        await api.post(`/deliveries/${rerouteDeliveryId}/reroute`);
        fetchDeliveries();
        showToast('Alternate Route B approved! Corridor trajectory rerouted.', 'success');
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
        showToast('Consignment record deleted.', 'info');
      }
    } catch (err) {
      showToast('Failed to delete consignment record.', 'error');
    } finally {
      setActionLoading(false);
      setDeleteDeliveryId(null);
    }
  };

  const filteredDeliveries = safeArray(deliveries).filter((d) => {
    const s = (search || '').toLowerCase();
    const matchesSearch =
      (d.delivery_code || '').toLowerCase().includes(s) ||
      (d.cargo_name || '').toLowerCase().includes(s) ||
      (d.destination_city || '').toLowerCase().includes(s) ||
      (d.priority || '').toLowerCase().includes(s) ||
      (d.cargo_category && (d.cargo_category || '').toLowerCase().includes(s));

    const matchesStatus =
      statusFilter === 'ALL'
        ? true
        : statusFilter === 'DELAYED'
        ? (d.estimated_delay_mins || 0) > 0
        : (d.status || '').toUpperCase().includes(statusFilter);

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-5 pb-8 text-[#17202A] font-sans">
      {/* Page Header */}
      <div className="bg-white border border-[#D9E0E7] p-4 sm:p-5 rounded-[8px] shadow-subtle flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold text-[#123B66] bg-[#123B66]/10 px-2 py-0.5 rounded border border-[#123B66]/20 uppercase tracking-wider">
              CONSIGNMENT CONSOLE
            </span>
            <span className="text-[10px] text-[#5B6570] font-mono">
              Regional Essential Freight Movement
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0B2744] flex items-center gap-2">
            <Package className="w-5 h-5 text-[#185A8D]" />
            Consignments & Freight Intelligence
          </h1>
          <p className="text-xs text-[#5B6570] mt-1">
            Track and reroute critical regional consignments (Medicines, Vaccines, Food Stocks, Relief Kits) across Northeast corridors.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-[6px] bg-[#123B66] hover:bg-[#0B2744] text-white font-bold text-xs shadow-subtle transition cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" /> Dispatch Consignment
        </button>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white border border-[#D9E0E7] p-3 rounded-[8px] shadow-subtle flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full md:w-auto flex-1">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-[#5B6570] absolute left-3 top-2.5" />
            <input 
              type="text"
              placeholder="Search code, cargo, district, priority..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#F6F8FA] border border-[#D9E0E7] rounded-[6px] pl-9 pr-3 py-1.5 text-xs text-[#17202A] placeholder-[#5B6570] focus:outline-none focus:border-[#185A8D] transition"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-[#5B6570]" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#F6F8FA] border border-[#D9E0E7] text-[#17202A] text-xs font-semibold rounded-[6px] px-2.5 py-1.5 focus:outline-none focus:border-[#185A8D] cursor-pointer"
            >
              <option value="ALL">Status: All</option>
              <option value="IN TRANSIT">Status: In Transit</option>
              <option value="REROUTED">Status: Rerouted</option>
              <option value="DELAYED">Status: Delayed</option>
              <option value="DELIVERED">Status: Delivered</option>
            </select>
          </div>
        </div>

        <div className="text-[#5B6570] font-medium text-xs shrink-0">
          Showing <span className="font-bold text-[#123B66]">{filteredDeliveries.length}</span> active shipments
        </div>
      </div>

      {/* Deliveries Table */}
      <div className="bg-white border border-[#D9E0E7] rounded-[8px] shadow-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-[#F6F8FA] border-b border-[#D9E0E7] text-[10px] font-bold text-[#5B6570] uppercase tracking-wider">
                <th className="p-3">Consignment Code / Cargo</th>
                <th className="p-3">Category</th>
                <th className="p-3">Corridor (Origin &rarr; Dest)</th>
                <th className="p-3">Priority</th>
                <th className="p-3">Route Risk</th>
                <th className="p-3">Status / Delay</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7EBEF] text-xs text-[#17202A]">
              {filteredDeliveries.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-[#5B6570]">
                    No consignments matching search criteria.
                  </td>
                </tr>
              ) : (
                filteredDeliveries.map((d) => (
                  <tr key={d.id} className="hover:bg-[#F6F8FA] transition">
                    <td className="p-3">
                      <div className="font-bold text-[#123B66] font-mono">{d.delivery_code}</div>
                      <div className="font-semibold text-[#17202A] mt-0.5">{d.cargo_name}</div>
                      <div className="text-[10px] text-[#5B6570]">{d.cargo_type}</div>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#123B66]/10 text-[#123B66] border border-[#123B66]/20">
                        {d.cargo_category || 'Medicines'}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-[#17202A]">{d.origin_city} &rarr; {d.destination_city}</div>
                      <div className="text-[10px] text-[#5B6570]">Driver: {d.driver_name || 'Assigned Driver'}</div>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        d.priority === 'EMERGENCY' ? 'bg-red-50 text-[#C62828] border-red-200' : d.priority === 'URGENT' ? 'bg-amber-50 text-[#D99A00] border-amber-200' : 'bg-[#F6F8FA] text-[#5B6570] border-[#D9E0E7]'
                      }`}>
                        {d.priority}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <StatusBadge level={d.route_risk_category} size="sm" />
                        <span className="font-mono text-[#5B6570]">({d.route_risk_score}/100)</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-[#17202A]">{d.status}</div>
                      {d.estimated_delay_mins > 0 ? (
                        <div className="text-[11px] text-[#C62828] font-bold flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" /> +{d.estimated_delay_mins}m Delay
                        </div>
                      ) : (
                        <div className="text-[11px] text-[#16834B] font-semibold mt-0.5">● On Schedule</div>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setViewingDelivery(d)}
                          title="View Details"
                          className="p-1.5 rounded-[4px] bg-[#F6F8FA] hover:bg-[#E7EBEF] text-[#5B6570] hover:text-[#123B66] border border-[#D9E0E7] transition cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {d.estimated_delay_mins > 0 && d.status !== 'REROUTED' && (
                          <button
                            onClick={() => setRerouteDeliveryId(d.id)}
                            title="Approve Reroute Detour"
                            className="p-1.5 rounded-[4px] bg-amber-50 hover:bg-amber-100 text-[#D99A00] border border-amber-200 transition cursor-pointer"
                          >
                            <ShieldAlert className="w-4 h-4" />
                          </button>
                        )}

                        <button
                          onClick={() => setDeleteDeliveryId(d.id)}
                          title="Delete Record"
                          className="p-1.5 rounded-[4px] bg-[#F6F8FA] hover:bg-red-50 text-[#5B6570] hover:text-[#C62828] border border-[#D9E0E7] hover:border-red-200 transition cursor-pointer"
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

      {/* New Shipment Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-2xs animate-in fade-in">
          <div className="bg-white border border-[#D9E0E7] rounded-[8px] shadow-xl w-full max-w-lg p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-[#D9E0E7] pb-2.5">
              <h2 className="text-base font-bold text-[#0B2744] flex items-center gap-2">
                <Package className="w-4 h-4 text-[#185A8D]" /> Dispatch Essential Consignment
              </h2>
              <button 
                onClick={() => setShowModal(false)}
                className="text-[#5B6570] hover:text-[#17202A] p-1 rounded transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-[#17202A] uppercase mb-1">Cargo Item Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pediatric Vaccine Units, Oxygen Cylinders"
                  value={formData.cargo_name}
                  onChange={(e) => setFormData({ ...formData, cargo_name: e.target.value })}
                  className="w-full bg-[#F6F8FA] border border-[#D9E0E7] rounded-[6px] p-2 text-[#17202A] focus:outline-none focus:border-[#185A8D] transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#17202A] uppercase mb-1">Category</label>
                  <select
                    value={formData.cargo_category}
                    onChange={(e) => setFormData({ ...formData, cargo_category: e.target.value })}
                    className="w-full bg-[#F6F8FA] border border-[#D9E0E7] rounded-[6px] p-2 text-[#17202A] focus:outline-none focus:border-[#185A8D] transition cursor-pointer"
                  >
                    <option value="Medicines">Medicines & Vaccines</option>
                    <option value="Oxygen">Medical Oxygen</option>
                    <option value="Food Supplies">Essential Food Supplies</option>
                    <option value="Disaster Relief">Disaster Relief Kit</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#17202A] uppercase mb-1">Priority Level</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full bg-[#F6F8FA] border border-[#D9E0E7] rounded-[6px] p-2 text-[#17202A] focus:outline-none focus:border-[#185A8D] transition cursor-pointer"
                  >
                    <option value="EMERGENCY">EMERGENCY</option>
                    <option value="URGENT">URGENT</option>
                    <option value="HIGH">HIGH</option>
                    <option value="NORMAL">NORMAL</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#17202A] uppercase mb-1">Origin Node</label>
                  <input
                    type="text"
                    required
                    value={formData.origin_city}
                    onChange={(e) => setFormData({ ...formData, origin_city: e.target.value })}
                    className="w-full bg-[#F6F8FA] border border-[#D9E0E7] rounded-[6px] p-2 text-[#17202A] focus:outline-none focus:border-[#185A8D] transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#17202A] uppercase mb-1">Destination Node</label>
                  <input
                    type="text"
                    required
                    value={formData.destination_city}
                    onChange={(e) => setFormData({ ...formData, destination_city: e.target.value })}
                    className="w-full bg-[#F6F8FA] border border-[#D9E0E7] rounded-[6px] p-2 text-[#17202A] focus:outline-none focus:border-[#185A8D] transition"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#D9E0E7]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 rounded-[6px] bg-[#F6F8FA] border border-[#D9E0E7] text-[#5B6570] font-semibold hover:bg-[#E7EBEF] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-[6px] bg-[#123B66] hover:bg-[#0B2744] text-white font-bold transition shadow-subtle cursor-pointer"
                >
                  Dispatch Consignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Delivery Details Modal */}
      {viewingDelivery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-2xs animate-in fade-in">
          <div className="bg-white border border-[#D9E0E7] rounded-[8px] shadow-xl w-full max-w-lg p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-[#D9E0E7] pb-2.5">
              <div>
                <span className="font-mono text-xs font-bold text-[#123B66]">{viewingDelivery.delivery_code}</span>
                <h2 className="text-base font-bold text-[#0B2744]">{viewingDelivery.cargo_name}</h2>
              </div>
              <button 
                onClick={() => setViewingDelivery(null)}
                className="text-[#5B6570] hover:text-[#17202A] p-1 rounded transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-2.5 rounded-[6px] bg-[#F6F8FA] border border-[#D9E0E7]">
                <span className="text-[#5B6570] block text-[10px]">Category</span>
                <span className="font-bold text-[#17202A]">{viewingDelivery.cargo_category || 'Medicines'}</span>
              </div>
              <div className="p-2.5 rounded-[6px] bg-[#F6F8FA] border border-[#D9E0E7]">
                <span className="text-[#5B6570] block text-[10px]">Priority</span>
                <span className="font-bold text-[#C62828]">{viewingDelivery.priority}</span>
              </div>
              <div className="p-2.5 rounded-[6px] bg-[#F6F8FA] border border-[#D9E0E7]">
                <span className="text-[#5B6570] block text-[10px]">Corridor</span>
                <span className="font-bold text-[#17202A]">{viewingDelivery.origin_city} &rarr; {viewingDelivery.destination_city}</span>
              </div>
              <div className="p-2.5 rounded-[6px] bg-[#F6F8FA] border border-[#D9E0E7]">
                <span className="text-[#5B6570] block text-[10px]">Status</span>
                <span className="font-bold text-[#16834B]">{viewingDelivery.status}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-[#D9E0E7]">
              <button
                onClick={() => setViewingDelivery(null)}
                className="px-4 py-1.5 rounded-[6px] bg-[#123B66] hover:bg-[#0B2744] text-white font-bold text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modals */}
      <ConfirmationModal
        isOpen={!!rerouteDeliveryId}
        title="Approve Alternate Route B Detour?"
        message="This action will approve detour rerouting for this consignment via the verified alternate corridor (NH-37 via Silchar/Jiribam)."
        confirmText="Approve Detour"
        type="primary"
        loading={actionLoading}
        onConfirm={handleConfirmReroute}
        onCancel={() => setRerouteDeliveryId(null)}
      />

      <ConfirmationModal
        isOpen={!!deleteDeliveryId}
        title="Delete Consignment Record?"
        message="Are you sure you want to remove this active delivery record from the monitoring matrix?"
        confirmText="Delete"
        type="danger"
        loading={actionLoading}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteDeliveryId(null)}
      />
    </div>
  );
};

export default DeliveriesPage;

