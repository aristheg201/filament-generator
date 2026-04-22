import type { Diagnostic } from '@filament-workbench/schemas';
import type { ParsedPack, ValidateResult } from '../types.js';
import { buildAssetGraph } from '../graph/build-graph.js';
import { isBuiltinParentReference, normalizeModelReferenceId, textureIdToPath } from '../utils/path.js';
import { diagnostic } from './diagnostics.js';
import {
  isSuspiciousArmorBacking,
  isSuspiciousBlockBacking,
  isSuspiciousVanillaBacking,
  isValidVanillaBlock,
  isValidVanillaItem,
} from '../parse/vanilla.js';

export function validatePack(pack: ParsedPack): ValidateResult {
  const graph = buildAssetGraph(pack);
  const diagnostics: Diagnostic[] = [...pack.parseDiagnostics, ...graph.diagnostics];

  validateBackingItems(pack, diagnostics);
  validateDuplicates(pack, diagnostics);
  validateModelAndTextures(pack, diagnostics);
  validateArmorEquipment(pack, diagnostics);
  validateBlockContent(pack, diagnostics);
  validateNamespaceMismatches(pack, diagnostics);

  return { graph, diagnostics };
}

function validateBackingItems(pack: ParsedPack, diagnostics: Diagnostic[]): void {
  for (const item of pack.items) {
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

    const isArmorType = item.definition.kind === 'armor' || item.definition.kind === 'helmet';

    if (isArmorType && isSuspiciousArmorBacking(item.definition.backingItem)) {
      diagnostics.push(
        diagnostic(
          'warn',
          'armor',
          'SUSPICIOUS_ARMOR_BACKING',
          `Suspicious armor backing item '${item.definition.backingItem}'`,
          item.filePath,
        ),
      );
      continue;
    }

    if (!isArmorType && isSuspiciousVanillaBacking(item.definition.backingItem)) {
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
  const seenAssets = new Map<string, string>();
  for (const entry of [...pack.items, ...pack.decorations, ...pack.blocks]) {
    const previous = seenAssets.get(entry.definition.id);
    if (previous) {
      diagnostics.push(
        diagnostic(
          'error',
          'asset',
          'DUPLICATE_LOGICAL_ASSET',
          `Duplicate logical asset id '${entry.definition.id}'`,
          entry.filePath,
          { relatedNodes: [previous, entry.filePath] },
        ),
      );
    } else {
      seenAssets.set(entry.definition.id, entry.filePath);
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

  for (const item of [...pack.items, ...pack.decorations, ...pack.blocks]) {
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

  for (const equipment of pack.equipments) {
    for (const layer of [...equipment.definition.humanoid, ...equipment.definition.humanoidLeggings]) {
      const texturePath = textureIdToPath(layer.texture);
      if (texturePath.startsWith('assets/minecraft/')) {
        continue;
      }
      if (!pack.texturePaths.has(texturePath)) {
        diagnostics.push(
          diagnostic(
            'error',
            'equipment',
            'MISSING_EQUIPMENT_TEXTURE',
            `Equipment group '${equipment.definition.assetId}' points to missing texture '${layer.texture}'`,
            equipment.filePath,
            { relatedNodes: [texturePath] },
          ),
        );
      }
    }
  }

  for (const [modelId, model] of modelsById.entries()) {
    if (model.parent && !isBuiltinParentReference(model.parent) && !modelsById.has(normalizeModelReferenceId(model.parent))) {
      diagnostics.push(
        diagnostic('error', 'model', 'BROKEN_PARENT_CHAIN', `Missing parent model '${model.parent}'`, model.filePath, {
          relatedNodes: [modelId],
        }),
      );
    }

    const parsedModel = pack.models.find((entry) => entry.id === modelId);
    if (parsedModel) {
      for (const override of parsedModel.definition.overrides ?? []) {
        if (!override.model || override.model.startsWith('builtin/')) {
          continue;
        }

        const normalizedOverrideModelId = normalizeModelReferenceId(override.model, parsedModel.namespace);
        if (parsedModel.namespace === 'minecraft' && override.model.startsWith('item/') && !modelsById.has(normalizedOverrideModelId)) {
          continue;
        }

        if (!modelsById.has(normalizedOverrideModelId)) {
          diagnostics.push(
            diagnostic(
              'error',
              'model',
              'BROKEN_OVERRIDE_CHAIN',
              `Missing override model '${override.model}'`,
              parsedModel.filePath,
              { relatedNodes: [modelId] },
            ),
          );
        }
      }
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
    if (!model?.parent || isBuiltinParentReference(model.parent)) {
      return false;
    }
    if (seen.has(current)) {
      return true;
    }
    seen.add(current);
    current = normalizeModelReferenceId(model.parent);
  }
  return false;
}

function validateArmorEquipment(pack: ParsedPack, diagnostics: Diagnostic[]): void {
  const equipmentByAssetId = new Map(pack.equipments.map((entry) => [entry.definition.assetId, entry]));
  const assetUsage = new Map<string, number>();

  for (const item of pack.items) {
    const isArmorType = item.definition.kind === 'armor' || item.definition.kind === 'helmet';
    const linkedAssetId = item.definition.assetId ?? item.definition.wearable?.equippableAssetId;
    const hasInventoryModel = Boolean(item.definition.model);

    if (!linkedAssetId) {
      if (isArmorType && hasInventoryModel) {
        diagnostics.push(
          diagnostic(
            'error',
            'armor',
            'MISSING_WORN_ASSET_GROUP',
            `Armor item '${item.definition.id}' has inventory model but no worn asset group`,
            item.filePath,
          ),
        );
      }
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

    if (!hasInventoryModel && isArmorType) {
      diagnostics.push(
        diagnostic(
          'warn',
          'armor',
          'MISSING_INVENTORY_MODEL',
          `Armor item '${item.definition.id}' has worn render data but no inventory model`,
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

function validateBlockContent(pack: ParsedPack, diagnostics: Diagnostic[]): void {
  for (const decoration of pack.decorations) {
    const hasPlacement = Boolean(decoration.definition.placement) || decoration.definition.placeable !== undefined;
    if (!hasPlacement) {
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

    if ((decoration.definition.placeable === false || decoration.definition.placement?.placeable === false) && /chest|barrel/i.test(decoration.definition.id)) {
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

    if (decoration.definition.backingBlock && !isValidVanillaBlock(decoration.definition.backingBlock)) {
      diagnostics.push(
        diagnostic(
          'error',
          'block',
          'INVALID_BACKING_BLOCK',
          `Invalid backing block '${decoration.definition.backingBlock}'`,
          decoration.filePath,
        ),
      );
    }
  }

  for (const block of pack.blocks) {
    if (!block.definition.placement) {
      diagnostics.push(
        diagnostic(
          'error',
          'block',
          'MISSING_PLACEMENT_METADATA',
          `Block '${block.definition.id}' missing placement metadata`,
          block.filePath,
        ),
      );
    }

    if (!block.definition.backingBlock && !block.definition.placement?.backingBlock) {
      diagnostics.push(
        diagnostic(
          'error',
          'block',
          'MISSING_BACKING_BLOCK',
          `Block '${block.definition.id}' is missing backing block metadata`,
          block.filePath,
        ),
      );
    }

    const resolvedBackingBlock = block.definition.backingBlock ?? block.definition.placement?.backingBlock;
    if (resolvedBackingBlock && !isValidVanillaBlock(resolvedBackingBlock)) {
      diagnostics.push(
        diagnostic(
          'error',
          'block',
          'INVALID_BACKING_BLOCK',
          `Invalid backing block '${resolvedBackingBlock}'`,
          block.filePath,
        ),
      );
    }

    if (resolvedBackingBlock && isSuspiciousBlockBacking(resolvedBackingBlock)) {
      diagnostics.push(
        diagnostic(
          'warn',
          'block',
          'SUSPICIOUS_BACKING_BLOCK',
          `Suspicious backing block '${resolvedBackingBlock}'`,
          block.filePath,
        ),
      );
    }

    if (block.definition.placement && block.definition.placement.placeable === false) {
      diagnostics.push(
        diagnostic(
          'warn',
          'block',
          'ITEM_ONLY_BLOCK_CONTENT',
          `'${block.definition.id}' is item-only and not placeable`,
          block.filePath,
        ),
      );
    }
  }
}

function validateNamespaceMismatches(pack: ParsedPack, diagnostics: Diagnostic[]): void {
  for (const item of [...pack.items, ...pack.decorations, ...pack.blocks]) {
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
  return id.startsWith('minecraft:item/') || id.startsWith('item/') || id.startsWith('builtin/');
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
