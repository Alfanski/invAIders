import type { CoachingEngine } from '@/lib/domain/coaching-engine';
import type { MeasurementSystem, UnitConverter } from '@/lib/domain/unit-converter';

import { DefaultCoachingEngine } from './default-coaching-engine';
import { ImperialUnitConverter } from './imperial-unit-converter';
import { MetricUnitConverter } from './metric-unit-converter';

let metricInstance: MetricUnitConverter | undefined;
let imperialInstance: ImperialUnitConverter | undefined;
let engineInstance: DefaultCoachingEngine | undefined;

export function getUnitConverter(system: MeasurementSystem): UnitConverter {
  if (system === 'imperial') {
    imperialInstance ??= new ImperialUnitConverter();
    return imperialInstance;
  }

  metricInstance ??= new MetricUnitConverter();
  return metricInstance;
}

export function getCoachingEngine(): CoachingEngine {
  engineInstance ??= new DefaultCoachingEngine();
  return engineInstance;
}
