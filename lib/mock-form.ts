import { getCoachingEngine } from '@/lib/coaching/factory';
import { computeRecovery } from '@/lib/form/recovery';
import type { DailyFormPoint, RecoveryState, WeeklyLoad } from '@/types/form';

export interface FormPageData {
  current: DailyFormPoint;
  series: readonly DailyFormPoint[];
  weeklyLoads: readonly WeeklyLoad[];
  recovery: RecoveryState;
  trend7d: { ctl: number; atl: number; tsb: number };
  aiAssessment: string;
  todayRec: string;
}

function generateDailyTrimps(): { trimps: number[]; dates: string[] } {
  const trimps: number[] = [];
  const dates: string[] = [];
  const startDate = new Date(2026, 0, 24);

  const weekPatterns = [
    [65, 95, 0, 80, 45, 130, 0],
    [55, 110, 0, 70, 50, 140, 0],
    [70, 100, 0, 85, 55, 145, 0],
    [60, 115, 0, 75, 40, 150, 0],
    [50, 90, 0, 65, 45, 120, 0],
    [70, 105, 0, 90, 50, 155, 0],
    [60, 120, 0, 80, 40, 160, 0],
    [48, 112, 0, 95, 38, 142, 0],
  ];

  for (let week = 0; week < weekPatterns.length; week++) {
    const pattern = weekPatterns[week] ?? [];
    for (let day = 0; day < 7; day++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + week * 7 + day);
      dates.push(d.toISOString().slice(0, 10));
      const noise = (Math.sin(week * 3.7 + day * 2.1) * 0.15 + 1) * (pattern[day] ?? 0);
      trimps.push(Math.round(noise));
    }
  }

  return { trimps, dates };
}

export function generateMockFormData(): FormPageData {
  const engine = getCoachingEngine();
  const { trimps, dates } = generateDailyTrimps();

  const snapshots = engine.projectSeries(trimps, 45, 50);

  const series: DailyFormPoint[] = snapshots.map((snap, i) => ({
    date: dates[i] ?? '',
    trimp: trimps[i] ?? 0,
    hasActivity: (trimps[i] ?? 0) > 0,
    ctl: Math.round(snap.ctl * 10) / 10,
    atl: Math.round(snap.atl * 10) / 10,
    tsb: Math.round(snap.tsb * 10) / 10,
  }));

  const current = series[series.length - 1] ?? {
    date: '',
    trimp: 0,
    hasActivity: false,
    ctl: 0,
    atl: 0,
    tsb: 0,
  };
  const weekAgo = series[series.length - 8] ?? current;

  const weeklyLoads: WeeklyLoad[] = [];
  for (let w = 0; w < 4; w++) {
    const start = series.length - (4 - w) * 7;
    let weekTrimp = 0;
    for (let d = 0; d < 7; d++) {
      const idx = start + d;
      if (idx >= 0 && idx < series.length) {
        weekTrimp += series[idx]?.trimp ?? 0;
      }
    }
    weeklyLoads.push({
      weekLabel: `W${String(w + 1)}`,
      trimp: Math.round(weekTrimp),
    });
  }

  const recovery = computeRecovery(14, 142);

  return {
    current,
    series,
    weeklyLoads,
    recovery,
    trend7d: {
      ctl: Math.round((current.ctl - weekAgo.ctl) * 10) / 10,
      atl: Math.round((current.atl - weekAgo.atl) * 10) / 10,
      tsb: Math.round((current.tsb - weekAgo.tsb) * 10) / 10,
    },
    aiAssessment:
      'You are carrying moderate fatigue from a strong 8-week training block. ' +
      'CTL has climbed steadily from 45 to 62, indicating real fitness gains. ' +
      "Your acute load spiked after Saturday's long run but will dissipate quickly. " +
      'Current TSB of -9.4 is in the productive fatigue zone -- you are absorbing load well. ' +
      'One more easy day will bring you to balanced state. ' +
      'Consider a lighter week next week to allow supercompensation before your next race block.',
    todayRec:
      'Rest day or very easy 30min Z1 shake-out. Your body is still processing ' +
      "yesterday's long run (142 TRIMP). Focus on hydration, sleep, and mobility work. " +
      'Tomorrow you can resume with an easy 45min Z2 run.',
  };
}
