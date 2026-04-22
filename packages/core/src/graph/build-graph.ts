import type { Diagnostic } from '@filament-workbench/schemas';
import type { AssetGraph, AssetNode, ParsedPack } from '../types.js';
import { addEdge, pushMapList } from '../utils/collections.js';
import { textureIdToPath } from '../utils/path.js';

export function buildAssetGraph(pack: ParsedPack): AssetGraph {
  const nodes = new Map<string, AssetNode>();
  const edges = new Map<string, Set<string>>();
  const reverseEdges = new Map<string, Set<string>>();
  const diagnostics: Diagnostic[] = [];
  const assetUsers = new Map<string, string[]>();

  for (const item of pack.items) {
    const id = `item:${item.definition.id}`;
    nodes.set(id, { id, type: 'item', filePath: item.filePath });

    if (item.definition.model) {
      const modelNodeId = `model:${item.definition.model}`;
      addEdge(edges, id, modelNodeId);
      addEdge(reverseEdges, modelNodeId, id);
    }

    if (item.definition.assetId) {
      pushMapList(assetUsers, item.definition.assetId, item.definition.id);
      const equipmentNodeId = `equipment:${item.definition.assetId}`;
      addEdge(edges, id, equipmentNodeId);
      addEdge(reverseEdges, equipmentNodeId, id);
    }
  }

  for (const decoration of pack.decorations) {
    const id = `decoration:${decoration.definition.id}`;
    nodes.set(id, { id, type: 'decoration', filePath: decoration.filePath });
    if (decoration.definition.model) {
      const modelNodeId = `model:${decoration.definition.model}`;
      addEdge(edges, id, modelNodeId);
      addEdge(reverseEdges, modelNodeId, id);
    }
  }

  for (const block of pack.blocks) {
    const id = `block:${block.definition.id}`;
    nodes.set(id, { id, type: 'block', filePath: block.filePath });
    if (block.definition.model) {
      const modelNodeId = `model:${block.definition.model}`;
      addEdge(edges, id, modelNodeId);
      addEdge(reverseEdges, modelNodeId, id);
    }
  }

  for (const equipment of pack.equipments) {
    const id = `equipment:${equipment.definition.assetId}`;
    nodes.set(id, { id, type: 'equipment', filePath: equipment.filePath });

    for (const layer of equipment.definition.humanoid) {
      const textureNodeId = `texture:${layer.texture}`;
      addEdge(edges, id, textureNodeId);
      addEdge(reverseEdges, textureNodeId, id);
    }
    for (const layer of equipment.definition.humanoidLeggings) {
      const textureNodeId = `texture:${layer.texture}`;
      addEdge(edges, id, textureNodeId);
      addEdge(reverseEdges, textureNodeId, id);
    }
  }

  for (const model of pack.models) {
    const id = `model:${model.id}`;
    nodes.set(id, { id, type: 'model', filePath: model.filePath });

    if (model.definition.parent) {
      const parentModelId = `model:${model.definition.parent}`;
      addEdge(edges, id, parentModelId);
      addEdge(reverseEdges, parentModelId, id);
    }

    for (const textureRef of Object.values(model.definition.textures)) {
      const textureNodeId = `texture:${textureRef}`;
      addEdge(edges, id, textureNodeId);
      addEdge(reverseEdges, textureNodeId, id);
      nodes.set(textureNodeId, { id: textureNodeId, type: 'texture', filePath: textureIdToPath(textureRef) });
    }
  }

  for (const texturePath of pack.texturePaths) {
    const id = texturePathToNodeId(texturePath);
    nodes.set(id, { id, type: 'texture', filePath: texturePath });
  }

  for (const [assetId, users] of assetUsers.entries()) {
    if (users.length > 5) {
      diagnostics.push({
        severity: 'warn',
        category: 'armor',
        code: 'ASSET_ID_OVER_SHARED',
        message: `${users.length} items share asset_id '${assetId}'`,
        relatedNodes: users,
      });
    }
  }

  for (const node of nodes.values()) {
    if ((node.type === 'model' || node.type === 'equipment') && !reverseEdges.has(node.id)) {
      diagnostics.push({
        severity: 'warn',
        category: node.type,
        code: node.type === 'model' ? 'UNREACHABLE_MODEL' : 'UNUSED_EQUIPMENT_GROUP',
        message: node.type === 'model' ? `Model '${node.id.replace(/^model:/, '')}' is unreachable` : `Equipment group '${node.id.replace(/^equipment:/, '')}' is not referenced by any item`,
        filePath: node.filePath,
        relatedNodes: [],
      });
    }
  }

  return { nodes, edges, reverseEdges, diagnostics };
}

export function getDependencies(graph: AssetGraph, nodeId: string): string[] {
  return [...(graph.edges.get(nodeId) ?? new Set<string>())].sort((a, b) => a.localeCompare(b));
}

export function getDependents(graph: AssetGraph, nodeId: string): string[] {
  return [...(graph.reverseEdges.get(nodeId) ?? new Set<string>())].sort((a, b) => a.localeCompare(b));
}

function texturePathToNodeId(path: string): string {
  const m = path.match(/^assets\/([^/]+)\/textures\/(.+)\.png$/);
  if (!m) {
    return `texture:${path}`;
  }
  return `texture:${m[1]}:${m[2]}`;
}
