import React, { useState } from 'react';
import {
  ChevronUp,
  ChevronDown,
  Clock,
  Shield,
  Bike,
  Footprints,
  Train,
  Bus,
  CloudRain,
  Users,
  WifiOff,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
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
  onToggleUndergroundOffline: () => void;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  routes,
  activeRoute,
  onSelectRoute,
  selectedStep,
  onSelectStep,
  isUndergroundOffline,
  offlineCachedAt,
  isRaining,
  isDisrupted,
  onToggleUndergroundOffline,
}) => {
  // Height states: 'peek' | 'medium' | 'expanded'
  const [sheetState, setSheetState] = useState<'peek' | 'medium' | 'expanded'>('medium');

  if (!activeRoute) return null;

  const toggleHeight = () => {
    if (sheetState === 'peek') setSheetState('medium');
    else if (sheetState === 'medium') setSheetState('expanded');
    else setSheetState('peek');
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'cycle':
        return <Bike className="w-4 h-4 text-cyan-400" />;
      case 'walk':
        return <Footprints className="w-4 h-4 text-emerald-400" />;
      case 'lrt':
      case 'mrt':
        return <Train className="w-4 h-4 text-pink-400" />;
      case 'bus':
      case 'shuttle':
        return <Bus className="w-4 h-4 text-amber-400" />;
      default:
        return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  const getCrowdBadge = (crowd?: string) => {
    switch (crowd) {
      case 'l':
        return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Low Crowd (L)</span>;
      case 'm':
        return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">Moderate (M)</span>;
      case 'h':
        return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">High Rush (H)</span>;
      default:
        return null;
    }
  };

  const getBusLoadBadge = (load?: string) => {
    switch (load) {
      case 'SEA':
        return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Seats Available (SEA)</span>;
      case 'SDA':
        return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">Standing Available (SDA)</span>;
      case 'LSD':
        return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">Limited Standing (LSD)</span>;
      default:
        return null;
    }
  };

  return (
    <div
      id="commuter-bottom-sheet"
      className={`fixed inset-x-0 bottom-0 z-[450] bg-slate-900/98 backdrop-blur-xl border-t border-slate-700/80 rounded-t-3xl shadow-2xl transition-all duration-300 ease-out flex flex-col ${
        sheetState === 'peek'
          ? 'h-36'
          : sheetState === 'medium'
          ? 'h-[52vh]'
          : 'h-[86vh]'
      }`}
    >
      {/* Drag & Header Bar (Touch target >= 44x44px) */}
      <div
        id="bottom-sheet-handle-zone"
        onClick={toggleHeight}
        className="w-full pt-2 pb-1 px-4 cursor-pointer select-none flex flex-col items-center touch-manipulation min-h-[44px]"
      >
        <div className="w-12 h-1.5 bg-slate-700 hover:bg-slate-500 rounded-full transition-colors mb-1.5" />
        <div className="w-full flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-sm">{activeRoute.title}</span>
            {activeRoute.isRecommended && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                Arjun's Pick
              </span>
            )}
            {isUndergroundOffline && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                <WifiOff className="w-3 h-3" />
                Underground Offline Mode
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <span className="font-mono text-cyan-400 font-bold">{activeRoute.totalDurationMinutes} min</span>
            <EvidenceBadge evidence={activeRoute.metricEvidence?.totalDurationMinutes} cached={isUndergroundOffline} />
            {sheetState === 'expanded' ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </div>
        </div>
      </div>

      {/* Route Quick Metric Summary Chips */}
      <div className="px-4 py-1.5 border-b border-slate-800/80 flex items-center justify-between gap-2 overflow-x-auto text-[11px]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-slate-300">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>{activeRoute.departureTime} → {activeRoute.arrivalTime}</span>
            <EvidenceBadge evidence={activeRoute.metricEvidence?.arrivalTime} cached={isUndergroundOffline} />
          </div>
          <div className="flex items-center gap-1 text-slate-300">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>{activeRoute.shelteredPercentage == null ? 'Shelter coverage unavailable' : `${activeRoute.shelteredPercentage}% Sheltered`}</span>
            <EvidenceBadge evidence={activeRoute.metricEvidence?.shelteredPercentage} cached={isUndergroundOffline} />
          </div>
          {activeRoute.cyclingDistanceKm > 0 && (
            <div className="flex items-center gap-1 text-slate-300">
              <Bike className="w-3.5 h-3.5 text-cyan-400" />
              <span>{activeRoute.cyclingDistanceKm} km Cycle</span>
              <EvidenceBadge evidence={activeRoute.metricEvidence?.cyclingDistanceKm} cached={isUndergroundOffline} />
            </div>
          )}
        </div>

        {/* Underground Mode Quick Toggle for Commuter */}
        <button
          id="toggle-offline-simulation-btn"
          onClick={(e) => {
            e.stopPropagation();
            onToggleUndergroundOffline();
          }}
          className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all touch-manipulation min-h-[32px] flex items-center gap-1 ${
            isUndergroundOffline
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
          }`}
          title="Toggle underground offline caching test"
        >
          <WifiOff className="w-3 h-3" />
          <span>{isUndergroundOffline ? 'Cached Underground' : 'Simulate Tunnel'}</span>
        </button>
      </div>

      {/* Alternative Route Tabs */}
      {sheetState !== 'peek' && (
        <div className="px-4 pt-2.5 pb-1 flex gap-2 overflow-x-auto no-scrollbar">
          {routes.map((route) => {
            const isSelected = route.id === activeRoute.id;
            return (
              <button
                key={route.id}
                id={`route-tab-${route.id}`}
                onClick={() => onSelectRoute(route)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium shrink-0 border transition-all touch-manipulation min-h-[44px] flex flex-col justify-center text-left ${
                  isSelected
                    ? 'bg-cyan-500/20 border-cyan-500 text-cyan-200 shadow-sm'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-white">{route.title}</span>
                  <span className="font-mono text-[10px] text-cyan-400">{route.totalDurationMinutes}m</span>
                  <EvidenceBadge evidence={route.metricEvidence?.totalDurationMinutes} cached={isUndergroundOffline} />
                </div>
                <div className="text-[10px] text-slate-400 truncate max-w-[190px]">
                  {route.subtitle}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Turn-by-Turn Timeline & Details (Scrollable) */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* Offline Underground Notice */}
        {isUndergroundOffline && (
          <div className="bg-amber-950/40 border border-amber-800/60 rounded-xl p-2.5 flex items-start gap-2.5 text-xs text-amber-200">
            <WifiOff className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Underground Mode: Cached Route Active</p>
              <p className="text-[11px] text-amber-300/80">
                Cellular network unreachable in tunnel. Displaying cached itinerary from {offlineCachedAt || '08:30 AM'}.
              </p>
            </div>
          </div>
        )}

        {/* Live Weather / Disruption Alerts if active */}
        {isDisrupted && (
          <div className="bg-rose-950/40 border border-rose-800/60 rounded-xl p-2.5 flex items-start gap-2 text-xs text-rose-200">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">SIMULATION — Train Disruption Replay: </span>
              Judge-controlled Punggol LRT fixture with free-service mitigation fields.
            </div>
          </div>
        )}

        {isRaining && (
          <div className="bg-blue-950/40 border border-blue-800/60 rounded-xl p-2.5 flex items-start gap-2 text-xs text-blue-200">
            <CloudRain className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">SIMULATION — Heavy Rain: </span>
              Judge-controlled 18.4 mm/h value near the configured origin; not a live observation.
            </div>
          </div>
        )}

        {/* Turn-by-Turn Timeline Steps */}
        <div className="space-y-2.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Turn-by-Turn Itinerary</span>
            <span className="text-slate-500 font-normal">Tap step to inspect on map</span>
          </div>

          {activeRoute.steps.map((step, idx) => {
            const isStepSelected = selectedStep?.id === step.id;
            return (
              <div
                key={step.id}
                id={`timeline-step-${idx}`}
                onClick={() => onSelectStep(isStepSelected ? null : step)}
                className={`p-3 rounded-2xl border transition-all cursor-pointer touch-manipulation min-h-[52px] ${
                  isStepSelected
                    ? 'bg-slate-800 border-yellow-400 ring-1 ring-yellow-400/40'
                    : 'bg-slate-800/50 border-slate-700/70 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-slate-700/80 flex items-center justify-center shrink-0 mt-0.5">
                    {getModeIcon(step.mode)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-semibold text-slate-100 leading-snug">
                        {step.instruction}
                      </p>
                      <span className="text-xs font-mono font-bold text-slate-400 shrink-0">
                        {step.durationMinutes}m
                      </span>
                      <EvidenceBadge evidence={step.metricEvidence?.durationMinutes} cached={isUndergroundOffline} />
                    </div>

                    {/* Step Attributes: Covered, Cycling, Crowds, Bus Load */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {step.isSheltered && (
                        <span className="text-[10px] bg-emerald-950/60 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-800/60 flex items-center gap-1">
                          <Shield className="w-2.5 h-2.5" />
                          CoveredLinkWay
                        </span>
                      )}
                      {step.isCyclingPath && (
                        <span className="text-[10px] bg-cyan-950/60 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-800/60 flex items-center gap-1">
                          <Bike className="w-2.5 h-2.5" />
                          Park Connector Path
                        </span>
                      )}
                      {step.crowdLevel && getCrowdBadge(step.crowdLevel)}
                      {step.crowdLevel && <EvidenceBadge evidence={step.metricEvidence?.crowdLevel} cached={isUndergroundOffline} />}
                      {step.busLoad && getBusLoadBadge(step.busLoad)}
                      {step.busLoad && <EvidenceBadge evidence={step.metricEvidence?.busLoad} cached={isUndergroundOffline} />}
                      {step.freeMitigation && (
                        <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/40">
                          {step.freeMitigation === 'FreeMRTShuttle' ? 'Free MRT Shuttle' : 'Free Public Bus'}
                        </span>
                      )}
                      {step.busServiceNo && (
                        <>
                          <span className="text-[10px] bg-slate-700 text-slate-200 px-1.5 py-0.5 rounded font-mono">
                            Bus {step.busServiceNo}{step.busType ? ` (${step.busType})` : ''}
                          </span>
                          <EvidenceBadge evidence={step.metricEvidence?.busServiceNo} cached={isUndergroundOffline} />
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-[10px] text-slate-400">
          <div className="mb-2 font-bold uppercase tracking-wider text-slate-300">Metric evidence</div>
          <div className="space-y-1.5">
            {Object.entries(activeRoute.metricEvidence || {}).map(([metric, evidence]) => (
              <div key={metric} className="flex items-start justify-between gap-3">
                <span className="font-mono text-slate-300">{metric}</span>
                <span className="flex-1 text-right" title={evidence.detail}>{evidence.source}</span>
                <EvidenceBadge evidence={evidence} cached={isUndergroundOffline} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
