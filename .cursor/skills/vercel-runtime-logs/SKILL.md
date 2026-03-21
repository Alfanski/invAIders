---
name: vercel-runtime-logs
description: >-
  View runtime function logs from a deployed Vercel application. Use when
  debugging production issues, checking if API routes are being hit, verifying
  serverless function output, or when the user says "check logs", "check Vercel
  logs", "is the backend working", or "check production".
---

# Vercel Runtime Logs

## Key Concepts

Vercel has two distinct log types:

| Log type | What it shows | How to access |
|----------|---------------|---------------|
| **Build logs** | Compilation, dependencies, routes | `vercel inspect <url> --logs` or deployment events API |
| **Runtime logs** | `console.log` from serverless functions, HTTP status, errors | `vercel logs` (live tail) |

The build logs API (`/v2/deployments/{id}/events`) only returns build-time output.
**Runtime/function logs require the `vercel logs` CLI command**, which is a live-streaming tail.

## Viewing Runtime Logs

### Step 1: Tail logs in background, trigger a request, capture output

The `vercel logs` command streams indefinitely. Run it in the background,
trigger a request, wait, then kill and read:

```bash
source .env.local

# Start tailing in background, write to temp file
vercel logs maicoach.vercel.app \
  --token "$VERCEL_TOKEN" \
  --scope lorenzohackathon-invaiders \
  > /tmp/vercel-logs.txt 2>&1 &
LOG_PID=$!

# Wait for stream to connect
sleep 5

# Trigger a request (adjust URL/payload as needed)
curl -s https://maicoach.vercel.app/api/your-route \
  -X POST -H "Content-Type: application/json" \
  -d '{"key":"value"}'

# Wait for logs to arrive
sleep 10

# Stop tailing and read output
kill $LOG_PID 2>/dev/null
wait $LOG_PID 2>/dev/null
cat /tmp/vercel-logs.txt
```

### Step 2: Read the output

Runtime log lines look like:

```
19:41:07.20  info   POST  ---  maicoach.vercel.app  f  /api/ai/coach-chat
----------------------------------------------------------------------
[coach-chat] message="hello" historyLen=0

19:41:08.21  info   POST  ---  maicoach.vercel.app  f  /api/ai/coach-chat
----------------------------------------------------------------------
[coach-chat] Tool call: getRecentActivities({"athleteId":"abc","limit":1})

19:41:08.35  error  POST  ---  maicoach.vercel.app  f  /api/ai/coach-chat
----------------------------------------------------------------------
[coach-chat] Tool getRecentActivities threw: Could not find public function...
```

Each log group shows: timestamp, level (info/error), method, domain, function
path, and the `console.log`/`console.error` output from the serverless function.

## Common Pitfalls

### `vercel logs` hangs with no output

This is normal -- it's a live tail waiting for new requests. You must trigger
a request while it's running to see output. Always use the background +
curl + kill pattern above.

### `vercel inspect --logs` only shows build logs

This is the build log API. It will never show runtime `console.log` output.
Do not use it for debugging serverless function behavior.

### Deployment events API returns only build events

```bash
# This only returns build-time events, NOT runtime logs
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.vercel.com/v2/deployments/{id}/events"
```

All events have `info.type: "build"`. There is no runtime event type in this API.

### Runtime logs API does not exist (as of 2026)

There is no REST API endpoint for querying historical runtime logs.
Options are:
- `vercel logs` CLI (live tail only, no history)
- Vercel dashboard UI (requires browser login)
- Log drains (Pro plan, sends to external service)

## Testing Authenticated Endpoints

To test endpoints that require a session cookie, generate a token locally
using the same `SESSION_SECRET` as production:

```bash
export $(grep SESSION_SECRET .env.local | xargs)

TOKEN=$(node -e "
const crypto = require('node:crypto');
const s = process.env.SESSION_SECRET;
const sign = d => crypto.createHmac('sha256', s).update(d).digest('hex');
const p = { athleteId: 'test', stravaAthleteId: '12345',
            exp: Math.floor(Date.now()/1000) + 3600 };
const e = Buffer.from(JSON.stringify(p)).toString('base64url');
console.log(e + '.' + sign(e));
")

curl -s https://maicoach.vercel.app/api/ai/coach-chat \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Cookie: maicoach_session=$TOKEN" \
  -d '{"message":"test","history":[]}'
```

Note: a fake `athleteId` like "test" will authenticate but return empty data
from Convex queries since no matching records exist.

## Vercel Environment Variables

When adding env vars via CLI, use `printf` (not `echo`) to avoid trailing newlines:

```bash
# Correct -- no trailing newline
printf 'https://example.com/callback' | vercel env add VAR_NAME production \
  --token "$VERCEL_TOKEN" --scope lorenzohackathon-invaiders

# Wrong -- echo adds \n which becomes %0A in URLs
echo "https://example.com/callback" | vercel env add VAR_NAME production ...
```

## Quick Diagnostic Checklist

When a deployed endpoint "doesn't work":

1. **Is the route deployed?** `curl -s <url> -o /dev/null -w "%{http_code}"` -- 404 means not deployed
2. **Is the code current?** `vercel ls --token ... --scope ...` -- check deployment age
3. **Are env vars set?** `vercel env ls --token ... --scope ...` -- check all required vars exist
4. **Does `vercel.json` override env vars?** Check for hardcoded `env` block that overrides dashboard values
5. **Are backend functions deployed?** For Convex: `npx convex deploy` -- "Could not find public function" means functions are missing
6. **What do runtime logs say?** Use the background tail + curl pattern above
