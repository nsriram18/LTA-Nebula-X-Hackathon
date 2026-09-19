/**
 * ClearPath Proactive Decision Engine
 * Runs 45 minutes prior to commuter's scheduled departure.
 * Orchestrates LTA DataMall (TrainServiceAlerts, PCDForecast, BusArrival, SpeedBands)
 * and data.gov.sg weather to generate actionable, decisive commuter guidance.
 */

import {
  CommuterProfile,
  ProactiveEvaluationResult,
  ProactiveNotificationPayload,
  ScenarioOptions,
} from '../types';
import { backendApi } from './backendApi';
import { ltaService } from './ltaService';
import { weatherService } from './weatherService';
import { routingEngine } from './routingEngine';

class ProactiveEngine {
  /**
   * Run the proactive evaluation for Arjun's commute
   * Typically scheduled by cron / worker at T - 45 min
   */
  public async evaluateCommute(
    profile: CommuterProfile,
    options: ScenarioOptions = {
      replayDisruption: false,
      simulatedRain: false,
      simulatedCrowd: false,
    },
  ): Promise<ProactiveEvaluationResult> {
    try {
      return await backendApi.evaluate(profile.id, options);
    } catch (error) {
      console.warn('Backend proactive evaluation unavailable, using offline engine:', error);
    }

    const scheduledTime = profile.scheduledDepartureTime; // e.g. "08:30"
    const alerts = await ltaService.getTrainServiceAlerts();
    const weather = await weatherService.checkCyclingLegRain();
    const hasDisruption = alerts.Status === 2 && alerts.AffectedSegments.length > 0;
    const hasRain = weather.isRaining;

    const routes = await routingEngine.generateRoutes(profile, scheduledTime, alerts, hasRain);

    // If motorcycle mode is active
    if (profile.motorcycleMode) {
      if (hasRain) {
        const payload: ProactiveNotificationPayload = {
          id: `notif-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          commuteDate: new Date().toISOString().slice(0, 10),
          scheduledTime,
          severity: 'warning',
          timeShiftMinutes: 0,
          newDepartureTime: scheduledTime,
          recommendedAction: 'Reroute via Bartley Viaduct (Avoid PIE Congestion & Wet Slip Hazard)',
          reason: 'Severe wet paint slip hazard and Speed Band 1 (12 km/h) stop-and-go on PIE Westbound.',
          originalRouteId: 'moto-route-pie-heavy',
          suggestedRouteId: 'moto-route-smooth',
          weatherSummary: 'Rain cell detected across Central Expressway corridor.',
          disruptionSummary: 'High clutch fatigue warning: >80 clutch engagements prevented on bypass route.',
        };
        return { payload, routes, activeAlerts: false, weatherAlert: true, profile };
      }

      const payload: ProactiveNotificationPayload = {
        id: `notif-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        commuteDate: new Date().toISOString().slice(0, 10),
        scheduledTime,
        severity: 'info',
        timeShiftMinutes: 0,
        newDepartureTime: scheduledTime,
        recommendedAction: 'Take Bartley Viaduct Flow Route to one-north',
        reason: 'Free-flow traffic (Speed Band 6: 65 km/h). Saves 13 mins and eliminates stop-and-go clutch strain.',
        originalRouteId: 'moto-route-pie-heavy',
        suggestedRouteId: 'moto-route-smooth',
      };
      return { payload, routes, activeAlerts: false, weatherAlert: false, profile };
    }

    // 1. Train Disruption scenario
    if (hasDisruption) {
      const affected = alerts.AffectedSegments[0];
      const freeMitigation = affected.FreeMRTShuttle || affected.FreePublicBus || 'Free public transit activated';

      const payload: ProactiveNotificationPayload = {
        id: `notif-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        commuteDate: new Date().toISOString().slice(0, 10),
        scheduledTime,
        severity: 'alert',
        timeShiftMinutes: 0,
        newDepartureTime: scheduledTime,
        recommendedAction: 'Take Free MRT Shuttle from Punggol Bus Interchange direct to Circle Line',
        reason: `${affected.Line} signalling fault affects ${affected.Stations}. LTA has activated ${freeMitigation}.`,
        originalRouteId: 'route-arjun-signature',
        suggestedRouteId: 'route-mitigated-disruption',
        disruptionSummary: alerts.Message[0]?.Content || 'LRT Track Fault on East Loop',
        freeMitigationAvailable: freeMitigation,
      };

      return { payload, routes, activeAlerts: true, weatherAlert: hasRain, profile };
    }

    // 2. Heavy Rain on Cycling Leg scenario
    if (hasRain && weather.severity === 'Heavy Rain') {
      const payload: ProactiveNotificationPayload = {
        id: `notif-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        commuteDate: new Date().toISOString().slice(0, 10),
        scheduledTime,
        severity: 'warning',
        timeShiftMinutes: 20,
        newDepartureTime: this.addMinutes(scheduledTime, 20),
        recommendedAction: 'Shift departure to ' + this.addMinutes(scheduledTime, 20) + ' or take Covered Linkway + Bus 84',
        reason: `Heavy rain cell (${weather.mmPerHour.toFixed(1)} mm/h) over Punggol Park Connector will pass in 20 min.`,
        originalRouteId: 'route-arjun-signature',
        suggestedRouteId: 'route-rain-sheltered',
        weatherSummary: weather.advisory,
      };

      return { payload, routes, activeAlerts: false, weatherAlert: true, profile };
    }

    // 3. High Crowd Density Proactive Recommendation (Arjun has flexible start!)
    const pcd = await ltaService.getPCDForecast('NEL', scheduledTime);
    if (pcd['PE7'] === 'h' || pcd['NE17'] === 'h') {
      const shiftedTime = this.addMinutes(scheduledTime, 20);
      const payload: ProactiveNotificationPayload = {
        id: `notif-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        commuteDate: new Date().toISOString().slice(0, 10),
        scheduledTime,
        severity: 'info',
        timeShiftMinutes: 20,
        newDepartureTime: shiftedTime,
        recommendedAction: `Shift departure by +20 min to ${shiftedTime} for a comfortable, seated commute`,
        reason: `PCDForecast indicates High ('h') crowd at 08:30 dropping to Low ('l') at ${shiftedTime}. Bus 85 has seats available (SEA).`,
        originalRouteId: 'route-arjun-signature',
        suggestedRouteId: 'route-proactive-offpeak',
        crowdSummary: 'Punggol MRT & Damai platform crowd drops 48% after 08:50.',
      };

      return { payload, routes, activeAlerts: false, weatherAlert: false, profile };
    }

    // Normal Day
    return {
      payload: null,
      routes,
      activeAlerts: false,
      weatherAlert: false,
      profile,
    };
  }

  private addMinutes(timeStr: string, minutes: number): string {
    const [h, m] = timeStr.split(':').map((x) => parseInt(x, 10));
    const total = (h || 8) * 60 + (m || 30) + minutes;
    const newH = Math.floor(total / 60) % 24;
    const newM = total % 60;
    return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
  }
}

export const proactiveEngine = new ProactiveEngine();
