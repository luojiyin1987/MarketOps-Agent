import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Competitor, Source } from "../domain/index.js";
import {
  SqliteCompetitorRepository,
  SqliteSourceRepository,
} from "./sqlite-repositories.js";
import {
  initializeSqliteDatabase,
  openSqliteDatabase,
  type SqliteDatabase,
} from "./sqlite.js";

describe("SQLite repositories", () => {
  let database: SqliteDatabase;
  let competitors: SqliteCompetitorRepository;
  let sources: SqliteSourceRepository;

  beforeEach(() => {
    database = openSqliteDatabase(":memory:");
    initializeSqliteDatabase(database);
    competitors = new SqliteCompetitorRepository(database);
    sources = new SqliteSourceRepository(database);
  });

  afterEach(() => {
    database.close();
  });

  it("persists and lists competitors with typed dates", () => {
    const competitor: Competitor = {
      id: "competitor-1",
      name: "Example AI",
      website: "https://example.com",
      createdAt: new Date("2026-08-27T12:00:00.000Z"),
    };

    competitors.create(competitor);

    expect(competitors.findById(competitor.id)).toEqual(competitor);
    expect(competitors.list()).toEqual([competitor]);
  });

  it("persists sources under an existing competitor", () => {
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

    expect(sources.findById(source.id)).toEqual(source);
    expect(sources.listByCompetitor(competitor.id)).toEqual([source]);
  });

  it("rejects a source whose competitor does not exist", () => {
    const source: Source = {
      id: "source-1",
      competitorId: "missing",
      type: "website",
      url: "https://example.com",
      createdAt: new Date("2026-08-27T12:00:00.000Z"),
    };

    expect(() => sources.create(source)).toThrow();
  });
});
