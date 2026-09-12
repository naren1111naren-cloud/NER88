import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { safeArray } from '../utils/apiHelpers';
import { StatusBadge } from '../components/StatusBadge';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { useToast } from '../context/ToastContext';
import { AlertTriangle, Plus, MapPin, Camera, Check, Search, Filter, Trash2, X } from 'lucide-react';

export const IncidentsPage = () => {
  const { showToast } = useToast();
  const [incidents, setIncidents] = useState([]);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [showModal, setShowModal] = useState(false);
  const [deleteIncidentId, setDeleteIncidentId] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [formData, setFormData] = useState({
    incident_type: 'LANDSLIDE',
    description: 'Heavy monsoon downpour caused rockslide blocking heavy freight traffic.',
    latitude: 25.2676,
    longitude: 94.0210,
    location_name: 'Senapati Mountain Pass (NH27)',
    district_name: 'Senapati',
    severity: 'CRITICAL',
    road_status: 'BLOCKED'
  });

  const fetchIncidents = async () => {
    try {
      const res = await api.get('/incidents');
      setIncidents(safeArray(res.data));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchIncidents();
    window.addEventListener('sih_demo_triggered', fetchIncidents);
    window.addEventListener('sih_demo_reset', fetchIncidents);
    return () => {
      window.removeEventListener('sih_demo_triggered', fetchIncidents);
      window.removeEventListener('sih_demo_reset', fetchIncidents);
    };
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/incidents', formData);
      setShowModal(false);
      fetchIncidents();
      window.dispatchEvent(new Event('sih_demo_triggered'));
      showToast('Incident reported & GIS map updated!', 'warning');
    } catch (err) {
      showToast('Failed to report incident.', 'error');
    }
  };

  const handleConfirmDelete = async () => {
    setActionLoading(true);
    try {
      if (deleteIncidentId) {
        setIncidents((prev) => prev.filter((i) => i.id !== deleteIncidentId));
        showToast('Incident record removed.', 'info');
      }
    } catch (err) {
      showToast('Failed to remove incident record.', 'error');
    } finally {
      setActionLoading(false);
      setDeleteIncidentId(null);
    }
  };

  const filteredIncidents = incidents.filter((i) => {
    const matchesSearch =
      i.incident_type.toLowerCase().includes(search.toLowerCase()) ||
      i.location_name.toLowerCase().includes(search.toLowerCase()) ||
      i.description.toLowerCase().includes(search.toLowerCase());

    const matchesSeverity =
      severityFilter === 'ALL'
        ? true
        : severityFilter === 'BLOCKED'
        ? i.road_status === 'BLOCKED' || i.road_status === 'CLOSED'
        : i.severity.toUpperCase() === severityFilter;

    return matchesSearch && matchesSeverity;
  });

  return (
    <div className="space-y-5 pb-8">
      {/* Page Header */}
      <div className="bg-white border border-[#E5E7EB] p-5 rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-extrabold text-[#1F2937] flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            Field Incidents & Disruption Registry
          </h1>
          <p className="text-xs text-[#6B7280] mt-0.5">
            Track reported landslides, flash floods, bridge damage, and road blockages across NER transport corridors.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" /> Report New Incident
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-[#E5E7EB] p-3.5 rounded-2xl shadow-xs flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto flex-1">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-[#6B7280] absolute left-3 top-2.5" />
            <input 
              type="text"
              placeholder="Search incident type, location, description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#F7F7FB] border border-[#E5E7EB] rounded-xl pl-9 pr-3 py-2 text-[#1F2937] placeholder-[#6B7280] focus:outline-none focus:border-purple-600"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-[#6B7280]" />
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="bg-[#F7F7FB] border border-[#E5E7EB] text-[#1F2937] text-xs font-semibold rounded-xl px-3 py-2 focus:outline-none focus:border-purple-600 cursor-pointer"
            >
              <option value="ALL">Severity: All Severity Levels</option>
              <option value="LOW">Severity: Low</option>
              <option value="MEDIUM">Severity: Medium</option>
              <option value="HIGH">Severity: High</option>
              <option value="CRITICAL">Severity: Critical</option>
              <option value="BLOCKED">Road Status: Blocked Only</option>
            </select>
          </div>
        </div>

        <div className="text-[#6B7280] font-semibold text-xs shrink-0">
          Showing <span className="font-extrabold text-[#1F2937]">{filteredIncidents.length}</span> active incidents
        </div>
      </div>

      {/* Incident Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredIncidents.map((inc) => (
          <div 
            key={inc.id} 
            className="bg-white border border-[#E5E7EB] rounded-2xl p-4 space-y-3 relative overflow-hidden shadow-xs border-l-4 border-l-rose-600 hover:border-purple-300 hover:shadow-md transition duration-200"
          >
            <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2.5">
              <span className="font-extrabold text-sm text-rose-700">{inc.incident_type}</span>
              <StatusBadge level={inc.road_status === 'BLOCKED' || inc.road_status === 'CLOSED' ? 'BLOCKED' : inc.severity} size="sm" />
            </div>

            <p className="text-xs text-[#1F2937] leading-relaxed">{inc.description}</p>

            <div className="space-y-1.5 text-xs text-[#6B7280] pt-1">
              <div className="flex items-center gap-1.5 text-[#1F2937]">
                <MapPin className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                <span className="font-bold">{inc.location_name}</span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px]">Reporter: {inc.reporter_name}</span>
                <button
                  onClick={() => setDeleteIncidentId(inc.id)}
                  title="Remove Incident"
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="text-[10px] text-slate-400">Log Date: {new Date(inc.created_at || Date.now()).toLocaleString()}</div>
            </div>
          </div>
        ))}
      </div>

      {/* New Incident Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="border-b border-[#E5E7EB] pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-base font-extrabold text-[#1F2937]">Report Road Disruption Incident</h3>
                <p className="text-xs text-[#6B7280]">Log field disruption to update live GIS corridor risk map.</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="text-[#1F2937] font-semibold block mb-1">Incident Type</label>
                <select
                  value={formData.incident_type}
                  onChange={(e) => setFormData({ ...formData, incident_type: e.target.value })}
                  className="w-full bg-[#F7F7FB] border border-[#E5E7EB] rounded-xl px-3 py-2 text-[#1F2937] focus:outline-none focus:border-purple-600"
                >
                  <option value="LANDSLIDE">LANDSLIDE</option>
                  <option value="FLOOD">FLOOD / FLASH WATER</option>
                  <option value="BRIDGE_DAMAGE">BRIDGE DAMAGE</option>
                  <option value="ROAD_DAMAGE">ROAD DAMAGE</option>
                  <option value="TRAFFIC">TRAFFIC CONGESTION</option>
                  <option value="WEATHER">WEATHER HAZARD</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>

              <div>
                <label className="text-[#1F2937] font-semibold block mb-1">Location Name</label>
                <input
                  type="text"
                  value={formData.location_name}
                  onChange={(e) => setFormData({ ...formData, location_name: e.target.value })}
                  required
                  className="w-full bg-[#F7F7FB] border border-[#E5E7EB] rounded-xl px-3 py-2 text-[#1F2937] focus:outline-none focus:border-purple-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#1F2937] font-semibold block mb-1">Severity</label>
                  <select
                    value={formData.severity}
                    onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                    className="w-full bg-[#F7F7FB] border border-[#E5E7EB] rounded-xl px-3 py-2 text-[#1F2937] focus:outline-none focus:border-purple-600"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>

                <div>
                  <label className="text-[#1F2937] font-semibold block mb-1">Road Status</label>
                  <select
                    value={formData.road_status}
                    onChange={(e) => setFormData({ ...formData, road_status: e.target.value })}
                    className="w-full bg-[#F7F7FB] border border-[#E5E7EB] rounded-xl px-3 py-2 text-[#1F2937] focus:outline-none focus:border-purple-600"
                  >
                    <option value="OPEN">OPEN</option>
                    <option value="PASSABLE">PASSABLE</option>
                    <option value="PARTIAL">PARTIAL ACCESS</option>
                    <option value="RESTRICTED">RESTRICTED</option>
                    <option value="BLOCKED">BLOCKED / IMPASSABLE</option>
                    <option value="CLOSED">CLOSED</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[#1F2937] font-semibold block mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows="2"
                  className="w-full bg-[#F7F7FB] border border-[#E5E7EB] rounded-xl px-3 py-2 text-[#1F2937] focus:outline-none focus:border-purple-600"
                ></textarea>
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
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs"
                >
                  Submit Incident & Update GIS
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!deleteIncidentId}
        title="Remove Incident Record?"
        message="Are you sure you want to remove this incident record from the GIS accessibility registry?"
        confirmText="Remove Record"
        type="danger"
        loading={actionLoading}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteIncidentId(null)}
      />
    </div>
  );
};
