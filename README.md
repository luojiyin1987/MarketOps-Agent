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
- `Finding` — a structured interpretation of a change with severity and confidence.
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
4. Analyze meaningful changes into validated findings.
5. Orchestrate an end-to-end research run.

Distributed workers, richer action workflows, human approval, MCP, RAG, and a web UI are later concerns.
