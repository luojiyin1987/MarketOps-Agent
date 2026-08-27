import type {
  ChangeAnalysisRepository,
  ChangeRepository,
  CompetitorRepository,
  FindingRepository,
  ResearchRunRepository,
  SnapshotRepository,
  SourceRepository,
} from "../application/repositories.js";
import {
  ChangeAnalysisSchema,
  ChangeSchema,
  CompetitorSchema,
  FindingSchema,
  ResearchRunSchema,
  SnapshotSchema,
  SourceSchema,
  type Change,
  type ChangeAnalysis,
  type Competitor,
  type Finding,
  type ResearchRun,
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

type ChangeRow = {
  id: string;
  source_id: string;
  previous_snapshot_id: string;
  current_snapshot_id: string;
  diff: string;
  detected_at: string;
};

type FindingRow = {
  id: string;
  competitor_id: string;
  change_id: string;
  type: Finding["type"];
  severity: Finding["severity"];
  summary: string;
  impact: string;
  confidence: number;
  created_at: string;
};

type ChangeAnalysisRow = {
  change_id: string;
  relevant: 0 | 1;
  reason: string | null;
  confidence: number;
  analyzed_at: string;
};

type ResearchRunRow = {
  id: string;
  competitor_id: string;
  status: ResearchRun["status"];
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
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

function mapChange(row: ChangeRow): Change {
  return ChangeSchema.parse({
    id: row.id,
    sourceId: row.source_id,
    previousSnapshotId: row.previous_snapshot_id,
    currentSnapshotId: row.current_snapshot_id,
    diff: row.diff,
    detectedAt: new Date(row.detected_at),
  });
}

function mapFinding(row: FindingRow): Finding {
  return FindingSchema.parse({
    id: row.id,
    competitorId: row.competitor_id,
    changeId: row.change_id,
    type: row.type,
    severity: row.severity,
    summary: row.summary,
    impact: row.impact,
    confidence: row.confidence,
    createdAt: new Date(row.created_at),
  });
}

function mapChangeAnalysis(row: ChangeAnalysisRow): ChangeAnalysis {
  return ChangeAnalysisSchema.parse(
    row.relevant === 1
      ? {
          changeId: row.change_id,
          relevant: true,
          confidence: row.confidence,
          analyzedAt: new Date(row.analyzed_at),
        }
      : {
          changeId: row.change_id,
          relevant: false,
          reason: row.reason,
          confidence: row.confidence,
          analyzedAt: new Date(row.analyzed_at),
        },
  );
}

function mapResearchRun(row: ResearchRunRow): ResearchRun {
  return ResearchRunSchema.parse({
    id: row.id,
    competitorId: row.competitor_id,
    status: row.status,
    startedAt: row.started_at === null ? null : new Date(row.started_at),
    completedAt: row.completed_at === null ? null : new Date(row.completed_at),
    createdAt: new Date(row.created_at),
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

export class SqliteChangeRepository implements ChangeRepository {
  constructor(private readonly database: SqliteDatabase) {}

  create(change: Change): void {
    const value = ChangeSchema.parse(change);
    this.database
      .prepare(
        `INSERT INTO changes (
           id, source_id, previous_snapshot_id, current_snapshot_id, diff, detected_at
         ) VALUES (
           @id, @sourceId, @previousSnapshotId, @currentSnapshotId, @diff, @detectedAt
         )`,
      )
      .run({
        id: value.id,
        sourceId: value.sourceId,
        previousSnapshotId: value.previousSnapshotId,
        currentSnapshotId: value.currentSnapshotId,
        diff: value.diff,
        detectedAt: value.detectedAt.toISOString(),
      });
  }

  findById(id: string): Change | undefined {
    const row = this.database
      .prepare(
        `SELECT id, source_id, previous_snapshot_id, current_snapshot_id, diff, detected_at
         FROM changes
         WHERE id = ?`,
      )
      .get(id) as ChangeRow | undefined;
    return row === undefined ? undefined : mapChange(row);
  }

  findByCurrentSnapshotId(currentSnapshotId: string): Change | undefined {
    const row = this.database
      .prepare(
        `SELECT id, source_id, previous_snapshot_id, current_snapshot_id, diff, detected_at
         FROM changes
         WHERE current_snapshot_id = ?`,
      )
      .get(currentSnapshotId) as ChangeRow | undefined;
    return row === undefined ? undefined : mapChange(row);
  }

  listBySource(sourceId: string): Change[] {
    const rows = this.database
      .prepare(
        `SELECT id, source_id, previous_snapshot_id, current_snapshot_id, diff, detected_at
         FROM changes
         WHERE source_id = ?
         ORDER BY detected_at, id`,
      )
      .all(sourceId) as ChangeRow[];
    return rows.map(mapChange);
  }
}

export class SqliteFindingRepository implements FindingRepository {
  constructor(private readonly database: SqliteDatabase) {}

  create(finding: Finding): void {
    const value = FindingSchema.parse(finding);
    this.database
      .prepare(
        `INSERT INTO findings (
           id, competitor_id, change_id, type, severity, summary, impact, confidence, created_at
         ) VALUES (
           @id, @competitorId, @changeId, @type, @severity, @summary, @impact, @confidence, @createdAt
         )`,
      )
      .run({
        id: value.id,
        competitorId: value.competitorId,
        changeId: value.changeId,
        type: value.type,
        severity: value.severity,
        summary: value.summary,
        impact: value.impact,
        confidence: value.confidence,
        createdAt: value.createdAt.toISOString(),
      });
  }

  findByChangeId(changeId: string): Finding | undefined {
    const row = this.database
      .prepare(
        `SELECT id, competitor_id, change_id, type, severity, summary, impact, confidence, created_at
         FROM findings
         WHERE change_id = ?`,
      )
      .get(changeId) as FindingRow | undefined;
    return row === undefined ? undefined : mapFinding(row);
  }

  listByCompetitor(competitorId: string): Finding[] {
    const rows = this.database
      .prepare(
        `SELECT id, competitor_id, change_id, type, severity, summary, impact, confidence, created_at
         FROM findings
         WHERE competitor_id = ?
         ORDER BY created_at, id`,
      )
      .all(competitorId) as FindingRow[];
    return rows.map(mapFinding);
  }
}

export class SqliteChangeAnalysisRepository implements ChangeAnalysisRepository {
  constructor(private readonly database: SqliteDatabase) {}

  create(analysis: ChangeAnalysis): void {
    const value = ChangeAnalysisSchema.parse(analysis);
    this.database
      .prepare(
        `INSERT INTO change_analyses (change_id, relevant, reason, confidence, analyzed_at)
         VALUES (@changeId, @relevant, @reason, @confidence, @analyzedAt)`,
      )
      .run({
        changeId: value.changeId,
        relevant: value.relevant ? 1 : 0,
        reason: value.relevant ? null : value.reason,
        confidence: value.confidence,
        analyzedAt: value.analyzedAt.toISOString(),
      });
  }

  findByChangeId(changeId: string): ChangeAnalysis | undefined {
    const row = this.database
      .prepare(
        `SELECT change_id, relevant, reason, confidence, analyzed_at
         FROM change_analyses
         WHERE change_id = ?`,
      )
      .get(changeId) as ChangeAnalysisRow | undefined;
    return row === undefined ? undefined : mapChangeAnalysis(row);
  }
}

export class SqliteResearchRunRepository implements ResearchRunRepository {
  constructor(private readonly database: SqliteDatabase) {}

  create(run: ResearchRun): void {
    const value = ResearchRunSchema.parse(run);
    this.database
      .prepare(
        `INSERT INTO research_runs (
           id, competitor_id, status, started_at, completed_at, created_at
         ) VALUES (
           @id, @competitorId, @status, @startedAt, @completedAt, @createdAt
         )`,
      )
      .run({
        id: value.id,
        competitorId: value.competitorId,
        status: value.status,
        startedAt: value.startedAt?.toISOString() ?? null,
        completedAt: value.completedAt?.toISOString() ?? null,
        createdAt: value.createdAt.toISOString(),
      });
  }

  update(run: ResearchRun): void {
    const value = ResearchRunSchema.parse(run);
    const result = this.database
      .prepare(
        `UPDATE research_runs
         SET status = @status, started_at = @startedAt, completed_at = @completedAt
         WHERE id = @id`,
      )
      .run({
        id: value.id,
        status: value.status,
        startedAt: value.startedAt?.toISOString() ?? null,
        completedAt: value.completedAt?.toISOString() ?? null,
      });
    if (result.changes !== 1) {
      throw new Error(`Unknown research run: ${value.id}`);
    }
  }

  findById(id: string): ResearchRun | undefined {
    const row = this.database
      .prepare(
        `SELECT id, competitor_id, status, started_at, completed_at, created_at
         FROM research_runs
         WHERE id = ?`,
      )
      .get(id) as ResearchRunRow | undefined;
    return row === undefined ? undefined : mapResearchRun(row);
  }

  listByCompetitor(competitorId: string): ResearchRun[] {
    const rows = this.database
      .prepare(
        `SELECT id, competitor_id, status, started_at, completed_at, created_at
         FROM research_runs
         WHERE competitor_id = ?
         ORDER BY created_at, id`,
      )
      .all(competitorId) as ResearchRunRow[];
    return rows.map(mapResearchRun);
  }
}
