#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { analyzeChange } from "../application/analyze-change.js";
import { captureSourceSnapshot } from "../application/capture-source-snapshot.js";
import { detectSourceChanges } from "../application/detect-source-changes.js";
import { runResearch } from "../application/run-research.js";
import { loadOptionalEnvFile } from "../config/load-env.js";
import { SourceTypeSchema } from "../domain/source.js";
import { DeepSeekFindingAnalyzer } from "../infrastructure/deepseek-finding-analyzer.js";
import { HttpSourceFetcher } from "../infrastructure/http-source-fetcher.js";
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
} from "../infrastructure/sqlite.js";

const HELP = `MarketOps Agent

Usage:
  marketops competitor add --name <name> --website <url>
  marketops competitor list
  marketops source add --competitor <id> --type <type> --url <url>
  marketops source list --competitor <id>
  marketops snapshot capture --source <id>
  marketops snapshot list --source <id>
  marketops change detect --source <id>
  marketops change list --source <id>
  marketops finding analyze --change <id>
  marketops finding list --competitor <id>
  marketops research run --competitor <id>
  marketops research list --competitor <id>

Source types: website, pricing, blog, github, rss
`;

function readOption(args: string[], name: string): string {
  const index = args.indexOf(`--${name}`);
  const value = index === -1 ? undefined : args[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`Missing required option --${name}`);
  }
  return value;
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

function createFindingAnalyzer(): DeepSeekFindingAnalyzer {
  return new DeepSeekFindingAnalyzer({
    apiKey: requireEnv("DEEPSEEK_API_KEY"),
    model: process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash",
    baseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
  });
}

async function main(args: string[]): Promise<void> {
  loadOptionalEnvFile();

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    process.stdout.write(HELP);
    return;
  }

  const database = openSqliteDatabase(process.env.MARKETOPS_DB ?? "marketops.db");
  initializeSqliteDatabase(database);
  const competitors = new SqliteCompetitorRepository(database);
  const sources = new SqliteSourceRepository(database);
  const snapshots = new SqliteSnapshotRepository(database);
  const changes = new SqliteChangeRepository(database);
  const findings = new SqliteFindingRepository(database);
  const analyses = new SqliteChangeAnalysisRepository(database);
  const researchRuns = new SqliteResearchRunRepository(database);

  try {
    const [resource, action, ...options] = args;

    if (resource === "competitor" && action === "add") {
      const competitor = {
        id: randomUUID(),
        name: readOption(options, "name"),
        website: readOption(options, "website"),
        createdAt: new Date(),
      };
      competitors.create(competitor);
      process.stdout.write(`${competitor.id}\t${competitor.name}\t${competitor.website}\n`);
      return;
    }

    if (resource === "competitor" && action === "list") {
      for (const competitor of competitors.list()) {
        process.stdout.write(`${competitor.id}\t${competitor.name}\t${competitor.website}\n`);
      }
      return;
    }

    if (resource === "source" && action === "add") {
      const source = {
        id: randomUUID(),
        competitorId: readOption(options, "competitor"),
        type: SourceTypeSchema.parse(readOption(options, "type")),
        url: readOption(options, "url"),
        createdAt: new Date(),
      };
      sources.create(source);
      process.stdout.write(`${source.id}\t${source.type}\t${source.url}\n`);
      return;
    }

    if (resource === "source" && action === "list") {
      const competitorId = readOption(options, "competitor");
      for (const source of sources.listByCompetitor(competitorId)) {
        process.stdout.write(`${source.id}\t${source.type}\t${source.url}\n`);
      }
      return;
    }

    if (resource === "snapshot" && action === "capture") {
      const sourceId = readOption(options, "source");
      const result = await captureSourceSnapshot(sourceId, {
        sourceRepository: sources,
        snapshotRepository: snapshots,
        fetcher: new HttpSourceFetcher(),
      });
      process.stdout.write(
        `${result.status}\t${result.snapshot.id}\t${result.snapshot.contentHash}\t${result.snapshot.fetchedAt.toISOString()}\n`,
      );
      return;
    }

    if (resource === "snapshot" && action === "list") {
      const sourceId = readOption(options, "source");
      for (const snapshot of snapshots.listBySource(sourceId)) {
        process.stdout.write(
          `${snapshot.id}\t${snapshot.contentHash}\t${snapshot.fetchedAt.toISOString()}\n`,
        );
      }
      return;
    }

    if (resource === "change" && action === "detect") {
      const sourceId = readOption(options, "source");
      const result = detectSourceChanges(sourceId, {
        sourceRepository: sources,
        snapshotRepository: snapshots,
        changeRepository: changes,
      });
      process.stdout.write(`created\t${result.created.length}\n`);
      process.stdout.write(`existing\t${result.existing.length}\n`);
      process.stdout.write(`unchanged\t${result.skippedUnchangedPairs}\n`);
      return;
    }

    if (resource === "change" && action === "list") {
      const sourceId = readOption(options, "source");
      for (const change of changes.listBySource(sourceId)) {
        process.stdout.write(
          `${change.id}\t${change.previousSnapshotId}\t${change.currentSnapshotId}\t${change.detectedAt.toISOString()}\n`,
        );
        process.stdout.write(`${change.diff}\n`);
      }
      return;
    }

    if (resource === "finding" && action === "analyze") {
      const changeId = readOption(options, "change");
      const result = await analyzeChange(changeId, {
        changeRepository: changes,
        sourceRepository: sources,
        competitorRepository: competitors,
        findingRepository: findings,
        changeAnalysisRepository: analyses,
        analyzer: createFindingAnalyzer(),
      });

      if (result.status === "irrelevant") {
        process.stdout.write(
          `irrelevant\t${result.analysis.confidence}\t${result.analysis.reason}\n`,
        );
        return;
      }

      process.stdout.write(
        `${result.status}\t${result.finding.id}\t${result.finding.type}\t${result.finding.severity}\t${result.finding.confidence}\n`,
      );
      process.stdout.write(`${result.finding.summary}\n${result.finding.impact}\n`);
      return;
    }

    if (resource === "finding" && action === "list") {
      const competitorId = readOption(options, "competitor");
      for (const finding of findings.listByCompetitor(competitorId)) {
        process.stdout.write(
          `${finding.id}\t${finding.changeId}\t${finding.type}\t${finding.severity}\t${finding.confidence}\t${finding.createdAt.toISOString()}\n`,
        );
        process.stdout.write(`${finding.summary}\n${finding.impact}\n`);
      }
      return;
    }

    if (resource === "research" && action === "run") {
      const competitorId = readOption(options, "competitor");
      const result = await runResearch(competitorId, {
        competitorRepository: competitors,
        sourceRepository: sources,
        snapshotRepository: snapshots,
        changeRepository: changes,
        findingRepository: findings,
        changeAnalysisRepository: analyses,
        researchRunRepository: researchRuns,
        fetcher: new HttpSourceFetcher(),
        analyzer: createFindingAnalyzer(),
      });

      process.stdout.write(`${result.run.id}\t${result.run.status}\n`);
      process.stdout.write(`snapshots_created\t${result.snapshotsCreated}\n`);
      process.stdout.write(`snapshots_unchanged\t${result.snapshotsUnchanged}\n`);
      process.stdout.write(`changes_created\t${result.changesCreated}\n`);
      process.stdout.write(`findings_created\t${result.findingsCreated}\n`);
      process.stdout.write(`findings_existing\t${result.findingsExisting}\n`);
      process.stdout.write(`irrelevant\t${result.irrelevant}\n`);
      for (const failure of result.failures) {
        process.stdout.write(`failure\t${failure.sourceId}\t${failure.message}\n`);
      }
      return;
    }

    if (resource === "research" && action === "list") {
      const competitorId = readOption(options, "competitor");
      for (const run of researchRuns.listByCompetitor(competitorId)) {
        process.stdout.write(
          `${run.id}\t${run.status}\t${run.startedAt?.toISOString() ?? "-"}\t${run.completedAt?.toISOString() ?? "-"}\n`,
        );
      }
      return;
    }

    throw new Error(`Unknown command: ${args.join(" ")}`);
  } finally {
    database.close();
  }
}

main(process.argv.slice(2)).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n\n${HELP}`);
  process.exitCode = 1;
});
