import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileSource } from './types.js';
import type { SourceFile } from '../types.js';
import { normalizeRelativePath } from '../utils/path.js';

export class DirectorySource implements FileSource {
  public constructor(private readonly directory: string) {}

  public async listFiles(): Promise<SourceFile[]> {
    const out: SourceFile[] = [];
    await this.walk(this.directory, out);
    return out;
  }

  private async walk(currentPath: string, out: SourceFile[]): Promise<void> {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        await this.walk(absolute, out);
        continue;
      }
      const content = await fs.readFile(absolute);
      out.push({
        path: normalizeRelativePath(path.relative(this.directory, absolute)),
        content,
      });
    }
  }
}
