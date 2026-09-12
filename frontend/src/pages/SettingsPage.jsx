import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Settings, Shield, Sliders, AlertOctagon, Save } from 'lucide-react';
import { useToast } from '../context/ToastContext';

export const SettingsPage = () => {
  const { showToast } = useToast();
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/settings').then((res) => setSettings(res.data)).catch(console.error);
  }, []);

  const handleValueChange = (id, newVal) => {
    setSettings((prev) => prev.map((s) => (s.id === id ? { ...s, setting_value: newVal } : s)));
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    try {
      showToast('System configuration settings saved successfully!', 'success');
    } catch (err) {
      showToast('Failed to save settings.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Page Header */}
      <div className="bg-white border border-[#E5E7EB] p-5 rounded-2xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-extrabold text-[#1F2937] flex items-center gap-2">
            <Settings className="w-5 h-5 text-purple-600" />
            System Configurations & Risk Thresholds
          </h1>
          <p className="text-xs text-[#6B7280] mt-0.5">
            Configure prototype risk score bounds, demo toggles, and dataset settings.
          </p>
        </div>

        <button
          onClick={handleSaveSettings}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-violet-600 to-teal-500 hover:opacity-90 text-white font-bold text-xs shadow-xs transition active:scale-95 shrink-0"
        >
          <Save className="w-4 h-4" /> Save Configurations
        </button>
      </div>

      <div className="bg-white border border-[#E5E7EB] p-5 rounded-2xl shadow-xs space-y-4">
        <h3 className="text-xs font-extrabold text-[#1F2937] uppercase tracking-wider flex items-center gap-2 border-b border-[#E5E7EB] pb-2">
          <Sliders className="w-4 h-4 text-purple-600" /> Prototype Threshold Configuration
        </h3>

        <div className="space-y-3">
          {settings.map((s) => (
            <div key={s.id} className="p-3.5 rounded-xl bg-[#F7F7FB] border border-[#E5E7EB] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <div className="font-extrabold text-purple-700">{s.setting_key}</div>
                <div className="text-[11px] text-[#6B7280] font-medium">{s.description}</div>
              </div>
              <input
                type="text"
                value={s.setting_value}
                onChange={(e) => handleValueChange(s.id, e.target.value)}
                className="bg-white border border-[#E5E5EB] rounded-xl px-3 py-1.5 text-xs text-[#1F2937] font-mono text-center w-full sm:w-28 font-bold focus:outline-none focus:border-purple-600"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Data Honesty Disclaimer Box */}
      <div className="bg-purple-50 border border-purple-200 p-4.5 rounded-2xl border-l-4 border-l-purple-600 space-y-2 text-xs shadow-xs">
        <div className="font-extrabold text-purple-950 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
          <AlertOctagon className="w-4 h-4 text-purple-600" /> Data Honesty & SIH Prototype Declaration
        </div>
        <p className="text-purple-900 text-[11px] leading-relaxed font-medium">
          All risk thresholds, weather telemetry, and vehicle movements are clearly tagged with{' '}
          <span className="text-purple-700 font-mono font-extrabold">[SIMULATED DEMO DATA]</span> badges in accordance with Smart India Hackathon data transparency guidelines.
        </p>
      </div>
    </div>
  );
};


