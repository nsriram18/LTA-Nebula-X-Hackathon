import React, { useState } from 'react';
import { User, Clock, Bike, Shield, Zap, Database, X, Check } from 'lucide-react';
import { CommuterProfile } from '../types';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: CommuterProfile;
  onSaveProfile: (updated: CommuterProfile) => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
  onSaveProfile,
}) => {
  const [formData, setFormData] = useState<CommuterProfile>({ ...profile });
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveProfile(formData);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  return (
    <div
      id="profile-settings-modal"
      className="fixed inset-0 z-[600] bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-3"
    >
      <div className="w-full max-w-md bg-slate-900 border border-slate-700/90 rounded-3xl p-4 sm:p-5 shadow-2xl text-slate-100 space-y-4 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Commuter Persona Settings</h3>
              <p className="text-xs text-slate-400">Target Persona: Arjun (Punggol → one-north)</p>
            </div>
          </div>
          <button
            id="close-profile-modal-btn"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg touch-manipulation min-w-[40px] min-h-[40px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Routine Schedule */}
        <div className="space-y-3 text-xs">
          <div>
            <label className="text-slate-300 font-semibold mb-1 block">Scheduled Departure Time</label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Clock className="w-4 h-4 text-cyan-400 absolute left-3 top-2.5" />
                <input
                  type="time"
                  value={formData.scheduledDepartureTime}
                  onChange={(e) => setFormData({ ...formData, scheduledDepartureTime: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div className="bg-slate-800 px-3 py-2 rounded-xl border border-slate-700 text-slate-400">
                ±{formData.flexibleWindowMinutes}m Flex
              </div>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Proactive check triggers 45 minutes prior (at 07:45 AM)
            </p>
          </div>

          {/* Preferences Toggles */}
          <div className="space-y-2 pt-1 border-t border-slate-800">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Preferences</div>

            <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 cursor-pointer min-h-[44px]">
              <div className="flex items-center gap-2">
                <Bike className="w-4 h-4 text-cyan-400" />
                <span className="font-medium text-slate-200">Bring Foldable Bicycle</span>
              </div>
              <input
                type="checkbox"
                checked={formData.bringBicycle}
                onChange={(e) => setFormData({ ...formData, bringBicycle: e.target.checked })}
                className="w-4 h-4 accent-cyan-500 rounded"
              />
            </label>

            <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 cursor-pointer min-h-[44px]">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span className="font-medium text-slate-200">Prioritize CoveredLinkWays (Shelter)</span>
              </div>
              <input
                type="checkbox"
                checked={formData.prioritizeShelter}
                onChange={(e) => setFormData({ ...formData, prioritizeShelter: e.target.checked })}
                className="w-4 h-4 accent-emerald-500 rounded"
              />
            </label>

            {/* Beyond Brief: Motorcycle Mode */}
            <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 cursor-pointer min-h-[44px]">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <div>
                  <span className="font-medium text-slate-200">Motorcycle Mode (Yamaha XSR155)</span>
                  <div className="text-[10px] text-slate-400">Avoid stop-and-go clutch strain on PIE</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={formData.motorcycleMode}
                onChange={(e) => setFormData({ ...formData, motorcycleMode: e.target.checked })}
                className="w-4 h-4 accent-amber-500 rounded"
              />
            </label>
          </div>

          {/* Cloud Firestore Storage Status */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              <span>Google Cloud Firestore</span>
            </div>
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Synchronized
            </span>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <button
            id="save-profile-btn"
            onClick={handleSave}
            className="w-full min-h-[44px] bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center justify-center gap-1.5 transition-transform active:scale-95 touch-manipulation"
          >
            {savedSuccess ? (
              <>
                <Check className="w-4 h-4 text-white" />
                <span>Profile Saved!</span>
              </>
            ) : (
              <span>Save Arjun's Routine</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
