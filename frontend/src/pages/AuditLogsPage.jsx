import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { History, ShieldCheck, User, Search, Filter } from 'lucide-react';

export const AuditLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  useEffect(() => {
    api.get('/audit-logs').then((res) => setLogs(res.data)).catch(console.error);
  }, []);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.user_email.toLowerCase().includes(search.toLowerCase()) ||
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.details.toLowerCase().includes(search.toLowerCase()) ||
      log.resource.toLowerCase().includes(search.toLowerCase());

    const matchesAction =
      actionFilter === 'ALL' ? true : log.action.toUpperCase().includes(actionFilter);

    return matchesSearch && matchesAction;
  });

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="bg-white border border-[#E5E7EB] p-5 rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-extrabold text-[#1F2937] flex items-center gap-2">
            <History className="w-5 h-5 text-purple-600" />
            Security & System Audit Trail
          </h1>
          <p className="text-xs text-[#6B7280] mt-0.5">
            Immutable action logs recording logins, delivery creations, incident reports, and reroute approvals.
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-[#E5E7EB] p-3.5 rounded-2xl shadow-xs flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto flex-1">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-[#6B7280] absolute left-3 top-2.5" />
            <input 
              type="text"
              placeholder="Search user, action, resource, details..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#F7F7FB] border border-[#E5E7EB] rounded-xl pl-9 pr-3 py-2 text-[#1F2937] placeholder-[#6B7280] focus:outline-none focus:border-purple-600"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-[#6B7280]" />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="bg-[#F7F7FB] border border-[#E5E7EB] text-[#1F2937] text-xs font-semibold rounded-xl px-3 py-2 focus:outline-none focus:border-purple-600 cursor-pointer"
            >
              <option value="ALL">Action: All Actions</option>
              <option value="LOGIN">Action: User Login</option>
              <option value="DELIVERY">Action: Delivery Dispatch</option>
              <option value="INCIDENT">Action: Incident Report</option>
              <option value="REROUTE">Action: Route Reroute</option>
            </select>
          </div>
        </div>

        <div className="text-[#6B7280] font-semibold text-xs shrink-0">
          Showing <span className="font-extrabold text-[#1F2937]">{filteredLogs.length}</span> audit logs
        </div>
      </div>

      <div className="bg-white border border-[#E5E7EB] rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-[#F7F7FB] border-b border-[#E5E7EB] text-[11px] font-extrabold text-[#6B7280] uppercase tracking-wider">
                <th className="p-3.5">User Email</th>
                <th className="p-3.5">Action Event</th>
                <th className="p-3.5">Target Resource</th>
                <th className="p-3.5">Event Details</th>
                <th className="p-3.5 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB] text-xs text-[#1F2937]">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-[#6B7280]">
                    No audit log records matching search criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#F7F7FB] transition">
                    <td className="p-3.5 font-bold text-purple-700">{log.user_email}</td>
                    <td className="p-3.5 font-extrabold text-[#1F2937]">{log.action}</td>
                    <td className="p-3.5 font-mono text-[#6B7280] text-[11px]">{log.resource}</td>
                    <td className="p-3.5 text-[#1F2937] font-medium">{log.details}</td>
                    <td className="p-3.5 text-right text-[#6B7280] font-mono text-[11px]">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
