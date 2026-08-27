#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { SourceTypeSchema } from "../domain/source.js";
import {
  SqliteCompetitorRepository,
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

function main(args: string[]): void {
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    process.stdout.write(HELP);
    return;
  }

  const database = openSqliteDatabase(process.env.MARKETOPS_DB ?? "marketops.db");
  initializeSqliteDatabase(database);
  const competitors = new SqliteCompetitorRepository(database);
  const sources = new SqliteSourceRepository(database);

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

    throw new Error(`Unknown command: ${args.join(" ")}`);
  } finally {
    database.close();
  }
}

try {
  main(process.argv.slice(2));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n\n${HELP}`);
  process.exitCode = 1;
}
