import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, ExternalLink } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDemo } from '../context/DemoContext';

/**
 * TopFunctionsMenu Component
 * Pop-down square mega-menu container directly matching the design, layout,
 * and typography of the Government of India National Portal (india.gov.in).
 */
export const TopFunctionsMenu = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { setShowScenarioModal } = useDemo();
  const menuRef = useRef(null);

  const role = user?.role || 'Viewer';

  const handleNav = (path) => {
    onClose();
    if (path) navigate(path);
  };

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background scrolling when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Dimmed backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-black/45 backdrop-blur-[1px] transition-opacity animate-in fade-in duration-150"
      />

      {/* Floating Pop-down Square Box (Positioned directly under top navbar, matching india.gov.in screenshot) */}
      <div 
        ref={menuRef}
        className="fixed top-[72px] right-2 sm:right-6 lg:right-10 z-50 w-[96vw] max-w-6xl max-h-[86vh] overflow-y-auto bg-white border border-[#CBD5E1] rounded-[8px] shadow-2xl p-6 sm:p-8 animate-in fade-in slide-in-from-top-2 duration-150 text-[#17202A] select-none"
      >
        {/* Subtle Indian Tricolor accent line across the top border */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#FF9933] via-white to-[#138808] rounded-t-[8px]" />

        {/* Circular Close Button (X) at Top Right (Exact match to india.gov.in Image 2) */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 sm:top-5 sm:right-6 w-8 h-8 rounded-full border border-[#CBD5E1] hover:border-[#94A3B8] bg-white hover:bg-[#F8FAFC] text-[#334155] hover:text-[#0F172A] flex items-center justify-center transition cursor-pointer shadow-2xs"
          title="Close Menu (Esc)"
          aria-label="Close functions menu"
        >
          <X className="w-4 h-4 stroke-[2.5]" />
        </button>

        {/* 5-Column Grid Layout matching india.gov.in screenshot */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 sm:gap-8 pt-2">
          
          {/* ── COLUMN 1: CATEGORY (LOGISTICS CORE) ── */}
          <div className="space-y-3">
            <h3 className="font-bold text-[14px] text-[#0F172A] tracking-tight border-b border-[#E2E8F0] pb-1.5">
              Category
            </h3>
            <ul className="space-y-2 text-[12.5px]">
              <li>
                <button 
                  onClick={() => handleNav('/command-center')}
                  className={`text-left transition hover:text-[#185A8D] cursor-pointer ${
                    location.pathname === '/command-center' || location.pathname === '/dashboard' ? 'font-bold text-[#185A8D]' : 'text-[#334155]'
                  }`}
                >
                  Command Center
                </button>
              </li>
              <li>
                <button 
                  onClick={() => handleNav('/map')}
                  className={`text-left transition hover:text-[#185A8D] cursor-pointer ${
                    location.pathname === '/map' ? 'font-bold text-[#185A8D]' : 'text-[#334155]'
                  }`}
                >
                  Live Satellite GIS Map
                </button>
              </li>
              <li>
                <button 
                  onClick={() => handleNav('/corridors')}
                  className={`text-left transition hover:text-[#185A8D] cursor-pointer ${
                    location.pathname === '/corridors' || location.pathname === '/routes' ? 'font-bold text-[#185A8D]' : 'text-[#334155]'
                  }`}
                >
                  Highway Freight Corridors
                </button>
              </li>
              <li>
                <button 
                  onClick={() => handleNav('/vehicles')}
                  className={`text-left transition hover:text-[#185A8D] cursor-pointer ${
                    location.pathname === '/vehicles' ? 'font-bold text-[#185A8D]' : 'text-[#334155]'
                  }`}
                >
                  Fleet Vehicles & Tracking
                </button>
              </li>
              <li>
                <button 
                  onClick={() => handleNav('/deliveries')}
                  className={`text-left transition hover:text-[#185A8D] cursor-pointer ${
                    location.pathname === '/deliveries' ? 'font-bold text-[#185A8D]' : 'text-[#334155]'
                  }`}
                >
                  Consignments & Cargo
                </button>
              </li>
              <li>
                <button 
                  onClick={() => handleNav('/vehicles')}
                  className="text-left text-[#334155] hover:text-[#185A8D] transition cursor-pointer"
                >
                  Cold-Chain Medical Carriers
                </button>
              </li>
              <li>
                <button 
                  onClick={() => handleNav('/corridors')}
                  className="text-left text-[#334155] hover:text-[#185A8D] transition cursor-pointer"
                >
                  Multi-Modal Transit Hubs
                </button>
              </li>
              <li>
                <button 
                  onClick={() => handleNav('/deliveries')}
                  className="text-left text-[#334155] hover:text-[#185A8D] transition cursor-pointer"
                >
                  Priority Cargo Clearance
                </button>
              </li>
              <li>
                <button 
                  onClick={() => handleNav('/command-center')}
                  className="text-left text-[#334155] hover:text-[#185A8D] transition cursor-pointer"
                >
                  Regional Operational Grid
                </button>
              </li>
            </ul>
          </div>

          {/* ── COLUMN 2: INFRASTRUCTURE & DISRUPTION ── */}
          <div className="space-y-3 pt-6 sm:pt-0">
            <h3 className="font-bold text-[14px] text-[#0F172A] tracking-tight border-b border-[#E2E8F0] pb-1.5 opacity-0 sm:opacity-100">
              Infrastructure & Risk
            </h3>
            <ul className="space-y-2 text-[12.5px]">
              <li>
                <button 
                  onClick={() => handleNav('/incidents')}
                  className={`text-left transition hover:text-[#185A8D] cursor-pointer ${
                    location.pathname === '/incidents' ? 'font-bold text-[#185A8D]' : 'text-[#334155]'
                  }`}
                >
                  Active Road Incidents & Landslides
                </button>
              </li>
              <li>
                <button 
                  onClick={() => handleNav('/weather')}
                  className={`text-left transition hover:text-[#185A8D] cursor-pointer ${
                    location.pathname === '/weather' ? 'font-bold text-[#185A8D]' : 'text-[#334155]'
                  }`}
                >
                  Weather & Monsoon Matrix
                </button>
              </li>
              <li>
                <button 
                  onClick={() => handleNav('/bridges')}
                  className={`text-left transition hover:text-[#185A8D] cursor-pointer ${
                    location.pathname === '/bridges' ? 'font-bold text-[#185A8D]' : 'text-[#334155]'
                  }`}
                >
                  Strategic Bridges (BRO / NHIDCL)
                </button>
              </li>
              <li>
                <button 
                  onClick={() => handleNav('/districts')}
                  className={`text-left transition hover:text-[#185A8D] cursor-pointer ${
                    location.pathname === '/districts' ? 'font-bold text-[#185A8D]' : 'text-[#334155]'
                  }`}
                >
                  District Accessibility Scores
                </button>
              </li>
              <li>
                <button 
                  onClick={() => handleNav('/incidents')}
                  className="text-left text-[#334155] hover:text-[#185A8D] transition cursor-pointer"
                >
                  Hill Slope Instability Watch
                </button>
              </li>
              <li>
                <button 
                  onClick={() => handleNav('/weather')}
                  className="text-left text-[#334155] hover:text-[#185A8D] transition cursor-pointer"
                >
                  River Basin Flash Flood Warnings
                </button>
              </li>
              <li>
                <button 
                  onClick={() => handleNav('/corridors')}
                  className="text-left text-[#334155] hover:text-[#185A8D] transition cursor-pointer"
                >
                  Highway Maintenance Watch
                </button>
              </li>
              <li>
                <button 
                  onClick={() => handleNav('/bridges')}
                  className="text-left text-[#334155] hover:text-[#185A8D] transition cursor-pointer"
                >
                  Heavy Vehicle Load Restrictions
                </button>
              </li>
              <li>
                <button 
                  onClick={() => handleNav('/government-integrations')}
                  className="text-left text-[#334155] hover:text-[#185A8D] transition cursor-pointer"
                >
                  Border Roads Network (Swastik)
                </button>
              </li>
            </ul>
          </div>

          {/* ── COLUMN 3: MY-GOVERNMENT & FIELD INTELLIGENCE ── */}
          <div className="space-y-4">
            <div>
              <h3 className="font-bold text-[14px] text-[#0F172A] tracking-tight border-b border-[#E2E8F0] pb-1.5 mb-3">
                Field Operations
              </h3>
              <ul className="space-y-2 text-[12.5px]">
                <li>
                  <button 
                    onClick={() => handleNav('/field-report')}
                    className={`text-left transition hover:text-[#185A8D] cursor-pointer ${
                      location.pathname === '/field-report' ? 'font-bold text-[#185A8D]' : 'text-[#334155]'
                    }`}
                  >
                    Geo-Tagged Field Reports
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => handleNav('/field-report')}
                    className="text-left text-[#334155] hover:text-[#185A8D] transition cursor-pointer"
                  >
                    Offline Synchronization Queue
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => handleNav('/field-report')}
                    className="text-left text-[#334155] hover:text-[#185A8D] transition cursor-pointer"
                  >
                    Ground Truth Inspections
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => handleNav('/vehicles')}
                    className="text-left text-[#334155] hover:text-[#185A8D] transition cursor-pointer"
                  >
                    Live GPS Telemetry Ingestion
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-[14px] text-[#0F172A] tracking-tight border-b border-[#E2E8F0] pb-1.5 mb-3">
                Government Directory
              </h3>
              <ul className="space-y-2 text-[12.5px]">
                <li>
                  <button 
                    onClick={() => handleNav('/government-integrations')}
                    className="text-left text-[#334155] hover:text-[#185A8D] transition cursor-pointer"
                  >
                    NHAI ATMS Corridor Feed
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => handleNav('/government-integrations')}
                    className="text-left text-[#334155] hover:text-[#185A8D] transition cursor-pointer"
                  >
                    BRO Project Swastik Registry
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => handleNav('/government-integrations')}
                    className="text-left text-[#334155] hover:text-[#185A8D] transition cursor-pointer"
                  >
                    MoRTH VAHAN Fleet Registry
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => handleNav('/government-integrations')}
                    className="text-left text-[#334155] hover:text-[#185A8D] transition cursor-pointer"
                  >
                    IMD Regional Weather Feeds
                  </button>
                </li>
              </ul>
            </div>
          </div>

          {/* ── COLUMN 4: EXPLORE REGION & ANALYTICS ── */}
          <div className="space-y-4">
            <div>
              <h3 className="font-bold text-[14px] text-[#0F172A] tracking-tight border-b border-[#E2E8F0] pb-1.5 mb-3">
                Regional Intelligence
              </h3>
              <ul className="space-y-2 text-[12.5px]">
                <li>
                  <button 
                    onClick={() => handleNav('/analytics')}
                    className={`text-left transition hover:text-[#185A8D] cursor-pointer ${
                      location.pathname === '/analytics' ? 'font-bold text-[#185A8D]' : 'text-[#334155]'
                    }`}
                  >
                    Regional Logistics Analytics
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => handleNav('/routes')}
                    className="text-left text-[#334155] hover:text-[#185A8D] transition cursor-pointer"
                  >
                    Route Decisions & Detours
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => handleNav('/deliveries')}
                    className="text-left text-[#334155] hover:text-[#185A8D] transition cursor-pointer"
                  >
                    Priority Emergency Dispatch
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => handleNav('/alerts')}
                    className={`text-left transition hover:text-[#185A8D] cursor-pointer ${
                      location.pathname === '/alerts' ? 'font-bold text-[#185A8D]' : 'text-[#334155]'
                    }`}
                  >
                    Operational Alerts Feed
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-[14px] text-[#0F172A] tracking-tight border-b border-[#E2E8F0] pb-1.5 mb-3">
                Decision Sandbox
              </h3>
              <ul className="space-y-2 text-[12.5px]">
                <li>
                  <button 
                    onClick={() => { onClose(); setShowScenarioModal(true); }}
                    className="text-left font-bold text-[#185A8D] hover:underline transition cursor-pointer"
                  >
                    Scenario Simulator Modal
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => handleNav('/audit-logs')}
                    className={`text-left transition hover:text-[#185A8D] cursor-pointer ${
                      location.pathname === '/audit-logs' ? 'font-bold text-[#185A8D]' : 'text-[#334155]'
                    }`}
                  >
                    Audit Trail & Compliance
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => handleNav('/command-center')}
                    className="text-left text-[#334155] hover:text-[#185A8D] transition cursor-pointer"
                  >
                    Master Demonstration Scenario
                  </button>
                </li>
              </ul>
            </div>
          </div>

          {/* ── COLUMN 5: ABOUT US & PORTAL GOVERNANCE ── */}
          <div className="space-y-3">
            <h3 className="font-bold text-[14px] text-[#0F172A] tracking-tight border-b border-[#E2E8F0] pb-1.5">
              About Us
            </h3>
            <ul className="space-y-2 text-[12.5px]">
              <li>
                <button 
                  onClick={() => handleNav('/how-to-use')}
                  className={`text-left transition hover:text-[#185A8D] cursor-pointer ${
                    location.pathname === '/how-to-use' ? 'font-bold text-[#185A8D]' : 'text-[#334155]'
                  }`}
                >
                  How to Use NER88 Guide
                </button>
              </li>
              <li>
                <button 
                  onClick={() => handleNav('/help')}
                  className="text-left text-[#334155] hover:text-[#185A8D] transition cursor-pointer"
                >
                  Contact Us
                </button>
              </li>
              <li>
                <button 
                  onClick={() => handleNav('/field-report')}
                  className="text-left text-[#334155] hover:text-[#185A8D] transition cursor-pointer"
                >
                  Feedback & Field Response
                </button>
              </li>
              <li>
                <button 
                  onClick={() => handleNav('/help')}
                  className="text-left text-[#334155] hover:text-[#185A8D] transition cursor-pointer"
                >
                  Operational FAQs
                </button>
              </li>
              <li>
                <button 
                  onClick={() => handleNav('/help')}
                  className={`text-left transition hover:text-[#185A8D] cursor-pointer ${
                    location.pathname === '/help' ? 'font-bold text-[#185A8D]' : 'text-[#334155]'
                  }`}
                >
                  Help & Documentation
                </button>
              </li>
              <li>
                <button 
                  onClick={() => handleNav('/government-integrations')}
                  className="text-left text-[#334155] hover:text-[#185A8D] transition cursor-pointer"
                >
                  National Portals Integration
                </button>
              </li>
              {role === 'Admin' && (
                <li>
                  <button 
                    onClick={() => handleNav('/users')}
                    className={`text-left transition hover:text-[#185A8D] cursor-pointer ${
                      location.pathname === '/users' ? 'font-bold text-[#185A8D]' : 'text-[#334155]'
                    }`}
                  >
                    User Management & Roles
                  </button>
                </li>
              )}
              <li>
                <button 
                  onClick={() => handleNav('/settings')}
                  className={`text-left transition hover:text-[#185A8D] cursor-pointer ${
                    location.pathname === '/settings' ? 'font-bold text-[#185A8D]' : 'text-[#334155]'
                  }`}
                >
                  Settings & Preferences
                </button>
              </li>
              <li>
                <button 
                  onClick={() => handleNav('/settings')}
                  className="text-left text-[#334155] hover:text-[#185A8D] transition cursor-pointer"
                >
                  Accessibility Policy (GIGW)
                </button>
              </li>
              <li>
                <button 
                  onClick={() => handleNav('/help')}
                  className="text-left text-[#334155] hover:text-[#185A8D] transition cursor-pointer"
                >
                  Portal Terms & Disclaimer
                </button>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom subtle divider with ministry attribution */}
        <div className="pt-4 mt-4 border-t border-[#E2E8F0] flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-[#64748B]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#16834B]" />
            <span className="font-semibold text-[#0F172A]">Ministry of Development of North Eastern Region (MDoNER)</span>
            <span>·</span>
            <span>Government of India</span>
          </div>
          <span className="font-mono text-[10.5px]">
            NER88 v2.6 · SIH26002
          </span>
        </div>

      </div>
    </div>
  );
};

export default TopFunctionsMenu;
