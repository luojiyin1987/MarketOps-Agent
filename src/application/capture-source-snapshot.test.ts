import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  captureSourceSnapshot,
  normalizeSourceContent,
  type SourceFetcher,
} from "./capture-source-snapshot.js";
import type { Competitor, Source } from "../domain/index.js";
import {
  SqliteCompetitorRepository,
  SqliteSnapshotRepository,
  SqliteSourceRepository,
} from "../infrastructure/sqlite-repositories.js";
import {
  initializeSqliteDatabase,
  openSqliteDatabase,
  type SqliteDatabase,
} from "../infrastructure/sqlite.js";

class SequenceFetcher implements SourceFetcher {
  constructor(private readonly values: string[]) {}

  async fetch(): Promise<string> {
    const value = this.values.shift();
    if (value === undefined) {
      throw new Error("No fake response remaining");
    }
    return value;
  }
}

describe("captureSourceSnapshot", () => {
  let database: SqliteDatabase;
  let competitors: SqliteCompetitorRepository;
  let sources: SqliteSourceRepository;
  let snapshots: SqliteSnapshotRepository;

  beforeEach(() => {
    database = openSqliteDatabase(":memory:");
    initializeSqliteDatabase(database);
    competitors = new SqliteCompetitorRepository(database);
    sources = new SqliteSourceRepository(database);
    snapshots = new SqliteSnapshotRepository(database);

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

  it("normalizes line endings and insignificant trailing whitespace", () => {
    expect(normalizeSourceContent("alpha  \r\n\r\n\r\nbeta\t\r\n")).toBe("alpha\n\nbeta");
  });

  it("deduplicates only the latest content while preserving later reversions", async () => {
    const fetcher = new SequenceFetcher([
      "alpha  \r\n\r\n\r\nbeta\r\n",
      "alpha\n\nbeta\n",
      "alpha\n\nbeta changed\n",
      "alpha\n\nbeta\n",
    ]);
    const ids = ["snapshot-1", "snapshot-2", "snapshot-3"];
    const times = [
      new Date("2026-08-27T12:02:00.000Z"),
      new Date("2026-08-27T12:03:00.000Z"),
      new Date("2026-08-27T12:04:00.000Z"),
    ];
    const createId = (): string => {
      const id = ids.shift();
      if (id === undefined) throw new Error("No fake ID remaining");
      return id;
    };
    const now = (): Date => {
      const time = times.shift();
      if (time === undefined) throw new Error("No fake timestamp remaining");
      return time;
    };

    const dependencies = {
      sourceRepository: sources,
      snapshotRepository: snapshots,
      fetcher,
      createId,
      now,
    };

    const first = await captureSourceSnapshot("source-1", dependencies);
    const unchanged = await captureSourceSnapshot("source-1", dependencies);
    const changed = await captureSourceSnapshot("source-1", dependencies);
    const reverted = await captureSourceSnapshot("source-1", dependencies);

    expect(first.status).toBe("created");
    expect(unchanged.status).toBe("unchanged");
    expect(unchanged.snapshot.id).toBe("snapshot-1");
    expect(changed.status).toBe("created");
    expect(reverted.status).toBe("created");
    expect(snapshots.listBySource("source-1").map((snapshot) => snapshot.id)).toEqual([
      "snapshot-1",
      "snapshot-2",
      "snapshot-3",
    ]);
  });
});
