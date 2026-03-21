import { describe, expect, it } from 'vitest';

import { generateCoachResponse } from './mock-responses';

describe('generateCoachResponse', () => {
  it('returns a non-empty string', async () => {
    const response = await generateCoachResponse('How am I doing?');
    expect(response.length).toBeGreaterThan(0);
  });

  it('returns split-related response for split questions', async () => {
    const response = await generateCoachResponse('Can you analyze my splits?');
    expect(response.toLowerCase()).toMatch(/split|kilometer|km/);
  });

  it('returns pacing response for pace questions', async () => {
    const response = await generateCoachResponse('How was my pacing today?');
    expect(response.toLowerCase()).toMatch(/pac|controlled|built/);
  });

  it('returns zone response for heart rate questions', async () => {
    const response = await generateCoachResponse('What heart rate zones was I in?');
    expect(response.toLowerCase()).toMatch(/zone|z[1-5]/i);
  });

  it('returns overtraining response for overtraining questions', async () => {
    const response = await generateCoachResponse('Am I overtraining?');
    expect(response.toLowerCase()).toMatch(/overtrain|tsb|fatigue/);
  });

  it('returns race response for race readiness questions', async () => {
    const response = await generateCoachResponse('Am I race ready?');
    expect(response.toLowerCase()).toMatch(/race|ctl|taper/);
  });

  it('returns injury response for injury questions', async () => {
    const response = await generateCoachResponse('Is there injury risk?');
    expect(response.toLowerCase()).toMatch(/injury|risk|ratio/);
  });

  it('returns plan response for planning questions', async () => {
    const response = await generateCoachResponse('Can you plan my next week?');
    expect(response.toLowerCase()).toMatch(/monday|week|session/);
  });

  it('returns today response for today questions', async () => {
    const response = await generateCoachResponse('What should I do today?');
    expect(response.toLowerCase()).toMatch(/today|rest|easy/);
  });

  it('returns a default response for unmatched input', async () => {
    const response = await generateCoachResponse('tell me something random');
    expect(response.length).toBeGreaterThan(0);
  });
});
