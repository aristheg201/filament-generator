import type { Diagnostic } from '@filament-workbench/schemas';
import type { ParsedPack } from '../types.js';
import { textureIdToPath } from '../utils/path.js';
import { diagnostic } from '../validate/diagnostics.js';
import { validatePack } from '../validate/validator.js';

export interface RuntimeCheckResult {
  lintDiagnostics: Diagnostic[];
  runtimeDiagnostics: Diagnostic[];
  diagnostics: Diagnostic[];
}

export function runtimeCheckPack(pack: ParsedPack): RuntimeCheckResult {
  const lint = validatePack(pack);
  const runtimeDiagnostics: Diagnostic[] = [];

  for (const item of pack.items) {
    const isArmorType = item.definition.kind === 'armor' || item.definition.kind === 'helmet';
    const linkedAssetId = item.definition.assetId ?? item.definition.wearable?.equippableAssetId;
    if (isArmorType && item.definition.model && !linkedAssetId) {
      runtimeDiagnostics.push(
        diagnostic(
          'error',
          'runtime',
          'RUNTIME_WORN_RENDER_MISSING',
          `Armor item '${item.definition.id}' would not render when worn because no equipment group is linked`,
          item.filePath,
        ),
      );
    }
  }

  for (const equipment of pack.equipments) {
    const hasHumanoid = equipment.definition.humanoid.length > 0;
    const hasLeggings = equipment.definition.humanoidLeggings.length > 0;
    if (hasHumanoid && !hasLeggings) {
      runtimeDiagnostics.push(
        diagnostic(
          'error',
          'runtime',
          'RUNTIME_ARMOR_RENDER_INCOMPLETE',
          `Equipment group '${equipment.definition.assetId}' is structurally present but would fail for leggings at runtime`,
          equipment.filePath,
        ),
      );
    }

    for (const layer of [...equipment.definition.humanoid, ...equipment.definition.humanoidLeggings]) {
      const texturePath = textureIdToPath(layer.texture);
      if (!texturePath.startsWith('assets/minecraft/') && !pack.texturePaths.has(texturePath)) {
        runtimeDiagnostics.push(
          diagnostic(
            'error',
            'runtime',
            'RUNTIME_MISSING_RENDER_TEXTURE',
            `Equipment group '${equipment.definition.assetId}' would fail resource lookup for '${layer.texture}'`,
            equipment.filePath,
            { relatedNodes: [texturePath] },
          ),
        );
      }
    }
  }

  for (const block of [...pack.blocks, ...pack.decorations]) {
    if ((block.definition.kind === 'block' || block.definition.placement?.placeable) && !block.definition.placement) {
      runtimeDiagnostics.push(
        diagnostic(
          'error',
          'runtime',
          'RUNTIME_BLOCK_PLACEMENT_FAILURE',
          `Block-like asset '${block.definition.id}' would fail placement because placement metadata is incomplete`,
          block.filePath,
        ),
      );
    }

    if (/chest|barrel/i.test(block.definition.id) && (block.definition.placeable === false || block.definition.placement?.placeable === false)) {
      runtimeDiagnostics.push(
        diagnostic(
          'warn',
          'runtime',
          'RUNTIME_ITEM_ONLY_CHEST',
          `Block-like asset '${block.definition.id}' behaves like item-only content and is unlikely to survive a real placement pipeline`,
          block.filePath,
        ),
      );
    }
  }

  for (const model of pack.models) {
    const refs = [model.definition.parent, ...Object.values(model.definition.textures)].filter(Boolean) as string[];
    for (const ref of refs) {
      if (ref.includes('\\') || ref.includes('//')) {
        runtimeDiagnostics.push(
          diagnostic(
            'error',
            'runtime',
            'RUNTIME_PATH_LOOKUP_FAILURE',
            `Reference '${ref}' in model '${model.id}' contains non-canonical separators and may fail lookup at runtime`,
            model.filePath,
          ),
        );
      }
    }
  }

  return {
    lintDiagnostics: lint.diagnostics,
    runtimeDiagnostics,
    diagnostics: [...lint.diagnostics, ...runtimeDiagnostics],
  };
}