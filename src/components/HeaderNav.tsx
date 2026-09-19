import React from 'react';
import { Compass, User, CloudSun, CloudRain, WifiOff } from 'lucide-react';
import { CommuterProfile } from '../types';

interface HeaderNavProps {
  profile: CommuterProfile;
  onOpenProfile: () => void;
  isRaining: boolean;
  isUnderground: boolean;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  profile,
  onOpenProfile,
  isRaining,
  isUnderground,
}) => {
  return (
    <header
      id="app-header-nav"
      className="fixed top-0 inset-x-0 z-[410] h-14 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-3.5 flex items-center justify-between select-none"
    >
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
          <Compass className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-sm font-black tracking-tight text-white leading-none">
              ClearPath
            </h1>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              PS2
            </span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium leading-tight mt-0.5">
            {profile.homeAddress} → {profile.officeAddress}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Real-time Condition Pill */}
        <div className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-slate-800/90 border border-slate-700/80 text-slate-300">
          {isUnderground ? (
            <>
              <WifiOff className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-amber-300 font-medium">Underground</span>
            </>
          ) : isRaining ? (
            <>
              <CloudRain className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
              <span className="text-blue-300 font-medium">SIMULATION: Rain</span>
            </>
          ) : (
            <>
              <CloudSun className="w-3.5 h-3.5 text-amber-400" />
              <span>No rain scenario</span>
            </>
          )}
        </div>

        {/* Persona Profile Button (Touch target >= 44x44px) */}
        <button
          id="profile-toggle-btn"
          onClick={onOpenProfile}
          className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 flex items-center justify-center transition-all touch-manipulation active:scale-95"
          aria-label="Open commuter profile"
          title="Arjun Commuter Profile"
        >
          <User className="w-4 h-4 text-cyan-400" />
        </button>
      </div>
    </header>
  );
};
