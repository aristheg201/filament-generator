import type { BlockDefinition, Diagnostic, EquipmentDefinition, ItemDefinition, ModelReference } from '@filament-workbench/schemas';
import { blockDefinitionSchema, equipmentDefinitionSchema, itemDefinitionSchema, modelReferenceSchema } from '@filament-workbench/schemas';
import { loadFileSource } from '../fs/source-loader.js';
import type { ParsedBlock, ParsedEquipment, ParsedItem, ParsedModel, ParsedPack, ParsedFile } from '../types.js';
import { classifyFile } from './classify.js';
import { canonicalizeExternalAssetFiles, importExternalPack } from './external-pack.js';
import { parseJsonFile } from './json.js';
import { detectNamespaces } from './namespace.js';
import { isBuiltinParentReference, normalizeModelReferenceId } from '../utils/path.js';
import { diagnostic } from '../validate/diagnostics.js';

export async function parsePack(inputPath: string): Promise<ParsedPack> {
  const source = await loadFileSource(inputPath);
  const sourceFiles = await source.listFiles();
  const files = canonicalizeExternalAssetFiles(sourceFiles);
  const classified = files.map((file) => classifyFile(file));
  const namespaces = new Set(detectNamespaces(classified));

  const parseDiagnostics: Diagnostic[] = [];
  const parsedFiles: ParsedFile[] = [];
  const items: ParsedItem[] = [];
  const decorations: ParsedBlock[] = [];
  const blocks: ParsedBlock[] = [];
  const equipments: ParsedEquipment[] = [];
  const models: ParsedModel[] = [];
  const texturePaths = new Set<string>();

  for (const file of classified) {
    if (file.role === 'texture') {
      texturePaths.add(file.path);
      parsedFiles.push({ ...file, hasBom: false });
      continue;
    }

    if (file.path.endsWith('.json')) {
      const parsed = parseJsonFile(file);
      parsedFiles.push(parsed);

      if (parsed.hasBom) {
        parseDiagnostics.push(
          diagnostic('error', 'json', 'JSON_BOM', `UTF-8 BOM detected in ${parsed.path}`, parsed.path, {
            suggestedFix: 'Run fix command to strip BOM',
          }),
        );
      }

      if (parsed.parseError) {
        parseDiagnostics.push(
          diagnostic('error', 'json', 'JSON_INVALID', `Invalid JSON in ${parsed.path}: ${parsed.parseError}`, parsed.path),
        );
        continue;
      }

      if (parsed.role === 'filament-item') {
        const result = itemDefinitionSchema.safeParse(parsed.jsonValue);
        if (!result.success) {
          parseDiagnostics.push(
            diagnostic(
              'error',
              'schema',
              'ITEM_SCHEMA_INVALID',
              `Invalid item definition in ${parsed.path}: ${result.error.issues[0]?.message ?? 'unknown'}`,
              parsed.path,
            ),
          );
          continue;
        }

        items.push({
          definition: result.data,
          filePath: parsed.path,
          namespace: parsed.namespace ?? 'minecraft',
        });
      }

      if (parsed.role === 'filament-decoration' || parsed.role === 'filament-block') {
        const result = blockDefinitionSchema.safeParse(parsed.jsonValue);
        if (!result.success) {
          parseDiagnostics.push(
            diagnostic(
              'error',
              'schema',
              'BLOCK_SCHEMA_INVALID',
              `Invalid block definition in ${parsed.path}: ${result.error.issues[0]?.message ?? 'unknown'}`,
              parsed.path,
            ),
          );
          continue;
        }

        pushBlock(parsed.role, result.data, parsed.path, parsed.namespace, decorations, blocks);
      }

      if (parsed.role === 'equipment') {
        const result = equipmentDefinitionSchema.safeParse(parsed.jsonValue);
        if (!result.success) {
          parseDiagnostics.push(
            diagnostic(
              'error',
              'schema',
              'EQUIPMENT_SCHEMA_INVALID',
              `Invalid equipment definition in ${parsed.path}: ${result.error.issues[0]?.message ?? 'unknown'}`,
              parsed.path,
            ),
          );
          continue;
        }
        equipments.push({
          definition: result.data,
          filePath: parsed.path,
          namespace: parsed.namespace ?? 'minecraft',
        });
      }

      if (parsed.role === 'model') {
        const result = modelReferenceSchema.safeParse(parsed.jsonValue);
        if (!result.success) {
          parseDiagnostics.push(
            diagnostic(
              'error',
              'schema',
              'MODEL_SCHEMA_INVALID',
              `Invalid model definition in ${parsed.path}: ${result.error.issues[0]?.message ?? 'unknown'}`,
              parsed.path,
            ),
          );
          continue;
        }

        const id = toModelId(parsed.namespace ?? 'minecraft', parsed.logicalPath ?? 'unknown');
        models.push({
          id,
          definition: result.data,
          filePath: parsed.path,
          namespace: parsed.namespace ?? 'minecraft',
          logicalPath: parsed.logicalPath ?? 'item/unknown',
        });
      }
      continue;
    }

    parsedFiles.push({ ...file, hasBom: false });
  }

  const external = importExternalPack(sourceFiles);
  for (const entry of external.items) {
    items.push(entry);
    namespaces.add(entry.namespace);
  }
  for (const entry of external.decorations) {
    decorations.push(entry);
    namespaces.add(entry.namespace);
  }
  for (const entry of external.blocks) {
    blocks.push(entry);
    namespaces.add(entry.namespace);
  }
  for (const entry of external.equipments) {
    equipments.push(entry);
    namespaces.add(entry.namespace);
  }
  for (const entry of external.models) {
    models.push(entry);
    namespaces.add(entry.namespace);
  }
  parseDiagnostics.push(...external.parseDiagnostics);
  repairModelLinks(models);

  return {
    inputPath,
    files: parsedFiles,
    namespaces: [...namespaces].sort((a, b) => a.localeCompare(b)),
    items,
    decorations,
    blocks,
    equipments,
    models,
    texturePaths,
    parseDiagnostics,
  };
}

function toModelId(namespace: string, logicalPath: string): string {
  const clean = logicalPath.replace(/^item\//, '').replace(/\.json$/, '');
  return `${namespace}:${clean}`;
}

function pushBlock(
  role: 'filament-decoration' | 'filament-block',
  definition: BlockDefinition,
  filePath: string,
  namespace: string | undefined,
  decorations: ParsedBlock[],
  blocks: ParsedBlock[],
): void {
  const entry: ParsedBlock = {
    definition,
    filePath,
    namespace: namespace ?? 'minecraft',
  };

  if (role === 'filament-decoration') {
    decorations.push(entry);
    return;
  }
  blocks.push(entry);
}

export type { BlockDefinition, EquipmentDefinition, ItemDefinition, ModelReference };

function repairModelLinks(models: ParsedModel[]): void {
  const availableModelIds = new Set(models.map((entry) => entry.id));

  for (const model of models) {
    if (model.definition.parent && !isBuiltinParentReference(model.definition.parent)) {
      model.definition.parent = resolveModelReference(model.definition.parent, model.namespace, availableModelIds);
    }

    for (const override of model.definition.overrides ?? []) {
      if (!override.model || override.model.startsWith('builtin/')) {
        continue;
      }

      override.model = resolveModelReference(override.model, model.namespace, availableModelIds);
    }
  }
}

function resolveModelReference(reference: string, namespace: string, availableModelIds: Set<string>): string {
  const normalizedReference = normalizeModelReferenceId(reference, namespace);
  if (availableModelIds.has(normalizedReference)) {
    return normalizedReference;
  }

  if (namespace === 'minecraft' && reference.startsWith('item/')) {
    return reference;
  }

  const repaired = findNearestModelId(normalizedReference, availableModelIds);
  return repaired ?? normalizedReference;
}

function findNearestModelId(targetId: string, availableModelIds: Set<string>): string | undefined {
  const separatorIndex = targetId.indexOf(':');
  const namespace = separatorIndex >= 0 ? targetId.slice(0, separatorIndex) : 'minecraft';
  const targetPath = separatorIndex >= 0 ? targetId.slice(separatorIndex + 1) : targetId;
  const targetBaseName = targetPath.split('/').at(-1) ?? targetPath;

  const sameNamespaceIds = [...availableModelIds].filter((entry) => entry.startsWith(`${namespace}:`));
  const baseNameMatches = sameNamespaceIds.filter((entry) => {
    const candidatePath = entry.slice(namespace.length + 1);
    const candidateBaseName = candidatePath.split('/').at(-1) ?? candidatePath;
    return candidateBaseName === targetBaseName;
  });

  if (baseNameMatches.length === 1) {
    return baseNameMatches[0];
  }

  let bestCandidate: string | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const candidateId of sameNamespaceIds) {
    const candidatePath = candidateId.slice(namespace.length + 1);
    const candidateBaseName = candidatePath.split('/').at(-1) ?? candidatePath;
    const distance = levenshteinDistance(targetBaseName, candidateBaseName);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestCandidate = candidateId;
      continue;
    }

    if (distance === bestDistance) {
      bestCandidate = undefined;
    }
  }

  return bestDistance <= 2 ? bestCandidate : undefined;
}

function levenshteinDistance(left: string, right: string): number {
  if (left === right) {
    return 0;
  }

  const previous = new Array<number>(right.length + 1).fill(0).map((_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = previous[0] ?? 0;
    previous[0] = leftIndex;

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const up = previous[rightIndex] ?? 0;
      const leftValue = previous[rightIndex - 1] ?? 0;
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      previous[rightIndex] = Math.min(
        up + 1,
        leftValue + 1,
        diagonal + substitutionCost,
      );
      diagonal = up;
    }
  }

  return previous[right.length] ?? 0;
}
