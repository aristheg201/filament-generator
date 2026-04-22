import fs from 'node:fs/promises';
import path from 'node:path';
import type { BuildReport, Diagnostic } from '@filament-workbench/schemas';
import {
  SUPPORTED_FILAMENT_VERSION,
  SUPPORTED_MINECRAFT_VERSION,
  SUPPORTED_MOD_LOADER,
  TOOL_NAME,
} from '../constants.js';
import { parsePack } from '../parse/parser.js';
import { diagnosticsToJson, diagnosticsToText } from '../report/report.js';
import { stableStringify } from '../utils/stable-json.js';
import { stripUtf8Bom } from '../utils/text.js';
import { summarizeDiagnostics, validatePack } from '../validate/validator.js';

export interface GenerateResult {
  diagnostics: Diagnostic[];
  report: BuildReport;
}

export async function generatePack(inputPath: string, outputPath: string): Promise<GenerateResult> {
  const pack = await parsePack(inputPath);
  const { diagnostics } = validatePack(pack);

  await fs.rm(outputPath, { recursive: true, force: true });
  await fs.mkdir(outputPath, { recursive: true });

  for (const file of pack.files) {
    const targetPath = path.join(outputPath, ...file.path.split('/'));
    await fs.mkdir(path.dirname(targetPath), { recursive: true });

    if (file.path.endsWith('.json') && file.jsonValue !== undefined && !file.parseError) {
      await fs.writeFile(targetPath, stableStringify(file.jsonValue), 'utf8');
    } else {
      await fs.writeFile(targetPath, stripUtf8Bom(file.content));
    }
  }

  const summary = summarizeDiagnostics(diagnostics);
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
    generatedAt: new Date().toISOString(),
  };

  await fs.writeFile(path.join(outputPath, 'build-report.json'), stableStringify(report), 'utf8');
  await fs.writeFile(path.join(outputPath, 'diagnostics.txt'), diagnosticsToText(diagnostics), 'utf8');
  await fs.writeFile(path.join(outputPath, 'diagnostics.json'), diagnosticsToJson(diagnostics), 'utf8');

  return { diagnostics, report };
}
