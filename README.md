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

SQLite is the initial persistence technology. The bootstrap only establishes the database adapter; repositories and schema migrations will be added with the first persistence feature.

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

1. Persist competitors and sources.
2. Capture deduplicated source snapshots.
3. Detect deterministic changes between snapshots.
4. Analyze meaningful changes into validated findings.
5. Orchestrate an end-to-end research run.

Distributed workers, richer action workflows, human approval, MCP, RAG, and a web UI are later concerns.
