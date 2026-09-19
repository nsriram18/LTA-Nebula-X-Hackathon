import React from 'react';
import { ArrowRight, Compass, Map, Route, Sparkles } from 'lucide-react';

interface WelcomeFlowProps {
  onSetup: () => void;
  onExplore: () => void;
}

export const WelcomeFlow: React.FC<WelcomeFlowProps> = ({ onSetup, onExplore }) => (
  <div className="fixed inset-0 z-[700] bg-slate-950/95 backdrop-blur-xl flex items-end sm:items-center justify-center p-3">
    <div className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20">
        <Compass className="h-7 w-7" />
      </div>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Welcome to ClearPath</p>
      <h2 className="mt-2 text-2xl font-black leading-tight text-white">Know the better way before you leave.</h2>
      <p className="mt-3 text-sm leading-relaxed text-slate-300">
        ClearPath checks your regular commute and recommends a route when disruptions, crowding, or weather affect the journey.
      </p>

      <div className="my-5 grid gap-2.5">
        <div className="flex gap-3 rounded-2xl bg-slate-800/70 p-3">
          <Map className="mt-0.5 h-5 w-5 shrink-0 text-cyan-400" />
          <div><p className="text-sm font-bold text-white">Map first</p><p className="text-xs text-slate-400">See the route immediately; swipe up only when you need details.</p></div>
        </div>
        <div className="flex gap-3 rounded-2xl bg-slate-800/70 p-3">
          <Route className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
          <div><p className="text-sm font-bold text-white">One clear recommendation</p><p className="text-xs text-slate-400">Alternatives and turn-by-turn steps stay one tap away.</p></div>
        </div>
        <div className="flex gap-3 rounded-2xl bg-slate-800/70 p-3">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-violet-400" />
          <div><p className="text-sm font-bold text-white">Optional Demo Lab</p><p className="text-xs text-slate-400">Try clearly labeled scenarios without cluttering the everyday view.</p></div>
        </div>
      </div>

      <button onClick={onSetup} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 text-sm font-bold text-white">
        Set up my commute <ArrowRight className="h-4 w-4" />
      </button>
      <button onClick={onExplore} className="mt-2 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-800 text-sm font-semibold text-slate-200">
        Explore the sample journey
      </button>
    </div>
  </div>
);
