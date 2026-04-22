#!/usr/bin/env node
import {
  TOOL_NAME,
  SUPPORTED_FILAMENT_VERSION,
  SUPPORTED_MINECRAFT_VERSION,
  SUPPORTED_MOD_LOADER,
  applySafeFixes,
  diagnosticsToJson,
  diagnosticsToText,
  generatePack,
  hasErrorSeverity,
  hasWarnSeverity,
  parsePack,
  summarizeDiagnostics,
  validatePack,
} from '@filament-workbench/core';
import { Command } from 'commander';

interface CommonOptions {
  strict?: boolean;
  json?: boolean;
}

const program = new Command();
program
  .name(TOOL_NAME)
  .description(
    `Filament Workbench (Minecraft ${SUPPORTED_MINECRAFT_VERSION}, ${SUPPORTED_MOD_LOADER}, Filament ${SUPPORTED_FILAMENT_VERSION})`,
  )
  .showHelpAfterError();

program
  .command('import')
  .argument('<path>')
  .option('--json', 'Machine-readable output')
  .action(async (inputPath: string, options: CommonOptions) => {
    const pack = await parsePack(inputPath);
    const payload = {
      inputPath,
      namespaces: pack.namespaces,
      counts: {
        files: pack.files.length,
        items: pack.items.length,
        decorations: pack.decorations.length,
        equipments: pack.equipments.length,
        models: pack.models.length,
      },
      parseDiagnostics: pack.parseDiagnostics,
    };
    if (options.json) {
      process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    } else {
      process.stdout.write(`Imported ${pack.files.length} files from ${inputPath}\n`);
      process.stdout.write(`Namespaces: ${pack.namespaces.join(', ') || '(none)'}\n`);
      process.stdout.write(`Items: ${pack.items.length}, Decorations: ${pack.decorations.length}, Equipment: ${pack.equipments.length}, Models: ${pack.models.length}\n`);
    }
  });

program
  .command('lint')
  .argument('<path>')
  .option('--strict', 'Warnings fail build')
  .option('--json', 'Machine-readable output')
  .action(async (inputPath: string, options: CommonOptions) => {
    await runValidationCommand(inputPath, options);
  });

program
  .command('analyze')
  .argument('<path>')
  .option('--json', 'Machine-readable output')
  .action(async (inputPath: string, options: CommonOptions) => {
    const pack = await parsePack(inputPath);
    const result = validatePack(pack);

    const nodes = [...result.graph.nodes.values()].map((entry) => ({ id: entry.id, type: entry.type, filePath: entry.filePath }));
    const edges = [...result.graph.edges.entries()].map(([from, tos]) => ({ from, to: [...tos.values()] }));

    if (options.json) {
      process.stdout.write(`${JSON.stringify({ nodes, edges, diagnostics: result.diagnostics }, null, 2)}\n`);
    } else {
      process.stdout.write(`Graph nodes: ${nodes.length}\n`);
      process.stdout.write(`Graph edges: ${edges.reduce((acc, entry) => acc + entry.to.length, 0)}\n`);
      process.stdout.write(`${diagnosticsToText(result.diagnostics)}\n`);
    }

    process.exit(hasErrorSeverity(result.diagnostics) ? 1 : 0);
  });

program
  .command('generate')
  .argument('<input>')
  .requiredOption('--out <dir>', 'Output directory')
  .option('--strict', 'Warnings fail build')
  .option('--json', 'Machine-readable output')
  .action(async (inputPath: string, options: { out: string } & CommonOptions) => {
    const generated = await generatePack(inputPath, options.out);
    if (options.json) {
      process.stdout.write(JSON.stringify(generated.report, null, 2));
      process.stdout.write('\n');
    } else {
      process.stdout.write(`Generated output at ${options.out}\n`);
      process.stdout.write(`${diagnosticsToText(generated.diagnostics)}\n`);
    }

    const shouldFail = hasErrorSeverity(generated.diagnostics) || (options.strict && hasWarnSeverity(generated.diagnostics));
    process.exit(shouldFail ? 1 : 0);
  });

program
  .command('doctor')
  .argument('<path>')
  .option('--json', 'Machine-readable output')
  .action(async (inputPath: string, options: CommonOptions) => {
    const pack = await parsePack(inputPath);
    const result = validatePack(pack);
    const summary = summarizeDiagnostics(result.diagnostics);
    const payload = {
      versionLock: {
        minecraft: SUPPORTED_MINECRAFT_VERSION,
        loader: SUPPORTED_MOD_LOADER,
        filament: SUPPORTED_FILAMENT_VERSION,
      },
      summary,
      diagnostics: result.diagnostics,
    };

    if (options.json) {
      process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    } else {
      process.stdout.write(`Errors: ${summary.errors} Warnings: ${summary.warnings} Infos: ${summary.infos}\n`);
      process.stdout.write(`${diagnosticsToText(result.diagnostics)}\n`);
    }

    process.exit(summary.errors > 0 ? 1 : 0);
  });

program
  .command('report')
  .argument('<path>')
  .option('--format <format>', 'json|text', 'text')
  .action(async (inputPath: string, options: { format: 'json' | 'text' }) => {
    const pack = await parsePack(inputPath);
    const result = validatePack(pack);
    if (options.format === 'json') {
      process.stdout.write(diagnosticsToJson(result.diagnostics));
    } else {
      process.stdout.write(`${diagnosticsToText(result.diagnostics)}\n`);
    }
    process.exit(hasErrorSeverity(result.diagnostics) ? 1 : 0);
  });

program
  .command('fix')
  .argument('<path>')
  .option('--dry-run', 'Report changes without writing')
  .action(async (inputPath: string, options: { dryRun?: boolean }) => {
    const result = await applySafeFixes(inputPath, options.dryRun ?? false);
    process.stdout.write(`Changed files: ${result.changedFiles.length}\n`);
    for (const changedFile of result.changedFiles) {
      process.stdout.write(`  ${changedFile}\n`);
    }
    for (const warning of result.warnings) {
      process.stdout.write(`WARN  [fix] ${warning}\n`);
    }
    process.exit(0);
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`ERROR [cli] ${message}\n`);
  process.exit(1);
});

async function runValidationCommand(inputPath: string, options: CommonOptions): Promise<void> {
  const pack = await parsePack(inputPath);
  const result = validatePack(pack);

  if (options.json) {
    process.stdout.write(diagnosticsToJson(result.diagnostics));
  } else {
    process.stdout.write(`${diagnosticsToText(result.diagnostics)}\n`);
  }

  const shouldFail = hasErrorSeverity(result.diagnostics) || (options.strict && hasWarnSeverity(result.diagnostics));
  process.exit(shouldFail ? 1 : 0);
}
