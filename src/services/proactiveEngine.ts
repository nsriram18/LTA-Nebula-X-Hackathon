/**
 * ClearPath Proactive Decision Engine
 * Runs 45 minutes prior to commuter's scheduled departure.
 * Orchestrates LTA DataMall (TrainServiceAlerts, PCDForecast, BusArrival, SpeedBands)
 * and data.gov.sg weather to generate actionable, decisive commuter guidance.
 */

import { CommuterProfile, ProactiveEvaluationResult, ScenarioOptions } from '../types';
import { backendApi } from './backendApi';

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
    return backendApi.evaluate(profile, options);
  }
}

export const proactiveEngine = new ProactiveEngine();
