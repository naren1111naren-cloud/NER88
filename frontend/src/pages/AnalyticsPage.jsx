import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { safeArray } from '../utils/apiHelpers';
import { StatusBadge } from '../components/StatusBadge';
import { BarChart3, TrendingUp, ShieldCheck, MapPin, Activity, Package, Clock, Shield } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

export const AnalyticsPage = () => {
  const [data, setData] = useState(null);
  const [districts, setDistricts] = useState([]);

  useEffect(() => {
    api.get('/analytics')
      .then((res) => setData(res.data))
      .catch(console.error);

    api.get('/districts')
      .then((res) => setDistricts(safeArray(res.data)))
      .catch(console.error);
  }, []);

  return (
    <div className="space-y-5 pb-8">
      {/* Page Header */}
      <div className="bg-white border border-[#E5E7EB] p-5 rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <StatusBadge variant="simulation" size="sm">Sandbox Adapter</StatusBadge>
          </div>
          <h1 className="text-lg font-extrabold text-[#1F2937] flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-600" />
            Logistics Bottleneck Analytics & Regional Accessibility BI
          </h1>
          <p className="text-xs text-[#6B7280] mt-0.5">
            Historical corridor disruption trends, regional risk metrics, district accessibility scores, and logistics delay benchmarks.
          </p>
        </div>
        <span className="text-xs font-mono font-bold px-3 py-1 rounded-lg bg-purple-50 text-purple-700 border border-purple-200">
          BI Metrics v1.0.0
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Incidents by Severity Bar Chart */}
        <div className="bg-white border border-[#E5E7EB] p-5 rounded-2xl shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2">
            <h3 className="text-xs font-extrabold text-[#1F2937] uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-600" /> Incidents by Severity Breakdown
            </h3>
            <span className="text-[11px] text-[#6B7280] font-semibold">Active Quarter</span>
          </div>

          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={safeArray(data?.incidents_by_severity)}>
                <XAxis dataKey="severity" stroke="#6B7280" fontSize={11} />
                <YAxis stroke="#6B7280" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E5E7EB', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" fill="#8B5CF6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Historical Risk Trend Line Chart */}
        <div className="bg-white border border-[#E5E7EB] p-5 rounded-2xl shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2">
            <h3 className="text-xs font-extrabold text-[#1F2937] uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-rose-600" /> Weekly Corridor Disruption Index Trend
            </h3>
            <span className="text-[11px] text-[#6B7280] font-semibold">7-Day Rolling Avg</span>
          </div>

          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={safeArray(data?.historical_risk_trend)}>
                <XAxis dataKey="day" stroke="#6B7280" fontSize={11} />
                <YAxis stroke="#6B7280" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E5E7EB', borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="risk_avg" stroke="#EF4444" strokeWidth={3} dot={{ fill: '#EF4444', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Regional Accessibility Table */}
      <div className="bg-white border border-[#E5E7EB] p-5 rounded-2xl shadow-xs space-y-4">
        <h3 className="text-xs font-extrabold text-[#1F2937] uppercase tracking-wider flex items-center gap-2">
          <MapPin className="w-4 h-4 text-purple-600" /> Regional Corridor Accessibility Index
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F7F7FB] border-b border-[#E5E7EB] text-[11px] font-extrabold text-[#6B7280] uppercase">
                <th className="p-3">Region Corridor</th>
                <th className="p-3">Accessibility Index</th>
                <th className="p-3">Operational Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB] text-xs text-[#1F2937]">
              {safeArray(data?.regional_accessibility).map((r, idx) => (
                <tr key={idx} className="hover:bg-[#F7F7FB] transition">
                  <td className="p-3 font-extrabold text-[#1F2937]">{r.region}</td>
                  <td className="p-3 font-mono text-purple-700 font-extrabold">{r.accessibility_score} / 100</td>
                  <td className="p-3">
                    <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-extrabold ${r.status.includes('CRITICAL') ? 'bg-rose-50 text-rose-800 border border-rose-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'}`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
