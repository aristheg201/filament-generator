import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePack, runtimeCheckPack, validatePack } from '@filament-workbench/core';

const fixture = (name: string): string => path.resolve('fixtures', name);

describe('runtime-check', () => {
  it('catches runtime mismatch that lint alone does not catch', async () => {
    const pack = await parsePack(fixture('runtime-mismatch-pack'));
    const lint = validatePack(pack);
    const runtime = runtimeCheckPack(pack);

    expect(lint.diagnostics.some((d) => d.code === 'RUNTIME_WORN_RENDER_MISSING')).toBe(false);
    expect(runtime.runtimeDiagnostics.some((d) => d.code === 'RUNTIME_WORN_RENDER_MISSING')).toBe(true);
  });

  it('catches runtime armor render failures for missing equipment textures', async () => {
    const pack = await parsePack(fixture('missing-equipment-texture-pack'));
    const runtime = runtimeCheckPack(pack);
    expect(runtime.runtimeDiagnostics.some((d) => d.code === 'RUNTIME_MISSING_RENDER_TEXTURE')).toBe(true);
  });
});