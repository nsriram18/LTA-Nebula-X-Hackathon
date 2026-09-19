/**
 * Weather Service - data.gov.sg
 * Integrates 2-hour nowcast and rainfall API readings
 * Detects localized rain along cycling legs and road routes
 */

import { WeatherNowcastArea, RainfallReading } from '../types';
import { backendApi } from './backendApi';

class WeatherService {
  private isHeavyRainScenario = false;

  public setHeavyRainScenario(active: boolean) {
    this.isHeavyRainScenario = active;
  }

  public getHeavyRainScenario(): boolean {
    return this.isHeavyRainScenario;
  }

  /**
   * Fetch 2-Hour Weather Nowcast from data.gov.sg
   */
  public async get2HourNowcast(): Promise<WeatherNowcastArea[]> {
    if (this.isHeavyRainScenario) {
      return [
        { area: 'Punggol', forecast: 'Heavy Thundery Showers' },
        { area: 'Sengkang', forecast: 'Thundery Showers' },
        { area: 'Pasir Ris', forecast: 'Heavy Rain' },
        { area: 'Ang Mo Kio', forecast: 'Cloudy' },
        { area: 'Queenstown', forecast: 'Light Showers' },
        { area: 'Bukit Merah', forecast: 'Fair' },
      ];
    }

    try {
      const forecasts = await backendApi.getNowcast();
      if (forecasts.length > 0) {
        return forecasts.map((forecast) => ({
          area: String(forecast.area || ''),
          forecast: String(forecast.forecast || 'Fair'),
        }));
      }
    } catch (err) {
      console.warn('data.gov.sg 2-hour nowcast fetch failed, using fallback:', err);
    }

    return [
      { area: 'Punggol', forecast: 'Partly Cloudy' },
      { area: 'Sengkang', forecast: 'Partly Cloudy' },
      { area: 'Serangoon', forecast: 'Fair' },
      { area: 'Queenstown', forecast: 'Fair (Day)' },
      { area: 'Bukit Merah', forecast: 'Fair' },
    ];
  }

  /**
   * Fetch real-time rainfall data from data.gov.sg
   */
  public async getRainfallReadings(): Promise<RainfallReading[]> {
    if (this.isHeavyRainScenario) {
      return [
        {
          stationId: 'S107',
          stationName: 'Punggol Central',
          valueMm: 18.4, // Heavy rain (>10mm is heavy shower)
          coordinates: { lat: 1.4024, lng: 103.9068 },
        },
        {
          stationId: 'S108',
          stationName: 'Sengkang East',
          valueMm: 12.1,
          coordinates: { lat: 1.388, lng: 103.896 },
        },
        {
          stationId: 'S117',
          stationName: 'one-north / Buona Vista',
          valueMm: 0.2, // Dry / very light trace
          coordinates: { lat: 1.2995, lng: 103.7876 },
        },
      ];
    }

    try {
      const readings = await backendApi.getRainfall();
      if (readings.length > 0) {
        return readings.map((reading) => ({
          stationId: String(reading.stationId || ''),
          stationName: String(reading.stationName || reading.stationId || 'Singapore'),
          valueMm: Number(reading.valueMm ?? reading.value ?? 0),
          coordinates: {
            lat: Number(reading.latitude ?? 1.35),
            lng: Number(reading.longitude ?? 103.82),
          },
        }));
      }
    } catch (e) {
      // Fallback
    }

    return [
      {
        stationId: 'S107',
        stationName: 'Punggol Central',
        valueMm: 0.0,
        coordinates: { lat: 1.4024, lng: 103.9068 },
      },
      {
        stationId: 'S117',
        stationName: 'one-north',
        valueMm: 0.0,
        coordinates: { lat: 1.2995, lng: 103.7876 },
      },
    ];
  }

  /**
   * Check if rain is detected along Punggol cycling route
   */
  public async checkCyclingLegRain(): Promise<{ isRaining: boolean; severity: 'None' | 'Light Rain' | 'Heavy Rain'; mmPerHour: number; advisory: string }> {
    const nowcast = await this.get2HourNowcast();
    const punggolForecast = nowcast.find((n) => n.area.toLowerCase().includes('punggol'))?.forecast || 'Fair';

    const rainfall = await this.getRainfallReadings();
    const punggolStation = rainfall.find((r) => r.stationName.toLowerCase().includes('punggol'))?.valueMm || 0;

    const isHeavy = punggolForecast.toLowerCase().includes('heavy') || punggolForecast.toLowerCase().includes('thundery') || punggolStation > 5.0;
    const isLight = punggolForecast.toLowerCase().includes('rain') || punggolForecast.toLowerCase().includes('shower') || punggolStation > 0.2;

    if (isHeavy) {
      return {
        isRaining: true,
        severity: 'Heavy Rain',
        mmPerHour: Math.max(12.5, punggolStation),
        advisory: 'Heavy rain detected on Punggol cycling link. Switch to covered linkway or feeder bus, or delay departure by +20 min.',
      };
    }

    if (isLight) {
      return {
        isRaining: true,
        severity: 'Light Rain',
        mmPerHour: Math.max(2.0, punggolStation),
        advisory: 'Light showers detected. Covered linkways recommended if carrying non-waterproof gear.',
      };
    }

    return {
      isRaining: false,
      severity: 'None',
      mmPerHour: 0,
      advisory: 'Dry and clear. Cycling conditions are optimal.',
    };
  }
}

export const weatherService = new WeatherService();
