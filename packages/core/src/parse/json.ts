import type { ParsedFile } from '../types.js';
import { bufferToUtf8, hasUtf8Bom } from '../utils/text.js';

export function parseJsonFile(file: Omit<ParsedFile, 'hasBom'>): ParsedFile {
  const hasBom = hasUtf8Bom(file.content);
  try {
    const jsonValue = JSON.parse(bufferToUtf8(file.content)) as unknown;
    return {
      ...file,
      hasBom,
      jsonValue,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown JSON parse error';
    return {
      ...file,
      hasBom,
      parseError: message,
    };
  }
}
