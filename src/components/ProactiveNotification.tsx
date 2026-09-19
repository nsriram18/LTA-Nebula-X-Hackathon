import React from 'react';
import { Bell, AlertTriangle, CloudRain, Clock, ShieldCheck, ArrowRight, X } from 'lucide-react';
import { ProactiveNotificationPayload } from '../types';
import { EvidenceBadge } from './EvidenceBadge';

interface ProactiveNotificationProps {
  payload: ProactiveNotificationPayload | null;
  onApplyRoute: (routeId: string) => void;
  onDismiss: () => void;
}

export const ProactiveNotification: React.FC<ProactiveNotificationProps> = ({
  payload,
  onApplyRoute,
  onDismiss,
}) => {
  if (!payload) return null;

  const isAlert = payload.severity === 'alert';
  const isWarning = payload.severity === 'warning';

  const badgeColor = isAlert
    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
    : isWarning
    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
    : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';

  const icon = isAlert ? (
    <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5 animate-bounce" />
  ) : isWarning ? (
    <CloudRain className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
  ) : (
    <Bell className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
  );

  return (
    <div
      id="proactive-notification-banner"
      className="fixed top-3 inset-x-3 sm:max-w-md sm:mx-auto z-[500] bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-700/80 shadow-2xl p-3.5 text-slate-100 transition-all duration-300 animate-in fade-in slide-in-from-top-4"
    >
      <div className="flex items-start gap-3">
        {icon}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${badgeColor}`}>
              <Clock className="w-3 h-3" />
              Proactive Notice • {payload.timestamp}
              <EvidenceBadge evidence={payload.metricEvidence?.scheduledTime} />
            </span>
            <button
              id="dismiss-notif-btn"
              onClick={onDismiss}
              className="p-1.5 -mr-1 -mt-1 text-slate-400 hover:text-slate-200 rounded-lg touch-manipulation min-w-[36px] min-h-[36px] flex items-center justify-center"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <h3 className="text-sm font-bold text-white tracking-tight leading-snug">
            {payload.recommendedAction}
          </h3>

          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            {payload.reason}
          </p>

          {/* Mitigations / Summary Pills */}
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {payload.timeShiftMinutes !== 0 && (
              <span className="inline-flex items-center text-[10px] bg-slate-800 text-cyan-300 px-2 py-0.5 rounded-md border border-slate-700 font-mono">
                Departure: {payload.newDepartureTime} ({payload.timeShiftMinutes > 0 ? `+${payload.timeShiftMinutes}m` : `${payload.timeShiftMinutes}m`})
                <EvidenceBadge evidence={payload.metricEvidence?.timeShiftMinutes} />
              </span>
            )}
            {payload.freeMitigationAvailable && (
              <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-950/80 text-emerald-300 px-2 py-0.5 rounded-md border border-emerald-800 font-semibold">
                <ShieldCheck className="w-3 h-3" />
                LTA Free Service Active
              </span>
            )}
            {payload.weatherSummary && (
              <span className="text-[10px] bg-slate-800/90 text-amber-200 px-2 py-0.5 rounded-md border border-slate-700">
                {payload.weatherSummary}
              </span>
            )}
          </div>

          {/* Action CTA Button (Anchor touch target >= 44x44px) */}
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              id="apply-proactive-route-btn"
              onClick={() => onApplyRoute(payload.suggestedRouteId)}
              className="w-full sm:w-auto min-h-[44px] px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-transform active:scale-95 touch-manipulation"
            >
              <span>Accept Recommended Route</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
