/**
 * ClearPath Commuter Companion - Core Domain Types
 */

export type TransportMode = 'cycle' | 'lrt' | 'mrt' | 'bus' | 'walk' | 'motorcycle' | 'shuttle';

export type CrowdLevel = 'l' | 'm' | 'h' | 'NA'; // Low, Moderate, High
export type BusLoad = 'SEA' | 'SDA' | 'LSD'; // Seats Available, Standing Available, Limited Standing

export interface GeoCoordinate {
  lat: number;
  lng: number;
}

export interface RouteStep {
  id: string;
  mode: TransportMode;
  instruction: string;
  distanceMeters: number;
  durationMinutes: number;
  coordinates: [number, number][]; // [lat, lng]
  isSheltered?: boolean;
  isCyclingPath?: boolean;
  // Crowding info
  stationCode?: string;
  stationName?: string;
  crowdLevel?: CrowdLevel;
  busServiceNo?: string;
  busLoad?: BusLoad;
  busFeature?: 'WAB' | 'NORMAL';
  busType?: 'SD' | 'DD' | 'BD';
  // Alerts & Mitigations
  disruptionAlert?: string;
  freeMitigation?: 'FreePublicBus' | 'FreeMRTShuttle' | null;
}

export interface RouteOption {
  id: string;
  title: string;
  subtitle: string;
  modeSummary: TransportMode[];
  totalDurationMinutes: number;
  totalDistanceKm: number;
  departureTime: string;
  arrivalTime: string;
  crowdScore: 'Low' | 'Moderate' | 'High';
  comfortScore: number; // 0 - 100
  shelteredPercentage: number; // % covered
  cyclingDistanceKm: number;
  steps: RouteStep[];
  isRecommended?: boolean;
  proactiveShiftMinutes?: number;
  isAlternative?: boolean;
  disruptionAvoided?: boolean;
  trafficStressScore?: number; // For motorcycle mode
  weatherRisk?: 'None' | 'Moderate Rain' | 'Heavy Rain';
}

export interface TrainAlertSegment {
  Line: string; // e.g. "PTL", "NEL"
  Direction: string; // e.g. "Both", "Punggol"
  Stations: string; // e.g. "PE1,PE2,PE3,PE4"
  FreePublicBus?: string;
  FreeMRTShuttle?: string;
  MRTShuttleDirection?: string;
}

export interface TrainAlertMessage {
  Content: string;
  CreatedDate: string;
}

export interface TrainServiceAlertResponse {
  Status: number; // 1 = Normal, 2 = Disrupted
  AffectedSegments: TrainAlertSegment[];
  Message: TrainAlertMessage[];
}

export interface WeatherNowcastArea {
  area: string;
  forecast: string; // e.g. "Thundery Showers", "Light Rain", "Fair"
}

export interface RainfallReading {
  stationId: string;
  stationName: string;
  valueMm: number;
  coordinates: GeoCoordinate;
}

export interface TrafficSpeedBand {
  LinkId: string;
  RoadName: string;
  SpeedBand: number; // 1 (0-19 km/h) to 8 (>80 km/h)
  MinimumSpeed: number;
  MaximumSpeed: number;
  StartCoordinates: GeoCoordinate;
  EndCoordinates: GeoCoordinate;
}

export interface CommuterProfile {
  id: string;
  name: string;
  persona: 'arjun' | 'rachel' | 'mdm_lim' | 'custom';
  homeAddress: string;
  homeCoords: GeoCoordinate;
  officeAddress: string;
  officeCoords: GeoCoordinate;
  scheduledDepartureTime: string; // e.g. "08:30"
  flexibleWindowMinutes: number; // ±30 mins
  notificationLeadTimeMinutes: number; // 45 mins
  bringBicycle: boolean;
  prioritizeShelter: boolean;
  prioritizeLowCrowd: boolean;
  preferredTravelMode: Exclude<RouteTravelMode, 'motorcycle'>;
  motorcycleMode: boolean;
  motorcycleModel?: string; // e.g. "Yamaha XSR155 (Manual)"
  minimizeClutchFatigue?: boolean;
}

export type RouteTravelMode = 'transit' | 'bus' | 'rail' | 'walk' | 'cycle' | 'drive' | 'motorcycle';

export interface RouteRequest {
  origin: GeoCoordinate;
  destination: GeoCoordinate;
  originAddress: string;
  destinationAddress: string;
  departureTime: string;
  travelMode: RouteTravelMode;
  maxWalkDistance?: number;
  numItineraries?: number;
  prioritizeShelter?: boolean;
  prioritizeLowCrowd?: boolean;
}

export interface RoutePlanResult {
  routes: RouteOption[];
  provider: 'onemap' | 'fallback';
}

export interface ProactiveNotificationPayload {
  id: string;
  timestamp: string;
  commuteDate: string;
  scheduledTime: string;
  recommendedAction: string;
  reason: string;
  severity: 'info' | 'warning' | 'alert';
  timeShiftMinutes: number; // e.g. +20 min or -15 min
  newDepartureTime: string;
  originalRouteId: string;
  suggestedRouteId: string;
  disruptionSummary?: string;
  weatherSummary?: string;
  crowdSummary?: string;
  freeMitigationAvailable?: string;
}

export interface OfflineRouteCache {
  cachedAt: string;
  activeRoute: RouteOption;
  profile: CommuterProfile;
  offlineNotes: string[];
}

export interface ScenarioOptions {
  replayDisruption: boolean;
  simulatedRain: boolean;
  simulatedCrowd: boolean;
}

export interface ProactiveEvaluationResult {
  payload: ProactiveNotificationPayload | null;
  routes: RouteOption[];
  activeAlerts: boolean;
  weatherAlert: boolean;
  profile: CommuterProfile;
}
