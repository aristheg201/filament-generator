import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePack } from '@filament-workbench/core';

const fixture = (name: string): string => path.resolve('fixtures', name);

describe('parser', () => {
  it('parses valid armor fixture', async () => {
    const pack = await parsePack(fixture('valid-armor-pack'));
    expect(pack.items.length).toBe(1);
    expect(pack.equipments.length).toBe(1);
    expect(pack.models.length).toBe(1);
    expect(pack.namespaces).toContain('svframe');
  });

  it('parses valid block fixture', async () => {
    const pack = await parsePack(fixture('valid-block-pack'));
    expect(pack.blocks.length).toBe(1);
    expect(pack.blocks[0]?.definition.kind).toBe('block');
  });
});
