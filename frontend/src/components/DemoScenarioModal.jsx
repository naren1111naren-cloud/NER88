import React from 'react';
import { useDemo } from '../context/DemoContext';
import { CheckCircle2, Loader2, Play, RefreshCw, X, AlertTriangle, ShieldAlert } from 'lucide-react';

export const DemoScenarioModal = () => {
  const {
    showScenarioModal,
    setShowScenarioModal,
    isScenarioRunning,
    scenarioStep,
    scenarioSteps,
    startDemoScenario,
    resetDemoScenario
  } = useDemo();

  if (!showScenarioModal) return null;

  const isCompleted = scenarioStep >= 16;

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-r from-purple-600 via-violet-600 to-teal-500 text-white flex items-center justify-center shadow-md">
              <Play className="w-4 h-4 fill-current" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#1F2937] flex items-center gap-2">
                16-Step Master Demonstration Scenario
              </h3>
              <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                SIH26002 • Disaster-to-Rerouting End-to-End Story
              </span>
            </div>
          </div>
          <button
            onClick={() => setShowScenarioModal(false)}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Progress */}
        <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1 text-xs">
          {scenarioSteps.map((step, idx) => {
            const isDone = scenarioStep > idx;
            const isCurrent = scenarioStep === idx + 1 && isScenarioRunning;

            return (
              <div
                key={idx}
                className={`p-3 rounded-xl border transition-all duration-300 flex items-start gap-3 ${
                  isDone
                    ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                    : isCurrent
                    ? 'bg-purple-50 border-purple-300 text-purple-950 shadow-xs'
                    : 'bg-[#F7F7FB] border-[#E5E7EB] text-slate-400'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {isDone ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : isCurrent ? (
                    <Loader2 className="w-5 h-5 text-purple-600 animate-spin" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-slate-300 flex items-center justify-center text-[10px] font-bold text-slate-400">
                      {idx + 1}
                    </div>
                  )}
                </div>

                <div className="space-y-0.5">
                  <div className={`font-bold ${isDone ? 'text-emerald-900' : isCurrent ? 'text-purple-900' : 'text-slate-500'}`}>
                    {step.title}
                  </div>
                  <div className={`text-[11px] ${isDone ? 'text-emerald-700' : isCurrent ? 'text-purple-700' : 'text-slate-400'}`}>
                    {step.desc}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Controls */}
        <div className="pt-3 border-t border-[#E5E7EB] flex items-center justify-between gap-3">
          <div className="text-[11px] font-semibold text-slate-500">
            {isScenarioRunning ? (
              <span className="text-purple-700 font-bold flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Executing 16-step scenario...
              </span>
            ) : isCompleted ? (
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                ✓ Master Scenario completed! GIS Map & Dashboard updated.
              </span>
            ) : (
              'Ready to execute end-to-end simulation.'
            )}
          </div>

          <div className="flex items-center gap-2">
            {isCompleted && (
              <button
                onClick={resetDemoScenario}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Reset State
              </button>
            )}

            <button
              onClick={startDemoScenario}
              disabled={isScenarioRunning}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-violet-600 to-teal-500 hover:opacity-90 text-white font-extrabold text-xs shadow-md transition flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
            >
              {isScenarioRunning ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Running...
                </>
              ) : isCompleted ? (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" /> Re-Run Scenario
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" /> Start Master Scenario
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
