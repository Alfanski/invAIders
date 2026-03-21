import { v } from 'convex/values';

import { internal } from './_generated/api';
import { internalAction } from './_generated/server';
import { refreshStravaToken } from './lib/stravaApi';

const TOKEN_REFRESH_BUFFER_SEC = 300;

/**
 * Resolves an athlete by Strava ID, returns a valid access token
 * (refreshing if needed), plus athlete metadata for the n8n pipeline.
 */
export const getTokenForPipeline = internalAction({
  args: {
    stravaAthleteId: v.string(),
  },
  handler: async (ctx, args) => {
    const athlete = await ctx.runQuery(internal.athletes.getByStravaAthleteId, {
      stravaAthleteId: args.stravaAthleteId,
    });
    if (!athlete) {
      throw new Error(`No athlete found for Strava ID ${args.stravaAthleteId}`);
    }

    const tokenDoc = await ctx.runQuery(internal.stravaTokens.getForAthlete, {
      athleteId: athlete._id,
    });
    if (!tokenDoc) {
      throw new Error(`No Strava tokens found for athlete ${athlete._id}`);
    }

    const now = Math.floor(Date.now() / 1000);
    let accessToken = tokenDoc.accessToken;

    if (tokenDoc.expiresAt <= now + TOKEN_REFRESH_BUFFER_SEC) {
      const clientId = process.env['STRAVA_CLIENT_ID'];
      const clientSecret = process.env['STRAVA_CLIENT_SECRET'];
      if (!clientId || !clientSecret) {
        throw new Error('STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET must be set in Convex env vars');
      }

      const refreshed = await refreshStravaToken(clientId, clientSecret, tokenDoc.refreshToken);

      await ctx.runMutation(internal.stravaTokens.upsertConnection, {
        athleteId: athlete._id,
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token,
        expiresAt: refreshed.expires_at,
      });

      accessToken = refreshed.access_token;
    }

    return {
      accessToken,
      athleteId: athlete._id,
      athleteName: [athlete.firstName, athlete.lastName].filter(Boolean).join(' ') || 'Athlete',
    };
  },
});
