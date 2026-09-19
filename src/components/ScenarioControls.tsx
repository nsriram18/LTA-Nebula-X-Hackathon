import React, { useState } from 'react';
import { AlertTriangle, CloudRain, RefreshCw, Sparkles, Users, X, Zap } from 'lucide-react';

interface ScenarioControlsProps {
  isDisruptionReplay: boolean;
  onToggleDisruptionReplay: () => void;
  isHeavyRain: boolean;
  onToggleHeavyRain: () => void;
  isHighCrowd: boolean;
  onToggleHighCrowd: () => void;
  isMotorcycleMode: boolean;
  onToggleMotorcycleMode: () => void;
  onTriggerProactiveCheck: () => void;
  onToggleUndergroundOffline: () => void;
  isUndergroundOffline: boolean;
  isLoading: boolean;
}

export const ScenarioControls: React.FC<ScenarioControlsProps> = (props) => {
  const [open, setOpen] = useState(false);
  const activeCount = [props.isDisruptionReplay, props.isHeavyRain, props.isHighCrowd, props.isMotorcycleMode, props.isUndergroundOffline].filter(Boolean).length;
  const scenarios = [
    { id: 'toggle-disruption-replay-btn', title: 'Train disruption replay', note: 'Simulation fixture', active: props.isDisruptionReplay, onClick: props.onToggleDisruptionReplay, icon: AlertTriangle, tone: 'rose' },
    { id: 'toggle-heavy-rain-btn', title: 'Heavy rain', note: 'Simulation · 18.4 mm/h', active: props.isHeavyRain, onClick: props.onToggleHeavyRain, icon: CloudRain, tone: 'blue' },
    { id: 'toggle-high-crowd-btn', title: 'High platform crowd', note: 'Simulation · high', active: props.isHighCrowd, onClick: props.onToggleHighCrowd, icon: Users, tone: 'amber' },
    { id: 'toggle-motorcycle-mode-btn', title: 'Motorcycle route', note: 'OneMap routing mode', active: props.isMotorcycleMode, onClick: props.onToggleMotorcycleMode, icon: Zap, tone: 'emerald' },
  ] as const;
  const activeStyles: Record<string, string> = { rose: 'border-rose-500 bg-rose-500/20 text-rose-200', blue: 'border-blue-500 bg-blue-500/20 text-blue-200', amber: 'border-amber-500 bg-amber-500/20 text-amber-200', emerald: 'border-emerald-500 bg-emerald-500/20 text-emerald-200' };

  return (
    <>
      <button onClick={() => setOpen(true)} className="fixed left-3 top-20 z-[420] flex min-h-10 items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/90 px-3 text-xs font-bold text-slate-100 shadow-lg backdrop-blur-md">
        <Sparkles className="h-4 w-4 text-cyan-400" /> Demo Lab
        {activeCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-cyan-500 px-1 text-[10px] text-slate-950">{activeCount}</span>}
      </button>
      {open && (
        <div className="fixed inset-0 z-[620] bg-slate-950/65 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <section className="absolute inset-x-3 top-20 mx-auto max-w-md rounded-3xl border border-slate-700 bg-slate-900 p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <div><p className="text-sm font-black text-white">Demo Lab</p><p className="mt-0.5 text-[11px] text-slate-400">Optional tools for testing proactive scenarios.</p></div>
              <button onClick={() => setOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-slate-400" aria-label="Close Demo Lab"><X className="h-4 w-4"/></button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {scenarios.map(({ id, title, note, active, onClick, icon: Icon, tone }) => (
                <button key={id} id={id} onClick={onClick} className={`flex min-h-14 items-center gap-3 rounded-2xl border px-3 text-left ${active ? activeStyles[tone] : 'border-slate-700 bg-slate-800/70 text-slate-200'}`}>
                  <Icon className="h-5 w-5 shrink-0"/><span><span className="block text-xs font-bold">{title}</span><span className="block text-[10px] opacity-70">{note}</span></span>
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-2 border-t border-slate-800 pt-3">
              <button onClick={props.onToggleUndergroundOffline} className={`min-h-11 flex-1 rounded-xl border px-3 text-xs font-bold ${props.isUndergroundOffline ? 'border-amber-500 bg-amber-500/20 text-amber-200' : 'border-slate-700 bg-slate-800 text-slate-300'}`}>{props.isUndergroundOffline ? 'Cached mode active' : 'Simulate tunnel'}</button>
              <button onClick={props.onTriggerProactiveCheck} disabled={props.isLoading} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-500 px-3 text-xs font-bold text-slate-950"><RefreshCw className={`h-4 w-4 ${props.isLoading ? 'animate-spin' : ''}`}/>Refresh journey</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
};
