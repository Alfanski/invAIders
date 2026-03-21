---
name: convex-delete-documents
description: >-
  Delete documents from the Convex database by table, date, or ID. Requires a
  deploy key. Use when the user says "delete from convex", "remove activities",
  "delete workouts", "clean up convex data", "purge records", or needs to remove
  specific documents from the production or dev Convex deployment.
---

# Delete Convex Documents

## When to Use

- Remove test or duplicate activities from the database
- Clean up data after a bad sync or backfill
- Delete documents matching a date range or filter condition
- Any bulk or selective document deletion from Convex tables

## Prerequisites

A **Convex deploy key** is required. The deploy key grants admin access to push
temporary mutations and call them. Format:

```
prod:<slug>|<base64-token>
```

If the user doesn't provide one, ask them. They can find it in the Convex
dashboard under Project Settings > Deploy Key.

## How It Works

Convex has no built-in public delete API. The workflow is:

1. Add a temporary public `deleteByIds` mutation to the target table's file
2. Deploy it using `CONVEX_DEPLOY_KEY`
3. Query for the documents to delete, confirm with the user
4. Call the mutation to delete them
5. Remove the temporary mutation and redeploy clean code

## Step-by-Step

### Step 1: Identify what to delete

Query the production database to find matching documents. Example for activities
by date:

```typescript
import { ConvexHttpClient } from 'convex/browser';
import { api } from './convex/_generated/api.js';

const PROD = 'https://effervescent-starling-354.eu-west-1.convex.cloud';
const convex = new ConvexHttpClient(PROD);

const activities = await convex.query(api.activities.listRecentForAthlete, {
  athleteId: '<ATHLETE_ID>' as any,
  limit: 200,
});

const toDelete = activities.filter(a => a.startDate.startsWith('2026-03-21'));
console.log(`Found ${toDelete.length} to delete:`);
for (const a of toDelete) {
  console.log(`  ${a.startDate.slice(0,16)} | ${a.sportType} | ${a.name} | ${a._id}`);
}
```

Adjust the filter for the target date, sport type, or any other field.

### Step 2: Add temporary mutation

Add a public `deleteByIds` mutation to the relevant Convex file (e.g.
`convex/activities.ts`). Import `mutation` alongside existing imports:

```typescript
import { internalMutation, internalQuery, mutation, query } from './_generated/server';
```

Append the temporary mutation at the end of the file:

```typescript
// TEMPORARY: delete documents by ID list -- remove after use
export const deleteByIds = mutation({
  args: { ids: v.array(v.id('activities')) },
  handler: async (ctx, args) => {
    for (const id of args.ids) {
      await ctx.db.delete(id);
    }
    return { deleted: args.ids.length };
  },
});
```

Change the table name in `v.id('activities')` if targeting a different table
(e.g. `'analyses'`, `'activityStreams'`).

### Step 3: Deploy with deploy key

```bash
CONVEX_DEPLOY_KEY="<DEPLOY_KEY>" npx convex deploy --cmd 'echo skip'
```

The `--cmd 'echo skip'` avoids running a full Next.js build.

### Step 4: Delete documents

Write a small script (e.g. `scripts/delete-temp.ts`) that calls the mutation:

```typescript
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api.js';

async function main(): Promise<void> {
  const convex = new ConvexHttpClient('<CONVEX_URL>');

  const idsToDelete = [
    // paste IDs from Step 1
  ];

  const result = await convex.mutation(api.activities.deleteByIds, {
    ids: idsToDelete as any,
  });
  console.log('Deleted:', result);
}

main();
```

Run it:

```bash
npx tsx scripts/delete-temp.ts
```

### Step 5: Clean up

1. Remove the temporary `deleteByIds` mutation from the Convex file
2. Remove the `mutation` import if it was added
3. Redeploy clean code:

```bash
CONVEX_DEPLOY_KEY="<DEPLOY_KEY>" npx convex deploy --cmd 'echo skip'
```

4. Delete the temporary script (`scripts/delete-temp.ts`)

## Deleting Related Data

Activities may have related documents in other tables. To fully clean up,
repeat steps 2-5 for each related table:

| Table | File | ID type | Lookup |
|-------|------|---------|--------|
| `activities` | `convex/activities.ts` | `v.id('activities')` | by date, athlete, sport |
| `activityStreams` | `convex/activityStreams.ts` | `v.id('activityStreams')` | by `activityId` field |
| `analyses` | `convex/analyses.ts` | `v.id('analyses')` | by `activityId` field |
| `voiceDebriefs` | `convex/voiceDebriefs.ts` | `v.id('voiceDebriefs')` | by `activityId` field |

## Deployments

| Environment | Convex URL | Deploy key env var |
|-------------|-----------|-------------------|
| **Production** | `https://effervescent-starling-354.eu-west-1.convex.cloud` | `CONVEX_DEPLOY_KEY` |
| Dev | `https://fine-ibex-73.eu-west-1.convex.cloud` | `CONVEX_DEPLOY_KEY` |

## Troubleshooting

**"You don't have access to the selected project"**: You're using the CLI
without a deploy key. Set `CONVEX_DEPLOY_KEY` as shown in Step 3.

**"Top-level await not supported"**: Don't use `npx tsx -e` with top-level
`await`. Create a `.ts` file with an `async function main()` wrapper instead.

**Mutation not found after deploy**: Make sure the mutation is exported as
`export const deleteByIds` (not `export default`) and the deploy succeeded
without errors.
