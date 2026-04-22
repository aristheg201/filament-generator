import fs from 'node:fs/promises';

const targets = [
  'fixtures/bom-corrupted-pack/assets/svframe/equipment/bomset.json',
  'fixtures/bom-corrupted-pack/data/svframe/filament/items/bom_helmet.json',
];

for (const file of targets) {
  const current = await fs.readFile(file);
  const bom = Buffer.from([0xef, 0xbb, 0xbf]);
  if (current[0] === 0xef && current[1] === 0xbb && current[2] === 0xbf) {
    continue;
  }
  await fs.writeFile(file, Buffer.concat([bom, current]));
}

console.log('BOM fixture generated.');
