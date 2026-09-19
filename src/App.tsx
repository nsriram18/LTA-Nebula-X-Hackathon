/**
 * ClearPath - Mobile-First Proactive Commuter Companion
 * Problem Statement 2 (PS2) Submission
 */

import React, { useState, useEffect, useCallback } from 'react';
import { MapComponent } from './components/MapComponent';
import { HeaderNav } from './components/HeaderNav';
import { BottomSheet } from './components/BottomSheet';
import { ProactiveNotification } from './components/ProactiveNotification';
import { ScenarioControls } from './components/ScenarioControls';
import { ProfileModal } from './components/ProfileModal';
import { WelcomeFlow } from './components/WelcomeFlow';
import { FirstRunTour } from './components/FirstRunTour';
import { proactiveEngine } from './services/proactiveEngine';
import { offlineStorage, DEFAULT_ARJUN_PROFILE } from './services/offlineStorage';
import { RouteOption, RouteStep, CommuterProfile, ProactiveNotificationPayload, TrafficSpeedBand } from './types';
import { backendApi } from './services/backendApi';

type SyncStatus = 'syncing' | 'synced' | 'offline';

export default function App() {
  const [profile, setProfile] = useState<CommuterProfile>(() => offlineStorage.getProfile());
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [activeRoute, setActiveRoute] = useState<RouteOption | null>(null);
  const [selectedStep, setSelectedStep] = useState<RouteStep | null>(null);
  const [proactivePayload, setProactivePayload] = useState<ProactiveNotificationPayload | null>(null);

  // Scenario toggles for testing and judging validation
  const [isDisruptionReplay, setIsDisruptionReplay] = useState<boolean>(false);
  const [isHeavyRain, setIsHeavyRain] = useState<boolean>(false);
  const [isHighCrowd, setIsHighCrowd] = useState<boolean>(false);
  const [showShelterLayer, setShowShelterLayer] = useState<boolean>(false);
  const [showCyclingLayer, setShowCyclingLayer] = useState<boolean>(false);
  const [showStations, setShowStations] = useState<boolean>(false);
  const [isUndergroundOffline, setIsUndergroundOffline] = useState<boolean>(false);
  const [offlineCachedAt, setOfflineCachedAt] = useState<string>('08:30 AM');
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [speedBands] = useState<TrafficSpeedBand[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('syncing');
  const [apiError, setApiError] = useState<string | null>(null);
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(() => !offlineStorage.hasCompletedOnboarding());
  const [showFirstRunTour, setShowFirstRunTour] = useState(false);
  const [tourAfterProfile, setTourAfterProfile] = useState(false);

  // Register service worker for offline underground caching
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('ClearPath Service Worker registered for offline resilience');
          void registration.update();
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (sessionStorage.getItem('clearpath_sw_refreshed') !== 'true') {
              sessionStorage.setItem('clearpath_sw_refreshed', 'true');
              window.location.reload();
            }
          });
        })
        .catch((err) => console.warn('Service Worker registration skipped:', err));
    }
  }, []);

  // Run proactive engine evaluation
  const cacheJourney = useCallback((route: RouteOption, targetProfile: CommuterProfile) => {
    offlineStorage.cacheActiveJourney(route, targetProfile);
    const cache = offlineStorage.getCachedJourney();
    if (cache) {
      void backendApi.saveOfflineCache(targetProfile.id, cache).catch(() => {
        setSyncStatus('offline');
      });
    }
  }, []);

  const runEvaluation = useCallback(async (
    customProfile?: CommuterProfile,
    overrides: Partial<{
      replayDisruption: boolean;
      simulatedRain: boolean;
      simulatedCrowd: boolean;
    }> = {},
  ) => {
    setIsLoading(true);
    const targetProfile = customProfile || profile;

    try {
      const result = await proactiveEngine.evaluateCommute(targetProfile, {
        replayDisruption: overrides.replayDisruption ?? isDisruptionReplay,
        simulatedRain: overrides.simulatedRain ?? isHeavyRain,
        simulatedCrowd: overrides.simulatedCrowd ?? isHighCrowd,
      });
      setRoutes(result.routes);

      // Select recommended route or keep active
      const rec = result.routes.find((r) => r.isRecommended) || result.routes[0] || null;
      setActiveRoute(rec);
      setProactivePayload(result.payload);

      // Cache active route to localStorage for underground offline capability
      if (rec) {
        cacheJourney(rec, targetProfile);
        setOfflineCachedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
      setApiError(null);
    } catch (e) {
      console.error('Proactive evaluation error:', e);
      setApiError('Live services are unavailable. ClearPath is using the last cached journey.');
    } finally {
      setIsLoading(false);
    }
  }, [cacheJourney, isDisruptionReplay, isHeavyRain, isHighCrowd, profile]);

  // Hydrate Firestore profile, then request server routes.
  useEffect(() => {
    let active = true;
    const bootstrap = async () => {
      let targetProfile = profile;
      try {
        const remoteProfile = await backendApi.getProfile(profile.id);
        if (!active) return;
        targetProfile = { ...DEFAULT_ARJUN_PROFILE, ...remoteProfile };
        setProfile(targetProfile);
        offlineStorage.saveProfile(targetProfile);
        setSyncStatus('synced');
      } catch (error) {
        console.warn('Profile sync unavailable; continuing with local profile:', error);
        setSyncStatus('offline');
      }

      if (active) await runEvaluation(targetProfile);
    };
    void bootstrap();
    return () => {
      active = false;
    };
    // Bootstrap exactly once; subsequent evaluations are user initiated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handlers for Scenario Testing
  const handleToggleDisruptionReplay = () => {
    const nextVal = !isDisruptionReplay;
    setIsDisruptionReplay(nextVal);
    void runEvaluation(undefined, { replayDisruption: nextVal });
  };

  const handleToggleHeavyRain = () => {
    const nextVal = !isHeavyRain;
    setIsHeavyRain(nextVal);
    void runEvaluation(undefined, { simulatedRain: nextVal });
  };

  const handleToggleHighCrowd = () => {
    const nextVal = !isHighCrowd;
    setIsHighCrowd(nextVal);
    void runEvaluation(undefined, { simulatedCrowd: nextVal });
  };

  const handleToggleMotorcycleMode = () => {
    const nextVal = !profile.motorcycleMode;
    const updated = { ...profile, motorcycleMode: nextVal };
    setProfile(updated);
    offlineStorage.saveProfile(updated);
    setSyncStatus('syncing');
    void backendApi.saveProfile(updated)
      .then(() => setSyncStatus('synced'))
      .catch(() => setSyncStatus('offline'));
    void runEvaluation(updated);
  };

  const handleApplyRoute = (routeId: string) => {
    const found = routes.find((r) => r.id === routeId);
    if (found) {
      setActiveRoute(found);
      cacheJourney(found, profile);
    }
    setProactivePayload(null);
  };

  const handleToggleUndergroundOffline = async () => {
    const nextVal = !isUndergroundOffline;
    setIsUndergroundOffline(nextVal);
    if (nextVal) {
      // Load strictly from cached snapshot
      const cached = offlineStorage.getCachedJourney();
      if (cached && cached.activeRoute) {
        setActiveRoute(cached.activeRoute);
        setOfflineCachedAt(new Date(cached.cachedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      } else {
        try {
          const remoteCache = await backendApi.getOfflineCache(profile.id);
          if (remoteCache?.activeRoute) {
            setActiveRoute(remoteCache.activeRoute);
            offlineStorage.cacheActiveJourney(remoteCache.activeRoute, remoteCache.profile);
            setOfflineCachedAt(new Date(remoteCache.cachedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
          }
        } catch (error) {
          console.warn('No remote offline snapshot is available:', error);
        }
      }
    }
  };

  const handleSaveProfile = (updated: CommuterProfile) => {
    setProfile(updated);
    offlineStorage.saveProfile(updated);
    setSyncStatus('syncing');
    void backendApi.saveProfile(updated)
      .then(() => {
        setSyncStatus('synced');
        setApiError(null);
      })
      .catch(() => {
        setSyncStatus('offline');
        setApiError('Profile saved locally and will be retried when the backend is available.');
      });
    void runEvaluation(updated);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans">
      {/* Top Header Navigation */}
      <HeaderNav
        profile={profile}
        onOpenProfile={() => setIsProfileOpen(true)}
        isRaining={isHeavyRain}
        isUnderground={isUndergroundOffline}
      />

      {/* 45-Min Proactive Notification Banner */}
      <ProactiveNotification
        payload={proactivePayload}
        onApplyRoute={handleApplyRoute}
        onDismiss={() => setProactivePayload(null)}
      />

      {/* Judging / Scenario Controls Toolbar */}
      <ScenarioControls
        isDisruptionReplay={isDisruptionReplay}
        onToggleDisruptionReplay={handleToggleDisruptionReplay}
        isHeavyRain={isHeavyRain}
        onToggleHeavyRain={handleToggleHeavyRain}
        isHighCrowd={isHighCrowd}
        onToggleHighCrowd={handleToggleHighCrowd}
        isMotorcycleMode={profile.motorcycleMode}
        onToggleMotorcycleMode={handleToggleMotorcycleMode}
        onTriggerProactiveCheck={() => void runEvaluation()}
        onToggleUndergroundOffline={() => void handleToggleUndergroundOffline()}
        isUndergroundOffline={isUndergroundOffline}
        isLoading={isLoading}
      />

      {apiError && (
        <div className="fixed top-20 inset-x-3 sm:max-w-md sm:mx-auto z-[430] rounded-xl border border-amber-500/40 bg-amber-950/90 px-3 py-2 text-xs text-amber-100 shadow-lg">
          {apiError}
        </div>
      )}

      {/* Full-Bleed Leaflet Map with visible OSM attribution */}
      <div className="absolute inset-0 pt-16 pb-[148px] z-0">
        <MapComponent
          activeRoute={activeRoute}
          selectedStep={selectedStep}
          showShelterLayer={showShelterLayer}
          showCyclingLayer={showCyclingLayer}
          showStations={showStations}
          onToggleShelterLayer={() => setShowShelterLayer(!showShelterLayer)}
          onToggleCyclingLayer={() => setShowCyclingLayer(!showCyclingLayer)}
          onToggleStations={() => setShowStations(!showStations)}
          isRaining={isHeavyRain}
          isDisrupted={isDisruptionReplay}
          isMotorcycleMode={profile.motorcycleMode}
          speedBands={speedBands}
          profile={profile}
        />
      </div>

      {/* Persistent, Expandable Bottom Sheet */}
      <BottomSheet
        routes={routes}
        activeRoute={activeRoute}
        onSelectRoute={(r) => {
          setActiveRoute(r);
          cacheJourney(r, profile);
        }}
        selectedStep={selectedStep}
        onSelectStep={setSelectedStep}
        isUndergroundOffline={isUndergroundOffline}
        offlineCachedAt={offlineCachedAt}
        isRaining={isHeavyRain}
        isDisrupted={isDisruptionReplay}
      />

      {/* Profile / Commuter Persona Settings Modal */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => {
          setIsProfileOpen(false);
          if (tourAfterProfile && !offlineStorage.hasCompletedTour()) {
            setTourAfterProfile(false);
            setShowFirstRunTour(true);
          }
        }}
        profile={profile}
        onSaveProfile={handleSaveProfile}
        syncStatus={syncStatus}
      />

      {isWelcomeOpen && <WelcomeFlow
        onSetup={() => {
          offlineStorage.completeOnboarding();
          setIsWelcomeOpen(false);
          setTourAfterProfile(true);
          setIsProfileOpen(true);
        }}
        onExplore={() => {
          offlineStorage.completeOnboarding();
          setIsWelcomeOpen(false);
          if (!offlineStorage.hasCompletedTour()) setShowFirstRunTour(true);
        }}
      />}
      {showFirstRunTour && <FirstRunTour onComplete={() => {
        offlineStorage.completeTour();
        setShowFirstRunTour(false);
      }} />}
    </div>
  );
}
