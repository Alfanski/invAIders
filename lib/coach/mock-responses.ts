const RESPONSE_POOL: Record<string, readonly string[]> = {
  splits: [
    'Looking at your splits, you ran a solid negative split today. ' +
      'Your first kilometer was conservative at 5:12/km, then you settled into a ' +
      '4:52-4:58 range for the middle section. The last 2km were your fastest at 4:45/km. ' +
      'This is textbook execution -- it means you paced well and had energy reserves for the finish.',
  ],
  pacing: [
    'Your pacing was excellent today. You started controlled and built through the run. ' +
      'Heart rate stayed in Z2-Z3 for the first half, which tells me you resisted the urge ' +
      'to go out too fast. The progression in the second half was smooth, not forced. ' +
      'Keep doing this -- it builds aerobic efficiency better than going out hard and fading.',
  ],
  zones: [
    'You spent about 65% of the run in Zone 2-3, which is your aerobic sweet spot. ' +
      'The remaining 35% crept into Z4 during the faster sections. For a moderate effort run, ' +
      'this distribution is ideal. If this was meant to be easy, try to keep Z4 time under 15%.',
  ],
  overtraining: [
    'Based on your recent data, you are NOT overtraining, but you are carrying productive fatigue. ' +
      'Your TSB is -9.4 which is in the "balanced" zone. Key things I am watching: ' +
      "your resting heart rate trend is stable, your easy pace hasn't slowed, and you are " +
      'hitting your target paces in workouts. All good signs. ' +
      'Just make sure you take that rest day today.',
  ],
  'race-ready': [
    'Right now your CTL is 62 and TSB is -9.4. For a race, you ideally want TSB between +5 and +15. ' +
      'If you taper properly starting now -- reduce volume by 40% while keeping some intensity -- ' +
      'you could be race-ready in about 7-10 days. ' +
      'Your fitness base is strong enough for a solid performance.',
  ],
  injury: [
    'Your acute:chronic ratio is currently 1.15, which is in the "sweet spot" range (0.8-1.3). ' +
      'Your weekly load ramp has been gradual -- no sudden spikes over 10%. ' +
      'The main risk factor I see is consecutive hard days without rest. ' +
      'As long as you maintain at least 2 easy/rest days per week, injury risk stays low.',
  ],
  today: [
    'Today should be a rest day or very easy movement only. ' +
      "Your body is processing yesterday's long run at 142 TRIMP. " +
      'If you must move, do a 20-30 minute walk or very easy jog keeping HR under 130. ' +
      'Focus on sleep (aim for 8+ hours), hydration, and some light stretching or foam rolling.',
  ],
  plan: [
    'Here is what I would suggest for next week based on your current form:\n\n' +
      'Monday: Easy 40min Z2 run\n' +
      'Tuesday: 6x800m intervals at 10K pace with 90s jog recovery\n' +
      'Wednesday: Rest or cross-training\n' +
      'Thursday: Tempo run -- 15min easy, 20min at threshold, 10min easy\n' +
      'Friday: Easy 30min recovery run\n' +
      'Saturday: Long run 90min at easy pace with last 20min at marathon pace\n' +
      'Sunday: Rest\n\n' +
      'This gives you good volume while respecting your current fatigue level.',
  ],
  default: [
    'Based on what I am seeing in your training data, you are building fitness consistently. ' +
      'Your CTL has risen from 45 to 62 over the past 8 weeks, which is a 38% improvement. ' +
      'The key is to keep the balance -- hard sessions need to be hard, easy sessions truly easy. ' +
      'You are doing well at this. Keep up the disciplined approach.',

    'Your training is on a good trajectory. The consistency is what stands out -- ' +
      '5 sessions per week with smart intensity distribution. ' +
      'One thing I would suggest: consider adding a small amount of tempo work mid-week. ' +
      'Your aerobic base is strong, and some threshold work will translate to faster race times.',

    'Looking at your numbers, you are in a productive training phase. ' +
      'Your aerobic capacity is improving -- I can see it in how your heart rate at the same pace ' +
      'has dropped about 3-4 bpm over the past month. ' +
      'The main thing to watch is recovery quality. Make sure your easy days stay easy.',
  ],
};

function matchTopic(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes('split')) return 'splits';
  if (lower.includes('pace') || lower.includes('pacing')) return 'pacing';
  if (lower.includes('zone') || lower.includes('heart rate')) return 'zones';
  if (lower.includes('overtrain') || lower.includes('too much')) return 'overtraining';
  if (lower.includes('race') || lower.includes('ready') || lower.includes('peak'))
    return 'race-ready';
  if (lower.includes('injury') || lower.includes('risk') || lower.includes('hurt')) return 'injury';
  if (lower.includes('plan') || lower.includes('schedule')) return 'plan';
  if (lower.includes('today') || lower.includes('should i do') || lower.includes('what next'))
    return 'today';
  if (lower.includes('week')) return 'plan';
  return 'default';
}

export function generateCoachResponse(message: string): Promise<string> {
  const topic = matchTopic(message);
  const pool = RESPONSE_POOL[topic] ?? RESPONSE_POOL['default'] ?? [];
  const response =
    pool[Math.floor(Math.random() * pool.length)] ??
    'I am here to help with your training. Could you rephrase that?';

  const delay = 800 + Math.random() * 1200;
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(response);
    }, delay);
  });
}
