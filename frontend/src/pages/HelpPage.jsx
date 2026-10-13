import React from 'react';
import { useTranslation } from 'react-i18next';
import { HelpCircle, Play, ShieldAlert, Award, Compass, CheckCircle, BookOpen, Layers } from 'lucide-react';
import { useDemo } from '../context/DemoContext';
import emblemSvg from '../assets/emblem.svg';

export const HelpPage = () => {
  const { t } = useTranslation();
  const { startDemoScenario } = useDemo();

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 text-[#17202A]">
      {/* Platform Header */}
      <div className="bg-white border border-[#D9E0E7] p-6 rounded-[8px] shadow-subtle border-l-4 border-l-[#185A8D] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-[4px] bg-[#185A8D]/10 text-[#185A8D] border border-[#185A8D]/20 w-fit">
            Operational Documentation
          </span>
          <span className="text-xs text-[#5B6570] font-semibold">
            Ministry of Development of North Eastern Region (MDoNER)
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-[8px] bg-[#F6F8FA] border border-[#D9E0E7] flex items-center justify-center shrink-0 shadow-subtle p-2">
            <img src={emblemSvg} alt="State Emblem of India" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#0B2744] tracking-tight leading-tight">
              NER88 Platform User Guide & Operations Manual
            </h1>
            <p className="text-xs text-[#5B6570] mt-0.5">
              Regional Logistics Intelligence & Decision Platform for Northeast India.{' '}
              <span className="text-[#185A8D] font-bold">Predict. Reroute. Deliver.</span>
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Demonstration Sequence */}
      <div className="bg-white border border-[#D9E0E7] p-6 rounded-[8px] shadow-subtle space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#D9E0E7] pb-4 gap-4">
          <div>
            <h2 className="text-xs font-bold text-[#0B2744] uppercase tracking-wider flex items-center gap-2">
              <Award className="w-4 h-4 text-[#185A8D]" /> Operational Demonstration Scenario
            </h2>
            <p className="text-xs text-[#5B6570] mt-0.5">
              Launch the step-by-step interactive workflow simulation for command evaluation.
            </p>
          </div>

          <button
            onClick={startDemoScenario}
            className="px-4 py-2 rounded-[6px] bg-[#123B66] hover:bg-[#0B2744] text-white font-bold text-xs shadow-subtle flex items-center justify-center gap-2 transition active:scale-95 shrink-0 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" /> Run Interactive Demo Scenario
          </button>
        </div>

        <div className="space-y-2.5 text-xs">
          <div className="p-3.5 rounded-[6px] bg-[#F6F8FA] border border-[#D9E0E7] flex items-start gap-3">
            <div className="w-6 h-6 rounded-[4px] bg-[#185A8D]/10 text-[#185A8D] font-bold flex items-center justify-center shrink-0 border border-[#185A8D]/20 text-xs">
              1
            </div>
            <div>
              <div className="font-bold text-[#17202A]">Consignment Dispatch Initiated</div>
              <div className="text-xs text-[#5B6570] mt-0.5 leading-relaxed">
                Guwahati &rarr; Imphal critical medical consignment (<code className="font-mono text-[#185A8D] font-bold">DEL-2026-001</code>) assigned to vehicle <code className="font-mono text-[#0B2744] font-bold">NER-V001</code> on primary NH-27 corridor. Initial Status: LOW RISK (18/100).
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-[6px] bg-[#F6F8FA] border border-[#D9E0E7] flex items-start gap-3">
            <div className="w-6 h-6 rounded-[4px] bg-[#C62828]/10 text-[#C62828] font-bold flex items-center justify-center shrink-0 border border-[#C62828]/20 text-xs">
              2
            </div>
            <div>
              <div className="font-bold text-[#17202A]">Field Incident Verified</div>
              <div className="text-xs text-[#5B6570] mt-0.5 leading-relaxed">
                Field Officer submits a Landslide report at Senapati Mountain Pass. Road status marked PARTIALLY BLOCKED. Disruption coordinates render immediately on the GIS command map.
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-[6px] bg-[#F6F8FA] border border-[#D9E0E7] flex items-start gap-3">
            <div className="w-6 h-6 rounded-[4px] bg-[#D99A00]/10 text-[#D99A00] font-bold flex items-center justify-center shrink-0 border border-[#D99A00]/20 text-xs">
              3
            </div>
            <div>
              <div className="font-bold text-[#17202A]">Risk Engine Evaluation</div>
              <div className="text-xs text-[#5B6570] mt-0.5 leading-relaxed">
                Risk Engine evaluates factors: Route Risk surges to CRITICAL (82/100) with factor breakdown (Landslide Hazard + Heavy Monsoon Precipitation).
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-[6px] bg-[#F6F8FA] border border-[#D9E0E7] flex items-start gap-3">
            <div className="w-6 h-6 rounded-[4px] bg-[#185A8D]/10 text-[#185A8D] font-bold flex items-center justify-center shrink-0 border border-[#185A8D]/20 text-xs">
              4
            </div>
            <div>
              <div className="font-bold text-[#17202A]">Alternate Route & Recalculated ETA</div>
              <div className="text-xs text-[#5B6570] mt-0.5 leading-relaxed">
                Routing engine computes Alternate Route B via Silchar / Jiribam (NH-37). Revised ETA updates delay to +35 minutes. Priority operational alert broadcasted to dispatchers.
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-[6px] bg-[#F6F8FA] border border-[#D9E0E7] flex items-start gap-3">
            <div className="w-6 h-6 rounded-[4px] bg-[#16834B]/10 text-[#16834B] font-bold flex items-center justify-center shrink-0 border border-[#16834B]/20 text-xs">
              5
            </div>
            <div>
              <div className="font-bold text-[#17202A]">Dispatcher Reroute Approval</div>
              <div className="text-xs text-[#5B6570] mt-0.5 leading-relaxed">
                Dispatcher clicks "Approve Alternate Route B". Vehicle trajectory shifts on GIS map, ensuring critical relief supplies deliver safely.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpPage;
