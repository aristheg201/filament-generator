import { describe, expect, it } from 'vitest';
import { diagnosticsToText } from '@filament-workbench/core';

describe('cli-adjacent formatting', () => {
  it('formats text diagnostics in minecraft style', () => {
    const output = diagnosticsToText([
      {
        severity: 'error',
        category: 'model',
        code: 'MISSING_TEXTURE',
        message: "missing texture 'svframe:item/ghost_blade'",
        filePath: 'assets/svframe/models/item/ghost_blade.json',
        relatedNodes: [],
      },
    ]);
    expect(output).toContain('ERROR');
    expect(output).toContain('[model]');
  });
});
