import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePack, validatePack } from '@filament-workbench/core';

describe('duplicate logical assets', () => {
  it('detects duplicate item ids', async () => {
    const dir = path.resolve('.tmp/duplicates');
    await fs.rm(dir, { recursive: true, force: true });
    await fs.mkdir(path.join(dir, 'data/svframe/filament/items'), { recursive: true });

    const fileA = path.join(dir, 'data/svframe/filament/items/a.json');
    const fileB = path.join(dir, 'data/svframe/filament/items/b.json');

    const payload = {
      id: 'svframe:duplicate',
      kind: 'item',
      backingItem: 'minecraft:iron_sword',
      model: 'svframe:duplicate',
    };

    await fs.writeFile(fileA, JSON.stringify(payload));
    await fs.writeFile(fileB, JSON.stringify(payload));

    const pack = await parsePack(dir);
    const result = validatePack(pack);
    expect(result.diagnostics.some((d) => d.code === 'DUPLICATE_LOGICAL_ASSET')).toBe(true);

    await fs.rm(dir, { recursive: true, force: true });
  });
});
