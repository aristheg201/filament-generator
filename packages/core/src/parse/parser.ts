import type { BlockDefinition, Diagnostic, EquipmentDefinition, ItemDefinition, ModelReference } from '@filament-workbench/schemas';
import { blockDefinitionSchema, equipmentDefinitionSchema, itemDefinitionSchema, modelReferenceSchema } from '@filament-workbench/schemas';
import { loadFileSource } from '../fs/source-loader.js';
import type { ParsedBlock, ParsedEquipment, ParsedItem, ParsedModel, ParsedPack, ParsedFile } from '../types.js';
import { classifyFile } from './classify.js';
import { canonicalizeExternalAssetFiles, importExternalPack } from './external-pack.js';
import { parseJsonFile } from './json.js';
import { detectNamespaces } from './namespace.js';
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
