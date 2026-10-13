import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useDemo } from '../context/DemoContext';
import { useToast } from '../context/ToastContext';
import { 
  Sparkles, X, Play, RotateCcw, CloudRain, Mountain, 
  Waves, Ban, CheckCircle2, ArrowRight, Activity, 
  ShieldCheck, AlertTriangle, Clock, Layers
} from 'lucide-react';

export const ScenarioSimulatorModal = ({ isOpen, onClose, onApplyPlan }) => {
  const { isDemoMode, startDemoScenario, startHeavyRainScenario, resetDemoScenario } = useDemo();
  const { showToast } = useToast();

  const [step, setStep] = useState(1);
  const [selectedEvent, setSelectedEvent] = useState('LANDSLIDE');
  const [selectedCorridor, setSelectedCorridor] = useState('GUW_IMP');
  const [severityLevel, setSeverityLevel] = useState('CRITICAL');
  const [isRunning, setIsRunning] = useState(false);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  const handleRunSimulation = async () => {
    setIsRunning(true);
    setStep(2);
    try {
      if (selectedEvent === 'HEAVY_RAIN') {
        await startHeavyRainScenario();
      } else {
        await startDemoScenario();
      }
      setTimeout(() => {
        setIsRunning(false);
        setStep(3);
        showToast('Simulation complete. Evaluated risk escalation & alternative routes.', 'warning');
      }, 1000);
    } catch {
      setIsRunning(false);
      setStep(1);
      showToast('Failed to execute simulation', 'error');
    }
  };

  const handleResetToLive = async () => {
    try {
      await resetDemoScenario();
      showToast('Restored baseline Live Operations state.', 'info');
      onClose();
    } catch {
      showToast('Failed to reset simulation state', 'error');
    }
  };

  const handleApplyOperationalPlan = () => {
    if (onApplyPlan) onApplyPlan();
    showToast('Simulated detour trajectory applied to active dispatch plan.', 'success');
    onClose();
  };

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 bg-[#0B2744]/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="relative z-[110] w-full max-w-2xl bg-white border border-[#D9E0E7] rounded-[8px] shadow-elevated p-6 space-y-5 text-[#17202A] max-h-[90vh] overflow-y-auto"
      >
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#D9E0E7] pb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[6px] bg-[#185A8D]/10 text-[#185A8D] flex items-center justify-center border border-[#185A8D]/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#0B2744]">
                Infrastructure Disruption Simulator
              </h2>
              <p className="text-xs text-[#5B6570]">
                Decision-support sandbox for evaluating extreme weather, landslides, and corridor disruptions
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-[#5B6570] hover:text-[#17202A] p-1 rounded-[4px] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── STEP 1: CONFIGURATION ── */}
        {step === 1 && (
          <div className="space-y-4 text-xs">
            {/* Event Selection */}
            <div className="space-y-2">
              <label className="font-bold text-[#0B2744] uppercase tracking-wider text-[11px] block">
                1. Select Disruptive Event Profile
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'LANDSLIDE', title: 'Mountain Landslide', desc: 'Debris obstruction across both highway lanes', icon: Mountain, color: 'text-[#C62828]' },
                  { id: 'HEAVY_RAIN', title: 'Monsoon Heavy Downpour', desc: 'Precipitation surge (75 mm/hr) & slope saturation', icon: CloudRain, color: 'text-[#185A8D]' },
                  { id: 'BRIDGE_FLOOD', title: 'River Crossing Flood Alert', desc: 'Water level elevation above bridge clearance', icon: Waves, color: 'text-[#D99A00]' },
                  { id: 'ROADBLOCK', title: 'Corridor Security Obstruction', desc: 'Highway transit blockages and freight diversions', icon: Ban, color: 'text-[#5B6570]' }
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = selectedEvent === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedEvent(item.id)}
                      className={`p-3.5 rounded-[6px] border transition cursor-pointer flex items-start gap-2.5 ${
                        isSelected
                          ? 'bg-[#185A8D]/10 border-[#185A8D] shadow-subtle'
                          : 'bg-[#F6F8FA] border-[#D9E0E7] hover:border-[#185A8D]'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${item.color}`} />
                      <div>
                        <div className="font-bold text-[#17202A] text-xs">{item.title}</div>
                        <div className="text-[11px] text-[#5B6570] mt-0.5 leading-snug">{item.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Target Corridor */}
            <div className="space-y-2">
              <label className="font-bold text-[#0B2744] uppercase tracking-wider text-[11px] block">
                2. Select Strategic Corridor / Sector
              </label>
              <select
                value={selectedCorridor}
                onChange={(e) => setSelectedCorridor(e.target.value)}
                className="w-full bg-[#F6F8FA] border border-[#D9E0E7] rounded-[6px] px-3 py-2 text-xs text-[#17202A] focus:outline-none focus:border-[#185A8D] cursor-pointer"
              >
                <option value="GUW_IMP">Guwahati ➔ Imphal (NH-27 / NH-37 via Senapati Pass)</option>
                <option value="SIL_GAN">Siliguri ➔ Gangtok (NH-10 via Teesta River Corridor)</option>
                <option value="BARAK_VALLEY">Guwahati ➔ Silchar (NH-6 via Meghalaya Plateau)</option>
              </select>
            </div>

            {/* Action Bar */}
            <div className="pt-3 border-t border-[#D9E0E7] flex items-center justify-between">
              <span className="text-[11px] text-[#5B6570]">
                Calculates accessibility drop, ETA impact, and detour feasibility.
              </span>
              <button
                onClick={handleRunSimulation}
                className="px-5 py-2 rounded-[6px] bg-[#123B66] hover:bg-[#0B2744] text-white font-bold text-xs shadow-subtle transition active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Execute Simulation</span>
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: RUNNING ── */}
        {step === 2 && (
          <div className="py-12 flex flex-col items-center justify-center space-y-4 text-center">
            <div className="w-10 h-10 rounded-full border-2 border-[#185A8D] border-t-transparent animate-spin" />
            <div className="space-y-1">
              <div className="font-bold text-sm text-[#0B2744]">Evaluating Regional Disruption Model...</div>
              <p className="text-xs text-[#5B6570]">
                Calculating terrain slope friction, rainfall runoff, river water levels, and multi-modal rerouting vectors.
              </p>
            </div>
          </div>
        )}

        {/* ── STEP 3: SIDE-BY-SIDE RESULTS COMPARISON ── */}
        {step === 3 && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between bg-[#D99A00]/10 border border-[#D99A00]/30 p-3 rounded-[6px]">
              <span className="font-bold text-[#D99A00] text-xs flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-[#D99A00]" /> SIMULATION ACTIVE: {selectedEvent}
              </span>
              <span className="text-[11px] font-mono text-[#5B6570]">Simulated Hazard State</span>
            </div>

            {/* Side-by-Side Comparison Grid */}
            <div className="grid grid-cols-2 gap-3.5">
              {/* Live Baseline State */}
              <div className="bg-[#F6F8FA] p-4 rounded-[6px] border border-[#D9E0E7] space-y-2.5">
                <div className="flex items-center justify-between border-b border-[#D9E0E7] pb-1.5">
                  <span className="font-bold text-[#0B2744] uppercase tracking-wider text-[11px]">LIVE BASELINE</span>
                  <span className="text-[10px] text-[#16834B] font-bold bg-[#16834B]/10 px-1.5 py-0.5 rounded-[4px] border border-[#16834B]/20">NORMAL</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[#5B6570]">Accessibility:</span>
                    <strong className="text-[#16834B] font-mono font-bold">82 / 100</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#5B6570]">Route Risk:</span>
                    <strong className="text-[#16834B] font-mono font-bold">18 / 100 (LOW)</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#5B6570]">Estimated Delay:</span>
                    <strong className="text-[#17202A] font-mono">+0 min</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#5B6570]">Road Status:</span>
                    <strong className="text-[#16834B]">Passable</strong>
                  </div>
                </div>
              </div>

              {/* Simulated Disrupted State */}
              <div className="bg-[#C62828]/5 p-4 rounded-[6px] border border-[#C62828]/20 space-y-2.5">
                <div className="flex items-center justify-between border-b border-[#C62828]/20 pb-1.5">
                  <span className="font-bold text-[#C62828] uppercase tracking-wider text-[11px]">SIMULATED IMPACT</span>
                  <span className="text-[10px] text-[#C62828] font-bold bg-[#C62828]/10 px-1.5 py-0.5 rounded-[4px] border border-[#C62828]/20">DISRUPTED</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[#5B6570]">Accessibility:</span>
                    <strong className="text-[#C62828] font-mono font-bold">42 / 100 (-40)</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#5B6570]">Route Risk:</span>
                    <strong className="text-[#C62828] font-mono font-bold">82 / 100 (CRITICAL)</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#5B6570]">Estimated Delay:</span>
                    <strong className="text-[#D99A00] font-mono font-bold">+35 min</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#5B6570]">Road Status:</span>
                    <strong className="text-[#C62828]">Impassable</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Recommended Action Box */}
            <div className="bg-[#F6F8FA] p-3.5 rounded-[6px] border border-[#D9E0E7] space-y-1">
              <div className="font-bold text-[#0B2744] flex items-center gap-1.5 text-xs">
                <ShieldCheck className="w-4 h-4 text-[#16834B]" />
                Recommended Operational Detour: Alternate Route B
              </div>
              <p className="text-[11px] text-[#5B6570]">
                Routing engine recommends diverting freight along NH-37 via Silchar / Jiribam to avoid Senapati pass blockage.
              </p>
            </div>

            {/* Footer Buttons */}
            <div className="pt-3 border-t border-[#D9E0E7] flex items-center justify-between">
              <button
                onClick={handleResetToLive}
                className="px-3.5 py-2 rounded-[6px] bg-white hover:bg-[#F6F8FA] text-[#5B6570] border border-[#D9E0E7] font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-subtle"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset to Baseline
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setStep(1)}
                  className="px-3.5 py-2 rounded-[6px] bg-white hover:bg-[#F6F8FA] text-[#5B6570] border border-[#D9E0E7] font-bold text-xs transition cursor-pointer shadow-subtle"
                >
                  Configure New
                </button>
                <button
                  onClick={handleApplyOperationalPlan}
                  className="px-4 py-2 rounded-[6px] bg-[#123B66] hover:bg-[#0B2744] text-white font-bold text-xs shadow-subtle transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Apply Detour to Plan</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default ScenarioSimulatorModal;
