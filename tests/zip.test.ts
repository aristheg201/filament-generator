import fs from 'node:fs/promises';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { describe, expect, it } from 'vitest';
import { parsePack } from '@filament-workbench/core';

describe('zip parsing', () => {
  it('parses zip input', async () => {
    const src = path.resolve('fixtures/valid-armor-pack');
    const outZip = path.resolve('.tmp/valid-armor-pack.zip');
    await fs.rm('.tmp', { recursive: true, force: true });
    await fs.mkdir('.tmp', { recursive: true });

    const zip = new AdmZip();
    zip.addLocalFolder(src);
    zip.writeZip(outZip);

    const pack = await parsePack(outZip);
    expect(pack.items.length).toBe(1);
    expect(pack.equipments.length).toBe(1);
  });
});
