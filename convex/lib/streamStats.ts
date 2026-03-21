/**
 * Pre-compute min/avg/max statistics for each stream metric.
 * Called at ingest time to avoid recomputing on every dashboard load.
 */

export interface StreamStatEntry {
  min: number;
  avg: number;
  max: number;
}

export interface StreamStats {
  heartrateBpm?: StreamStatEntry;
  velocitySmooth?: StreamStatEntry;
  altitudeM?: StreamStatEntry;
  cadenceRpm?: StreamStatEntry;
  watts?: StreamStatEntry;
  tempC?: StreamStatEntry;
  gradeSmooth?: StreamStatEntry;
}

function computeStats(data: number[]): StreamStatEntry | null {
  if (data.length === 0) return null;

  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let count = 0;

  for (const val of data) {
    if (Number.isFinite(val)) {
      if (val < min) min = val;
      if (val > max) max = val;
      sum += val;
      count++;
    }
  }

  if (count === 0) return null;

  return {
    min: Math.round(min * 100) / 100,
    avg: Math.round((sum / count) * 100) / 100,
    max: Math.round(max * 100) / 100,
  };
}

export function computeStreamStats(streams: {
  heartrateBpm?: number[];
  velocitySmooth?: number[];
  altitudeM?: number[];
  cadenceRpm?: number[];
  watts?: number[];
  tempC?: number[];
  gradeSmooth?: number[];
}): StreamStats {
  const stats: StreamStats = {};

  if (streams.heartrateBpm) {
    const s = computeStats(streams.heartrateBpm);
    if (s) stats.heartrateBpm = s;
  }
  if (streams.velocitySmooth) {
    const s = computeStats(streams.velocitySmooth);
    if (s) stats.velocitySmooth = s;
  }
  if (streams.altitudeM) {
    const s = computeStats(streams.altitudeM);
    if (s) stats.altitudeM = s;
  }
  if (streams.cadenceRpm) {
    const s = computeStats(streams.cadenceRpm);
    if (s) stats.cadenceRpm = s;
  }
  if (streams.watts) {
    const s = computeStats(streams.watts);
    if (s) stats.watts = s;
  }
  if (streams.tempC) {
    const s = computeStats(streams.tempC);
    if (s) stats.tempC = s;
  }
  if (streams.gradeSmooth) {
    const s = computeStats(streams.gradeSmooth);
    if (s) stats.gradeSmooth = s;
  }

  return stats;
}
