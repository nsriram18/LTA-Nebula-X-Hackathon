import {
  CommuterProfile,
  OfflineRouteCache,
  ProactiveEvaluationResult,
  ScenarioOptions,
} from '../types';
import { apiQuery, apiRequest } from './apiClient';

export interface RawBusArrival {
  ServiceNo?: string;
  Load?: string;
  EstimatedMinutes?: number;
  Feature?: string;
  Type?: string;
}

export interface RawSpeedBand {
  LinkId?: string;
  RoadName?: string;
  SpeedBand?: number;
  MinSpeed?: number;
  MaxSpeed?: number;
  MinimumSpeed?: number;
  MaximumSpeed?: number;
}

export const backendApi = {
  health: () => apiRequest<{ status: string; firestore_connected: boolean }>('/api/health'),

  getProfile: (commuterId = 'commuter-arjun-01') =>
    apiRequest<CommuterProfile>(`/api/profile${apiQuery({ commuter_id: commuterId })}`),

  saveProfile: (profile: CommuterProfile) =>
    apiRequest<{ status: 'success' | 'error'; profile: CommuterProfile }>('/api/profile', {
      method: 'POST',
      body: JSON.stringify(profile),
    }),

  getAlerts: (replay = false) =>
    apiRequest<import('../types').TrainServiceAlertResponse>(
      `/api/alerts${apiQuery({ replay })}`,
    ),

  getCrowd: (line: string, timeSlot: string) =>
    apiRequest<Record<string, import('../types').CrowdLevel>>(
      `/api/crowd${apiQuery({ line, time_slot: timeSlot })}`,
    ),

  getBusArrivals: (busStopCode: string) =>
    apiRequest<RawBusArrival[]>(
      `/api/bus-arrivals${apiQuery({ bus_stop_code: busStopCode })}`,
    ),

  getNowcast: () => apiRequest<Array<Record<string, unknown>>>('/api/weather/nowcast'),
  getRainfall: () => apiRequest<Array<Record<string, unknown>>>('/api/weather/rainfall'),
  getSpeedBands: () => apiRequest<RawSpeedBand[]>('/api/speed-bands'),

  evaluate: (commuterId: string, options: ScenarioOptions) =>
    apiRequest<ProactiveEvaluationResult>(
      `/api/proactive-check${apiQuery({
        commuter_id: commuterId,
        replay_disruption: options.replayDisruption,
        simulated_rain: options.simulatedRain,
        simulated_crowd: options.simulatedCrowd,
      })}`,
      { method: 'POST', timeoutMs: 20_000 },
    ),

  getOfflineCache: (commuterId: string) =>
    apiRequest<OfflineRouteCache | null>(
      `/api/offline-cache${apiQuery({ commuter_id: commuterId })}`,
    ),

  saveOfflineCache: (commuterId: string, cache: OfflineRouteCache) =>
    apiRequest<{ status: 'cached' | 'error'; cachedAt: string }>(
      `/api/offline-cache${apiQuery({ commuter_id: commuterId })}`,
      { method: 'POST', body: JSON.stringify(cache) },
    ),
};
