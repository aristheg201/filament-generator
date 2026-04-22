import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { generatePack } from '@filament-workbench/core';

const fixture = (name: string): string => path.resolve('fixtures', name);

describe('generator', () => {
  it('writes deterministic report and diagnostics', async () => {
    const out = path.resolve('.tmp/generated-valid');
    await fs.rm(out, { recursive: true, force: true });
    const result = await generatePack(fixture('valid-armor-pack'), out);

    expect(result.report.tool).toBe('filament-workbench');
    expect(await fs.stat(path.join(out, 'build-report.json'))).toBeTruthy();
    expect(await fs.stat(path.join(out, 'diagnostics.json'))).toBeTruthy();
    expect(await fs.stat(path.join(out, 'diagnostics.txt'))).toBeTruthy();

    await fs.rm(out, { recursive: true, force: true });
  });

  it('rebuilds canonical block output from parsed entities', async () => {
    const out = path.resolve('.tmp/generated-block');
    await fs.rm(out, { recursive: true, force: true });
    await generatePack(fixture('valid-block-pack'), out);

    const generatedBlock = await fs.readFile(path.join(out, 'data/svframe/filament/blocks/ancient_pillar.json'), 'utf8');
    expect(generatedBlock).toContain('"placement"');
    expect(generatedBlock).toContain('"backingBlock": "minecraft:stone"');

    await fs.rm(out, { recursive: true, force: true });
  });

  it('requires explicit allow-partial for invalid generation', async () => {
    const out = path.resolve('.tmp/generated-invalid');
    await fs.rm(out, { recursive: true, force: true });

    await expect(generatePack(fixture('invalid-block-pack'), out)).rejects.toThrow(/allow-partial/);

    const partial = await generatePack(fixture('invalid-block-pack'), out, { allowPartial: true });
    expect(partial.report.partialGeneration).toBe(true);

    await fs.rm(out, { recursive: true, force: true });
  });
});
