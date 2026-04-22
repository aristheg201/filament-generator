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
});
