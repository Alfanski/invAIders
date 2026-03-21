/**
 * Server-side CTL/ATL/TSB (Fitness-Fatigue model) computation.
 *
 * Mirrors lib/coaching/default-coaching-engine.ts but runs in Convex actions/mutations.
 */

export interface FormSnapshot {
  date: string;
  ctl: number;
  atl: number;
  tsb: number;
  acwr: number;
  dailyTrimp: number;
}

const CTL_DECAY = 1 / 42;
const ATL_DECAY = 1 / 7;

/**
 * Project CTL/ATL/TSB series from daily TRIMP values.
 * Each entry in dailyTrimps corresponds to a consecutive day.
 */
export function projectFormSeries(
  dailyTrimps: { date: string; trimp: number }[],
  priorCtl = 0,
  priorAtl = 0,
): FormSnapshot[] {
  let ctl = priorCtl;
  let atl = priorAtl;

  return dailyTrimps.map(({ date, trimp }) => {
    ctl = ctl + CTL_DECAY * (trimp - ctl);
    atl = atl + ATL_DECAY * (trimp - atl);
    const acwr = ctl > 0 ? Math.round((atl / ctl) * 100) / 100 : 0;
    return {
      date,
      ctl: Math.round(ctl * 10) / 10,
      atl: Math.round(atl * 10) / 10,
      tsb: Math.round((ctl - atl) * 10) / 10,
      acwr,
      dailyTrimp: trimp,
    };
  });
}

export type FormZone = 'overreaching' | 'fatigued' | 'balanced' | 'race_ready' | 'fresh';

export function classifyForm(tsb: number): FormZone {
  if (tsb < -30) return 'overreaching';
  if (tsb < -10) return 'fatigued';
  if (tsb < 5) return 'balanced';
  if (tsb < 15) return 'race_ready';
  return 'fresh';
}

/**
 * Build daily TRIMP map from activities sorted by start date.
 * Groups activities by date and sums their TRIMP values.
 * Fills gaps (rest days) with 0.
 */
export function buildDailyTrimps(
  activities: { startDate: string; trimp?: number; movingTimeSec: number }[],
): { date: string; trimp: number }[] {
  if (activities.length === 0) return [];

  const sorted = [...activities].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
  );

  const first = sorted[0];
  if (!first) return [];

  const trimpByDate = new Map<string, number>();
  for (const a of sorted) {
    const dateKey = a.startDate.slice(0, 10);
    const trimp = a.trimp ?? Math.round((a.movingTimeSec / 60) * 1.2);
    trimpByDate.set(dateKey, (trimpByDate.get(dateKey) ?? 0) + trimp);
  }

  const earliest = new Date(first.startDate);
  earliest.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const result: { date: string; trimp: number }[] = [];
  const cursor = new Date(earliest);

  while (cursor <= today) {
    const key = cursor.toISOString().slice(0, 10);
    result.push({ date: key, trimp: trimpByDate.get(key) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  return result;
}
