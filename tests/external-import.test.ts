import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { generatePack, parsePack, validatePack } from '@filament-workbench/core';

describe('external yaml import', () => {
  it('converts itemsadder-style yaml into canonical filament entities', async () => {
    const fixtureRoot = path.resolve('.tmp/external-itemsadder-pack');
    await fs.rm(fixtureRoot, { recursive: true, force: true });

    await writeFixture(fixtureRoot, 'plugins/ItemsAdder/contents/demo/configs/demo/items.yml', `info:
  namespace: demo
items:
  demo_bow:
    display_name: Demo Bow
    resource:
      generate: false
      material: BOW
      model_path: gear/demo_bow
  demo_chest:
    display_name: Demo Chest
    resource:
      generate: false
      material: PAPER
      model_path: furniture/demo_chest
    behaviours:
      furniture:
        solid: true
`);

    await writeFixture(fixtureRoot, 'plugins/ItemsAdder/contents/demo/configs/demo/armor.yml', `info:
  namespace: demo
armors_rendering:
  demoset:
    layer_1: armor/demo_layer_1
    layer_2: armor/demo_layer_2
items:
  demo_helmet:
    display_name: Demo Helmet
    resource:
      generate: true
      textures:
        - armor/demo_helmet_icon.png
    specific_properties:
      armor:
        slot: head
        custom_armor: demoset
`);

    await writeFixture(
      fixtureRoot,
      'plugins/ItemsAdder/contents/demo/resourcepack/assets/demo/models/gear/demo_bow.json',
      JSON.stringify({
        parent: 'minecraft:item/generated',
        textures: { layer0: 'demo:gear/demo_bow' },
        display: { gui: { rotation: [0, 0, 0] } },
        elements: [{ from: [0, 0, 0], to: [1, 1, 1] }],
      }),
    );
    await writeFixture(
      fixtureRoot,
      'plugins/ItemsAdder/contents/demo/resourcepack/assets/demo/models/gear/demo_bow_0.json',
      JSON.stringify({ parent: 'minecraft:item/generated', textures: { layer0: 'demo:gear/demo_bow' }, elements: [{ from: [1, 1, 1], to: [2, 2, 2] }] }),
    );
    await writeFixture(
      fixtureRoot,
      'plugins/ItemsAdder/contents/demo/resourcepack/assets/demo/models/furniture/demo_chest.json',
      JSON.stringify({ parent: 'minecraft:item/generated', textures: { layer0: 'demo:furniture/demo_chest' } }),
    );
    await writeFixture(
      fixtureRoot,
      'plugins/ItemsAdder/contents/demo/resourcepack/assets/minecraft/models/item/bow.json',
      JSON.stringify({
        parent: 'item/generated',
        textures: { layer0: 'minecraft:item/bow' },
        overrides: [
          { predicate: { custom_model_data: 10 }, model: 'demo:gear/demo_bow' },
          { predicate: { custom_model_data: 11 }, model: 'demo:gear/demo_bow_0' },
        ],
      }),
    );

    await writeFixture(fixtureRoot, 'plugins/ItemsAdder/contents/demo/resourcepack/assets/demo/textures/gear/demo_bow.png', 'png');
    await writeFixture(fixtureRoot, 'plugins/ItemsAdder/contents/demo/resourcepack/assets/demo/textures/furniture/demo_chest.png', 'png');
    await writeFixture(fixtureRoot, 'plugins/ItemsAdder/contents/demo/resourcepack/assets/demo/textures/armor/demo_layer_1.png', 'png');
    await writeFixture(fixtureRoot, 'plugins/ItemsAdder/contents/demo/resourcepack/assets/demo/textures/armor/demo_layer_2.png', 'png');
    await writeFixture(fixtureRoot, 'plugins/ItemsAdder/contents/demo/resourcepack/assets/demo/textures/armor/demo_helmet_icon.png', 'png');

    const pack = await parsePack(fixtureRoot);
    const validation = validatePack(pack);
    expect(pack.parseDiagnostics).toHaveLength(0);
    expect(pack.namespaces).toContain('demo');
    expect(pack.items.map((entry) => entry.definition.id)).toEqual(
      expect.arrayContaining(['demo:demo_bow', 'demo:demo_helmet']),
    );
    expect(pack.decorations.map((entry) => entry.definition.id)).toContain('demo:demo_chest');
    expect(pack.equipments.map((entry) => entry.definition.assetId)).toContain('demo:demoset');
    expect(pack.models.map((entry) => entry.id)).toEqual(
      expect.arrayContaining(['demo:gear/demo_bow', 'demo:gear/demo_bow_0', 'demo:furniture/demo_chest', 'demo:demo_helmet', 'minecraft:bow']),
    );
    expect(
      validation.diagnostics.some(
        (entry) => entry.code === 'UNREACHABLE_MODEL' && /demo_bow_0|minecraft:bow/.test(entry.filePath ?? entry.message),
      ),
    ).toBe(false);
  });

  it('generates canonical filament json and does not copy yaml inputs', async () => {
    const fixtureRoot = path.resolve('.tmp/external-itemsadder-pack');
    const out = path.resolve('.tmp/generated-external-itemsadder');

    await fs.rm(out, { recursive: true, force: true });
    await generatePack(fixtureRoot, out);

    const generatedItem = await fs.readFile(path.join(out, 'data/demo/filament/items/demo_bow.json'), 'utf8');
    const generatedDecoration = await fs.readFile(path.join(out, 'data/demo/filament/decorations/demo_chest.json'), 'utf8');
    const generatedEquipment = await fs.readFile(path.join(out, 'assets/demo/equipment/demoset.json'), 'utf8');
    const generatedHelmetModel = await fs.readFile(path.join(out, 'assets/demo/models/demo_helmet.json'), 'utf8');
    const generatedBowModel = await fs.readFile(path.join(out, 'assets/demo/models/gear/demo_bow.json'), 'utf8');
    const generatedVanillaBowModel = await fs.readFile(path.join(out, 'assets/minecraft/models/item/bow.json'), 'utf8');
    const generatedTexture = await fs.readFile(path.join(out, 'assets/demo/textures/gear/demo_bow.png'), 'utf8');

    expect(generatedItem).toContain('"id": "demo:demo_bow"');
    expect(generatedDecoration).toContain('"id": "demo:demo_chest"');
    expect(generatedEquipment).toContain('"assetId": "demo:demoset"');
    expect(generatedHelmetModel).toContain('"parent": "minecraft:item/generated"');
    expect(generatedBowModel).toContain('"elements"');
    expect(generatedVanillaBowModel).toContain('"overrides"');
    expect(generatedVanillaBowModel).toContain('"demo:gear/demo_bow_0"');
    expect(generatedTexture).toBe('png');

    await expect(
      fs.stat(path.join(out, 'plugins/ItemsAdder/contents/demo/configs/demo/items.yml')),
    ).rejects.toThrow();
  });
});

async function writeFixture(root: string, relativePath: string, content: string): Promise<void> {
  const targetPath = path.join(root, relativePath);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, content, 'utf8');
}