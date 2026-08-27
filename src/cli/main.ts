#!/usr/bin/env node

const HELP = `MarketOps Agent

Usage:
  marketops <command>

Commands will be introduced incrementally as the domain workflow is implemented.
`;

function main(args: string[]): void {
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    process.stdout.write(HELP);
    return;
  }

  const [command] = args;
  process.stderr.write(`Unknown command: ${command}\n\n${HELP}`);
  process.exitCode = 1;
}

main(process.argv.slice(2));
