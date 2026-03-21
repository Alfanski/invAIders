/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activities from "../activities.js";
import type * as activityStreams from "../activityStreams.js";
import type * as athleteZones from "../athleteZones.js";
import type * as athletes from "../athletes.js";
import type * as crons from "../crons.js";
import type * as gear from "../gear.js";
import type * as lib_downsample from "../lib/downsample.js";
import type * as lib_stravaApi from "../lib/stravaApi.js";
import type * as strava from "../strava.js";
import type * as stravaPollState from "../stravaPollState.js";
import type * as stravaSync from "../stravaSync.js";
import type * as stravaTokens from "../stravaTokens.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activities: typeof activities;
  activityStreams: typeof activityStreams;
  athleteZones: typeof athleteZones;
  athletes: typeof athletes;
  crons: typeof crons;
  gear: typeof gear;
  "lib/downsample": typeof lib_downsample;
  "lib/stravaApi": typeof lib_stravaApi;
  strava: typeof strava;
  stravaPollState: typeof stravaPollState;
  stravaSync: typeof stravaSync;
  stravaTokens: typeof stravaTokens;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
