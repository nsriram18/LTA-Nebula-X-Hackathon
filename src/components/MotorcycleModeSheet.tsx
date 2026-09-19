import React from 'react';
import { Gauge, AlertTriangle, ShieldCheck, Zap, Activity, Droplets } from 'lucide-react';
import { RouteOption } from '../types';

interface MotorcycleModeSheetProps {
  activeRoute: RouteOption;
  isRaining: boolean;
}

export const MotorcycleModeSheet: React.FC<MotorcycleModeSheetProps> = ({
  activeRoute,
  isRaining,
}) => {
  const isSmoothRoute = activeRoute.id === 'moto-route-smooth';
  const fatigueScore = activeRoute.trafficStressScore || (isSmoothRoute ? 18 : 88);

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
            isSmoothRoute
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
          }`}
        >
          {isSmoothRoute ? 'Low Clutch Fatigue' : 'High Fatigue Risk'}
        </span>
      </div>

      {/* Clutch & Traffic Gauges */}
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
          <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400 mb-1">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>Clutch Friction Score</span>
          </div>
          <div className={`text-lg font-bold font-mono ${fatigueScore < 40 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {fatigueScore} / 100
          </div>
          <div className="text-[9px] text-slate-500 mt-0.5">
            {isSmoothRoute ? '84 stop-and-go shifts saved' : 'Severe clutch modulation'}
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
          <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400 mb-1">
            <Droplets className="w-3.5 h-3.5 text-blue-400" />
            <span>Wet Slip Index</span>
          </div>
          <div className={`text-lg font-bold font-mono ${isRaining ? 'text-amber-400' : 'text-emerald-400'}`}>
            {isRaining ? 'Elevated' : 'Optimal'}
          </div>
          <div className="text-[9px] text-slate-500 mt-0.5">
            {isRaining ? 'Wet road markings on PIE' : 'Dry asphalt traction'}
          </div>
        </div>
      </div>

      {/* Speed Band Insights */}
      <div className="text-[11px] bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 space-y-1">
        <div className="font-semibold text-slate-300 flex items-center gap-1">
          <Gauge className="w-3 h-3 text-cyan-400" />
          <span>LTA v4/TrafficSpeedBands Analysis</span>
        </div>
        <p className="text-slate-400 text-[10px] leading-relaxed">
          {isSmoothRoute
            ? 'Bartley Viaduct & Lornie Highway maintains continuous 62-68 km/h (Speed Band 6), bypassing the Adam Rd bottleneck completely.'
            : 'PIE Westbound bottleneck detected at 12 km/h (Speed Band 1). Heavy stop-and-go causes high clutch cable heat and rider fatigue.'}
        </p>
      </div>
    </div>
  );
};
