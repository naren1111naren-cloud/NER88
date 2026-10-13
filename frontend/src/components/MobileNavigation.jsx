import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Network, 
  TriangleAlert, 
  Route, 
  Menu
} from 'lucide-react';

/**
 * NER88 Mobile Bottom Navigation — Light Green Brand Shell
 * Section 23: Prioritizes Command Center, Network, Incidents, Routes, and "More" drawer.
 */
export const MobileNavigation = () => {
  const location = useLocation();

  const primaryTabs = [
    { to: '/command-center', label: 'Command', icon: LayoutDashboard, aliases: ['/dashboard', '/'] },
    { to: '/network', label: 'Network', icon: Network, aliases: ['/map'] },
    { to: '/incidents', label: 'Incidents', icon: TriangleAlert, aliases: ['/alerts'] },
    { to: '/routes', label: 'Routes', icon: Route, aliases: ['/corridors'] },
  ];

  const handleOpenMoreDrawer = () => {
    window.dispatchEvent(new CustomEvent('toggle_mobile_nav'));
  };

  return (
    <nav 
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#DDEFE3] border-t border-[#C7DCCB] shadow-elevated px-2 py-1 flex items-center justify-around select-none"
      aria-label="Mobile Bottom Navigation"
    >
      {primaryTabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = location.pathname === tab.to || (tab.aliases && tab.aliases.includes(location.pathname));

        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-md text-[10px] font-semibold transition-colors ${
              isActive
                ? 'text-[#173D2A] font-bold bg-[#B9DCC3]'
                : 'text-[#4F6B59] hover:text-[#173D2A]'
            }`}
          >
            <Icon className={`w-4.5 h-4.5 mb-0.5 ${isActive ? 'text-[#173D2A]' : 'text-[#4F6B59]'}`} />
            <span>{tab.label}</span>
          </NavLink>
        );
      })}

      {/* "More" Trigger — Opens Full Navigation Drawer */}
      <button
        type="button"
        onClick={handleOpenMoreDrawer}
        className="flex flex-col items-center justify-center py-1 px-3 rounded-md text-[10px] font-semibold text-[#4F6B59] hover:text-[#173D2A] transition-colors cursor-pointer"
        aria-label="More navigation options"
      >
        <Menu className="w-4.5 h-4.5 mb-0.5 text-[#4F6B59]" />
        <span>More</span>
      </button>
    </nav>
  );
};

export default MobileNavigation;
