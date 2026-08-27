import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Competitor, Source } from "../domain/index.js";
import {
  SqliteChangeAnalysisRepository,
  SqliteChangeRepository,
  SqliteCompetitorRepository,
  SqliteFindingRepository,
  SqliteResearchRunRepository,
  SqliteSnapshotRepository,
  SqliteSourceRepository,
} from "../infrastructure/sqlite-repositories.js";
import {
  initializeSqliteDatabase,
  openSqliteDatabase,
  type SqliteDatabase,
} from "../infrastructure/sqlite.js";
import type {
  FindingAnalysis,
  FindingAnalysisInput,
  FindingAnalyzer,
} from "./analyze-change.js";
import type { SourceFetcher } from "./capture-source-snapshot.js";
import { runResearch } from "./run-research.js";

class SequenceFetcher implements SourceFetcher {
  constructor(private readonly values: string[]) {}

  async fetch(): Promise<string> {
    const value = this.values.shift();
    if (value === undefined) throw new Error("No fake response remaining");
    return value;
  }
}

class SourceAwareFetcher implements SourceFetcher {
  async fetch(source: Source): Promise<string> {
    if (source.id === "source-2") throw new Error("synthetic fetch failure");
    return "stable content";
  }
}

class FakeAnalyzer implements FindingAnalyzer {
  calls = 0;

  constructor(private readonly result: FindingAnalysis) {}

  async analyze(_input: FindingAnalysisInput): Promise<FindingAnalysis> {
    this.calls += 1;
    return this.result;
  }
}

describe("runResearch", () => {
  let database: SqliteDatabase;
  let competitors: SqliteCompetitorRepository;
  let sources: SqliteSourceRepository;
  let snapshots: SqliteSnapshotRepository;
  let changes: SqliteChangeRepository;
  let findings: SqliteFindingRepository;
  let analyses: SqliteChangeAnalysisRepository;
  let runs: SqliteResearchRunRepository;

  beforeEach(() => {
    database = openSqliteDatabase(":memory:");
    initializeSqliteDatabase(database);
    competitors = new SqliteCompetitorRepository(database);
    sources = new SqliteSourceRepository(database);
    snapshots = new SqliteSnapshotRepository(database);
    changes = new SqliteChangeRepository(database);
    findings = new SqliteFindingRepository(database);
    analyses = new SqliteChangeAnalysisRepository(database);
    runs = new SqliteResearchRunRepository(database);

    const competitor: Competitor = {
      id: "competitor-1",
      name: "Example AI",
      website: "https://example.com",
      createdAt: new Date("2026-08-27T12:00:00.000Z"),
    };
    const source: Source = {
      id: "source-1",
      competitorId: competitor.id,
      type: "pricing",
      url: "https://example.com/pricing",
      createdAt: new Date("2026-08-27T12:01:00.000Z"),
    };
    competitors.create(competitor);
    sources.create(source);
  });

  afterEach(() => {
    database.close();
  });

  function dependencies(fetcher: SourceFetcher, analyzer: FindingAnalyzer) {
    return {
      competitorRepository: competitors,
      sourceRepository: sources,
      snapshotRepository: snapshots,
      changeRepository: changes,
      findingRepository: findings,
      changeAnalysisRepository: analyses,
      researchRunRepository: runs,
      fetcher,
      analyzer,
    };
  }

  it("persists irrelevant analysis so later runs do not call the model again", async () => {
    const fetcher = new SequenceFetcher(["price: 59", "price: 49", "price: 49"]);
    const analyzer = new FakeAnalyzer({
      relevant: false,
      reason: "Minor copy-level pricing display change",
      confidence: 0.91,
    });

    const first = await runResearch("competitor-1", dependencies(fetcher, analyzer));
    expect(first.run.status).toBe("succeeded");
    expect(first.snapshotsCreated).toBe(1);
    expect(first.changesCreated).toBe(0);
    expect(analyzer.calls).toBe(0);

    const second = await runResearch("competitor-1", dependencies(fetcher, analyzer));
    expect(second.run.status).toBe("succeeded");
    expect(second.snapshotsCreated).toBe(1);
    expect(second.changesCreated).toBe(1);
    expect(second.irrelevant).toBe(1);
    expect(analyzer.calls).toBe(1);

    const change = changes.listBySource("source-1")[0];
    expect(change).toBeDefined();
    expect(change === undefined ? undefined : analyses.findByChangeId(change.id)).toMatchObject({
      relevant: false,
      reason: "Minor copy-level pricing display change",
      confidence: 0.91,
    });

    const third = await runResearch("competitor-1", dependencies(fetcher, analyzer));
    expect(third.run.status).toBe("succeeded");
    expect(third.snapshotsUnchanged).toBe(1);
    expect(third.changesCreated).toBe(0);
    expect(third.irrelevant).toBe(1);
    expect(analyzer.calls).toBe(1);

    expect(runs.listByCompetitor("competitor-1").map((run) => run.status)).toEqual([
      "succeeded",
      "succeeded",
      "succeeded",
    ]);
  });

  it("marks a run partial when one source fails and another succeeds", async () => {
    sources.create({
      id: "source-2",
      competitorId: "competitor-1",
      type: "blog",
      url: "https://example.com/blog",
      createdAt: new Date("2026-08-27T12:02:00.000Z"),
    });
    const analyzer = new FakeAnalyzer({
      relevant: true,
      type: "content_change",
      severity: "low",
      summary: "content changed",
      impact: "low impact",
      confidence: 0.8,
    });

    const result = await runResearch(
      "competitor-1",
      dependencies(new SourceAwareFetcher(), analyzer),
    );

    expect(result.run.status).toBe("partial");
    expect(result.snapshotsCreated).toBe(1);
    expect(result.failures).toEqual([
      { sourceId: "source-2", message: "synthetic fetch failure" },
    ]);
    expect(analyzer.calls).toBe(0);
  });

  it("rejects an unknown competitor before creating a run", async () => {
    const analyzer = new FakeAnalyzer({
      relevant: false,
      reason: "irrelevant",
      confidence: 1,
    });

    await expect(
      runResearch("missing", dependencies(new SequenceFetcher([]), analyzer)),
    ).rejects.toThrow("Unknown competitor: missing");
    expect(runs.listByCompetitor("missing")).toEqual([]);
  });
});
