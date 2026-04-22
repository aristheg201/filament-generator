import fs from 'node:fs/promises';
import { DirectorySource } from './dir-source.js';
import type { FileSource } from './types.js';
import { ZipSource } from './zip-source.js';
import { WorkbenchError } from '../errors.js';

export async function loadFileSource(inputPath: string): Promise<FileSource> {
  const stat = await fs.stat(inputPath).catch(() => null);
  if (!stat) {
    throw new WorkbenchError(`Input does not exist: ${inputPath}`);
  }

  if (stat.isDirectory()) {
    return new DirectorySource(inputPath);
  }

  if (stat.isFile() && inputPath.toLowerCase().endsWith('.zip')) {
    return new ZipSource(inputPath);
  }

  throw new WorkbenchError('Input must be a directory or .zip file');
}
