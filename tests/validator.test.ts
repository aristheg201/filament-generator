import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePack, validatePack } from '@filament-workbench/core';

const fixture = (name: string): string => path.resolve('fixtures', name);

describe('validator', () => {
  it('detects empty equipment and missing leggings', async () => {
    const pack = await parsePack(fixture('broken-armor-pack'));
    const result = validatePack(pack);
    expect(result.diagnostics.some((d) => d.code === 'EMPTY_EQUIPMENT_LAYERS')).toBe(true);
    expect(result.diagnostics.some((d) => d.code === 'MISSING_LEGGINGS_TEXTURE')).toBe(true);
  });

  it('detects missing model texture', async () => {
    const pack = await parsePack(fixture('missing-texture-pack'));
    const result = validatePack(pack);
    expect(result.diagnostics.some((d) => d.code === 'MISSING_TEXTURE')).toBe(true);
  });

  it('warns for item-only chest block content', async () => {
    const pack = await parsePack(fixture('item-only-fake-block-pack'));
    const result = validatePack(pack);
    expect(result.diagnostics.some((d) => d.code === 'ITEM_ONLY_BLOCK_CONTENT')).toBe(true);
  });

  it('detects invalid block content and missing placement metadata', async () => {
    const pack = await parsePack(fixture('invalid-block-pack'));
    const result = validatePack(pack);
    expect(result.diagnostics.some((d) => d.code === 'MISSING_PLACEMENT_METADATA')).toBe(true);
    expect(result.diagnostics.some((d) => d.code === 'INVALID_BACKING_BLOCK')).toBe(true);
  });

  it('detects missing equipment texture targets', async () => {
    const pack = await parsePack(fixture('missing-equipment-texture-pack'));
    const result = validatePack(pack);
    expect(result.diagnostics.some((d) => d.code === 'MISSING_EQUIPMENT_TEXTURE')).toBe(true);
  });

  it('detects inventory model present but worn group missing', async () => {
    const pack = await parsePack(fixture('runtime-mismatch-pack'));
    const result = validatePack(pack);
    expect(result.diagnostics.some((d) => d.code === 'MISSING_WORN_ASSET_GROUP')).toBe(true);
  });
});
