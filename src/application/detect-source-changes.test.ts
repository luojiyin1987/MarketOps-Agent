import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Competitor, Snapshot, Source } from "../domain/index.js";
import {
  SqliteChangeRepository,
  SqliteCompetitorRepository,
  SqliteSnapshotRepository,
  SqliteSourceRepository,
} from "../infrastructure/sqlite-repositories.js";
import {
  initializeSqliteDatabase,
  openSqliteDatabase,
  type SqliteDatabase,
} from "../infrastructure/sqlite.js";
import { buildDeterministicDiff, detectSourceChanges } from "./detect-source-changes.js";

describe("deterministic source changes", () => {
  let database: SqliteDatabase;
  let competitors: SqliteCompetitorRepository;
  let sources: SqliteSourceRepository;
  let snapshots: SqliteSnapshotRepository;
  let changes: SqliteChangeRepository;

  beforeEach(() => {
    database = openSqliteDatabase(":memory:");
    initializeSqliteDatabase(database);
    competitors = new SqliteCompetitorRepository(database);
    sources = new SqliteSourceRepository(database);
    snapshots = new SqliteSnapshotRepository(database);
    changes = new SqliteChangeRepository(database);

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

  function addSnapshot(id: string, content: string, contentHash: string, fetchedAt: string): void {
    const snapshot: Snapshot = {
      id,
      sourceId: "source-1",
      content,
      contentHash,
      fetchedAt: new Date(fetchedAt),
    };
    snapshots.create(snapshot);
  }

  it("builds a stable line-oriented diff around the changed region", () => {
    expect(
      buildDeterministicDiff(
        "header\nprice: 59\nfooter",
        "header\nprice: 49\nfooter",
      ),
    ).toBe("@@ -2,1 +2,1 @@\n-price: 59\n+price: 49");

    expect(buildDeterministicDiff("alpha\nomega", "alpha\nbeta\nomega")).toBe(
      "@@ -2,0 +2,1 @@\n+beta",
    );
  });

  it("creates one change for each changed adjacent snapshot pair and preserves reversions", () => {
    addSnapshot("snapshot-1", "header\nprice: 59\nfooter", "hash-a", "2026-08-27T12:02:00.000Z");
    addSnapshot("snapshot-2", "header\nprice: 49\nfooter", "hash-b", "2026-08-27T12:03:00.000Z");
    addSnapshot("snapshot-3", "header\nprice: 59\nfooter", "hash-a", "2026-08-27T12:04:00.000Z");

    const ids = ["change-1", "change-2"];
    const times = [
      new Date("2026-08-27T12:05:00.000Z"),
      new Date("2026-08-27T12:06:00.000Z"),
    ];

    const result = detectSourceChanges("source-1", {
      sourceRepository: sources,
      snapshotRepository: snapshots,
      changeRepository: changes,
      createId: () => {
        const id = ids.shift();
        if (id === undefined) throw new Error("No fake ID remaining");
        return id;
      },
      now: () => {
        const time = times.shift();
        if (time === undefined) throw new Error("No fake timestamp remaining");
        return time;
      },
    });

    expect(result.created).toHaveLength(2);
    expect(result.existing).toHaveLength(0);
    expect(result.skippedUnchangedPairs).toBe(0);
    expect(changes.listBySource("source-1").map((change) => change.diff)).toEqual([
      "@@ -2,1 +2,1 @@\n-price: 59\n+price: 49",
      "@@ -2,1 +2,1 @@\n-price: 49\n+price: 59",
    ]);
  });

  it("is idempotent when detection is repeated", () => {
    addSnapshot("snapshot-1", "alpha", "hash-a", "2026-08-27T12:02:00.000Z");
    addSnapshot("snapshot-2", "beta", "hash-b", "2026-08-27T12:03:00.000Z");

    detectSourceChanges("source-1", {
      sourceRepository: sources,
      snapshotRepository: snapshots,
      changeRepository: changes,
      createId: () => "change-1",
      now: () => new Date("2026-08-27T12:04:00.000Z"),
    });

    const repeated = detectSourceChanges("source-1", {
      sourceRepository: sources,
      snapshotRepository: snapshots,
      changeRepository: changes,
      createId: () => {
        throw new Error("Detection attempted to create a duplicate change");
      },
    });

    expect(repeated.created).toHaveLength(0);
    expect(repeated.existing).toHaveLength(1);
    expect(changes.listBySource("source-1")).toHaveLength(1);
  });

  it("defensively ignores identical adjacent snapshots", () => {
    addSnapshot("snapshot-1", "alpha", "same-hash", "2026-08-27T12:02:00.000Z");
    addSnapshot("snapshot-2", "alpha", "same-hash", "2026-08-27T12:03:00.000Z");

    const result = detectSourceChanges("source-1", {
      sourceRepository: sources,
      snapshotRepository: snapshots,
      changeRepository: changes,
    });

    expect(result.created).toHaveLength(0);
    expect(result.existing).toHaveLength(0);
    expect(result.skippedUnchangedPairs).toBe(1);
  });

  it("rejects detection for an unknown source", () => {
    expect(() =>
      detectSourceChanges("missing", {
        sourceRepository: sources,
        snapshotRepository: snapshots,
        changeRepository: changes,
      }),
    ).toThrow("Source not found: missing");
  });
});
