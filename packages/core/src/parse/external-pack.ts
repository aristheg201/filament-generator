import type { BlockDefinition, Diagnostic, EquipmentDefinition, ItemDefinition, ModelReference } from '@filament-workbench/schemas';
import { parseDocument } from 'yaml';
import type { ParsedBlock, ParsedEquipment, ParsedItem, ParsedModel, SourceFile } from '../types.js';
import { normalizeRelativePath } from '../utils/path.js';
import { diagnostic } from '../validate/diagnostics.js';

export interface ExternalImportResult {
  items: ParsedItem[];
  decorations: ParsedBlock[];
  blocks: ParsedBlock[];
  equipments: ParsedEquipment[];
  models: ParsedModel[];
  parseDiagnostics: Diagnostic[];
}

type JsonObject = Record<string, unknown>;

export function canonicalizeExternalAssetFiles(files: SourceFile[]): SourceFile[] {
  const byPath = new Map<string, SourceFile>();

  for (const file of files) {
    const normalizedPath = normalizeRelativePath(file.path);
    const canonicalPath = extractCanonicalAssetPath(normalizedPath) ?? normalizedPath;
    if (!byPath.has(canonicalPath)) {
      byPath.set(canonicalPath, {
        path: canonicalPath,
        content: file.content,
      });
    }
  }

  return [...byPath.values()];
}

export function importExternalPack(files: SourceFile[]): ExternalImportResult {
  const items: ParsedItem[] = [];
  const decorations: ParsedBlock[] = [];
  const blocks: ParsedBlock[] = [];
  const equipments: ParsedEquipment[] = [];
  const models = new Map<string, ParsedModel>();
  const parseDiagnostics: Diagnostic[] = [];

  for (const file of files) {
    if (!/\.ya?ml$/i.test(file.path)) {
      continue;
    }

    const document = parseDocument(file.content.toString('utf8'));
    if (document.errors.length > 0) {
      parseDiagnostics.push(
        diagnostic(
          'error',
          'yaml',
          'YAML_INVALID',
          `Invalid YAML in ${file.path}: ${document.errors[0]?.message ?? 'unknown YAML parse error'}`,
          file.path,
        ),
      );
      continue;
    }

    const root = asObject(document.toJSON());
    const info = asObject(root?.info);
    const namespace = asString(info?.namespace);
    const yamlItems = asObject(root?.items);
    const armorRendering = asObject(root?.armors_rendering);

    if (!namespace || (!yamlItems && !armorRendering)) {
      continue;
    }

    if (armorRendering) {
      for (const [assetName, rawValue] of Object.entries(armorRendering)) {
        const rawArmor = asObject(rawValue);
        if (!rawArmor) {
          continue;
        }

        const layer1 = normalizeTextureId(namespace, asString(rawArmor.layer_1));
        const layer2 = normalizeTextureId(namespace, asString(rawArmor.layer_2));
        const assetId = `${namespace}:${assetName}`;
        const definition: EquipmentDefinition = {
          assetId,
          humanoid: layer1 ? [{ texture: layer1 }] : [],
          humanoidLeggings: layer2 ? [{ texture: layer2 }] : [],
        };

        equipments.push({
          definition,
          filePath: `assets/${namespace}/equipment/${assetName}.json`,
          namespace,
        });
      }
    }

    if (!yamlItems) {
      continue;
    }

    for (const [itemKey, rawValue] of Object.entries(yamlItems)) {
      const rawItem = asObject(rawValue);
      if (!rawItem) {
        continue;
      }

      const resource = asObject(rawItem.resource);
      const behaviours = asObject(rawItem.behaviours);
      const furniture = asObject(behaviours?.furniture);
      const armor = asObject(asObject(rawItem.specific_properties)?.armor);
      const generatedTexture = firstString(asArray(resource?.textures));
      const explicitModelPath = asString(resource?.model_path);
      const modelId = explicitModelPath
        ? normalizeModelId(namespace, explicitModelPath)
        : generatedTexture
          ? `${namespace}:${itemKey}`
          : undefined;

      if (generatedTexture) {
        const normalizedTexture = normalizeTextureId(namespace, generatedTexture);
        if (normalizedTexture) {
          const model = createGeneratedModel(namespace, itemKey, normalizedTexture);
          models.set(model.id, model);
        }
      }

      if (furniture) {
        const backingItem = normalizeMaterialId(asString(resource?.material) ?? 'PAPER');
        const definition: BlockDefinition = {
          id: `${namespace}:${itemKey}`,
          kind: 'decoration',
          backingItem,
          model: modelId,
          placeable: true,
          placement: {
            placeable: true,
            backingItem,
            placementSound: 'block.stone.place',
          },
        };

        decorations.push({
          definition,
          filePath: `data/${namespace}/filament/decorations/${itemKey}.json`,
          namespace,
        });
        continue;
      }

      const slot = asString(armor?.slot);
      const assetName = asString(armor?.custom_armor);
      const assetId = assetName ? `${namespace}:${assetName}` : undefined;
      const kind = resolveItemKind(rawItem, slot);
      const backingItem = normalizeBackingItem(kind, asString(resource?.material), slot);

      const definition: ItemDefinition = {
        id: `${namespace}:${itemKey}`,
        kind,
        backingItem,
        model: modelId,
        assetId,
        wearable: assetId
          ? {
              slot,
              equippableAssetId: assetId,
            }
          : undefined,
      };

      items.push({
        definition,
        filePath: `data/${namespace}/filament/items/${itemKey}.json`,
        namespace,
      });
    }
  }

  return {
    items,
    decorations,
    blocks,
    equipments,
    models: [...models.values()],
    parseDiagnostics,
  };
}

function createGeneratedModel(namespace: string, itemKey: string, textureId: string): ParsedModel {
  const definition: ModelReference = {
    parent: 'minecraft:item/generated',
    textures: {
      layer0: textureId,
    },
  };

  return {
    id: `${namespace}:${itemKey}`,
    definition,
    filePath: `assets/${namespace}/models/${itemKey}.json`,
    namespace,
    logicalPath: itemKey,
  };
}

function resolveItemKind(rawItem: JsonObject, slot: string | undefined): ItemDefinition['kind'] {
  const behaviours = asObject(rawItem.behaviours);
  if (behaviours?.hat === true) {
    return 'hat';
  }

  if (slot === 'head') {
    return 'helmet';
  }

  if (slot === 'chest' || slot === 'legs' || slot === 'feet') {
    return 'armor';
  }

  return 'item';
}

function normalizeBackingItem(kind: ItemDefinition['kind'], material: string | undefined, slot: string | undefined): string {
  if (material) {
    return normalizeMaterialId(material);
  }

  if (slot === 'head') {
    return 'minecraft:leather_helmet';
  }
  if (slot === 'chest') {
    return 'minecraft:leather_chestplate';
  }
  if (slot === 'legs') {
    return 'minecraft:leather_leggings';
  }
  if (slot === 'feet') {
    return 'minecraft:leather_boots';
  }
  if (kind === 'hat') {
    return 'minecraft:paper';
  }
  return 'minecraft:paper';
}

function normalizeMaterialId(material: string): string {
  return `minecraft:${material.toLowerCase()}`;
}

function normalizeModelId(namespace: string, modelPath: string): string {
  if (modelPath.includes(':')) {
    return modelPath.replace(/\.json$/i, '');
  }
  return `${namespace}:${normalizeRelativePath(modelPath).replace(/\.json$/i, '')}`;
}

function normalizeTextureId(namespace: string, texturePath: string | undefined): string | undefined {
  if (!texturePath) {
    return undefined;
  }

  if (texturePath.includes(':')) {
    return texturePath.replace(/\.png$/i, '');
  }

  return `${namespace}:${normalizeRelativePath(texturePath).replace(/\.png$/i, '')}`;
}

function extractCanonicalAssetPath(filePath: string): string | undefined {
  const match = normalizeRelativePath(filePath).match(/(?:^|\/)(assets\/[^/]+\/(?:models|textures)\/.+\.(?:json|png))$/i);
  return match?.[1];
}

function asObject(value: unknown): JsonObject | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  return value as JsonObject;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asArray(value: unknown): unknown[] | undefined {
  return Array.isArray(value) ? value : undefined;
}

function firstString(values: unknown[] | undefined): string | undefined {
  if (!values) {
    return undefined;
  }
  return values.find((value): value is string => typeof value === 'string' && value.length > 0);
}