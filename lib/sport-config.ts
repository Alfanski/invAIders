export type ActivityBucket = 'run' | 'ride' | 'swim' | 'other';

export interface SportConfig {
  speedLabel: string;
  speedUnit: string;
  cadenceLabel: string;
  cadenceUnit: string;
  showPower: boolean;
  showSplits: boolean;
  showElevation: boolean;
  splitLabel: string;
  invertSpeedAxis: boolean;
  formatSpeed: (secPerKm: number) => string;
  formatSpeedShort: (secPerKm: number) => string;
}

function fmtPace(secPerKm: number): string {
  if (secPerKm <= 0) return '--';
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${String(m)}:${s.toString().padStart(2, '0')} /km`;
}

function fmtPaceShort(secPerKm: number): string {
  if (secPerKm <= 0) return '--';
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${String(m)}:${s.toString().padStart(2, '0')}`;
}

function fmtSpeedKmh(secPerKm: number): string {
  if (secPerKm <= 0) return '--';
  const kmh = 3600 / secPerKm;
  return `${kmh.toFixed(1)} km/h`;
}

function fmtSpeedKmhShort(secPerKm: number): string {
  if (secPerKm <= 0) return '--';
  const kmh = 3600 / secPerKm;
  return kmh.toFixed(1);
}

function fmtSwimPace(secPerKm: number): string {
  if (secPerKm <= 0) return '--';
  const secPer100m = secPerKm / 10;
  const m = Math.floor(secPer100m / 60);
  const s = Math.round(secPer100m % 60);
  return `${String(m)}:${s.toString().padStart(2, '0')} /100m`;
}

function fmtSwimPaceShort(secPerKm: number): string {
  if (secPerKm <= 0) return '--';
  const secPer100m = secPerKm / 10;
  const m = Math.floor(secPer100m / 60);
  const s = Math.round(secPer100m % 60);
  return `${String(m)}:${s.toString().padStart(2, '0')}`;
}

const RUN_CONFIG: SportConfig = {
  speedLabel: 'Avg Pace',
  speedUnit: '/km',
  cadenceLabel: 'Cadence',
  cadenceUnit: 'spm',
  showPower: false,
  showSplits: true,
  showElevation: true,
  splitLabel: 'KM',
  invertSpeedAxis: true,
  formatSpeed: fmtPace,
  formatSpeedShort: fmtPaceShort,
};

const RIDE_CONFIG: SportConfig = {
  speedLabel: 'Avg Speed',
  speedUnit: 'km/h',
  cadenceLabel: 'Cadence',
  cadenceUnit: 'rpm',
  showPower: true,
  showSplits: false,
  showElevation: true,
  splitLabel: 'KM',
  invertSpeedAxis: false,
  formatSpeed: fmtSpeedKmh,
  formatSpeedShort: fmtSpeedKmhShort,
};

const SWIM_CONFIG: SportConfig = {
  speedLabel: 'Avg Pace',
  speedUnit: '/100m',
  cadenceLabel: 'Stroke Rate',
  cadenceUnit: 'spm',
  showPower: false,
  showSplits: true,
  showElevation: false,
  splitLabel: 'Lap',
  invertSpeedAxis: true,
  formatSpeed: fmtSwimPace,
  formatSpeedShort: fmtSwimPaceShort,
};

export function getSportConfig(bucket: ActivityBucket): SportConfig {
  switch (bucket) {
    case 'ride':
      return RIDE_CONFIG;
    case 'swim':
      return SWIM_CONFIG;
    case 'run':
    case 'other':
    default:
      return RUN_CONFIG;
  }
}

const RUN_TYPES = new Set(['Run', 'TrailRun', 'VirtualRun', 'Walk', 'Hike']);
const RIDE_TYPES = new Set(['Ride', 'EBikeRide', 'VirtualRide', 'MountainBikeRide', 'GravelRide']);
const SWIM_TYPES = new Set(['Swim']);

export function toBucket(sportType: string): ActivityBucket {
  if (RUN_TYPES.has(sportType)) return 'run';
  if (RIDE_TYPES.has(sportType)) return 'ride';
  if (SWIM_TYPES.has(sportType)) return 'swim';
  return 'other';
}
