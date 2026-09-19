/**
 * ClearPath Proactive Decision Engine
 * Runs on demand in the browser; Cloud Scheduler invokes the protected backend
 * endpoint at the configured pre-departure lead time.
 * Orchestrates LTA DataMall (TrainServiceAlerts, PCDForecast, BusArrival, SpeedBands)
 * and data.gov.sg weather to generate actionable, decisive commuter guidance.
 */

import { CommuterProfile, ProactiveEvaluationResult, ScenarioOptions } from '../types';
import { backendApi } from './backendApi';

class ProactiveEngine {
  /**
   * Run the proactive evaluation for Arjun's commute
   * The same evaluation is used by the scheduled backend endpoint.
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
