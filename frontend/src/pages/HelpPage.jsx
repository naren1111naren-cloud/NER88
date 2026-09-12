import React from 'react';
import { HelpCircle, Play, ShieldAlert, Award, Compass, CheckCircle } from 'lucide-react';
import { useDemo } from '../context/DemoContext';

export const HelpPage = () => {
  const { startDemoScenario } = useDemo();

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* SIH Header */}
      <div className="bg-white border border-[#E5E7EB] p-6 rounded-2xl shadow-xs border-l-4 border-l-purple-600 space-y-2 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-full bg-gradient-to-l from-purple-500/10 via-violet-500/5 to-transparent pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 relative z-10">
          <span className="text-xs font-extrabold px-3 py-1 rounded-md bg-purple-50 text-purple-700 border border-purple-200 w-fit">
            SIH 2026 Problem Statement ID: SIH26002
          </span>
          <span className="text-xs text-[#6B7280] font-bold">
            Ministry of Development of North Eastern Region (MDoNER)
          </span>
        </div>
        <h1 className="text-2xl font-extrabold text-[#1F2937] tracking-tight relative z-10">
          LINK X8 Platform Walkthrough
        </h1>
        <p className="text-xs text-[#6B7280] relative z-10">
          Smart Logistics and Accessibility Intelligence Platform for the North Eastern Region of India.{' '}
          <span className="text-purple-700 font-extrabold">Predict. Reroute. Deliver.</span>
        </p>
      </div>

      {/* The 3-Minute Master Story Presentation Guide */}
      <div className="bg-white border border-[#E5E7EB] p-6 rounded-2xl shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#E5E7EB] pb-4 gap-3">
          <div>
            <h2 className="text-sm font-extrabold text-[#1F2937] uppercase tracking-wider flex items-center gap-2">
              <Award className="w-4 h-4 text-purple-600" /> Hackathon 3-Minute Master Story Sequence
            </h2>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Launch the step-by-step interactive simulation for judges and evaluation panels.
            </p>
          </div>

          <button
            onClick={startDemoScenario}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-violet-600 to-teal-500 hover:opacity-90 text-white font-extrabold text-xs shadow-xs flex items-center justify-center gap-2 transition active:scale-95 shrink-0"
          >
            <Play className="w-4 h-4 fill-current" /> Run Interactive Demo Scenario
          </button>
        </div>

        <div className="space-y-3.5 text-xs">
          <div className="p-3.5 rounded-xl bg-[#F7F7FB] border border-[#E5E7EB] flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 font-extrabold flex items-center justify-center shrink-0 border border-purple-200 shadow-xs">
              1
            </div>
            <div>
              <div className="font-extrabold text-[#1F2937] text-sm">Vehicle Starts Delivery</div>
              <div className="text-[#6B7280] mt-0.5 leading-relaxed">
                Guwahati ➔ Imphal critical medical shipment (<code className="font-mono text-purple-700">DEL-2026-001</code>) assigned to truck <code className="font-mono text-purple-700">NER-V001</code> on primary NH27 corridor. Initial Status: LOW RISK (18/100).
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#F7F7FB] border border-[#E5E7EB] flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-700 font-extrabold flex items-center justify-center shrink-0 border border-rose-200 shadow-xs">
              2
            </div>
            <div>
              <div className="font-extrabold text-[#1F2937] text-sm">Field Officer Incident Report</div>
              <div className="text-[#6B7280] mt-0.5 leading-relaxed">
                Field Officer submits a Landslide report at Senapati Mountain Pass. Road status marked BLOCKED. Field report instantly renders on the interactive Leaflet GIS map.
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#F7F7FB] border border-[#E5E7EB] flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 font-extrabold flex items-center justify-center shrink-0 border border-amber-200 shadow-xs">
              3
            </div>
            <div>
              <div className="font-extrabold text-[#1F2937] text-sm">AI Risk Engine Surge</div>
              <div className="text-[#6B7280] mt-0.5 leading-relaxed">
                FastAPI AI Risk Model evaluates features against feature contract: Risk Score surges to CRITICAL (82/100) with SHAP explainability breakdown (Landslide + Heavy Monsoon Rain).
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#F7F7FB] border border-[#E5E7EB] flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 font-extrabold flex items-center justify-center shrink-0 border border-purple-200 shadow-xs">
              4
            </div>
            <div>
              <div className="font-extrabold text-[#1F2937] text-sm">Alternate Route B & Recalculated ETA</div>
              <div className="text-[#6B7280] mt-0.5 leading-relaxed">
                Routing engine computes Alternate Route B via Silchar / Jiribam (NH37). Revised ETA updates delay to +35 minutes. Priority operational alert pops up.
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#F7F7FB] border border-[#E5E7EB] flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 font-extrabold flex items-center justify-center shrink-0 border border-emerald-200 shadow-xs">
              5
            </div>
            <div>
              <div className="font-extrabold text-[#1F2937] text-sm">Dispatcher Reroute Approval</div>
              <div className="text-[#6B7280] mt-0.5 leading-relaxed">
                Dispatcher clicks "Approve Alternate Route B". Truck trajectory smoothly shifts on GIS map, ensuring medical supplies deliver safely!
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


