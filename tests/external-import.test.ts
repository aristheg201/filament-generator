import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { generatePack, parsePack } from '@filament-workbench/core';

describe('external yaml import', () => {
  it('converts itemsadder-style yaml into canonical filament entities', async () => {
    const fixtureRoot = path.resolve('.tmp/external-itemsadder-pack');
    await fs.rm(fixtureRoot, { recursive: true, force: true });

    await writeFixture(fixtureRoot, 'plugins/ItemsAdder/contents/demo/configs/demo/items.yml', `info:
  namespace: demo
items:
  demo_blade:
    display_name: Demo Blade
    resource:
      generate: false
      material: DIAMOND_SWORD
      model_path: gear/demo_blade
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
      'plugins/ItemsAdder/contents/demo/resourcepack/assets/demo/models/gear/demo_blade.json',
      JSON.stringify({ parent: 'minecraft:item/generated', textures: { layer0: 'demo:gear/demo_blade' } }),
    );
    await writeFixture(
      fixtureRoot,
      'plugins/ItemsAdder/contents/demo/resourcepack/assets/demo/models/furniture/demo_chest.json',
      JSON.stringify({ parent: 'minecraft:item/generated', textures: { layer0: 'demo:furniture/demo_chest' } }),
    );

    await writeFixture(fixtureRoot, 'plugins/ItemsAdder/contents/demo/resourcepack/assets/demo/textures/gear/demo_blade.png', 'png');
    await writeFixture(fixtureRoot, 'plugins/ItemsAdder/contents/demo/resourcepack/assets/demo/textures/furniture/demo_chest.png', 'png');
    await writeFixture(fixtureRoot, 'plugins/ItemsAdder/contents/demo/resourcepack/assets/demo/textures/armor/demo_layer_1.png', 'png');
    await writeFixture(fixtureRoot, 'plugins/ItemsAdder/contents/demo/resourcepack/assets/demo/textures/armor/demo_layer_2.png', 'png');
    await writeFixture(fixtureRoot, 'plugins/ItemsAdder/contents/demo/resourcepack/assets/demo/textures/armor/demo_helmet_icon.png', 'png');

    const pack = await parsePack(fixtureRoot);
    expect(pack.parseDiagnostics).toHaveLength(0);
    expect(pack.namespaces).toContain('demo');
    expect(pack.items.map((entry) => entry.definition.id)).toEqual(
      expect.arrayContaining(['demo:demo_blade', 'demo:demo_helmet']),
    );
    expect(pack.decorations.map((entry) => entry.definition.id)).toContain('demo:demo_chest');
    expect(pack.equipments.map((entry) => entry.definition.assetId)).toContain('demo:demoset');
    expect(pack.models.map((entry) => entry.id)).toEqual(
      expect.arrayContaining(['demo:gear/demo_blade', 'demo:furniture/demo_chest', 'demo:demo_helmet']),
    );
  });

  it('generates canonical filament json and does not copy yaml inputs', async () => {
    const fixtureRoot = path.resolve('.tmp/external-itemsadder-pack');
    const out = path.resolve('.tmp/generated-external-itemsadder');

    await fs.rm(out, { recursive: true, force: true });
    await generatePack(fixtureRoot, out);

    const generatedItem = await fs.readFile(path.join(out, 'data/demo/filament/items/demo_blade.json'), 'utf8');
    const generatedDecoration = await fs.readFile(path.join(out, 'data/demo/filament/decorations/demo_chest.json'), 'utf8');
    const generatedEquipment = await fs.readFile(path.join(out, 'assets/demo/equipment/demoset.json'), 'utf8');
    const generatedHelmetModel = await fs.readFile(path.join(out, 'assets/demo/models/demo_helmet.json'), 'utf8');
    const generatedTexture = await fs.readFile(path.join(out, 'assets/demo/textures/gear/demo_blade.png'), 'utf8');

    expect(generatedItem).toContain('"id": "demo:demo_blade"');
    expect(generatedDecoration).toContain('"id": "demo:demo_chest"');
    expect(generatedEquipment).toContain('"assetId": "demo:demoset"');
    expect(generatedHelmetModel).toContain('"parent": "minecraft:item/generated"');
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