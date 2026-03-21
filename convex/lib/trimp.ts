/**
 * Server-side TRIMP (Training Impulse) computation using the Banister formula.
 *
 * Mirrors the client-side DefaultCoachingEngine.computeTrimp() but runs in Convex.
 * Includes heuristic fallbacks for activities missing HR data.
 */

export interface TrimpInput {
  durationMin: number;
  avgHr: number;
  restHr: number;
  maxHr: number;
  sex: 'M' | 'F';
}

const DEFAULT_RESTING_HR_M = 60;
const DEFAULT_RESTING_HR_F = 65;
const DEFAULT_MAX_HR_M = 190;
const DEFAULT_MAX_HR_F = 190;

export function getDefaultRestingHr(sex: 'M' | 'F'): number {
  return sex === 'M' ? DEFAULT_RESTING_HR_M : DEFAULT_RESTING_HR_F;
}

export function getDefaultMaxHr(sex: 'M' | 'F'): number {
  return sex === 'M' ? DEFAULT_MAX_HR_M : DEFAULT_MAX_HR_F;
}

/**
 * Banister TRIMP formula:
 *   TRIMP = duration(min) * HR_ratio * exp(b * HR_ratio)
 * where HR_ratio = (avgHr - restHr) / (maxHr - restHr)
 *       b = 1.92 (male) or 1.67 (female)
 */
export function computeTrimp(input: TrimpInput): number {
  const hrRange = input.maxHr - input.restHr;
  if (hrRange <= 0) return 0;

  const hrRatio = Math.max(0, Math.min(1, (input.avgHr - input.restHr) / hrRange));
  const b = input.sex === 'M' ? 1.92 : 1.67;
  return Math.round(input.durationMin * hrRatio * Math.exp(b * hrRatio) * 10) / 10;
}

interface HeuristicTrimpInput {
  movingTimeSec: number;
  sportType: string;
  distanceMeters: number;
  totalElevationGainM: number;
}

const SPORT_INTENSITY: Record<string, number> = {
  Run: 1.4,
  TrailRun: 1.6,
  VirtualRun: 1.3,
  Walk: 0.7,
  Hike: 0.9,
  Ride: 1.1,
  VirtualRide: 1.0,
  MountainBikeRide: 1.3,
  GravelRide: 1.2,
  EBikeRide: 0.6,
  Swim: 1.3,
  Yoga: 0.4,
  WeightTraining: 0.8,
  Workout: 1.0,
};

/**
 * Improved heuristic TRIMP estimate for activities without HR data.
 * Factors in sport type intensity, duration, and elevation.
 *
 * The base formula is duration(min) * sport_intensity_factor,
 * with an elevation bonus for hilly activities.
 */
export function estimateTrimpWithoutHr(input: HeuristicTrimpInput): number {
  const durationMin = input.movingTimeSec / 60;
  const intensity = SPORT_INTENSITY[input.sportType] ?? 1.0;

  let trimp = durationMin * intensity;

  if (input.totalElevationGainM > 0 && input.distanceMeters > 0) {
    const elevPerKm = (input.totalElevationGainM / input.distanceMeters) * 1000;
    const elevBonus = Math.min(0.3, elevPerKm / 200);
    trimp *= 1 + elevBonus;
  }

  return Math.round(trimp * 10) / 10;
}

/**
 * Compute TRIMP for an activity, choosing Banister or heuristic depending on data.
 * Returns null if insufficient data even for heuristic (should not happen).
 */
export function computeActivityTrimp(
  activity: {
    movingTimeSec: number;
    averageHeartrate?: number;
    maxHeartrate?: number;
    sportType: string;
    distanceMeters: number;
    totalElevationGainM?: number;
    sufferScore?: number;
  },
  athlete: {
    sex?: 'M' | 'F';
    restingHr?: number;
    maxHr?: number;
  },
): number {
  const sex = athlete.sex ?? 'M';

  if (activity.averageHeartrate && activity.averageHeartrate > 0) {
    const maxHr = activity.maxHeartrate ?? athlete.maxHr ?? getDefaultMaxHr(sex);
    const restHr = athlete.restingHr ?? getDefaultRestingHr(sex);

    return computeTrimp({
      durationMin: activity.movingTimeSec / 60,
      avgHr: activity.averageHeartrate,
      restHr,
      maxHr,
      sex,
    });
  }

  if (activity.sufferScore && activity.sufferScore > 0) {
    return activity.sufferScore;
  }

  return estimateTrimpWithoutHr({
    movingTimeSec: activity.movingTimeSec,
    sportType: activity.sportType,
    distanceMeters: activity.distanceMeters,
    totalElevationGainM: activity.totalElevationGainM ?? 0,
  });
}
