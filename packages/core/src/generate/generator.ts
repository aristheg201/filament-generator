import fs from 'node:fs/promises';
import path from 'node:path';
import type { BuildReport, Diagnostic } from '@filament-workbench/schemas';
import {
  SUPPORTED_FILAMENT_VERSION,
  SUPPORTED_MINECRAFT_VERSION,
  SUPPORTED_MOD_LOADER,
  TOOL_NAME,
} from '../constants.js';
import { WorkbenchError } from '../errors.js';
import { parsePack } from '../parse/parser.js';
import { diagnosticsToJson, diagnosticsToText } from '../report/report.js';
import { stableStringify } from '../utils/stable-json.js';
import { stripUtf8Bom } from '../utils/text.js';
import { summarizeDiagnostics, validatePack } from '../validate/validator.js';

export interface GenerateResult {
  diagnostics: Diagnostic[];
  report: BuildReport;
}

export interface GenerateOptions {
  allowPartial?: boolean;
}

export async function generatePack(inputPath: string, outputPath: string, options: GenerateOptions = {}): Promise<GenerateResult> {
  const pack = await parsePack(inputPath);
  const { diagnostics } = validatePack(pack);
  const summary = summarizeDiagnostics(diagnostics);

  if (summary.errors > 0 && !options.allowPartial) {
    throw new WorkbenchError('Generation aborted because validation errors were found. Re-run with --allow-partial to emit partial output.', 2);
  }

  await fs.rm(outputPath, { recursive: true, force: true });
  await fs.mkdir(outputPath, { recursive: true });

  const filesToWrite = new Map<string, Buffer>();

  for (const item of pack.items) {
    filesToWrite.set(
      `data/${item.namespace}/filament/items/${idToLocalPath(item.definition.id)}.json`,
      Buffer.from(stableStringify(item.definition), 'utf8'),
    );
  }

  for (const decoration of pack.decorations) {
    filesToWrite.set(
      `data/${decoration.namespace}/filament/decorations/${idToLocalPath(decoration.definition.id)}.json`,
      Buffer.from(stableStringify(decoration.definition), 'utf8'),
    );
  }

  for (const block of pack.blocks) {
    filesToWrite.set(
      `data/${block.namespace}/filament/blocks/${idToLocalPath(block.definition.id)}.json`,
      Buffer.from(stableStringify(block.definition), 'utf8'),
    );
  }

  for (const equipment of pack.equipments) {
    filesToWrite.set(
      `assets/${equipment.namespace}/equipment/${idToLocalPath(equipment.definition.assetId)}.json`,
      Buffer.from(stableStringify(equipment.definition), 'utf8'),
    );
  }

  for (const model of pack.models) {
    filesToWrite.set(
      `assets/${model.namespace}/models/${model.logicalPath}.json`,
      Buffer.from(stableStringify(model.definition), 'utf8'),
    );
  }

  for (const file of pack.files) {
    if (file.role === 'texture') {
      filesToWrite.set(file.path, stripUtf8Bom(file.content));
      continue;
    }

    if (file.role === 'unknown' && !/\.ya?ml$/i.test(file.path)) {
      filesToWrite.set(file.path, stripUtf8Bom(file.content));
    }
  }

  const orderedPaths = [...filesToWrite.keys()].sort((a, b) => a.localeCompare(b));
  for (const relativePath of orderedPaths) {
    const targetPath = path.join(outputPath, ...relativePath.split('/'));
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, filesToWrite.get(relativePath) ?? Buffer.alloc(0));
  }

  const report: BuildReport = {
    tool: TOOL_NAME,
    versionLock: {
      minecraft: SUPPORTED_MINECRAFT_VERSION,
      loader: SUPPORTED_MOD_LOADER,
      filament: SUPPORTED_FILAMENT_VERSION,
    },
    inputPath,
    outputPath,
    namespaces: pack.namespaces,
    diagnostics: {
      errors: summary.errors,
      warnings: summary.warnings,
      infos: summary.infos,
    },
    partialGeneration: Boolean(options.allowPartial),
    generatedFiles: orderedPaths.length + 3,
    generatedAt: new Date().toISOString(),
  };

  await fs.writeFile(path.join(outputPath, 'build-report.json'), stableStringify(report), 'utf8');
  await fs.writeFile(path.join(outputPath, 'diagnostics.txt'), diagnosticsToText(diagnostics), 'utf8');
  await fs.writeFile(path.join(outputPath, 'diagnostics.json'), diagnosticsToJson(diagnostics), 'utf8');

  return { diagnostics, report };
}

function idToLocalPath(id: string): string {
  return id.includes(':') ? id.split(':')[1] ?? id : id;
}
