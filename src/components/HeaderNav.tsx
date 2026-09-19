import React from 'react';
import { ChevronRight, CloudRain, Compass, User, WifiOff } from 'lucide-react';
import { CommuterProfile } from '../types';

interface HeaderNavProps {
  profile: CommuterProfile;
  onOpenProfile: () => void;
  isRaining: boolean;
  isUnderground: boolean;
}

const shortPlace = (address: string) => {
  const first = address.split(',')[0]?.trim() || address;
  return first.length > 20 ? `${first.slice(0, 18)}…` : first;
};

export const HeaderNav: React.FC<HeaderNavProps> = ({ profile, onOpenProfile, isRaining, isUnderground }) => (
  <header id="app-header-nav" className="fixed inset-x-0 top-0 z-[410] flex h-16 items-center gap-2 border-b border-slate-800 bg-slate-900/95 px-3 backdrop-blur-md">
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20">
      <Compass className="h-5 w-5" />
    </div>
    <button onClick={onOpenProfile} className="min-w-0 flex-1 rounded-xl px-1 py-1 text-left" aria-label="Edit commute">
      <div className="flex items-center gap-1 text-sm font-black text-white">ClearPath <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 text-[8px] text-cyan-300">PS2</span></div>
      <div className="mt-0.5 flex items-center gap-1 truncate text-xs font-medium text-slate-400">
        <span className="truncate">{shortPlace(profile.homeAddress)}</span><ChevronRight className="h-3 w-3 shrink-0"/><span className="truncate">{shortPlace(profile.officeAddress)}</span><span className="ml-1 shrink-0 text-cyan-300">{profile.scheduledDepartureTime}</span>
      </div>
    </button>
    {(isUnderground || isRaining) && (
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${isUnderground ? 'border-amber-500/40 bg-amber-500/15 text-amber-300' : 'border-blue-500/40 bg-blue-500/15 text-blue-300'}`} title={isUnderground ? 'Cached journey' : 'Rain simulation active'}>
        {isUnderground ? <WifiOff className="h-4 w-4"/> : <CloudRain className="h-4 w-4"/>}
      </div>
    )}
    <button id="profile-toggle-btn" onClick={onOpenProfile} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-200" aria-label="Open journey settings">
      <User className="h-4 w-4 text-cyan-400" />
    </button>
  </header>
);
