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
import type * as aiAnalysis from "../aiAnalysis.js";
import type * as analyses from "../analyses.js";
import type * as athleteZones from "../athleteZones.js";
import type * as athletes from "../athletes.js";
import type * as crons from "../crons.js";
import type * as formAssessments from "../formAssessments.js";
import type * as formSnapshots from "../formSnapshots.js";
import type * as gear from "../gear.js";
import type * as http from "../http.js";
import type * as lib_downsample from "../lib/downsample.js";
import type * as lib_formMetrics from "../lib/formMetrics.js";
import type * as lib_gemini from "../lib/gemini.js";
import type * as lib_stravaApi from "../lib/stravaApi.js";
import type * as lib_streamStats from "../lib/streamStats.js";
import type * as lib_trimp from "../lib/trimp.js";
import type * as pipelineActions from "../pipelineActions.js";
import type * as strava from "../strava.js";
import type * as stravaPollState from "../stravaPollState.js";
import type * as stravaSync from "../stravaSync.js";
import type * as stravaTokens from "../stravaTokens.js";
import type * as weeklyAnalyses from "../weeklyAnalyses.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activities: typeof activities;
  activityStreams: typeof activityStreams;
  aiAnalysis: typeof aiAnalysis;
  analyses: typeof analyses;
  athleteZones: typeof athleteZones;
  athletes: typeof athletes;
  crons: typeof crons;
  formAssessments: typeof formAssessments;
  formSnapshots: typeof formSnapshots;
  gear: typeof gear;
  http: typeof http;
  "lib/downsample": typeof lib_downsample;
  "lib/formMetrics": typeof lib_formMetrics;
  "lib/gemini": typeof lib_gemini;
  "lib/stravaApi": typeof lib_stravaApi;
  "lib/streamStats": typeof lib_streamStats;
  "lib/trimp": typeof lib_trimp;
  pipelineActions: typeof pipelineActions;
  strava: typeof strava;
  stravaPollState: typeof stravaPollState;
  stravaSync: typeof stravaSync;
  stravaTokens: typeof stravaTokens;
  weeklyAnalyses: typeof weeklyAnalyses;
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
