import fs from 'node:fs/promises';
import path from 'node:path';
import { WorkbenchError } from '../errors.js';
import { loadFileSource } from '../fs/source-loader.js';
import { stableStringify } from '../utils/stable-json.js';
import { stripUtf8Bom } from '../utils/text.js';

export interface FixResult {
  changedFiles: string[];
  warnings: string[];
}

export async function applySafeFixes(inputPath: string, dryRun = false): Promise<FixResult> {
  const stat = await fs.stat(inputPath).catch(() => null);
  if (!stat?.isDirectory()) {
    throw new WorkbenchError('Safe in-place fixes only support directory input', 2);
  }

  const source = await loadFileSource(inputPath);
  const files = await source.listFiles();

  const changedFiles: string[] = [];
  const warnings: string[] = [];

  for (const file of files) {
    if (!file.path.endsWith('.json')) {
      continue;
    }

    const bomStripped = stripUtf8Bom(file.content);
    const text = bomStripped.toString('utf8');

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      warnings.push(`Skipped invalid JSON: ${file.path}`);
      continue;
    }

    const normalized = Buffer.from(stableStringify(parsed), 'utf8');
    const changed = !normalized.equals(file.content);

    if (!changed) {
      continue;
    }

    changedFiles.push(file.path);
    if (!dryRun) {
      const absolute = path.join(inputPath, ...file.path.split('/'));
      await fs.mkdir(path.dirname(absolute), { recursive: true });
      await fs.writeFile(absolute, normalized);
    }
  }

  return { changedFiles, warnings };
}
