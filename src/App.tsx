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
import { MotorcycleModeSheet } from './components/MotorcycleModeSheet';
import { proactiveEngine } from './services/proactiveEngine';
import { ltaService } from './services/ltaService';
import { weatherService } from './services/weatherService';
import { offlineStorage, DEFAULT_ARJUN_PROFILE } from './services/offlineStorage';
import { RouteOption, RouteStep, CommuterProfile, ProactiveNotificationPayload, TrafficSpeedBand } from './types';
import { TRAFFIC_SPEED_BANDS_DATA } from './data/mockGeospatial';

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
  const [showShelterLayer, setShowShelterLayer] = useState<boolean>(true);
  const [showCyclingLayer, setShowCyclingLayer] = useState<boolean>(true);
  const [isUndergroundOffline, setIsUndergroundOffline] = useState<boolean>(false);
  const [offlineCachedAt, setOfflineCachedAt] = useState<string>('08:30 AM');
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [speedBands] = useState<TrafficSpeedBand[]>(TRAFFIC_SPEED_BANDS_DATA);

  // Register service worker for offline underground caching
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then(() => console.log('ClearPath Service Worker registered for offline resilience'))
        .catch((err) => console.warn('Service Worker registration skipped:', err));
    }
  }, []);

  // Run proactive engine evaluation
  const runEvaluation = useCallback(async (customProfile?: CommuterProfile) => {
    setIsLoading(true);
    const targetProfile = customProfile || profile;

    try {
      const result = await proactiveEngine.evaluateCommute(targetProfile);
      setRoutes(result.routes);

      // Select recommended route or keep active
      const rec = result.routes.find((r) => r.isRecommended) || result.routes[0] || null;
      setActiveRoute(rec);
      setProactivePayload(result.payload);

      // Cache active route to localStorage for underground offline capability
      if (rec) {
        offlineStorage.cacheActiveJourney(rec, targetProfile);
        setOfflineCachedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
    } catch (e) {
      console.error('Proactive evaluation error:', e);
    } finally {
      setIsLoading(false);
    }
  }, [profile]);

  // Initial mount trigger
  useEffect(() => {
    runEvaluation();
  }, [runEvaluation]);

  // Handlers for Scenario Testing
  const handleToggleDisruptionReplay = () => {
    const nextVal = !isDisruptionReplay;
    setIsDisruptionReplay(nextVal);
    ltaService.setReplayDisruptionMode(nextVal);
    runEvaluation();
  };

  const handleToggleHeavyRain = () => {
    const nextVal = !isHeavyRain;
    setIsHeavyRain(nextVal);
    weatherService.setHeavyRainScenario(nextVal);
    runEvaluation();
  };

  const handleToggleHighCrowd = () => {
    const nextVal = !isHighCrowd;
    setIsHighCrowd(nextVal);
    const updated = {
      ...profile,
      scheduledDepartureTime: nextVal ? '08:15' : '08:30',
    };
    setProfile(updated);
    runEvaluation(updated);
  };

  const handleToggleMotorcycleMode = () => {
    const nextVal = !profile.motorcycleMode;
    const updated = { ...profile, motorcycleMode: nextVal };
    setProfile(updated);
    offlineStorage.saveProfile(updated);
    runEvaluation(updated);
  };

  const handleApplyRoute = (routeId: string) => {
    const found = routes.find((r) => r.id === routeId);
    if (found) {
      setActiveRoute(found);
      offlineStorage.cacheActiveJourney(found, profile);
    }
    setProactivePayload(null);
  };

  const handleToggleUndergroundOffline = () => {
    const nextVal = !isUndergroundOffline;
    setIsUndergroundOffline(nextVal);
    if (nextVal) {
      // Load strictly from cached snapshot
      const cached = offlineStorage.getCachedJourney();
      if (cached && cached.activeRoute) {
        setActiveRoute(cached.activeRoute);
        setOfflineCachedAt(new Date(cached.cachedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
    }
  };

  const handleSaveProfile = (updated: CommuterProfile) => {
    setProfile(updated);
    offlineStorage.saveProfile(updated);
    runEvaluation(updated);
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
        showShelterLayer={showShelterLayer}
        onToggleShelterLayer={() => setShowShelterLayer(!showShelterLayer)}
        showCyclingLayer={showCyclingLayer}
        onToggleCyclingLayer={() => setShowCyclingLayer(!showCyclingLayer)}
        onTriggerProactiveCheck={() => runEvaluation()}
        isLoading={isLoading}
      />

      {/* Full-Bleed Leaflet Map with visible OSM attribution */}
      <div className="absolute inset-0 pt-14 pb-36 z-0">
        <MapComponent
          activeRoute={activeRoute}
          selectedStep={selectedStep}
          showShelterLayer={showShelterLayer}
          showCyclingLayer={showCyclingLayer}
          isRaining={isHeavyRain}
          isDisrupted={isDisruptionReplay}
          isMotorcycleMode={profile.motorcycleMode}
          speedBands={speedBands}
        />
      </div>

      {/* Persistent, Expandable Bottom Sheet */}
      <BottomSheet
        routes={routes}
        activeRoute={activeRoute}
        onSelectRoute={(r) => {
          setActiveRoute(r);
          offlineStorage.cacheActiveJourney(r, profile);
        }}
        selectedStep={selectedStep}
        onSelectStep={setSelectedStep}
        isUndergroundOffline={isUndergroundOffline}
        offlineCachedAt={offlineCachedAt}
        isRaining={isHeavyRain}
        isDisrupted={isDisruptionReplay}
        onToggleUndergroundOffline={handleToggleUndergroundOffline}
      />

      {/* Profile / Commuter Persona Settings Modal */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        profile={profile}
        onSaveProfile={handleSaveProfile}
      />
    </div>
  );
}
