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
