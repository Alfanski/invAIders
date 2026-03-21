import type { StravaStreamSet } from './stravaApi';

export interface DownsampledStreams {
  timeSec: number[];
  distanceM?: number[];
  latlng?: number[][];
  altitudeM?: number[];
  heartrateBpm?: number[];
  cadenceRpm?: number[];
  watts?: number[];
  velocitySmooth?: number[];
  tempC?: number[];
  gradeSmooth?: number[];
  meta: { windowSec: number; pointCount: number };
}

/**
 * Downsample raw Strava streams using rolling window averages.
 *
 * Algorithm (per IP-001d):
 * - Window size = max(30, ceil(durationSec / 500)) seconds
 * - Numeric streams: average of defined values in window
 * - latlng: last point in window (route continuity)
 * - distance: last value in window
 * - time: window start offset
 * - Output: ~500 points max
 */
export function downsampleStreams(streams: StravaStreamSet): DownsampledStreams | null {
  const timeData = streams.time?.data;
  if (!timeData || timeData.length === 0) return null;

  const durationSec = timeData[timeData.length - 1] ?? 0;
  const windowSec = Math.max(30, Math.ceil(durationSec / 500));

  const result: DownsampledStreams = {
    timeSec: [],
    meta: { windowSec, pointCount: 0 },
  };

  const distData = streams.distance?.data;
  const latlngData = streams.latlng?.data;
  const altData = streams.altitude?.data;
  const hrData = streams.heartrate?.data;
  const cadData = streams.cadence?.data;
  const wattsData = streams.watts?.data;
  const velData = streams.velocity_smooth?.data;
  const tempData = streams.temp?.data;
  const gradeData = streams.grade_smooth?.data;

  if (distData) result.distanceM = [];
  if (latlngData) result.latlng = [];
  if (altData) result.altitudeM = [];
  if (hrData) result.heartrateBpm = [];
  if (cadData) result.cadenceRpm = [];
  if (wattsData) result.watts = [];
  if (velData) result.velocitySmooth = [];
  if (tempData) result.tempC = [];
  if (gradeData) result.gradeSmooth = [];

  let windowStart = 0;

  while (windowStart < timeData.length) {
    const windowStartTime = timeData[windowStart] ?? 0;
    const windowEndTime = windowStartTime + windowSec;

    let windowEnd = windowStart;
    while (windowEnd < timeData.length && (timeData[windowEnd] ?? 0) < windowEndTime) {
      windowEnd++;
    }

    if (windowEnd === windowStart) {
      windowEnd = windowStart + 1;
    }

    result.timeSec.push(windowStartTime);

    if (distData && result.distanceM) {
      result.distanceM.push(distData[windowEnd - 1] ?? 0);
    }

    if (latlngData && result.latlng) {
      const lastPt = latlngData[windowEnd - 1];
      result.latlng.push(lastPt ? [lastPt[0], lastPt[1]] : [0, 0]);
    }

    if (altData && result.altitudeM) {
      result.altitudeM.push(avgSlice(altData, windowStart, windowEnd));
    }
    if (hrData && result.heartrateBpm) {
      result.heartrateBpm.push(avgSlice(hrData, windowStart, windowEnd));
    }
    if (cadData && result.cadenceRpm) {
      result.cadenceRpm.push(avgSlice(cadData, windowStart, windowEnd));
    }
    if (wattsData && result.watts) {
      result.watts.push(avgSlice(wattsData, windowStart, windowEnd));
    }
    if (velData && result.velocitySmooth) {
      result.velocitySmooth.push(avgSlice(velData, windowStart, windowEnd));
    }
    if (tempData && result.tempC) {
      result.tempC.push(avgSlice(tempData, windowStart, windowEnd));
    }
    if (gradeData && result.gradeSmooth) {
      result.gradeSmooth.push(avgSlice(gradeData, windowStart, windowEnd));
    }

    windowStart = windowEnd;
  }

  result.meta.pointCount = result.timeSec.length;
  return result;
}

function avgSlice(data: number[], start: number, end: number): number {
  let sum = 0;
  let count = 0;
  for (let i = start; i < end; i++) {
    const val = data[i];
    if (val !== undefined) {
      sum += val;
      count++;
    }
  }
  return count > 0 ? Math.round((sum / count) * 100) / 100 : 0;
}
