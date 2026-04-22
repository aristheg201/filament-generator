import type { ClassifiedFile, FileRole, SourceFile } from '../types.js';
import { normalizeRelativePath } from '../utils/path.js';

const ITEM_RE = /^data\/([^/]+)\/filament\/items\/(.+)\.json$/;
const DECORATION_RE = /^data\/([^/]+)\/filament\/decorations\/(.+)\.json$/;
const EQUIPMENT_RE = /^assets\/([^/]+)\/equipment\/(.+)\.json$/;
const MODEL_RE = /^assets\/([^/]+)\/models\/(.+)\.json$/;
const TEXTURE_RE = /^assets\/([^/]+)\/textures\/(.+)\.png$/;

export function classifyFile(file: SourceFile): ClassifiedFile {
  const normalizedPath = normalizeRelativePath(file.path);

  const item = normalizedPath.match(ITEM_RE);
  if (item) {
    return withRole(file, 'filament-item', item[1], item[2]);
  }

  const decoration = normalizedPath.match(DECORATION_RE);
  if (decoration) {
    return withRole(file, 'filament-decoration', decoration[1], decoration[2]);
  }

  const equipment = normalizedPath.match(EQUIPMENT_RE);
  if (equipment) {
    return withRole(file, 'equipment', equipment[1], equipment[2]);
  }

  const model = normalizedPath.match(MODEL_RE);
  if (model) {
    return withRole(file, 'model', model[1], model[2]);
  }

  const texture = normalizedPath.match(TEXTURE_RE);
  if (texture) {
    return withRole(file, 'texture', texture[1], texture[2]);
  }

  return {
    ...file,
    path: normalizedPath,
    role: 'unknown',
  };
}

function withRole(
  file: SourceFile,
  role: FileRole,
  namespace?: string,
  logicalPath?: string,
): ClassifiedFile {
  return {
    ...file,
    path: normalizeRelativePath(file.path),
    role,
    namespace,
    logicalPath,
  };
}
