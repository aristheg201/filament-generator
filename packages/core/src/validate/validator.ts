import type { Diagnostic } from '@filament-workbench/schemas';
import type { ParsedPack, ValidateResult } from '../types.js';
import { buildAssetGraph } from '../graph/build-graph.js';
import { textureIdToPath } from '../utils/path.js';
import { diagnostic } from './diagnostics.js';
import { isSuspiciousVanillaBacking, isValidVanillaItem } from '../parse/vanilla.js';

export function validatePack(pack: ParsedPack): ValidateResult {
  const graph = buildAssetGraph(pack);
  const diagnostics: Diagnostic[] = [...pack.parseDiagnostics, ...graph.diagnostics];

  validateBackingItems(pack, diagnostics);
  validateDuplicates(pack, diagnostics);
  validateModelAndTextures(pack, diagnostics);
  validateArmorEquipment(pack, diagnostics);
  validateDecorations(pack, diagnostics);
  validateNamespaceMismatches(pack, diagnostics);

  return { graph, diagnostics };
}

function validateBackingItems(pack: ParsedPack, diagnostics: Diagnostic[]): void {
  for (const item of [...pack.items, ...pack.decorations]) {
    if (!isValidVanillaItem(item.definition.backingItem)) {
      diagnostics.push(
        diagnostic(
          'error',
          'item',
          'INVALID_BACKING_ITEM',
          `Invalid vanilla backing item '${item.definition.backingItem}'`,
          item.filePath,
        ),
      );
      continue;
    }

    if (isSuspiciousVanillaBacking(item.definition.backingItem)) {
      diagnostics.push(
        diagnostic(
          'warn',
          'item',
          'SUSPICIOUS_BACKING_ITEM',
          `Suspicious vanilla backing item '${item.definition.backingItem}'`,
          item.filePath,
        ),
      );
    }
  }
}

function validateDuplicates(pack: ParsedPack, diagnostics: Diagnostic[]): void {
  const seenItems = new Map<string, string>();
  for (const item of pack.items) {
    const previous = seenItems.get(item.definition.id);
    if (previous) {
      diagnostics.push(
        diagnostic(
          'error',
          'item',
          'DUPLICATE_LOGICAL_ASSET',
          `Duplicate logical asset id '${item.definition.id}'`,
          item.filePath,
          { relatedNodes: [previous, item.filePath] },
        ),
      );
    } else {
      seenItems.set(item.definition.id, item.filePath);
    }
  }
}

function validateModelAndTextures(pack: ParsedPack, diagnostics: Diagnostic[]): void {
  const modelsById = new Map<string, { filePath: string; parent?: string; textures: string[] }>();
  for (const model of pack.models) {
    modelsById.set(model.id, {
      filePath: model.filePath,
      parent: model.definition.parent,
      textures: Object.values(model.definition.textures),
    });
  }

  for (const item of [...pack.items, ...pack.decorations]) {
    if (!item.definition.model) {
      continue;
    }
    if (isBuiltinModelReference(item.definition.model)) {
      continue;
    }
    if (!modelsById.has(item.definition.model)) {
      diagnostics.push(
        diagnostic(
          'error',
          'model',
          'MISSING_MODEL',
          `Missing model '${item.definition.model}'`,
          item.filePath,
        ),
      );
    }
  }

  for (const [modelId, model] of modelsById.entries()) {
    if (model.parent && !isBuiltinModelReference(model.parent) && !modelsById.has(model.parent)) {
      diagnostics.push(
        diagnostic('error', 'model', 'BROKEN_PARENT_CHAIN', `Missing parent model '${model.parent}'`, model.filePath, {
          relatedNodes: [modelId],
        }),
      );
    }

    for (const texture of model.textures) {
      const texturePath = textureIdToPath(texture);
      if (texturePath.startsWith('assets/minecraft/')) {
        continue;
      }
      if (!pack.texturePaths.has(texturePath)) {
        diagnostics.push(
          diagnostic(
            'error',
            'model',
            'MISSING_TEXTURE',
            `Missing texture '${texture}'`,
            model.filePath,
            { relatedNodes: [texturePath] },
          ),
        );
      }
    }
  }

  for (const modelId of modelsById.keys()) {
    if (hasParentCycle(modelId, modelsById)) {
      diagnostics.push(
        diagnostic('error', 'model', 'PARENT_CYCLE', `Broken parent chain cycle at '${modelId}'`, modelsById.get(modelId)?.filePath),
      );
    }
  }
}

function hasParentCycle(
  start: string,
  modelsById: Map<string, { filePath: string; parent?: string; textures: string[] }>,
): boolean {
  const seen = new Set<string>();
  let current: string | undefined = start;
  while (current) {
    const model = modelsById.get(current);
    if (!model?.parent || isBuiltinModelReference(model.parent)) {
      return false;
    }
    if (seen.has(current)) {
      return true;
    }
    seen.add(current);
    current = model.parent;
  }
  return false;
}

function validateArmorEquipment(pack: ParsedPack, diagnostics: Diagnostic[]): void {
  const equipmentByAssetId = new Map(pack.equipments.map((entry) => [entry.definition.assetId, entry]));
  const assetUsage = new Map<string, number>();

  for (const item of pack.items) {
    const isArmorType = item.definition.kind === 'armor' || item.definition.kind === 'helmet' || item.definition.kind === 'hat';
    const linkedAssetId = item.definition.assetId ?? item.definition.wearable?.equippableAssetId;

    if (!linkedAssetId) {
      continue;
    }

    assetUsage.set(linkedAssetId, (assetUsage.get(linkedAssetId) ?? 0) + 1);

    const equipment = equipmentByAssetId.get(linkedAssetId);
    if (!equipment) {
      diagnostics.push(
        diagnostic(
          'error',
          'equipment',
          'MISSING_EQUIPMENT',
          `Armor item '${item.definition.id}' references missing asset group '${linkedAssetId}'`,
          item.filePath,
        ),
      );
      continue;
    }

    const humanoidEmpty = equipment.definition.humanoid.length === 0;
    const leggingsEmpty = equipment.definition.humanoidLeggings.length === 0;

    if (humanoidEmpty && leggingsEmpty) {
      diagnostics.push(
        diagnostic(
          'error',
          'equipment',
          'EMPTY_EQUIPMENT_LAYERS',
          `asset group '${linkedAssetId}' has empty layers`,
          equipment.filePath,
        ),
      );
    }

    if (leggingsEmpty) {
      diagnostics.push(
        diagnostic(
          'error',
          'armor',
          'MISSING_LEGGINGS_TEXTURE',
          `asset group '${linkedAssetId}' is missing leggings texture`,
          equipment.filePath,
        ),
      );
    }

    if (isArmorType && humanoidEmpty) {
      diagnostics.push(
        diagnostic(
          'error',
          'armor',
          'NO_WORN_RENDER_DATA',
          `Armor item '${item.definition.id}' has wearable metadata but no valid worn render data`,
          item.filePath,
        ),
      );
    }
  }

  for (const [assetId, count] of assetUsage.entries()) {
    if (count > 5) {
      diagnostics.push(
        diagnostic('warn', 'armor', 'ASSET_ID_COLLISION', `${count} items share asset_id '${assetId}'`),
      );
    }
  }
}

function validateDecorations(pack: ParsedPack, diagnostics: Diagnostic[]): void {
  for (const decoration of pack.decorations) {
    if (decoration.definition.placeable === undefined) {
      diagnostics.push(
        diagnostic(
          'warn',
          'block',
          'MISSING_PLACEMENT_METADATA',
          `Decoration '${decoration.definition.id}' missing placement metadata`,
          decoration.filePath,
        ),
      );
    }

    if (decoration.definition.placeable === false && /chest|barrel/i.test(decoration.definition.id)) {
      diagnostics.push(
        diagnostic(
          'warn',
          'block',
          'ITEM_ONLY_BLOCK_CONTENT',
          `'${decoration.definition.id}' is item-only and not placeable`,
          decoration.filePath,
        ),
      );
    }
  }
}

function validateNamespaceMismatches(pack: ParsedPack, diagnostics: Diagnostic[]): void {
  for (const item of [...pack.items, ...pack.decorations]) {
    const itemNamespace = item.definition.id.split(':')[0] ?? 'minecraft';
    if (itemNamespace !== item.namespace) {
      diagnostics.push(
        diagnostic(
          'warn',
          'namespace',
          'MISMATCHED_NAMESPACE',
          `ID namespace '${itemNamespace}' does not match file namespace '${item.namespace}'`,
          item.filePath,
        ),
      );
    }
  }
}

function isBuiltinModelReference(id: string): boolean {
  return id.startsWith('minecraft:item/') || id.startsWith('item/');
}

export function summarizeDiagnostics(diagnostics: Diagnostic[]): { errors: number; warnings: number; infos: number } {
  let errors = 0;
  let warnings = 0;
  let infos = 0;

  for (const diagnostic of diagnostics) {
    if (diagnostic.severity === 'error') {
      errors += 1;
    } else if (diagnostic.severity === 'warn') {
      warnings += 1;
    } else {
      infos += 1;
    }
  }

  return { errors, warnings, infos };
}

export function hasErrorSeverity(diagnostics: Diagnostic[]): boolean {
  return diagnostics.some((entry) => entry.severity === 'error');
}

export function hasWarnSeverity(diagnostics: Diagnostic[]): boolean {
  return diagnostics.some((entry) => entry.severity === 'warn');
}
