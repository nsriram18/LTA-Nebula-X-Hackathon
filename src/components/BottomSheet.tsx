import React, { useState } from 'react';
import { AlertCircle, Bike, Bus, ChevronDown, ChevronUp, Clock, Footprints, Route as RouteIcon, Shield, Train, WifiOff } from 'lucide-react';
import { RouteOption, RouteStep } from '../types';
import { EvidenceBadge } from './EvidenceBadge';

interface BottomSheetProps {
  routes: RouteOption[];
  activeRoute: RouteOption | null;
  onSelectRoute: (route: RouteOption) => void;
  selectedStep: RouteStep | null;
  onSelectStep: (step: RouteStep | null) => void;
  isUndergroundOffline: boolean;
  offlineCachedAt?: string;
  isRaining: boolean;
  isDisrupted: boolean;
}

const modeLabel: Record<string, string> = { cycle: 'Cycle', walk: 'Walk', lrt: 'LRT', mrt: 'MRT', bus: 'Bus', shuttle: 'Shuttle', motorcycle: 'Motorcycle' };

export const BottomSheet: React.FC<BottomSheetProps> = ({ routes, activeRoute, onSelectRoute, selectedStep, onSelectStep, isUndergroundOffline, offlineCachedAt, isRaining, isDisrupted }) => {
  const [sheetState, setSheetState] = useState<'peek' | 'medium' | 'expanded'>('peek');
  const [showAlternatives, setShowAlternatives] = useState(false);
  if (!activeRoute) return null;

  const toggleHeight = () => setSheetState(sheetState === 'peek' ? 'medium' : sheetState === 'medium' ? 'expanded' : 'peek');
  const alternatives = routes.filter((route) => route.id !== activeRoute.id);
  const sourceType = activeRoute.provider === 'estimated_fallback' ? 'ESTIMATE' : isUndergroundOffline ? 'CACHED' : 'Live route · OneMap';
  const getModeIcon = (mode: string) => mode === 'cycle' ? <Bike className="h-4 w-4 text-cyan-400"/> : mode === 'walk' ? <Footprints className="h-4 w-4 text-emerald-400"/> : ['mrt', 'lrt'].includes(mode) ? <Train className="h-4 w-4 text-pink-400"/> : mode === 'bus' || mode === 'shuttle' ? <Bus className="h-4 w-4 text-amber-400"/> : <RouteIcon className="h-4 w-4 text-blue-400"/>;

  return (
    <div id="commuter-bottom-sheet" className={`fixed inset-x-0 bottom-0 z-[450] flex flex-col rounded-t-3xl border-t border-slate-700/80 bg-slate-900/98 shadow-2xl backdrop-blur-xl transition-all duration-300 ${sheetState === 'peek' ? 'h-[148px]' : sheetState === 'medium' ? 'h-[62vh]' : 'h-[90vh]'}`}>
      <button id="bottom-sheet-handle-zone" onClick={toggleHeight} className="min-h-9 w-full pt-2" aria-label="Expand journey details">
        <span className="mx-auto block h-1.5 w-11 rounded-full bg-slate-700" />
      </button>

      <div className="px-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2"><h2 className="truncate text-sm font-black text-white">{activeRoute.title}</h2>{activeRoute.isRecommended && <span className="shrink-0 rounded-full bg-cyan-500/15 px-2 py-0.5 text-[9px] font-bold text-cyan-300">Recommended</span>}</div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
              {activeRoute.modeSummary.map((mode) => <span key={mode} className="rounded-md bg-slate-800 px-1.5 py-0.5">{modeLabel[mode] || mode}</span>)}
              <span className={activeRoute.provider === 'estimated_fallback' || isUndergroundOffline ? 'font-bold text-amber-300' : 'text-emerald-300'}>{sourceType}</span>
            </div>
          </div>
          <div className="shrink-0 text-right"><div className="text-xl font-black text-cyan-300">{activeRoute.totalDurationMinutes}<span className="ml-1 text-xs font-bold">min</span></div><div className="text-[10px] text-slate-400">{activeRoute.departureTime} → {activeRoute.arrivalTime}</div></div>
        </div>
        <div className="mt-3 flex gap-2">
          <button onClick={() => setSheetState(sheetState === 'peek' ? 'medium' : 'peek')} className="min-h-10 flex-1 rounded-xl bg-cyan-500 px-3 text-xs font-black text-slate-950">{sheetState === 'peek' ? 'View journey' : 'Back to map'}</button>
          {alternatives.length > 0 && <button onClick={() => { setSheetState('medium'); setShowAlternatives(true); }} className="min-h-10 rounded-xl border border-slate-700 bg-slate-800 px-3 text-xs font-bold text-slate-200">{alternatives.length} other {alternatives.length === 1 ? 'route' : 'routes'}</button>}
          <button onClick={toggleHeight} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-300" aria-label="Change sheet height">{sheetState === 'expanded' ? <ChevronDown className="h-4 w-4"/> : <ChevronUp className="h-4 w-4"/>}</button>
        </div>
      </div>

      {sheetState !== 'peek' && <div className="flex-1 space-y-3 overflow-y-auto border-t border-slate-800 px-4 py-3">
        {isUndergroundOffline && <div className="flex gap-2 rounded-xl border border-amber-700/60 bg-amber-950/40 p-3 text-xs text-amber-200"><WifiOff className="h-4 w-4 shrink-0"/><span><b>Cached journey</b><br/>Saved at {offlineCachedAt || 'an earlier time'}; conditions may have changed.</span></div>}
        {isDisrupted && <div className="flex gap-2 rounded-xl border border-rose-700/60 bg-rose-950/40 p-3 text-xs text-rose-200"><AlertCircle className="h-4 w-4 shrink-0"/><span><b>Simulation: train disruption</b><br/>A judge-controlled replay is active.</span></div>}
        {isRaining && <div className="flex gap-2 rounded-xl border border-blue-700/60 bg-blue-950/40 p-3 text-xs text-blue-200"><AlertCircle className="h-4 w-4 shrink-0"/><span><b>Simulation: heavy rain</b><br/>The 18.4 mm/h test scenario is active.</span></div>}

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-slate-800/70 p-2.5"><Clock className="mb-1 h-4 w-4 text-cyan-400"/><p className="text-[9px] uppercase text-slate-500">Journey</p><p className="text-xs font-bold text-white">{activeRoute.totalDurationMinutes} min</p></div>
          <div className="rounded-xl bg-slate-800/70 p-2.5"><RouteIcon className="mb-1 h-4 w-4 text-blue-400"/><p className="text-[9px] uppercase text-slate-500">Distance</p><p className="text-xs font-bold text-white">{activeRoute.totalDistanceKm} km</p></div>
          <div className="rounded-xl bg-slate-800/70 p-2.5"><Shield className="mb-1 h-4 w-4 text-emerald-400"/><p className="text-[9px] uppercase text-slate-500">Shelter</p><p className="text-xs font-bold text-white">{activeRoute.shelteredPercentage == null ? 'Unknown' : `${activeRoute.shelteredPercentage}%`}</p></div>
        </div>

        <section className="rounded-2xl border border-slate-800 bg-slate-950/40">
          <button onClick={() => setShowAlternatives(!showAlternatives)} className="flex min-h-11 w-full items-center justify-between px-3 text-xs font-bold text-white"><span>Route alternatives ({alternatives.length})</span>{showAlternatives ? <ChevronUp className="h-4 w-4"/> : <ChevronDown className="h-4 w-4"/>}</button>
          {showAlternatives && <div className="space-y-2 border-t border-slate-800 p-2">
            {alternatives.map((route) => <button key={route.id} onClick={() => { onSelectRoute(route); setShowAlternatives(false); }} className="flex min-h-14 w-full items-center justify-between rounded-xl bg-slate-800 px-3 text-left"><span className="min-w-0"><span className="block truncate text-xs font-bold text-white">{route.title}</span><span className="block truncate text-[10px] text-slate-400">{route.modeSummary.map((mode) => modeLabel[mode] || mode).join(' + ')}</span></span><span className="ml-3 shrink-0 text-sm font-black text-cyan-300">{route.totalDurationMinutes} min</span></button>)}
          </div>}
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between"><h3 className="text-[11px] font-black uppercase tracking-wider text-slate-400">Directions</h3><span className="text-[10px] text-slate-500">Tap a step to highlight it</span></div>
          <div className="space-y-2">
            {activeRoute.steps.map((step) => <button key={step.id} onClick={() => onSelectStep(selectedStep?.id === step.id ? null : step)} className={`flex min-h-14 w-full items-start gap-3 rounded-2xl border p-3 text-left ${selectedStep?.id === step.id ? 'border-yellow-400 bg-slate-800' : 'border-slate-800 bg-slate-800/55'}`}><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-700/80">{getModeIcon(step.mode)}</span><span className="min-w-0 flex-1 text-xs font-semibold leading-relaxed text-slate-100">{step.instruction}</span><span className="shrink-0 text-xs font-bold text-slate-400">{step.durationMinutes}m</span></button>)}
          </div>
        </section>

        {sheetState === 'expanded' && <details className="rounded-2xl border border-slate-800 bg-slate-950/50 p-3">
          <summary className="cursor-pointer text-xs font-bold text-slate-300">Sources & calculations</summary>
          <div className="mt-3 space-y-2">{Object.entries(activeRoute.metricEvidence || {}).map(([metric, evidence]) => <div key={metric} className="grid grid-cols-[1fr_auto] gap-2 border-t border-slate-800 pt-2 text-[10px]"><span><b className="text-slate-300">{metric}</b><span className="mt-0.5 block text-slate-500">{evidence.source}: {evidence.detail}</span></span><EvidenceBadge evidence={evidence} cached={isUndergroundOffline}/></div>)}</div>
        </details>}
      </div>}
    </div>
  );
};
