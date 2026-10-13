import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { History, ShieldCheck, User, Search, Filter, Clock } from 'lucide-react';

export const AuditLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  useEffect(() => {
    api.get('/audit-logs').then((res) => {
      const data = res?.data;
      setLogs(Array.isArray(data) ? data : []);
    }).catch(console.error);
  }, []);

  const filteredLogs = (Array.isArray(logs) ? logs : []).filter((log) => {
    const s = (search || '').toLowerCase();
    const matchesSearch =
      (log.user_email || '').toLowerCase().includes(s) ||
      (log.action || '').toLowerCase().includes(s) ||
      (log.details || '').toLowerCase().includes(s) ||
      (log.resource || '').toLowerCase().includes(s);

    const matchesAction =
      actionFilter === 'ALL' ? true : (log.action || '').toUpperCase().includes(actionFilter);

    return matchesSearch && matchesAction;
  });

  return (
    <div className="space-y-5 pb-8 text-[#17202A] font-sans">
      {/* Page Header */}
      <div className="bg-white border border-[#D9E0E7] p-4 sm:p-5 rounded-[8px] shadow-subtle flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold text-[#123B66] bg-[#123B66]/10 px-2 py-0.5 rounded border border-[#123B66]/20 uppercase tracking-wider">
              OPERATIONAL INTEGRITY
            </span>
            <span className="text-[10px] text-[#5B6570] font-mono">
              Statutory Government Audit Logs
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0B2744] flex items-center gap-2">
            <History className="w-5 h-5 text-[#185A8D]" />
            Security & System Audit Trail
          </h1>
          <p className="text-xs text-[#5B6570] mt-1">
            Immutable operational action log tracking consignment dispatches, incident log modifications, route approvals, and operator logins.
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-[#D9E0E7] p-3 rounded-[8px] shadow-subtle flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto flex-1">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-[#5B6570] absolute left-3 top-2.5" />
            <input 
              type="text"
              placeholder="Search user, action, resource, details..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#F6F8FA] border border-[#D9E0E7] rounded-[6px] pl-9 pr-3 py-1.5 text-xs text-[#17202A] placeholder-[#5B6570] focus:outline-none focus:border-[#185A8D] transition"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-[#5B6570]" />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="bg-[#F6F8FA] border border-[#D9E0E7] text-[#17202A] text-xs font-semibold rounded-[6px] px-3 py-1.5 focus:outline-none focus:border-[#185A8D] cursor-pointer"
            >
              <option value="ALL">Action: All Events</option>
              <option value="LOGIN">Action: User Login</option>
              <option value="DELIVERY">Action: Consignment Dispatch</option>
              <option value="INCIDENT">Action: Hazard Incident Report</option>
              <option value="REROUTE">Action: Reroute Detour Approval</option>
            </select>
          </div>
        </div>

        <div className="text-[#5B6570] font-semibold text-xs shrink-0">
          Showing <span className="font-bold text-[#123B66]">{filteredLogs.length}</span> audit logs
        </div>
      </div>

      <div className="bg-white border border-[#D9E0E7] rounded-[8px] shadow-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-[#F6F8FA] border-b border-[#D9E0E7] text-[10px] font-bold text-[#5B6570] uppercase tracking-wider">
                <th className="p-3">User Email</th>
                <th className="p-3">Action Event</th>
                <th className="p-3">Target Resource</th>
                <th className="p-3">Event Details</th>
                <th className="p-3 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7EBEF] text-xs text-[#17202A]">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-[#5B6570]">
                    No audit log records matching search criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#F6F8FA] transition">
                    <td className="p-3 font-bold text-[#123B66] font-mono">{log.user_email}</td>
                    <td className="p-3 font-bold text-[#0B2744]">{log.action}</td>
                    <td className="p-3 font-mono text-[#5B6570] text-[11px] font-semibold">{log.resource}</td>
                    <td className="p-3 text-[#5B6570] font-medium">{log.details}</td>
                    <td className="p-3 text-right text-[#5B6570] font-mono text-[11px]">
                      {new Date(log.timestamp).toLocaleString()} IST
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

export default AuditLogsPage;
