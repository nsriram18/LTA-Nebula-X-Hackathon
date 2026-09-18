/**
 * Offline Storage & Service Worker Cache Manager
 * Handles local caching of active journey, commuter profile, and fallback directions
 * for seamless offline operation when underground with no cellular signal.
 */

import { OfflineRouteCache, RouteOption, CommuterProfile } from '../types';

const STORAGE_KEY = 'clearpath_active_journey';
const PROFILE_KEY = 'clearpath_user_profile';

export const DEFAULT_ARJUN_PROFILE: CommuterProfile = {
  id: 'commuter-arjun-01',
  name: 'Arjun',
  persona: 'arjun',
  homeAddress: 'Waterway Terraces II, Punggol Walk',
  homeCoords: { lat: 1.4024, lng: 103.9068 },
  officeAddress: 'Fusionopolis One, 1 Fusionopolis Way, one-north',
  officeCoords: { lat: 1.2995, lng: 103.7876 },
  scheduledDepartureTime: '08:30',
  flexibleWindowMinutes: 30,
  notificationLeadTimeMinutes: 45,
  bringBicycle: true,
  prioritizeShelter: true,
  prioritizeLowCrowd: true,
  motorcycleMode: false,
  motorcycleModel: 'Yamaha XSR155 (Manual 6-Speed)',
  minimizeClutchFatigue: true,
};

class OfflineStorageManager {
  /**
   * Cache current active journey to localStorage
   */
  public cacheActiveJourney(route: RouteOption, profile: CommuterProfile): void {
    try {
      const cache: OfflineRouteCache = {
        cachedAt: new Date().toISOString(),
        activeRoute: route,
        profile,
        offlineNotes: [
          'Signal offline: Using verified cached itinerary.',
          'Interchange transfer: Circle Line cross-platform at Serangoon (B2).',
          'Exit A at one-north connects directly to Fusionopolis basement concourse.',
        ],
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
    } catch (e) {
      console.warn('Unable to write to localStorage:', e);
    }
  }

  /**
   * Retrieve cached active journey
   */
  public getCachedJourney(): OfflineRouteCache | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Unable to read localStorage cache:', e);
    }
    return null;
  }

  /**
   * Save commuter profile
   */
  public saveProfile(profile: CommuterProfile): void {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } catch (e) {
      console.warn('Unable to save profile:', e);
    }
  }

  /**
   * Load commuter profile with fallback to Arjun
   */
  public getProfile(): CommuterProfile {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (raw) {
        return { ...DEFAULT_ARJUN_PROFILE, ...JSON.parse(raw) };
      }
    } catch (e) {
      // Fallback
    }
    return DEFAULT_ARJUN_PROFILE;
  }
}

export const offlineStorage = new OfflineStorageManager();
