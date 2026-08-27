import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Change, Competitor, Snapshot, Source } from "../domain/index.js";
import {
  SqliteChangeRepository,
  SqliteCompetitorRepository,
  SqliteFindingRepository,
  SqliteSnapshotRepository,
  SqliteSourceRepository,
} from "../infrastructure/sqlite-repositories.js";
import {
  initializeSqliteDatabase,
  openSqliteDatabase,
  type SqliteDatabase,
} from "../infrastructure/sqlite.js";
import {
  analyzeChange,
  type FindingAnalysis,
  type FindingAnalysisInput,
  type FindingAnalyzer,
} from "./analyze-change.js";

class FakeAnalyzer implements FindingAnalyzer {
  calls = 0;

  constructor(private readonly result: FindingAnalysis) {}

  async analyze(_input: FindingAnalysisInput): Promise<FindingAnalysis> {
    this.calls += 1;
    return this.result;
  }
}

describe("analyzeChange", () => {
  let database: SqliteDatabase;
  let competitors: SqliteCompetitorRepository;
  let sources: SqliteSourceRepository;
  let snapshots: SqliteSnapshotRepository;
  let changes: SqliteChangeRepository;
  let findings: SqliteFindingRepository;

  beforeEach(() => {
    database = openSqliteDatabase(":memory:");
    initializeSqliteDatabase(database);
    competitors = new SqliteCompetitorRepository(database);
    sources = new SqliteSourceRepository(database);
    snapshots = new SqliteSnapshotRepository(database);
    changes = new SqliteChangeRepository(database);
    findings = new SqliteFindingRepository(database);

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
    const previous: Snapshot = {
      id: "snapshot-1",
      sourceId: source.id,
      content: "price: 59",
      contentHash: "hash-a",
      fetchedAt: new Date("2026-08-27T12:02:00.000Z"),
    };
    const current: Snapshot = {
      id: "snapshot-2",
      sourceId: source.id,
      content: "price: 49",
      contentHash: "hash-b",
      fetchedAt: new Date("2026-08-27T12:03:00.000Z"),
    };
    const change: Change = {
      id: "change-1",
      sourceId: source.id,
      previousSnapshotId: previous.id,
      currentSnapshotId: current.id,
      diff: "@@ -1,1 +1,1 @@\n-price: 59\n+price: 49",
      detectedAt: new Date("2026-08-27T12:04:00.000Z"),
    };

    competitors.create(competitor);
    sources.create(source);
    snapshots.create(previous);
    snapshots.create(current);
    changes.create(change);
  });

  afterEach(() => {
    database.close();
  });

  it("persists a validated relevant finding and reuses it on rerun", async () => {
    const analyzer = new FakeAnalyzer({
      relevant: true,
      type: "pricing_change",
      severity: "high",
      summary: "The Pro plan price decreased from $59 to $49.",
      impact: "This may increase pricing pressure.",
      confidence: 0.95,
    });
    const dependencies = {
      changeRepository: changes,
      sourceRepository: sources,
      competitorRepository: competitors,
      findingRepository: findings,
      analyzer,
      createId: () => "finding-1",
      now: () => new Date("2026-08-27T12:05:00.000Z"),
    };

    const first = await analyzeChange("change-1", dependencies);
    const second = await analyzeChange("change-1", dependencies);

    expect(first.status).toBe("created");
    expect(second.status).toBe("existing");
    expect(analyzer.calls).toBe(1);
    expect(findings.listByCompetitor("competitor-1")).toHaveLength(1);
    expect(findings.findByChangeId("change-1")).toMatchObject({
      id: "finding-1",
      type: "pricing_change",
      severity: "high",
      confidence: 0.95,
    });
  });

  it("does not persist an irrelevant change", async () => {
    const analyzer = new FakeAnalyzer({
      relevant: false,
      reason: "Only page chrome changed.",
      confidence: 0.9,
    });

    const result = await analyzeChange("change-1", {
      changeRepository: changes,
      sourceRepository: sources,
      competitorRepository: competitors,
      findingRepository: findings,
      analyzer,
    });

    expect(result).toEqual({
      status: "irrelevant",
      analysis: {
        relevant: false,
        reason: "Only page chrome changed.",
        confidence: 0.9,
      },
    });
    expect(findings.listByCompetitor("competitor-1")).toEqual([]);
  });

  it("rejects an unknown change before calling the model", async () => {
    const analyzer = new FakeAnalyzer({
      relevant: false,
      reason: "irrelevant",
      confidence: 1,
    });

    await expect(
      analyzeChange("missing", {
        changeRepository: changes,
        sourceRepository: sources,
        competitorRepository: competitors,
        findingRepository: findings,
        analyzer,
      }),
    ).rejects.toThrow("Unknown change: missing");
    expect(analyzer.calls).toBe(0);
  });
});
