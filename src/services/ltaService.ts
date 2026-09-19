/**
 * LTA DataMall API Service
 * Handles TrainServiceAlerts, PCDForecast, BusArrival (v3), and TrafficSpeedBands (v4)
 */

import { TrainServiceAlertResponse, CrowdLevel, BusLoad, TrafficSpeedBand } from '../types';
import { CANONICAL_LINE_MAP, CAPTURED_DISRUPTION_REPLAY, NORMAL_TRAIN_ALERTS, TRAFFIC_SPEED_BANDS_DATA } from '../data/mockGeospatial';
import { backendApi } from './backendApi';

export interface StationCrowdForecast {
  stationCode: string;
  stationName: string;
  line: string;
  timeSlot: string; // e.g. "08:00", "08:30", "09:00"
  crowdLevel: CrowdLevel;
}

export interface BusArrivalInfo {
  serviceNo: string;
  nextBusEstimatedArrivalMinutes: number;
  load: BusLoad;
  feature: 'WAB' | 'NORMAL';
  type: 'SD' | 'DD' | 'BD';
}

class LTAService {
  private isReplayDisruptionMode = false;

  public setReplayDisruptionMode(active: boolean) {
    this.isReplayDisruptionMode = active;
  }

  public getReplayDisruptionMode(): boolean {
    return this.isReplayDisruptionMode;
  }

  /**
   * Fetch LTA TrainServiceAlerts
   * Parses nested AffectedSegments array to detect LRT/MRT disruptions and extract FreePublicBus / FreeMRTShuttle
   */
  public async getTrainServiceAlerts(): Promise<TrainServiceAlertResponse> {
    try {
      return await backendApi.getAlerts(this.isReplayDisruptionMode);
    } catch (err) {
      console.warn('LTA TrainServiceAlerts fetch failed, using fallback status:', err);
      return this.isReplayDisruptionMode ? CAPTURED_DISRUPTION_REPLAY : NORMAL_TRAIN_ALERTS;
    }
  }

  /**
   * Fetch LTA PCDForecast (Station Crowd Density Forecast)
   * 30-minute interval crowd levels ('l', 'm', 'h')
   */
  public async getPCDForecast(lineKey: string, timeSlot = '08:30'): Promise<Record<string, CrowdLevel>> {
    const lineConfig = CANONICAL_LINE_MAP[lineKey] || { crowdCode: lineKey };
    const mappedCrowdCode = lineConfig.crowdCode;

    // High fidelity realistic baseline by hour for Punggol & transit stations
    const crowdMap: Record<string, CrowdLevel> = {};

    // Standard peak hour curve:
    // 07:30 - 08:00: Moderate (m)
    // 08:00 - 08:45: High (h) for Punggol, Serangoon, Bishan, Buona Vista
    // 08:45 - 09:30: Moderate (m) dropping to Low (l)
    const [hoursStr, minsStr] = timeSlot.split(':');
    const totalMinutes = parseInt(hoursStr || '8', 10) * 60 + parseInt(minsStr || '30', 10);

    const isPeakHour = totalMinutes >= 480 && totalMinutes <= 525; // 08:00 to 08:45
    const isShoulderPeak = (totalMinutes >= 450 && totalMinutes < 480) || (totalMinutes > 525 && totalMinutes <= 560);

    const defaultCrowd: CrowdLevel = isPeakHour ? 'h' : isShoulderPeak ? 'm' : 'l';

    // Set station codes
    crowdMap['PE7'] = this.isReplayDisruptionMode ? 'h' : defaultCrowd; // Damai
    crowdMap['PE6'] = defaultCrowd; // Oasis
    crowdMap['NE17'] = isPeakHour ? 'h' : 'm'; // Punggol MRT
    crowdMap['NE12'] = isPeakHour ? 'h' : 'm'; // Serangoon
    crowdMap['CC13'] = isPeakHour ? 'h' : 'm'; // Serangoon CCL
    crowdMap['CC22'] = isPeakHour ? 'h' : 'm'; // Buona Vista CCL
    crowdMap['CC23'] = isPeakHour ? 'm' : 'l'; // one-north

    try {
      const liveCrowd = await backendApi.getCrowd(mappedCrowdCode, timeSlot);
      return { ...crowdMap, ...liveCrowd };
    } catch (e) {
      console.warn('Backend crowd forecast unavailable, using fallback:', e);
    }

    return crowdMap;
  }

  /**
   * Fetch LTA v3/BusArrival for specific bus stop
   * Returns bus ETA and Load ('SEA', 'SDA', 'LSD')
   */
  public async getBusArrivals(busStopCode: string): Promise<BusArrivalInfo[]> {
    // Standard realistic simulated feeds for Arjun's key feeder and express buses:
    // Bus 85 (Punggol to Yishun), Bus 39 (Punggol to Tampines/Pasir Ris), Bus 168 (Woodlands express)
    const simulatedArrivals: Record<string, BusArrivalInfo[]> = {
      '65199': [ // Punggol Temp Interchange
        { serviceNo: '85', nextBusEstimatedArrivalMinutes: 4, load: 'SEA', feature: 'WAB', type: 'DD' },
        { serviceNo: '39', nextBusEstimatedArrivalMinutes: 8, load: 'SDA', feature: 'WAB', type: 'SD' },
        { serviceNo: '168', nextBusEstimatedArrivalMinutes: 11, load: 'SEA', feature: 'WAB', type: 'DD' },
      ],
      '65309': [ // Opp Damai Stn
        { serviceNo: '84', nextBusEstimatedArrivalMinutes: 3, load: 'SEA', feature: 'WAB', type: 'SD' },
        { serviceNo: '382G', nextBusEstimatedArrivalMinutes: 6, load: 'SDA', feature: 'WAB', type: 'DD' },
      ],
      '18059': [ // one-north Stn / Galaxis
        { serviceNo: '91', nextBusEstimatedArrivalMinutes: 5, load: 'SEA', feature: 'WAB', type: 'SD' },
        { serviceNo: '200', nextBusEstimatedArrivalMinutes: 9, load: 'SEA', feature: 'WAB', type: 'SD' },
      ],
    };

    try {
      const services = await backendApi.getBusArrivals(busStopCode);
      return services.map((service) => ({
        serviceNo: service.ServiceNo || '',
        nextBusEstimatedArrivalMinutes: service.EstimatedMinutes ?? 5,
        load: (service.Load as BusLoad) || 'SEA',
        feature: (service.Feature as 'WAB' | 'NORMAL') || 'WAB',
        type: (service.Type as 'SD' | 'DD' | 'BD') || 'SD',
      }));
    } catch (e) {
      console.warn('Backend bus arrivals unavailable, using fallback:', e);
    }

    return simulatedArrivals[busStopCode] || [];
  }

  /**
   * Fetch LTA v4/TrafficSpeedBands for Motorcycle Mode
   */
  public async getTrafficSpeedBands(): Promise<TrafficSpeedBand[]> {
    try {
      const live = await backendApi.getSpeedBands();
      return live.map((band, index) => {
        const fallback = TRAFFIC_SPEED_BANDS_DATA[index % TRAFFIC_SPEED_BANDS_DATA.length];
        return {
          LinkId: band.LinkId || fallback.LinkId,
          RoadName: band.RoadName || fallback.RoadName,
          SpeedBand: band.SpeedBand ?? fallback.SpeedBand,
          MinimumSpeed: band.MinimumSpeed ?? band.MinSpeed ?? fallback.MinimumSpeed,
          MaximumSpeed: band.MaximumSpeed ?? band.MaxSpeed ?? fallback.MaximumSpeed,
          StartCoordinates: fallback.StartCoordinates,
          EndCoordinates: fallback.EndCoordinates,
        };
      });
    } catch (error) {
      console.warn('Backend speed bands unavailable, using fallback:', error);
      return TRAFFIC_SPEED_BANDS_DATA;
    }
  }
}

export const ltaService = new LTAService();
