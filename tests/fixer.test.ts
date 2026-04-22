import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { applySafeFixes } from '@filament-workbench/core';

describe('fixer', () => {
  it('normalizes JSON and strips BOM', async () => {
    const tempDir = path.resolve('.tmp/fix-fixture');
    await fs.rm(tempDir, { recursive: true, force: true });
    await fs.mkdir(path.join(tempDir, 'data/svframe/filament/items'), { recursive: true });
    const targetFile = path.join(tempDir, 'data/svframe/filament/items/test.json');
    const bomAndMessy = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from('{"b":2,"a":1}', 'utf8'),
    ]);
    await fs.writeFile(targetFile, bomAndMessy);

    const result = await applySafeFixes(tempDir);
    expect(result.changedFiles).toContain('data/svframe/filament/items/test.json');

    const after = await fs.readFile(targetFile);
    expect(after[0]).not.toBe(0xef);
    expect(after.toString('utf8')).toContain('"a": 1');

    await fs.rm(tempDir, { recursive: true, force: true });
  });
});
