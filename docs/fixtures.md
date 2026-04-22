# Fixtures

Fixtures are deterministic and mapped to concrete validator scenarios:

- valid-armor-pack: valid equipment/model/texture links.
- valid-block-pack: valid block metadata, placement metadata, and normalized generation input.
- broken-armor-pack: empty equipment layers and missing leggings data.
- invalid-block-pack: invalid backing block plus missing placement metadata.
- missing-texture-pack: model references missing texture.
- missing-equipment-texture-pack: equipment layers point to absent render textures.
- bom-corrupted-pack: UTF-8 BOM in JSON files.
- item-only-fake-block-pack: decoration marked non-placeable.
- runtime-mismatch-pack: inventory model exists but no worn armor asset group is linked.
