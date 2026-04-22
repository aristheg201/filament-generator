import path from 'node:path';

export function normalizeSlashes(input: string): string {
  return input.replace(/\\/g, '/').replace(/\/+/g, '/');
}

export function normalizeRelativePath(input: string): string {
  return normalizeSlashes(input).replace(/^\.\//, '').replace(/^\//, '');
}

export function ensureJsonExtension(input: string): string {
  return input.endsWith('.json') ? input : `${input}.json`;
}

export function modelIdToPath(id: string): string {
  const normalized = normalizeSlashes(id);
  const parts = normalized.split(':');
  const namespace = parts[1] ? parts[0] : 'minecraft';
  const modelPath = parts[1] ?? parts[0];
  return `assets/${namespace}/models/${modelPath}.json`;
}

export function normalizeModelReferenceId(reference: string, fallbackNamespace = 'minecraft'): string {
  const normalized = normalizeSlashes(reference).replace(/\.json$/i, '');
  const separatorIndex = normalized.indexOf(':');

  let namespace = fallbackNamespace;
  let modelPath = normalized;

  if (separatorIndex >= 0) {
    namespace = normalized.slice(0, separatorIndex);
    modelPath = normalized.slice(separatorIndex + 1);
  }

  if (modelPath.startsWith('item/')) {
    modelPath = modelPath.slice('item/'.length);
  }

  return `${namespace}:${modelPath}`;
}

export function isBuiltinParentReference(id: string): boolean {
  return (
    id.startsWith('builtin/') ||
    id === 'item/generated' ||
    id === 'item/handheld' ||
    id === 'item/handheld_rod' ||
    id === 'minecraft:item/generated' ||
    id === 'minecraft:item/handheld' ||
    id === 'minecraft:item/handheld_rod'
  );
}

export function textureIdToPath(id: string): string {
  const normalized = normalizeSlashes(id);
  const parts = normalized.split(':');
  const namespace = parts[1] ? parts[0] : 'minecraft';
  const texturePath = parts[1] ?? parts[0];
  return `assets/${namespace}/textures/${texturePath}.png`;
}

export function joinOutputPath(baseDir: string, relativePath: string): string {
  return path.join(baseDir, ...normalizeRelativePath(relativePath).split('/'));
}
