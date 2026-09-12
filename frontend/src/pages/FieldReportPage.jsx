import React, { useState, useRef } from 'react';
import { useOfflineSync } from '../context/OfflineSyncContext';
import { useToast } from '../context/ToastContext';
import { 
  ClipboardEdit, Wifi, WifiOff, RefreshCw, Camera, MapPin, 
  CheckCircle2, Upload, AlertTriangle, ShieldCheck, Trash2, 
  Crosshair, Image as ImageIcon, Eye, Smartphone, AlertCircle 
} from 'lucide-react';

export const FieldReportPage = () => {
  const { isOnline, pendingQueue, addOfflineReport, syncPendingReports, syncStatus, removePendingReport, clearQueue } = useOfflineSync();
  const { showToast } = useToast();

  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    incident_type: 'LANDSLIDE',
    description: 'Fresh monsoon mudslide observed blocking heavy transport trucks on highway mountain pass.',
    latitude: 25.2676,
    longitude: 94.0210,
    location_name: 'Senapati Mountain Pass (NH27)',
    district_name: 'Senapati',
    severity: 'CRITICAL',
    road_status: 'BLOCKED',
    affected_bridge_code: '',
    load_restriction_type: 'No Restriction',
    photo_url: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=400'
  });

  const [photoPreview, setPhotoPreview] = useState(formData.photo_url);
  const [photoName, setPhotoName] = useState('Default Evidence Photo');
  const [gpsStatus, setGpsStatus] = useState({
    captured: true,
    accuracy: 12.4, // meters
    timestamp: new Date().toLocaleTimeString()
  });
  const [capturingGps, setCapturingGps] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showQueueModal, setShowQueueModal] = useState(false);

  const STRATEGIC_BRIDGES = [
    { code: '', label: '-- None / General Mountain Road --' },
    { code: 'BRG-IRANG', label: 'Irang River Bailey Bridge (COR-NH37, Noney, Manipur)', road: 'COR-NH37' },
    { code: 'BRG-BOGIBEEL', label: 'Bogibeel Rail-Road Bridge (COR-NH15, Dibrugarh, Assam)', road: 'COR-NH15' },
    { code: 'BRG-DHOLA-SADIYA', label: 'Dhola-Sadiya (Bhupen Hazarika) Bridge (COR-NH15, Tinsukia, Assam)', road: 'COR-NH15' },
    { code: 'BRG-KOLIA-BHOMORA', label: 'Kolia Bhomora Setu (COR-NH715, Sonitpur, Assam)', road: 'COR-NH715' },
    { code: 'BRG-SERCHHIP', label: 'Tuichang Suspension Bridge (COR-NH54, Serchhip, Mizoram)', road: 'COR-NH54' },
    { code: 'BRG-NAMGANG', label: 'Namgang RCC Bridge (COR-NH10, Gangtok, Sikkim)', road: 'COR-NH10' },
    { code: 'BRG-RANIDANGA', label: 'Ranidanga River Span (COR-NH31A, Darjeeling)', road: 'COR-NH31A' },
    { code: 'BRG-CORONATION', label: 'Coronation Teesta Bridge (COR-NH10, Sevoke, WB/SKM)', road: 'COR-NH10' }
  ];

  const handleBridgeSelect = (bridgeCode) => {
    const matched = STRATEGIC_BRIDGES.find(b => b.code === bridgeCode);
    setFormData(prev => ({
      ...prev,
      affected_bridge_code: bridgeCode,
      location_name: matched && matched.code ? `${matched.label.split('(')[0].trim()}` : prev.location_name
    }));
  };

  // Real GPS Geolocation Capture
  const handleCaptureGps = () => {
    setCapturingGps(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = parseFloat(pos.coords.latitude.toFixed(4));
          const lng = parseFloat(pos.coords.longitude.toFixed(4));
          const acc = pos.coords.accuracy ? parseFloat(pos.coords.accuracy.toFixed(1)) : 10.0;
          setFormData((prev) => ({
            ...prev,
            latitude: lat,
            longitude: lng
          }));
          setGpsStatus({
            captured: true,
            accuracy: acc,
            timestamp: new Date().toLocaleTimeString()
          });
          setCapturingGps(false);
          showToast(`📍 Live GPS Locked: [${lat}, ${lng}] (±${acc}m)`, 'success');
        },
        (err) => {
          setCapturingGps(false);
          setGpsStatus((prev) => ({ ...prev, captured: false }));
          showToast(`GPS Error (${err.message}). Using manual/last coordinates.`, 'warning');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setCapturingGps(false);
      showToast('Geolocation API not supported in browser environment.', 'warning');
    }
  };

  // Real Photo Upload & Validation (<5MB, Image format)
  const handlePhotoFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Invalid file format. Please attach an image file (JPG, PNG, WebP).', 'error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('File size exceeds 5MB limit. Please attach a compressed image.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result;
      setPhotoPreview(dataUrl);
      setPhotoName(file.name);
      setFormData((prev) => ({
        ...prev,
        photo_url: dataUrl
      }));
      showToast(`📷 Photo captured: ${file.name} (${(file.size / 1024).toFixed(0)} KB)`, 'success');
    };
    reader.readAsDataURL(file);
  };

  const handleClearPhoto = () => {
    setPhotoPreview(null);
    setPhotoName('');
    setFormData((prev) => ({
      ...prev,
      photo_url: ''
    }));
    if (fileInputRef.current) fileInputRef.current.value = '';
    showToast('Photo removed from field report.', 'info');
  };

  // Handle Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const report = addOfflineReport(formData);

    setIsSubmitting(false);
    if (isOnline) {
      showToast('✓ Report created and auto-synchronized to Central GIS Server!', 'success');
    } else {
      showToast('🌐 Network Offline: Saved to Local Offline Queue (Pending Sync).', 'warning');
    }
  };

  const handleManualSync = async () => {
    showToast('Transmitting offline reports to central GIS intelligence server...', 'info');
    const res = await syncPendingReports();
    if (res.success) {
      showToast(`✓ Sync Complete! ${res.count} report(s) accepted by GIS server.`, 'success');
    } else {
      showToast(`Sync failed: ${res.error}`, 'error');
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-4 pb-12 px-2 sm:px-0">
      {/* Mobile-First Header Bar */}
      <div className="bg-white border border-[#E5E7EB] p-4 sm:p-5 rounded-2xl shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 shadow-xs">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-extrabold text-[#1F2937] leading-tight flex items-center gap-2">
              Field Officer Mobile Portal
            </h1>
            <p className="text-[11px] text-[#6B7280]">
              Offline-First Field Reporting • SIH Gap 15 (MDoNER)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between">
          {/* Online / Offline Connectivity Badge */}
          {isOnline ? (
            <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1.5 shadow-xs">
              <Wifi className="w-3.5 h-3.5 text-emerald-600" /> ONLINE
            </span>
          ) : (
            <span className="px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-300 text-xs font-bold flex items-center gap-1.5 animate-pulse shadow-xs">
              <WifiOff className="w-3.5 h-3.5 text-amber-600" /> OFFLINE MODE
            </span>
          )}

          {pendingQueue.length > 0 && (
            <button
              onClick={() => setShowQueueModal(true)}
              className="px-3 py-1.5 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 text-xs font-bold flex items-center gap-1"
            >
              Queue ({pendingQueue.length})
            </button>
          )}
        </div>
      </div>

      {/* Offline Pending Queue Banner */}
      {pendingQueue.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 p-3.5 sm:p-4 rounded-2xl border-l-4 border-l-amber-500 flex items-center justify-between shadow-xs gap-2">
          <div className="min-w-0 flex-1">
            <div className="font-extrabold text-amber-900 text-xs flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
              <span>OFFLINE QUEUE: {pendingQueue.length} PENDING</span>
            </div>
            <p className="text-[11px] text-amber-800 font-medium truncate mt-0.5">
              Stored locally on device. Will auto-sync when network returns.
            </p>
          </div>
          <button
            onClick={handleManualSync}
            disabled={syncStatus === 'SYNCING'}
            className="px-3 py-2 min-h-[44px] rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs shadow-xs flex items-center gap-1.5 transition active:scale-95 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncStatus === 'SYNCING' ? 'animate-spin' : ''}`} />
            <span>{syncStatus === 'SYNCING' ? 'Syncing...' : 'Sync Now'}</span>
          </button>
        </div>
      )}

      {/* Mobile Form Card */}
      <div className="bg-white border border-[#E5E7EB] p-4 sm:p-6 rounded-2xl shadow-xs">
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          
          {/* Incident Type */}
          <div>
            <label className="text-[#1F2937] font-bold block mb-1 text-xs">
              Incident Category <span className="text-rose-500">*</span>
            </label>
            <select
              value={formData.incident_type}
              onChange={(e) => setFormData({ ...formData, incident_type: e.target.value })}
              className="w-full min-h-[44px] bg-[#F7F7FB] border border-[#E5E7EB] rounded-xl px-3.5 py-2.5 text-[#1F2937] font-semibold focus:outline-none focus:border-purple-600 text-xs"
            >
              <option value="LANDSLIDE">LANDSLIDE (Monsoon Mudslide)</option>
              <option value="FLOOD">FLOOD (Flash Flood / Inundation)</option>
              <option value="BRIDGE_DAMAGE">BRIDGE DAMAGE (Structural Failure / Pier Shift)</option>
              <option value="ROAD_DAMAGE">ROAD DAMAGE (Caved Segment / Sinkhole)</option>
              <option value="TRAFFIC">TRAFFIC (Severe Mountain Gridlock)</option>
              <option value="WEATHER">WEATHER (Dense Fog / Heavy Downpour)</option>
              <option value="OTHER">OTHER OBSTRUCTION</option>
            </select>
          </div>

          {/* Strategic Bridge Integration (SIH Gap 2 & Gap 15) */}
          <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl space-y-2.5">
            <div>
              <label className="text-purple-900 font-bold block mb-1 text-[11px] flex items-center justify-between">
                <span>🌉 Strategic Bridge Association (Optional)</span>
                {formData.affected_bridge_code && (
                  <span className="text-[10px] font-mono bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full font-bold">
                    {formData.affected_bridge_code}
                  </span>
                )}
              </label>
              <select
                value={formData.affected_bridge_code}
                onChange={(e) => handleBridgeSelect(e.target.value)}
                className="w-full min-h-[44px] bg-white border border-purple-200 rounded-xl px-3 py-2 text-[#1F2937] font-semibold text-xs focus:outline-none focus:border-purple-600"
              >
                {STRATEGIC_BRIDGES.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>

            {formData.affected_bridge_code && (
              <div>
                <label className="text-purple-900 font-bold block mb-1 text-[11px]">
                  Imposed Bridge Load Restriction
                </label>
                <select
                  value={formData.load_restriction_type}
                  onChange={(e) => setFormData({ ...formData, load_restriction_type: e.target.value })}
                  className="w-full min-h-[44px] bg-white border border-purple-200 rounded-xl px-3 py-2 text-[#1F2937] text-xs font-semibold focus:outline-none focus:border-purple-600"
                >
                  <option value="No Restriction">No Restriction (Normal Transit)</option>
                  <option value="Light Vehicles Only">Light Vehicles Only (&lt; 3.5T)</option>
                  <option value="Reduced Load (Max 20T)">Reduced Load (Max 20 Tonnes)</option>
                  <option value="Heavy Vehicles Restricted">Heavy Vehicles Restricted</option>
                  <option value="Closed">Closed (Zero Access / Full Structural Block)</option>
                  <option value="Unknown">Unknown Condition</option>
                </select>
              </div>
            )}
          </div>

          {/* Location & District */}
          <div>
            <label className="text-[#1F2937] font-bold block mb-1 text-xs">
              Corridor Location / Sector Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-purple-600 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={formData.location_name}
                onChange={(e) => setFormData({ ...formData, location_name: e.target.value })}
                required
                className="w-full min-h-[44px] bg-[#F7F7FB] border border-[#E5E7EB] rounded-xl pl-10 pr-3.5 py-2.5 text-[#1F2937] font-medium text-xs focus:outline-none focus:border-purple-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[#1F2937] font-bold block mb-1 text-xs">District Name</label>
              <input
                type="text"
                value={formData.district_name}
                onChange={(e) => setFormData({ ...formData, district_name: e.target.value })}
                className="w-full min-h-[44px] bg-[#F7F7FB] border border-[#E5E7EB] rounded-xl px-3.5 py-2.5 text-[#1F2937] font-medium text-xs focus:outline-none focus:border-purple-600"
              />
            </div>

            <div>
              <label className="text-[#1F2937] font-bold block mb-1 text-xs">GPS Geolocation</label>
              <button
                type="button"
                onClick={handleCaptureGps}
                disabled={capturingGps}
                className="w-full min-h-[44px] rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold border border-purple-200 flex items-center justify-center gap-2 transition active:scale-95 text-xs"
              >
                <Crosshair className={`w-4 h-4 text-purple-600 ${capturingGps ? 'animate-spin' : ''}`} />
                <span>{capturingGps ? 'Locking Satellite...' : 'Capture Device GPS'}</span>
              </button>
            </div>
          </div>

          {/* GPS Coordinates & Accuracy Status */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-slate-700">GPS Coordinates:</span>
              {gpsStatus.captured ? (
                <span className="text-emerald-700 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> LOCATION CAPTURED (±{gpsStatus.accuracy}m)
                </span>
              ) : (
                <span className="text-amber-700 font-bold flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-amber-600" /> LOCATION UNAVAILABLE
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 font-mono text-xs">
              <input
                type="number"
                step="0.0001"
                value={formData.latitude}
                onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) || 0 })}
                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-slate-800 font-bold"
              />
              <input
                type="number"
                step="0.0001"
                value={formData.longitude}
                onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) || 0 })}
                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-slate-800 font-bold"
              />
            </div>
          </div>

          {/* Severity & Road Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[#1F2937] font-bold block mb-1 text-xs">Severity Level</label>
              <select
                value={formData.severity}
                onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                className="w-full min-h-[44px] bg-[#F7F7FB] border border-[#E5E7EB] rounded-xl px-3 py-2 text-[#1F2937] font-semibold text-xs focus:outline-none focus:border-purple-600"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>

            <div>
              <label className="text-[#1F2937] font-bold block mb-1 text-xs">Passability Status</label>
              <select
                value={formData.road_status}
                onChange={(e) => setFormData({ ...formData, road_status: e.target.value })}
                className="w-full min-h-[44px] bg-[#F7F7FB] border border-[#E5E7EB] rounded-xl px-3 py-2 text-[#1F2937] font-semibold text-xs focus:outline-none focus:border-purple-600"
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

          {/* Photo Evidence Capture (Mobile Camera / Gallery) */}
          <div>
            <label className="text-[#1F2937] font-bold block mb-1 text-xs">
              Photo Evidence (Camera / File)
            </label>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoFileChange}
              className="hidden"
              id="field-photo-input"
            />

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 font-bold flex items-center justify-center gap-2 transition active:scale-95 text-xs"
              >
                <Camera className="w-4 h-4 text-purple-600" />
                <span>Capture / Upload Photo</span>
              </button>

              {photoPreview && (
                <div className="flex items-center justify-between gap-2 p-2 bg-[#F7F7FB] border border-[#E5E7EB] rounded-xl text-xs flex-1">
                  <div className="flex items-center gap-2 truncate">
                    <img src={photoPreview} alt="Evidence" className="w-8 h-8 rounded-lg object-cover border" />
                    <span className="font-semibold text-[#1F2937] truncate">{photoName || 'Evidence Photo Attached'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearPhoto}
                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"
                    title="Remove Photo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Observations */}
          <div>
            <label className="text-[#1F2937] font-bold block mb-1 text-xs">
              Detailed Field Observations
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows="3"
              className="w-full bg-[#F7F7FB] border border-[#E5E7EB] rounded-xl px-3.5 py-2.5 text-[#1F2937] font-medium text-xs focus:outline-none focus:border-purple-600"
              placeholder="Describe incident nature, affected convoy width, weather conditions..."
            ></textarea>
          </div>

          {/* Submit Action (Touch-Friendly Full Width) */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full min-h-[48px] rounded-xl bg-gradient-to-r from-purple-600 via-violet-600 to-teal-500 hover:opacity-95 text-white font-extrabold text-xs shadow-md transition active:scale-98 flex items-center justify-center gap-2"
          >
            <ClipboardEdit className="w-4 h-4" />
            <span>Save Report to Local Offline Queue</span>
          </button>
        </form>
      </div>

      {/* Offline Queue Modal / Inspection Sheet */}
      {showQueueModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom duration-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2 font-extrabold text-sm text-slate-800">
                <ShieldCheck className="w-4 h-4 text-purple-600" />
                <span>Pending Offline Reports ({pendingQueue.length})</span>
              </div>
              <button
                onClick={() => setShowQueueModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕ Close
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 flex-1 text-xs">
              {pendingQueue.length === 0 ? (
                <div className="text-center text-slate-500 py-6">No reports pending in offline queue.</div>
              ) : (
                pendingQueue.map((item) => (
                  <div key={item.report_code} className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-purple-900">{item.report_code}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900">
                        {item.sync_status}
                      </span>
                    </div>
                    <div className="font-semibold text-slate-800">{item.incident_type} at {item.location_name}</div>
                    <p className="text-slate-600 text-[11px] leading-tight">{item.description}</p>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                      <span>Coords: [{item.latitude}, {item.longitude}]</span>
                      <button
                        onClick={() => removePendingReport(item.report_code)}
                        className="text-rose-600 font-bold hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
              <button
                onClick={clearQueue}
                className="px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 font-bold text-xs"
              >
                Clear Queue
              </button>
              <button
                onClick={handleManualSync}
                disabled={pendingQueue.length === 0 || syncStatus === 'SYNCING'}
                className="px-4 py-2 rounded-xl bg-purple-600 text-white font-bold text-xs hover:bg-purple-700 disabled:opacity-50"
              >
                {syncStatus === 'SYNCING' ? 'Syncing...' : 'Sync All Reports'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

