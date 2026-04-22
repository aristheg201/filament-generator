import type { SourceFile } from '../types.js';

export interface FileSource {
  listFiles(): Promise<SourceFile[]>;
}
