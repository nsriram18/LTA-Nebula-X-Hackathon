import React from 'react';
import { Gauge, Zap, Activity, Droplets } from 'lucide-react';
import { RouteOption } from '../types';
import { EvidenceBadge } from './EvidenceBadge';

interface MotorcycleModeSheetProps {
  activeRoute: RouteOption;
  isRaining: boolean;
}

export const MotorcycleModeSheet: React.FC<MotorcycleModeSheetProps> = ({
  activeRoute,
  isRaining,
}) => {
  const fatigueScore = activeRoute.trafficStressScore;

  return (
    <div
      id="motorcycle-telemetry-card"
      className="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-3.5 shadow-lg text-xs space-y-3 mb-3"
    >
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-white text-sm">Yamaha XSR155 Mode</h4>
            <p className="text-[10px] text-slate-400">Manual Transmission • Proactive Flow Engine</p>
          </div>
        </div>
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
            'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
          }`}
        >
          ROUTE MODE
        </span>
      </div>

      {/* Clutch & Traffic Gauges */}
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
          <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400 mb-1">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>Clutch Friction Score</span>
          </div>
          <div className="text-lg font-bold font-mono text-slate-300">
            {fatigueScore == null ? 'Unavailable' : `${fatigueScore} / 100`}
          </div>
          <div className="text-[9px] text-slate-500 mt-0.5">
            No clutch sensor or validated fatigue model is connected.
          </div>
          <EvidenceBadge evidence={activeRoute.metricEvidence?.trafficStressScore} />
        </div>

        <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
          <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400 mb-1">
            <Droplets className="w-3.5 h-3.5 text-blue-400" />
            <span>Wet Slip Index</span>
          </div>
          <div className={`text-lg font-bold font-mono ${isRaining ? 'text-amber-400' : 'text-emerald-400'}`}>
            {isRaining ? 'Scenario active' : 'Not measured'}
          </div>
          <div className="text-[9px] text-slate-500 mt-0.5">
            {isRaining ? 'SIMULATION — not a traction reading' : 'No road-friction sensor connected'}
          </div>
        </div>
      </div>

      {/* Speed Band Insights */}
      <div className="text-[11px] bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 space-y-1">
        <div className="font-semibold text-slate-300 flex items-center gap-1">
          <Gauge className="w-3 h-3 text-cyan-400" />
          <span>Routing evidence</span>
        </div>
        <p className="text-slate-400 text-[10px] leading-relaxed">
          Route duration, distance and geometry come from OneMap when available. No speed-band, time-saved, clutch-engagement or road-grip metric is displayed without a supporting response.
        </p>
      </div>
    </div>
  );
};
