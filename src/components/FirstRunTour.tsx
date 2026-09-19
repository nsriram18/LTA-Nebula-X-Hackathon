import React, { useState } from 'react';
import { ArrowRight, MapPinned, PanelBottom, Sparkles, X } from 'lucide-react';

interface FirstRunTourProps { onComplete: () => void; }

const steps = [
  { icon: MapPinned, title: 'Your commute is here', body: 'The map shows your recommended route. Tap the journey name in the header whenever you want to edit it.', position: 'top-20 left-4 right-4' },
  { icon: PanelBottom, title: 'Swipe up for details', body: 'The compact card keeps the map visible. Open it for alternatives, directions, and sources.', position: 'bottom-40 left-4 right-4' },
  { icon: Sparkles, title: 'Demo tools stay out of the way', body: 'Use Demo Lab to try disruption, rain, crowd, and offline scenarios.', position: 'top-20 right-4 left-4' },
];

export const FirstRunTour: React.FC<FirstRunTourProps> = ({ onComplete }) => {
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const Icon = step.icon;
  const finish = () => onComplete();
  return (
    <div className="fixed inset-0 z-[680] bg-slate-950/45 pointer-events-none">
      <div className={`absolute ${step.position} pointer-events-auto mx-auto max-w-sm rounded-2xl border border-cyan-500/50 bg-slate-900 p-4 shadow-2xl`}>
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-300"><Icon className="h-5 w-5" /></div>
          <div className="flex-1"><p className="text-sm font-bold text-white">{step.title}</p><p className="mt-1 text-xs leading-relaxed text-slate-300">{step.body}</p></div>
          <button onClick={finish} aria-label="Skip tour" className="p-1 text-slate-400"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-500">{index + 1} of {steps.length}</span>
          <button onClick={() => index === steps.length - 1 ? finish() : setIndex(index + 1)} className="flex min-h-9 items-center gap-1 rounded-lg bg-cyan-500 px-3 text-xs font-bold text-slate-950">
            {index === steps.length - 1 ? 'Got it' : 'Next'} <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
