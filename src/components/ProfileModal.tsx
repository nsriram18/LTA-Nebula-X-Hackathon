import React, { useEffect, useState } from 'react';
import { User, Clock, Bike, Shield, Zap, Database, X, Check, MapPin } from 'lucide-react';
import { CommuterProfile } from '../types';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: CommuterProfile;
  onSaveProfile: (updated: CommuterProfile) => void;
  syncStatus: 'syncing' | 'synced' | 'offline';
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
  onSaveProfile,
  syncStatus,
}) => {
  const [formData, setFormData] = useState<CommuterProfile>({ ...profile });
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) setFormData({ ...profile });
  }, [isOpen, profile]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveProfile(formData);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  const [departureHour, departureMinute] = formData.scheduledDepartureTime.split(':').map(Number);
  const proactiveTotal = (departureHour * 60 + departureMinute - formData.notificationLeadTimeMinutes + 1440) % 1440;
  const proactiveTime = `${String(Math.floor(proactiveTotal / 60)).padStart(2, '0')}:${String(proactiveTotal % 60).padStart(2, '0')}`;

  return (
    <div
      id="profile-settings-modal"
      className="fixed inset-0 z-[600] bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-3"
    >
      <div className="w-full max-w-md max-h-[92vh] overflow-y-auto bg-slate-900 border border-slate-700/90 rounded-3xl p-4 sm:p-5 shadow-2xl text-slate-100 space-y-4 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Commuter Persona Settings</h3>
              <p className="text-xs text-slate-400 truncate max-w-[250px]">{formData.homeAddress} → {formData.officeAddress}</p>
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
          <div className="space-y-2">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-cyan-400" /> Route Parameters
            </div>
            {([
              ['Origin', 'homeAddress', 'homeCoords'],
              ['Destination', 'officeAddress', 'officeCoords'],
            ] as const).map(([label, addressKey, coordinateKey]) => (
              <div key={label} className="rounded-xl bg-slate-800/60 border border-slate-700/60 p-2.5 space-y-2">
                <label className="text-slate-300 font-semibold block">{label}</label>
                <input
                  type="text"
                  value={formData[addressKey]}
                  onChange={(e) => setFormData({ ...formData, [addressKey]: e.target.value })}
                  aria-label={`${label} address`}
                  className="w-full bg-slate-950/70 border border-slate-700 rounded-lg px-2.5 py-2 text-white focus:outline-none focus:border-cyan-500"
                />
                <div className="grid grid-cols-2 gap-2">
                  {(['lat', 'lng'] as const).map((axis) => (
                    <label key={axis} className="text-[10px] text-slate-400 uppercase">
                      {axis === 'lat' ? 'Latitude' : 'Longitude'}
                      <input
                        type="number"
                        step="0.000001"
                        min={axis === 'lat' ? 1.13 : 103.59}
                        max={axis === 'lat' ? 1.48 : 104.1}
                        value={formData[coordinateKey][axis]}
                        onChange={(e) => setFormData({
                          ...formData,
                          [coordinateKey]: {
                            ...formData[coordinateKey],
                            [axis]: Number(e.target.value),
                          },
                        })}
                        aria-label={`${label} ${axis === 'lat' ? 'latitude' : 'longitude'}`}
                        className="mt-1 w-full bg-slate-950/70 border border-slate-700 rounded-lg px-2.5 py-2 text-white font-mono focus:outline-none focus:border-cyan-500"
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

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
              <label className="bg-slate-800 px-2 py-1 rounded-xl border border-slate-700 text-slate-400 text-[10px] uppercase">
                Flex (min)
                <input
                  type="number"
                  min="0"
                  max="120"
                  value={formData.flexibleWindowMinutes}
                  onChange={(e) => setFormData({ ...formData, flexibleWindowMinutes: Number(e.target.value) })}
                  className="block w-16 bg-transparent text-white font-mono text-sm focus:outline-none"
                />
              </label>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Proactive check triggers {formData.notificationLeadTimeMinutes} minutes prior (at {proactiveTime})
            </p>
          </div>

          {/* Preferences Toggles */}
          <div className="space-y-2 pt-1 border-t border-slate-800">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Preferences</div>

            <label className="block p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <span className="font-medium text-slate-200 block mb-1.5">Preferred Travel Mode</span>
              <select
                value={formData.preferredTravelMode}
                onChange={(e) => setFormData({
                  ...formData,
                  preferredTravelMode: e.target.value as CommuterProfile['preferredTravelMode'],
                  motorcycleMode: false,
                })}
                className="w-full bg-slate-950/70 border border-slate-700 rounded-lg px-2.5 py-2 text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="transit">Public transport</option>
                <option value="bus">Bus only</option>
                <option value="rail">Rail only</option>
                <option value="walk">Walk</option>
                <option value="cycle">Cycle</option>
                <option value="drive">Drive</option>
              </select>
            </label>

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
                <User className="w-4 h-4 text-violet-400" />
                <span className="font-medium text-slate-200">Prioritize Lower Crowding</span>
              </div>
              <input
                type="checkbox"
                checked={formData.prioritizeLowCrowd}
                onChange={(e) => setFormData({ ...formData, prioritizeLowCrowd: e.target.checked })}
                className="w-4 h-4 accent-violet-500 rounded"
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
            <span className={`font-semibold flex items-center gap-1 ${
              syncStatus === 'synced'
                ? 'text-emerald-400'
                : syncStatus === 'syncing'
                  ? 'text-cyan-400'
                  : 'text-amber-400'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                syncStatus === 'synced'
                  ? 'bg-emerald-400'
                  : syncStatus === 'syncing'
                    ? 'bg-cyan-400 animate-pulse'
                    : 'bg-amber-400'
              }`}></span>
              {syncStatus === 'synced' ? 'Synchronized' : syncStatus === 'syncing' ? 'Synchronizing' : 'Saved locally'}
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
              <span>Save & Recalculate Route</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
