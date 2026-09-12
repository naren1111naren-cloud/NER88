import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, Map, Package, Truck, Compass, 
  AlertTriangle, Bell, BarChart3, ClipboardEdit, 
  Settings, History, Users, HelpCircle, ShieldCheck, Building2
} from 'lucide-react';

export const Sidebar = () => {
  const { user } = useAuth();
  const role = user?.role || 'Viewer';

  const navSections = [
    {
      title: 'OPERATIONS',
      links: [
        { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['Admin', 'Dispatcher', 'Field Officer', 'Viewer'] },
        { to: '/map', label: 'GIS Command Map', icon: Map, roles: ['Admin', 'Dispatcher', 'Field Officer', 'Viewer'] },
        { to: '/deliveries', label: 'Deliveries', icon: Package, roles: ['Admin', 'Dispatcher', 'Viewer'] },
        { to: '/vehicles', label: 'Fleet Vehicles', icon: Truck, roles: ['Admin', 'Dispatcher', 'Viewer'] }
      ]
    },
    {
      title: 'INTELLIGENCE',
      links: [
        { to: '/routes', label: 'Route Risk', icon: Compass, roles: ['Admin', 'Dispatcher', 'Viewer'] },
        { to: '/incidents', label: 'Incidents & Blockages', icon: AlertTriangle, roles: ['Admin', 'Dispatcher', 'Field Officer', 'Viewer'] },
        { to: '/alerts', label: 'Alerts Center', icon: Bell, roles: ['Admin', 'Dispatcher', 'Field Officer', 'Viewer'] },
        { to: '/government-integrations', label: 'Gov APIs & Portals', icon: Building2, roles: ['Admin', 'Dispatcher', 'Field Officer', 'Viewer'] },
        { to: '/analytics', label: 'Analytics & BI', icon: BarChart3, roles: ['Admin', 'Dispatcher', 'Viewer'] }
      ]
    },
    {
      title: 'SYSTEM',
      links: [
        { to: '/field-report', label: 'Field Officer Reports', icon: ClipboardEdit, roles: ['Admin', 'Field Officer'] },
        { to: '/audit-logs', label: 'Audit Trail', icon: History, roles: ['Admin'] },
        { to: '/user-management', label: 'User Management', icon: Users, roles: ['Admin'] },
        { to: '/settings', label: 'System Settings', icon: Settings, roles: ['Admin'] },
        { to: '/help', label: 'Documentation & Guide', icon: HelpCircle, roles: ['Admin', 'Dispatcher', 'Field Officer', 'Viewer'] }
      ]
    }
  ];

  return (
    <aside className="w-64 bg-[#171329] text-white flex flex-col justify-between p-3.5 shrink-0 hidden md:flex border-r border-[#2A2447]">
      <div className="space-y-4">
        {/* Brand Header */}
        <div className="px-3 pt-2 pb-3 border-b border-[#2A2447]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-r from-purple-600 via-violet-600 to-teal-500 flex items-center justify-center text-white font-bold shadow-xs shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base tracking-tight text-white leading-tight">
                LINK X8
              </h2>
              <p className="text-xs text-purple-200/90 font-medium leading-none mt-0.5">
                Logistics Intelligence Platform
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Sections */}
        <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-220px)] pr-1">
          {navSections.map((sec) => {
            const visibleLinks = sec.links.filter(l => l.roles.includes(role));
            if (visibleLinks.length === 0) return null;

            return (
              <div key={sec.title} className="space-y-1">
                <div className="px-3 py-1 text-xs font-bold uppercase tracking-wider text-purple-300/80">
                  {sec.title}
                </div>
                {visibleLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <NavLink
                      key={link.to}
                      to={link.to}
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-all duration-150 ${
                          isActive
                            ? 'bg-[#6D28D9] text-white font-bold shadow-xs'
                            : 'text-slate-300 hover:text-white hover:bg-purple-900/30'
                        }`
                      }
                    >
                      <Icon className="w-4 h-4 shrink-0 opacity-90" />
                      <span>{link.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Role Footer */}
      <div className="p-3.5 rounded-md bg-[#231C3D] border border-[#332A57] text-xs space-y-1 shadow-inner">
        <div className="flex items-center gap-1.5 text-xs text-purple-300 uppercase font-bold tracking-wider">
          <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
          Active Portal Role
        </div>
        <div className="text-white font-bold text-sm">{role}</div>
        <div className="text-xs text-slate-300 truncate">{user?.email || 'authenticated'}</div>
      </div>
    </aside>
  );
};

export default Sidebar;


