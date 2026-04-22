import type { ClassifiedFile } from '../types.js';

export function detectNamespaces(files: ClassifiedFile[]): string[] {
  const set = new Set<string>();
  for (const file of files) {
    if (file.namespace) {
      set.add(file.namespace);
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}
