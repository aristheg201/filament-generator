import { z } from 'zod';

export const severitySchema = z.enum(['error', 'warn', 'info']);
export type Severity = z.infer<typeof severitySchema>;

export const sourceLocationSchema = z.object({
  line: z.number().int().positive().optional(),
  column: z.number().int().positive().optional(),
  jsonPointer: z.string().optional(),
});
export type SourceLocation = z.infer<typeof sourceLocationSchema>;

export const diagnosticSchema = z.object({
  severity: severitySchema,
  category: z.string().min(1),
  code: z.string().min(1),
  message: z.string().min(1),
  filePath: z.string().optional(),
  location: sourceLocationSchema.optional(),
  relatedNodes: z.array(z.string()).default([]),
  suggestedFix: z.string().optional(),
});
export type Diagnostic = z.infer<typeof diagnosticSchema>;

export const wearableSchema = z.object({
  slot: z.string().optional(),
  equippableAssetId: z.string().optional(),
});

export const placementMetadataSchema = z.object({
  placeable: z.boolean(),
  backingBlock: z.string().optional(),
  backingItem: z.string().optional(),
  placementSound: z.string().optional(),
  breakLootTable: z.string().optional(),
});
export type PlacementMetadata = z.infer<typeof placementMetadataSchema>;

export const breakMetadataSchema = z.object({
  lootTable: z.string().optional(),
  hardness: z.number().nonnegative().optional(),
  tool: z.string().optional(),
});
export type BreakMetadata = z.infer<typeof breakMetadataSchema>;

export const itemDefinitionSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['item', 'armor', 'helmet', 'hat', 'decoration', 'block']),
  backingItem: z.string().min(1),
  model: z.string().optional(),
  assetId: z.string().optional(),
  wearable: wearableSchema.optional(),
  placeable: z.boolean().optional(),
});
export type ItemDefinition = z.infer<typeof itemDefinitionSchema>;

export const blockDefinitionSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['decoration', 'block']),
  backingItem: z.string().optional(),
  backingBlock: z.string().optional(),
  model: z.string().optional(),
  assetId: z.string().optional(),
  placeable: z.boolean().optional(),
  placement: placementMetadataSchema.optional(),
  break: breakMetadataSchema.optional(),
});
export type BlockDefinition = z.infer<typeof blockDefinitionSchema>;

export const equipmentLayerSchema = z.object({
  texture: z.string().min(1),
});

export const equipmentDefinitionSchema = z.object({
  assetId: z.string().min(1),
  humanoid: z.array(equipmentLayerSchema),
  humanoidLeggings: z.array(equipmentLayerSchema),
});
export type EquipmentDefinition = z.infer<typeof equipmentDefinitionSchema>;

export const modelOverrideSchema = z.object({
  model: z.string().optional(),
  predicate: z.record(z.string(), z.number()).default({}),
});
export type ModelOverride = z.infer<typeof modelOverrideSchema>;

export const modelReferenceSchema = z
  .object({
  parent: z.string().optional(),
  textures: z.record(z.string(), z.string()).default({}),
  overrides: z.array(modelOverrideSchema).default([]),
  })
  .passthrough();
export type ModelReference = z.infer<typeof modelReferenceSchema>;

export const buildReportSchema = z.object({
  tool: z.string(),
  versionLock: z.object({
    minecraft: z.string(),
    loader: z.string(),
    filament: z.string(),
  }),
  inputPath: z.string(),
  outputPath: z.string(),
  namespaces: z.array(z.string()),
  diagnostics: z.object({
    errors: z.number().int().nonnegative(),
    warnings: z.number().int().nonnegative(),
    infos: z.number().int().nonnegative(),
  }),
  partialGeneration: z.boolean().default(false),
  generatedFiles: z.number().int().nonnegative().default(0),
  generatedAt: z.string(),
});
export type BuildReport = z.infer<typeof buildReportSchema>;
