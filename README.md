# MarketOps Agent

MarketOps Agent is an evidence-driven market intelligence project for monitoring competitors, detecting meaningful changes, and eventually turning findings into reviewable operational actions.

## Why this project starts small

The first milestone intentionally uses TypeScript and SQLite to validate the domain and workflow before introducing distributed infrastructure. The project should earn additional complexity through real requirements rather than adopting queues, Redis, PostgreSQL, multi-agent orchestration, or MCP up front.

The core design rule is:

> Deterministic detection first, probabilistic interpretation second.

Fetching, snapshotting, hashing, and diffing should remain ordinary program logic. LLMs should be introduced only where probabilistic interpretation is useful, such as judging business significance or proposing an action.

## Initial domain

The core model contains:

- `Competitor` — an organization or product being monitored.
- `Source` — a monitored website, pricing page, blog, GitHub repository, or feed.
- `Snapshot` — versioned source content captured at a point in time.
- `Change` — a deterministic difference between two snapshots.
- `ChangeAnalysis` — the durable relevant/irrelevant decision for a change.
- `Finding` — a structured interpretation of a relevant change with severity and confidence.
- `ResearchRun` — the lifecycle of one monitoring execution.

## Development

Requirements:

- Node.js 22+
- pnpm

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm dev -- --help
```

SQLite is the initial persistence technology. Set `MARKETOPS_DB` to override the default `marketops.db` path.

The CLI automatically loads an optional root `.env` file with Node's built-in environment-file support. Copy `.env.example` for local development; already-defined process environment variables remain suitable for CI and production deployment.

```bash
cp .env.example .env
```

## Current CLI

Add and list competitors:

```bash
pnpm dev -- competitor add --name "Example AI" --website https://example.com
pnpm dev -- competitor list
```

Use the returned competitor ID to add monitored sources:

```bash
pnpm dev -- source add \
  --competitor <competitor-id> \
  --type pricing \
  --url https://example.com/pricing

pnpm dev -- source list --competitor <competitor-id>
```

Capture and inspect versioned source snapshots:

```bash
pnpm dev -- snapshot capture --source <source-id>
pnpm dev -- snapshot list --source <source-id>
```

Snapshot capture uses Node's HTTP fetch, normalizes line endings and trailing whitespace, and stores a SHA-256 hash with the normalized content. A capture whose hash matches the immediately previous snapshot is reported as `unchanged` and does not create another row.

Deduplication is intentionally based only on the latest snapshot. If a source changes `A -> B -> A`, the second `A` is stored because the return to earlier content is itself an observed change.

Detect and inspect deterministic changes between adjacent snapshots:

```bash
pnpm dev -- change detect --source <source-id>
pnpm dev -- change list --source <source-id>
```

Change detection is idempotent. Each current snapshot can have at most one persisted `Change`, so rerunning detection reports existing changes instead of duplicating them. A reversion such as `A -> B -> A` still produces two changes because each transition ends at a different snapshot.

The current diff is deliberately small and deterministic: it removes the common line prefix and suffix, then records the changed middle region with `-` and `+` lines. A richer diff algorithm can replace this later without involving an LLM.

Analyze a deterministic change into a structured finding with DeepSeek:

```bash
DEEPSEEK_API_KEY=<your-key>
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

Put those values in `.env` or export them through the process environment, then run:

```bash
pnpm dev -- finding analyze --change <change-id>
pnpm dev -- finding list --competitor <competitor-id>
```

The DeepSeek adapter uses JSON Output and validates the returned object again with Zod before any `Finding` is persisted. Source diffs are treated as untrusted evidence in the prompt and are never treated as instructions. The first classification path explicitly disables model thinking to keep routine monitoring latency and cost bounded; the model and base URL remain configurable.

Analysis decisions are durable by `change_id`. Relevant changes point to persisted findings; irrelevant changes store their reason and confidence separately. Re-running analysis therefore does not call the model again for either outcome.

Run the current end-to-end monitoring workflow for every source belonging to a competitor:

```bash
pnpm dev -- research run --competitor <competitor-id>
pnpm dev -- research list --competitor <competitor-id>
```

A research run performs:

```text
capture snapshot
  -> detect deterministic changes
  -> analyze unclassified changes
  -> persist findings / irrelevant decisions
```

Each source is isolated from the others. If all sources succeed the run is `succeeded`; if some fail it is `partial`; if every configured source fails it is `failed`. The sub-operations are idempotent, so starting a later run after a failure does not duplicate snapshots, changes, findings, or completed LLM classifications.

This milestone deliberately does not claim same-run checkpoint/resume. Per-source execution checkpoints, automatic retries, and retry scheduling should be introduced together once recurring runs make their required semantics concrete.

Supported source types are `website`, `pricing`, `blog`, `github`, and `rss`.

Persistence is accessed through repository interfaces. SQLite is the first implementation rather than a domain dependency, so a later move to PostgreSQL does not require rewriting the domain or CLI workflow.

## Roadmap

The first usable workflow is deliberately narrow:

```text
competitor
  -> source
  -> snapshot
  -> deterministic change
  -> structured finding
```

Near-term milestones:

1. Persist competitors and sources. ✅
2. Capture deduplicated source snapshots. ✅
3. Detect deterministic changes between snapshots. ✅
4. Analyze meaningful changes into validated findings. ✅
5. Orchestrate an end-to-end research run. ✅

Distributed workers, richer action workflows, human approval, MCP, RAG, and a web UI are later concerns.
