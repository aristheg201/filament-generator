import type { Diagnostic, EquipmentDefinition, ItemDefinition, ModelReference } from '@filament-workbench/schemas';

export type FileRole =
  | 'filament-item'
  | 'filament-decoration'
  | 'equipment'
  | 'model'
  | 'texture'
  | 'unknown';

export interface SourceFile {
  path: string;
  content: Buffer;
}

export interface ClassifiedFile extends SourceFile {
  role: FileRole;
  namespace?: string;
  logicalPath?: string;
}

export interface ParsedFile extends ClassifiedFile {
  hasBom: boolean;
  jsonValue?: unknown;
  parseError?: string;
}

export interface ParsedItem {
  definition: ItemDefinition;
  filePath: string;
  namespace: string;
}

export interface ParsedEquipment {
  definition: EquipmentDefinition;
  filePath: string;
  namespace: string;
}

export interface ParsedModel {
  id: string;
  definition: ModelReference;
  filePath: string;
  namespace: string;
}

export interface ParsedPack {
  inputPath: string;
  files: ParsedFile[];
  namespaces: string[];
  items: ParsedItem[];
  decorations: ParsedItem[];
  equipments: ParsedEquipment[];
  models: ParsedModel[];
  texturePaths: Set<string>;
  parseDiagnostics: Diagnostic[];
}

export type AssetNodeType = 'item' | 'decoration' | 'equipment' | 'model' | 'texture';

export interface AssetNode {
  id: string;
  type: AssetNodeType;
  filePath?: string;
}

export interface AssetGraph {
  nodes: Map<string, AssetNode>;
  edges: Map<string, Set<string>>;
  reverseEdges: Map<string, Set<string>>;
  diagnostics: Diagnostic[];
}

export interface ValidateResult {
  graph: AssetGraph;
  diagnostics: Diagnostic[];
}
