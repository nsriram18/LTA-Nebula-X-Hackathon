import React from 'react';
import {
  Sparkles,
  AlertTriangle,
  CloudRain,
  Users,
  Shield,
  Bike,
  Compass,
  RefreshCw,
  Zap,
} from 'lucide-react';

interface ScenarioControlsProps {
  isDisruptionReplay: boolean;
  onToggleDisruptionReplay: () => void;
  isHeavyRain: boolean;
  onToggleHeavyRain: () => void;
  isHighCrowd: boolean;
  onToggleHighCrowd: () => void;
  isMotorcycleMode: boolean;
  onToggleMotorcycleMode: () => void;
  showShelterLayer: boolean;
  onToggleShelterLayer: () => void;
  showCyclingLayer: boolean;
  onToggleCyclingLayer: () => void;
  onTriggerProactiveCheck: () => void;
  isLoading: boolean;
}

export const ScenarioControls: React.FC<ScenarioControlsProps> = ({
  isDisruptionReplay,
  onToggleDisruptionReplay,
  isHeavyRain,
  onToggleHeavyRain,
  isHighCrowd,
  onToggleHighCrowd,
  isMotorcycleMode,
  onToggleMotorcycleMode,
  showShelterLayer,
  onToggleShelterLayer,
  showCyclingLayer,
  onToggleCyclingLayer,
  onTriggerProactiveCheck,
  isLoading,
}) => {
  return (
    <div
      id="scenario-controls-panel"
      className="fixed top-16 inset-x-3 sm:max-w-md sm:mx-auto z-[420] bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-700/80 shadow-xl p-2.5 text-xs select-none pointer-events-auto"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-slate-300 font-bold text-[11px] uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>PS2 Judging & Simulation Lab</span>
        </div>
        <button
          id="re-eval-proactive-btn"
          onClick={onTriggerProactiveCheck}
          disabled={isLoading}
          className="px-2.5 py-1 bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 rounded-lg text-[10px] font-bold border border-cyan-500/40 flex items-center gap-1 min-h-[36px] touch-manipulation transition-all active:scale-95"
          title="Run 45-min background proactive evaluation"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Run Proactive Check</span>
        </button>
      </div>

      {/* Scenario Injection Pills */}
      <div className="grid grid-cols-2 gap-1.5">
        {/* Disruption Replay */}
        <button
          id="toggle-disruption-replay-btn"
          onClick={onToggleDisruptionReplay}
          className={`px-2.5 py-2 rounded-xl text-[11px] font-semibold flex items-center gap-1.5 border transition-all touch-manipulation min-h-[44px] ${
            isDisruptionReplay
              ? 'bg-rose-500/30 border-rose-500 text-rose-200 ring-1 ring-rose-500/40'
              : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <AlertTriangle className={`w-4 h-4 ${isDisruptionReplay ? 'text-rose-400' : 'text-slate-400'}`} />
          <div className="text-left leading-tight">
            <div>LRT Fault Replay</div>
            <div className="text-[9px] text-slate-400 font-normal">SIMULATION • replay fixture</div>
          </div>
        </button>

        {/* Heavy Rain */}
        <button
          id="toggle-heavy-rain-btn"
          onClick={onToggleHeavyRain}
          className={`px-2.5 py-2 rounded-xl text-[11px] font-semibold flex items-center gap-1.5 border transition-all touch-manipulation min-h-[44px] ${
            isHeavyRain
              ? 'bg-blue-500/30 border-blue-500 text-blue-200 ring-1 ring-blue-500/40'
              : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <CloudRain className={`w-4 h-4 ${isHeavyRain ? 'text-blue-400' : 'text-slate-400'}`} />
          <div className="text-left leading-tight">
            <div>Torrential Rain</div>
            <div className="text-[9px] text-slate-400 font-normal">SIMULATION • 18.4 mm/h</div>
          </div>
        </button>

        {/* High Platform Crowd */}
        <button
          id="toggle-high-crowd-btn"
          onClick={onToggleHighCrowd}
          className={`px-2.5 py-2 rounded-xl text-[11px] font-semibold flex items-center gap-1.5 border transition-all touch-manipulation min-h-[44px] ${
            isHighCrowd
              ? 'bg-amber-500/30 border-amber-500 text-amber-200 ring-1 ring-amber-500/40'
              : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Users className={`w-4 h-4 ${isHighCrowd ? 'text-amber-400' : 'text-slate-400'}`} />
          <div className="text-left leading-tight">
            <div>Peak Rush Hour</div>
            <div className="text-[9px] text-slate-400 font-normal">SIMULATION • high ('h')</div>
          </div>
        </button>

        {/* Beyond Brief: Motorcycle Mode */}
        <button
          id="toggle-motorcycle-mode-btn"
          onClick={onToggleMotorcycleMode}
          className={`px-2.5 py-2 rounded-xl text-[11px] font-semibold flex items-center gap-1.5 border transition-all touch-manipulation min-h-[44px] ${
            isMotorcycleMode
              ? 'bg-emerald-500/30 border-emerald-500 text-emerald-200 ring-1 ring-emerald-500/40'
              : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Zap className={`w-4 h-4 ${isMotorcycleMode ? 'text-emerald-400' : 'text-slate-400'}`} />
          <div className="text-left leading-tight">
            <div>Motorcycle Mode</div>
            <div className="text-[9px] text-slate-400 font-normal">OneMap route • no fake telemetry</div>
          </div>
        </button>
      </div>

      {/* Geospatial Overlays Quick Toggles */}
      <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-800 text-[10px]">
        <div className="text-slate-400">Reference overlays:</div>
        <div className="flex items-center gap-2">
          <button
            id="toggle-shelter-overlay-btn"
            onClick={onToggleShelterLayer}
            className={`px-2 py-1 rounded-md border font-medium flex items-center gap-1 touch-manipulation min-h-[30px] ${
              showShelterLayer
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            <Shield className="w-2.5 h-2.5" />
            CoveredLinkWay
          </button>
          <button
            id="toggle-cycling-overlay-btn"
            onClick={onToggleCyclingLayer}
            className={`px-2 py-1 rounded-md border font-medium flex items-center gap-1 touch-manipulation min-h-[30px] ${
              showCyclingLayer
                ? 'bg-cyan-950/80 text-cyan-300 border-cyan-700'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            <Bike className="w-2.5 h-2.5" />
            CyclingPath
          </button>
        </div>
      </div>
    </div>
  );
};
