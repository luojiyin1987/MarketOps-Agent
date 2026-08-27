import type {
  CompetitorRepository,
  SnapshotRepository,
  SourceRepository,
} from "../application/repositories.js";
import {
  CompetitorSchema,
  SnapshotSchema,
  SourceSchema,
  type Competitor,
  type Snapshot,
  type Source,
} from "../domain/index.js";
import type { SqliteDatabase } from "./sqlite.js";

type CompetitorRow = {
  id: string;
  name: string;
  website: string;
  created_at: string;
};

type SourceRow = {
  id: string;
  competitor_id: string;
  type: Source["type"];
  url: string;
  created_at: string;
};

type SnapshotRow = {
  id: string;
  source_id: string;
  content: string;
  content_hash: string;
  fetched_at: string;
};

function mapCompetitor(row: CompetitorRow): Competitor {
  return CompetitorSchema.parse({
    id: row.id,
    name: row.name,
    website: row.website,
    createdAt: new Date(row.created_at),
  });
}

function mapSource(row: SourceRow): Source {
  return SourceSchema.parse({
    id: row.id,
    competitorId: row.competitor_id,
    type: row.type,
    url: row.url,
    createdAt: new Date(row.created_at),
  });
}

function mapSnapshot(row: SnapshotRow): Snapshot {
  return SnapshotSchema.parse({
    id: row.id,
    sourceId: row.source_id,
    content: row.content,
    contentHash: row.content_hash,
    fetchedAt: new Date(row.fetched_at),
  });
}

export class SqliteCompetitorRepository implements CompetitorRepository {
  constructor(private readonly database: SqliteDatabase) {}

  create(competitor: Competitor): void {
    const value = CompetitorSchema.parse(competitor);
    this.database
      .prepare(
        `INSERT INTO competitors (id, name, website, created_at)
         VALUES (@id, @name, @website, @createdAt)`,
      )
      .run({
        id: value.id,
        name: value.name,
        website: value.website,
        createdAt: value.createdAt.toISOString(),
      });
  }

  findById(id: string): Competitor | undefined {
    const row = this.database
      .prepare("SELECT id, name, website, created_at FROM competitors WHERE id = ?")
      .get(id) as CompetitorRow | undefined;
    return row === undefined ? undefined : mapCompetitor(row);
  }

  list(): Competitor[] {
    const rows = this.database
      .prepare("SELECT id, name, website, created_at FROM competitors ORDER BY created_at, id")
      .all() as CompetitorRow[];
    return rows.map(mapCompetitor);
  }
}

export class SqliteSourceRepository implements SourceRepository {
  constructor(private readonly database: SqliteDatabase) {}

  create(source: Source): void {
    const value = SourceSchema.parse(source);
    this.database
      .prepare(
        `INSERT INTO sources (id, competitor_id, type, url, created_at)
         VALUES (@id, @competitorId, @type, @url, @createdAt)`,
      )
      .run({
        id: value.id,
        competitorId: value.competitorId,
        type: value.type,
        url: value.url,
        createdAt: value.createdAt.toISOString(),
      });
  }

  findById(id: string): Source | undefined {
    const row = this.database
      .prepare("SELECT id, competitor_id, type, url, created_at FROM sources WHERE id = ?")
      .get(id) as SourceRow | undefined;
    return row === undefined ? undefined : mapSource(row);
  }

  listByCompetitor(competitorId: string): Source[] {
    const rows = this.database
      .prepare(
        `SELECT id, competitor_id, type, url, created_at
         FROM sources
         WHERE competitor_id = ?
         ORDER BY created_at, id`,
      )
      .all(competitorId) as SourceRow[];
    return rows.map(mapSource);
  }
}

export class SqliteSnapshotRepository implements SnapshotRepository {
  constructor(private readonly database: SqliteDatabase) {}

  create(snapshot: Snapshot): void {
    const value = SnapshotSchema.parse(snapshot);
    this.database
      .prepare(
        `INSERT INTO snapshots (id, source_id, content, content_hash, fetched_at)
         VALUES (@id, @sourceId, @content, @contentHash, @fetchedAt)`,
      )
      .run({
        id: value.id,
        sourceId: value.sourceId,
        content: value.content,
        contentHash: value.contentHash,
        fetchedAt: value.fetchedAt.toISOString(),
      });
  }

  findLatestBySource(sourceId: string): Snapshot | undefined {
    const row = this.database
      .prepare(
        `SELECT id, source_id, content, content_hash, fetched_at
         FROM snapshots
         WHERE source_id = ?
         ORDER BY fetched_at DESC, id DESC
         LIMIT 1`,
      )
      .get(sourceId) as SnapshotRow | undefined;
    return row === undefined ? undefined : mapSnapshot(row);
  }

  listBySource(sourceId: string): Snapshot[] {
    const rows = this.database
      .prepare(
        `SELECT id, source_id, content, content_hash, fetched_at
         FROM snapshots
         WHERE source_id = ?
         ORDER BY fetched_at, id`,
      )
      .all(sourceId) as SnapshotRow[];
    return rows.map(mapSnapshot);
  }
}
