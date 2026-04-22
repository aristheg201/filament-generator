import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePack, validatePack } from '@filament-workbench/core';

const fixture = (name: string): string => path.resolve('fixtures', name);

describe('bom validation', () => {
  it('reports UTF-8 BOM diagnostics', async () => {
    const pack = await parsePack(fixture('bom-corrupted-pack'));
    const result = validatePack(pack);
    expect(result.diagnostics.some((d) => d.code === 'JSON_BOM')).toBe(true);
  });
});
