import AdmZip from 'adm-zip';
import type { FileSource } from './types.js';
import type { SourceFile } from '../types.js';
import { normalizeRelativePath } from '../utils/path.js';

export class ZipSource implements FileSource {
  public constructor(private readonly zipPath: string) {}

  public async listFiles(): Promise<SourceFile[]> {
    const zip = new AdmZip(this.zipPath);
    const entries = zip.getEntries();
    const out: SourceFile[] = [];

    for (const entry of entries) {
      if (entry.isDirectory) {
        continue;
      }
      out.push({
        path: normalizeRelativePath(entry.entryName),
        content: entry.getData(),
      });
    }

    return out;
  }
}
