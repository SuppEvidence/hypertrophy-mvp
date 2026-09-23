# T1–T3 model routing update

This package builds on the corrected T3 installation and includes its supporting
files. It adds model routing and explicit reasoning effort to all five AI calls.
No new dependency, database migration, or API key is required. Keep the existing
`OPENAI_API_KEY` in your local and Vercel environments.

## Routing

| Workload | API model | Reasoning | Request timeout | Maximum generated tokens |
| --- | --- | --- | --- | --- |
| T1: eligible per-set intervention | gpt-5.6-luna | low | 20 seconds | 2,048 |
| T2: pre-workout proposal | gpt-5.6-terra | medium | 45 seconds | 8,192 |
| Supporting completed-workout analysis | gpt-5.6-terra | medium | 60 seconds | 16,384 |
| T3: weekly volume review | gpt-5.6-sol | high | 90 seconds | 24,576 |
| T3: mesocycle/next-block review | gpt-5.6-sol | xhigh | 110 seconds | 32,768 |

The maximum generated-token allowance includes reasoning as well as the final
answer. These are caps, not estimated usage. Request timeouts are also caps, not
promised latency. The actual model workload still needs a live dev smoke test.

The existing deterministic calculations run before each request: eligibility,
equipment increments, performance summaries, recovery/readiness, body composition,
prescribed volume and slot capacity. AI outputs are parsed and then checked by
the existing deterministic validators before changes can be applied.

- T1 runs only after an eligible signal, not after every saved set. Validated
  load, rep and RIR targets may apply automatically to an unstarted set. Set
  removal/stopping still requires approval.
- T2 returns a proposal validated against existing slots and session constraints.
  Session construction changes still require approval.
- T3 automatically assesses evidence. Set-count and volume changes retain the
  corrected T3 previews, staged limits, approval gates and stale-state checks.
- No stronger-model retry or automatic model substitution is introduced. A
  timeout, unavailable model or invalid response cannot bypass a validator.

These calls use the Responses API with structured outputs and `store: false`.
No temperature or Pro mode is added. A higher reasoning level is not a guarantee
of better coaching; compare useful conclusions, latency and actual token usage.

## Apply locally

Stop your dev server with Ctrl+C. Download `T1_T3_model_routing_update.zip` to
Downloads. Run in PowerShell:

```powershell
cd C:\Users\ilpop\Desktop\hypertrophy-mvp
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\T1_T3_model_routing_update.zip" -DestinationPath . -Force
```

The requested routing works with built-in defaults. To make the configuration
explicit, add or update these lines in `.env.local` (also supplied in
`coaching-models.env.example`). Keep any existing database/Auth/API credentials:

```dotenv
OPENAI_T1_MODEL=gpt-5.6-luna
OPENAI_T1_REASONING_EFFORT=low
OPENAI_T2_MODEL=gpt-5.6-terra
OPENAI_T2_REASONING_EFFORT=medium
OPENAI_T3_MODEL=gpt-5.6-sol
OPENAI_T3_REASONING_EFFORT=high
OPENAI_T3_MESO_REASONING_EFFORT=xhigh
```

`OPENAI_MODEL` is no longer consulted by these coaching calls. It can remain for
rollback, but changing it will not change these tiers. To run both T3 reviews at
high effort, set `OPENAI_T3_MESO_REASONING_EFFORT=high`. The literal value
`HIGH/XHIGH` is not valid. Models can be overridden within the verified GPT-5.6
family; unsupported names or blank settings produce a configuration error.

Verify the files and resolved settings:

```powershell
npm run typecheck
node --import tsx scripts/test-coaching-models.ts
node --import tsx scripts/check-coaching-models.ts
node --import tsx scripts/test-t3-volume-coach.ts
node --import tsx scripts/test-pre-workout-coach.ts
node --import tsx scripts/test-workout-coach.ts
npm run build
```

Stop if a check fails. The configuration checker above makes no API calls. To
verify your API project's access to all four distinct model/effort combinations,
run this small **billable** structured-output check:

```powershell
node --import tsx scripts/check-coaching-models.ts --live
```

It sends a fixed connection-check prompt, with no workout data, and makes no
database changes. A successful connection check establishes access and structured
output compatibility, not coaching quality or full-workload latency.

Run `npm run dev`. Check a pre-workout proposal, a completed-workout analysis, and
Volume Coaching. T1 is checked when a real eligible signal occurs; do not invent
training data in your regular log solely to force an intervention.

## Deploy to Vercel

In the project's Environment Variables, add the seven settings above for
Production and the environments you test. Keep `OPENAI_API_KEY` protected as a
secret. These model identifiers and effort settings do not contain credentials.

The code sets route limits to 60 seconds for T1, 75 for pre-workout coaching,
120 for manual workout analysis, 180 for Volume Coaching and Programs, and 300
for the logger's post-workout sequence. Your Vercel project must support those
durations; check its function configuration before deploying. The sequential
workout → volume → next-block API budgets total 260 seconds, leaving 40 seconds
inside the logger's 300-second route budget for database and other work.
Extremely slow database work can still exhaust that margin.

Use the supplied manifest to stage only the files in this update:

```powershell
git diff --stat
git add --pathspec-from-file=MODEL_ROUTING_FILES.txt
git add -- MODEL_ROUTING_FILES.txt
git commit -m "Route T1 T2 T3 coaching to dedicated GPT-5.6 models"
git push origin main
```

Push after setting the Vercel variables so the automatic deployment includes
them. If you change environment variables afterwards, redeploy. No additional
Prisma migration is needed for this update. The original T3 migration in the
cumulative archive is only relevant if T3 has never been migrated.

## Verify operation and costs

Search Vercel Runtime Logs or the dev terminal for `COACHING_AI`. Each parsed
response records workload, model, effort, elapsed time, input/output/reasoning
tokens and cached input tokens. Prompt contents, workout records, user IDs and
API credentials are not included in these new logs. A timeout before a response
is received will follow the existing workload error path rather than produce a
response-usage record. These logs are operational diagnostics, not a durable
billing ledger; check the API usage dashboard for charged usage.

Existing stored analyses keep their original model attribution. New routing
does not automatically regenerate historical analyses or charge for backfilling.

## Rollback

Redeploy the preceding Vercel deployment. Keep the previous `OPENAI_MODEL` value
available if that version needs it. No schema rollback is necessary. Changing
the per-tier variables affects future requests only and requires a dev restart
or production redeployment.

## Official API references

- https://developers.openai.com/api/docs/models/gpt-5.6-luna
- https://developers.openai.com/api/docs/models/gpt-5.6-terra
- https://developers.openai.com/api/docs/models/gpt-5.6-sol
- https://developers.openai.com/api/docs/guides/latest-model?model=gpt-5.6
- https://developers.openai.com/api/docs/guides/reasoning

The model pages document the requested API names, reasoning-effort choices and
structured-output support. Documentation does not establish your API project's
individual access; use the optional connection check for that.
