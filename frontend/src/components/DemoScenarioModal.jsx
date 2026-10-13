import React from 'react';
import { useTranslation } from 'react-i18next';
import { useDemo } from '../context/DemoContext';
import { 
  CheckCircle2, Loader2, Play, RefreshCw, X, AlertTriangle, 
  ShieldAlert, Truck, Navigation, Activity, ArrowRight, ShieldCheck,
  Radio, FileCheck, Check
} from 'lucide-react';

export const DemoScenarioModal = () => {
  const { t } = useTranslation();
  const {
    showScenarioModal,
    setShowScenarioModal,
    isScenarioRunning,
    scenarioStep,
    masterScenarioSteps,
    scenarioStatus,
    activeStepAction,
    startMasterScenario,
    disruptMasterScenario,
    fieldConfirmMasterScenario,
    rerouteApproveMasterScenario,
    telemetryAdvanceMasterScenario,
    deliverMasterScenario,
    resetMasterScenario,
    runFullMasterDemo
  } = useDemo();

  if (!showScenarioModal) return null;

  const isCompleted = scenarioStep >= 6;

  const getStepHandler = (stepNum) => {
    switch (stepNum) {
      case 1: return startMasterScenario;
      case 2: return disruptMasterScenario;
      case 3: return fieldConfirmMasterScenario;
      case 4: return rerouteApproveMasterScenario;
      case 5: return telemetryAdvanceMasterScenario;
      case 6: return deliverMasterScenario;
      default: return () => {};
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0B2744]/65 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-3xl bg-white border border-[#D9E0E7] rounded-[10px] p-6 space-y-5 shadow-elevated text-[#17202A] max-h-[92vh] overflow-y-auto">
        
        {/* Header with strict Demo/Development separation (Section 20 & 27) */}
        <div className="flex items-start justify-between border-b border-[#D9E0E7] pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-mono font-bold text-[10px] tracking-wider uppercase">
                DEMO / DEVELOPMENT CONTROL PANEL
              </span>
              <span className="text-[10px] font-mono text-[#5B6570]">
                SIH26002 Master Scenario
              </span>
            </div>
            <h2 className="text-base font-bold text-[#0B2744]">
              End-to-End Regional Logistics Intelligence Workflow
            </h2>
            <p className="text-xs text-[#5B6570]">
              Guwahati ➔ Shillong Essential Medicine Delivery (<span className="font-semibold text-[#185A8D]">Consignment MED-102 / Vehicle V-102</span>)
            </p>
          </div>

          <button
            onClick={() => setShowScenarioModal(false)}
            className="text-[#5B6570] hover:text-[#17202A] p-1.5 rounded-[4px] hover:bg-[#F6F8FA] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Scenario Telemetry & Cargo Card */}
        {scenarioStatus && (
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px] p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-[10px] font-bold text-[#64748B] uppercase block">{t('common.fleet', 'Vehicle')}</span>
              <div className="font-bold text-[#0F172A] flex items-center gap-1 mt-0.5">
                <Truck className="w-3.5 h-3.5 text-[#185A8D]" />
                <span>{scenarioStatus.vehicle?.code || 'V-102'}</span>
              </div>
              <span className="text-[10px] text-[#64748B]">{t('common.status', 'Status')}: {scenarioStatus.vehicle?.status || 'IN_TRANSIT'}</span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-[#64748B] uppercase block">{t('dashboard.activeDelivery', 'Consignment')}</span>
              <div className="font-bold text-[#0F172A] mt-0.5 truncate">
                {scenarioStatus.shipment?.shipment_id || 'MED-102'}
              </div>
              <span className="text-[10px] text-emerald-700 font-semibold">{t('common.priority', 'Priority')}: {scenarioStatus.shipment?.priority || 'EMERGENCY'}</span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-[#64748B] uppercase block">{t('common.corridor', 'Corridor')}</span>
              <div className="font-bold text-[#0F172A] mt-0.5">
                {scenarioStatus.corridor?.code || 'COR-NH40'}
              </div>
              <span className={`text-[10px] font-bold ${
                scenarioStatus.corridor?.status === 'BLOCKED' ? 'text-red-600' :
                scenarioStatus.corridor?.status === 'RESTRICTED' ? 'text-amber-600' : 'text-emerald-600'
              }`}>
                {scenarioStatus.corridor?.status || 'OPEN'} ({Math.round(scenarioStatus.corridor?.accessibility_score ?? 94)}/100)
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-[#64748B] uppercase block">{t('dashboard.estimatedDelay', 'Revised ETA / Delay')}</span>
              <div className="font-bold text-[#0F172A] mt-0.5">
                {scenarioStatus.shipment?.estimated_delay_mins > 0 
                  ? `+${scenarioStatus.shipment?.estimated_delay_mins} ${t('common.mins', 'mins')}`
                  : 'On Schedule'}
              </div>
              <span className="text-[10px] text-[#64748B]">
                {scenarioStatus.shipment?.status === 'DELIVERED' ? 'Arrived & Delivered' : 'In Transit'}
              </span>
            </div>
          </div>
        )}

        {/* Master Stepper with Independent Manual Triggers (Section 20) */}
        <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1 text-xs">
          {masterScenarioSteps.map((stepItem) => {
            const isDone = scenarioStep >= stepItem.step;
            const isCurrent = scenarioStep === stepItem.step - 1;
            const isProcessing = activeStepAction && scenarioStep === stepItem.step - 1;

            return (
              <div
                key={stepItem.step}
                className={`p-3.5 rounded-[8px] border transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isDone
                    ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'
                    : isCurrent
                    ? 'bg-[#EFF6FF] border-[#93C5FD] text-[#1E3A8A] ring-1 ring-[#3B82F6]'
                    : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#64748B]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {isDone ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : isProcessing ? (
                      <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[11px] font-bold">
                        {stepItem.step}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[#0F172A]">
                        {stepItem.title}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/80 border border-current text-slate-700">
                        {stepItem.statusLabel}
                      </span>
                    </div>

                    <p className="text-[11.5px] leading-relaxed text-[#475569]">
                      {stepItem.desc}
                    </p>

                    <div className="text-[10px] font-mono text-[#64748B]">
                      Source: {stepItem.source}
                    </div>
                  </div>
                </div>

                {/* Individual Action Button */}
                <div className="shrink-0 flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={getStepHandler(stepItem.step)}
                    disabled={isScenarioRunning || activeStepAction !== null}
                    className={`px-3 py-1.5 rounded-[6px] font-semibold text-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                      isDone
                        ? 'bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300'
                        : isCurrent
                        ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300'
                    }`}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Processing...</span>
                      </>
                    ) : isDone ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Re-Execute</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>{stepItem.actionName}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Controls & Automated 3-Minute Demonstration Sequence */}
        <div className="pt-4 border-t border-[#D9E0E7] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-[#5B6570]">
            {isScenarioRunning ? (
              <span className="text-blue-700 font-bold flex items-center gap-1.5">
                <Loader2 className="w-4 h-4 animate-spin" /> Auto-running master demonstration workflow...
              </span>
            ) : isCompleted ? (
              <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Full logistics lifecycle completed (Status: DELIVERED).
              </span>
            ) : (
              <span>Ready. Use step buttons above or trigger autonomous 3-minute sequence.</span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={resetMasterScenario}
              disabled={isScenarioRunning || activeStepAction !== null}
              className="px-3.5 py-2 rounded-[6px] bg-[#F6F8FA] hover:bg-[#E7EBEF] text-[#475569] hover:text-[#0F172A] font-bold text-xs border border-[#CBD5E1] transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className="w-3.5 h-3.5" /> {t('common.reset', 'Reset Scenario')}
            </button>

            <button
              onClick={runFullMasterDemo}
              disabled={isScenarioRunning || activeStepAction !== null}
              className="px-4 py-2 rounded-[6px] bg-[#123B66] hover:bg-[#0B2744] text-white font-bold text-xs shadow-subtle transition flex items-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isScenarioRunning ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('common.loading', 'Running Demo...')}
                </>
              ) : isCompleted ? (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" /> {t('dashboard.scenarioSimulation', 'Re-Run Full Demo')}
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" /> {t('dashboard.demoScenario', 'Run 3-Min Demonstration')}
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default DemoScenarioModal;
