import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  StravaApiError,
  StravaRateLimitError,
  deriveActivityBucket,
  fetchActivitiesList,
  fetchActivityDetail,
  fetchActivityLaps,
  fetchActivityStreams,
  fetchAthleteZones,
  fetchGearDetail,
  refreshStravaToken,
  stravaGet,
} from './stravaApi';

// ---------------------------------------------------------------------------
// deriveActivityBucket
// ---------------------------------------------------------------------------

describe('deriveActivityBucket', () => {
  it.each([
    ['Run', 'run'],
    ['TrailRun', 'run'],
    ['VirtualRun', 'run'],
    ['Walk', 'run'],
  ] as const)('returns "run" for %s', (sportType, expected) => {
    expect(deriveActivityBucket(sportType)).toBe(expected);
  });

  it.each([
    ['Ride', 'ride'],
    ['EBikeRide', 'ride'],
    ['VirtualRide', 'ride'],
    ['MountainBikeRide', 'ride'],
    ['GravelRide', 'ride'],
  ] as const)('returns "ride" for %s', (sportType, expected) => {
    expect(deriveActivityBucket(sportType)).toBe(expected);
  });

  it.each(['Swim', 'Hike', 'Workout', 'Yoga', 'Kayaking', 'UnknownType'])(
    'returns "other" for %s',
    (sportType) => {
      expect(deriveActivityBucket(sportType)).toBe('other');
    },
  );
});

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

describe('StravaApiError', () => {
  it('stores status, path, and message', () => {
    const err = new StravaApiError(404, '/activities/123', 'Not found');
    expect(err.status).toBe(404);
    expect(err.path).toBe('/activities/123');
    expect(err.message).toBe('Not found');
    expect(err.name).toBe('StravaApiError');
  });

  it('is an instance of Error', () => {
    const err = new StravaApiError(500, '/test', 'fail');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('StravaRateLimitError', () => {
  it('sets status to 429 and stores retry delay', () => {
    const err = new StravaRateLimitError('/activities', 120);
    expect(err.status).toBe(429);
    expect(err.retryAfterSec).toBe(120);
    expect(err.name).toBe('StravaRateLimitError');
    expect(err.message).toContain('retry after 120s');
  });

  it('extends StravaApiError', () => {
    const err = new StravaRateLimitError('/test', 60);
    expect(err).toBeInstanceOf(StravaApiError);
  });
});

// ---------------------------------------------------------------------------
// Fetch mock helpers
// ---------------------------------------------------------------------------

function mockFetchOk(body: unknown): void {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

function mockFetchError(status: number, body: string, headers?: Record<string, string>): void {
  const init: ResponseInit = headers ? { status, headers } : { status };
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(body, init));
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// stravaGet
// ---------------------------------------------------------------------------

describe('stravaGet', () => {
  it('sends Authorization header and returns parsed JSON', async () => {
    const payload = { id: 1, name: 'Morning Run' };
    mockFetchOk(payload);

    const result = await stravaGet<{ id: number; name: string }>('tok_123', '/activities/1');

    expect(result).toEqual(payload);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://www.strava.com/api/v3/activities/1',
      expect.objectContaining({
        headers: { Authorization: 'Bearer tok_123' },
      }),
    );
  });

  it('throws StravaRateLimitError on 429 with Retry-After header', async () => {
    mockFetchError(429, 'rate limited', { 'Retry-After': '90' });

    await expect(stravaGet('tok', '/test')).rejects.toThrow(StravaRateLimitError);
  });

  it('defaults Retry-After to 60 when header missing', async () => {
    mockFetchError(429, 'rate limited');

    try {
      await stravaGet('tok', '/test');
    } catch (err) {
      expect(err).toBeInstanceOf(StravaRateLimitError);
      expect((err as StravaRateLimitError).retryAfterSec).toBe(60);
    }
  });

  it('throws StravaApiError on non-ok responses', async () => {
    mockFetchError(404, 'not found');

    await expect(stravaGet('tok', '/activities/999')).rejects.toThrow(StravaApiError);
    try {
      mockFetchError(404, 'not found');
      await stravaGet('tok', '/activities/999');
    } catch (err) {
      expect(err).toBeInstanceOf(StravaApiError);
      expect((err as StravaApiError).status).toBe(404);
    }
  });
});

// ---------------------------------------------------------------------------
// Endpoint wrappers
// ---------------------------------------------------------------------------

describe('fetchActivitiesList', () => {
  it('builds correct URL with defaults', async () => {
    mockFetchOk([]);

    await fetchActivitiesList('tok');

    const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(url).toContain('/athlete/activities?');
    expect(url).toContain('page=1');
    expect(url).toContain('per_page=200');
  });

  it('passes after parameter when provided', async () => {
    mockFetchOk([]);

    await fetchActivitiesList('tok', { after: 1700000000 });

    const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(url).toContain('after=1700000000');
  });

  it('overrides page and perPage', async () => {
    mockFetchOk([]);

    await fetchActivitiesList('tok', { page: 3, perPage: 50 });

    const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(url).toContain('page=3');
    expect(url).toContain('per_page=50');
  });
});

describe('fetchActivityDetail', () => {
  it('calls /activities/{id}', async () => {
    const activity = { id: 42, name: 'Test' };
    mockFetchOk(activity);

    const result = await fetchActivityDetail('tok', '42');

    expect(result).toEqual(activity);
    const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(url).toContain('/activities/42');
  });
});

describe('fetchActivityStreams', () => {
  it('calls streams endpoint and reshapes array into keyed object', async () => {
    const rawStreams = [
      {
        type: 'time',
        data: [0, 30, 60],
        series_type: 'time',
        original_size: 3,
        resolution: 'high',
      },
      {
        type: 'heartrate',
        data: [150, 155, 160],
        series_type: 'heartrate',
        original_size: 3,
        resolution: 'high',
      },
    ];
    mockFetchOk(rawStreams);

    const result = await fetchActivityStreams('tok', '42');

    expect(result.time?.data).toEqual([0, 30, 60]);
    expect(result.heartrate?.data).toEqual([150, 155, 160]);
    expect(result.altitude).toBeUndefined();
  });
});

describe('fetchActivityLaps', () => {
  it('calls /activities/{id}/laps', async () => {
    const laps = [{ id: 1, name: 'Lap 1', distance: 1000 }];
    mockFetchOk(laps);

    const result = await fetchActivityLaps('tok', '42');
    expect(result).toEqual(laps);
  });
});

describe('fetchAthleteZones', () => {
  it('calls /athlete/zones', async () => {
    const zones = { heart_rate: { custom_zones: false, zones: [{ min: 0, max: 120 }] } };
    mockFetchOk(zones);

    const result = await fetchAthleteZones('tok');
    expect(result.heart_rate?.zones).toHaveLength(1);
  });
});

describe('fetchGearDetail', () => {
  it('calls /gear/{id}', async () => {
    const gear = { id: 'g12345', name: 'Pegasus 40', distance: 500000 };
    mockFetchOk(gear);

    const result = await fetchGearDetail('tok', 'g12345');
    expect(result.name).toBe('Pegasus 40');
  });
});

// ---------------------------------------------------------------------------
// refreshStravaToken
// ---------------------------------------------------------------------------

describe('refreshStravaToken', () => {
  it('POSTs to token URL and returns parsed response', async () => {
    const tokenResp = {
      token_type: 'Bearer',
      expires_at: 1700000000,
      expires_in: 3600,
      refresh_token: 'new_refresh',
      access_token: 'new_access',
    };
    mockFetchOk(tokenResp);

    const result = await refreshStravaToken('cid', 'csecret', 'old_refresh');

    expect(result.access_token).toBe('new_access');
    expect(result.refresh_token).toBe('new_refresh');

    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe('https://www.strava.com/oauth/token');
    expect(init.method).toBe('POST');
    const body = init.body as URLSearchParams;
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('client_id')).toBe('cid');
    expect(body.get('refresh_token')).toBe('old_refresh');
  });

  it('throws on non-ok response', async () => {
    mockFetchError(401, 'Unauthorized');

    await expect(refreshStravaToken('cid', 'csecret', 'bad_token')).rejects.toThrow(
      /Strava token refresh failed/,
    );
  });
});
