# CoachAgent -- Documentation Hub

AI fitness coach powered by Strava. Analyzes workouts, generates dashboards, delivers voice debriefs.

## PRDs & Requirements

| ID                                       | Title          | Phase   | Status |
| ---------------------------------------- | -------------- | ------- | ------ |
| [PRD-001](prd/PRD-001-coachagent-mvp.md) | CoachAgent MVP | Phase 1 | Draft  |

## Implementation Plans

| ID                                          | Title                                     | Status |
| ------------------------------------------- | ----------------------------------------- | ------ |
| [IP-001](prd/IP-001-coachagent-mvp.md)      | MVP Overview (schema, types, build order) | Draft  |
| [IP-001a](prd/IP-001a-scaffolding.md)       | Scaffolding (Next.js, Convex, deps)       | Draft  |
| [IP-001b](prd/IP-001b-strava-oauth.md)      | Strava OAuth Login                        | Draft  |
| [IP-001c](prd/IP-001c-activity-trigger.md)  | Activity Trigger (webhook + polling)      | Draft  |
| [IP-001d](prd/IP-001d-fetch-data.md)        | Fetch Full Activity Data                  | Draft  |
| [IP-001e](prd/IP-001e-ai-analysis.md)       | AI Coaching Analysis                      | Draft  |
| [IP-001f](prd/IP-001f-dashboard-workout.md) | Dashboard -- Last Workout                 | Draft  |
| [IP-001g](prd/IP-001g-dashboard-week.md)    | Dashboard -- Last Week                    | Draft  |
| [IP-001h](prd/IP-001h-dashboard-form.md)    | Dashboard -- Coach Status                 | Draft  |
| [IP-001i](prd/IP-001i-voice-debrief.md)     | Voice Debrief                             | Draft  |

## Design Docs

| ID                                                       | Title                                    | Status |
| -------------------------------------------------------- | ---------------------------------------- | ------ |
| [DD-001](design/DD-001-application-architecture-plan.md) | Application architecture & contract prep | Draft  |
| [DD-002](design/DD-002-frontend-contract-plan.md)        | Frontend contract plan (views A/B/C)     | Draft  |
| [DD-003](design/DD-003-gemini-workout-agent.md)          | LangChain Gemini workout agent           | Draft  |

_Add further design docs as `docs/design/DD-NNN-title.md`._

## Quick Links

| Doc                                           | Purpose                                                     |
| --------------------------------------------- | ----------------------------------------------------------- |
| [AGENTS.md](../AGENTS.md)                     | Cross-tool agent context (architecture, commands, patterns) |
| [tasks/lessons.md](../tasks/lessons.md)       | Corrections and patterns learned                            |
| [tasks/lessons-pr.md](../tasks/lessons-pr.md) | PR review patterns                                          |
| [.cursor/rules/](../.cursor/rules/)           | File-scoped coding rules                                    |
