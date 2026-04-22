# Filament Workbench

Filament Workbench is a production-focused, version-locked tooling engine for Minecraft content pipelines.

## Scope lock (v0.1)

- Minecraft: 1.21.1
- Mod loader: Fabric
- Filament target: 1.3.22
- Polymer-aware workflow assumptions
- No web UI in this phase

This repository is not a generic resource-pack helper and is intentionally not version-agnostic in v0.1.

## What phase 1 implements

- Import from directory and zip packs
- Parse Filament structures under data/<namespace>/filament/
- Parse resource-like structures under assets/<namespace>/
- Build an internal asset graph for item, armor, model, texture, equipment, decoration relations
- Deep validation with structured diagnostics
- Safe deterministic fixer for BOM and JSON normalization
- Deterministic generator output with reports
- CLI commands for import/lint/analyze/generate/doctor/report/fix

## Repository layout

- packages/core: parser, graph, validator, fixer, generator, reporting
- packages/cli: command-line tool
- packages/schemas: shared contracts
- fixtures: valid and broken packs
- tests: unit and integration coverage
- docs: architecture and fixture notes
- .github/workflows: CI

## CLI usage

- filament-workbench import <path>
- filament-workbench lint <path> [--strict] [--json]
- filament-workbench analyze <path> [--json]
- filament-workbench generate <input> --out <dir> [--strict] [--json]
- filament-workbench doctor <path> [--json]
- filament-workbench report <path> --format json|text
- filament-workbench fix <path> [--dry-run]

Examples:

- pnpm cli lint fixtures/broken-armor-pack
- pnpm cli report fixtures/missing-texture-pack --format json
- pnpm cli generate fixtures/valid-armor-pack --out .tmp/out
- pnpm cli fix fixtures/bom-corrupted-pack

## Diagnostic style

Examples produced by the validator:

- ERROR [equipment] asset group 'lunarset' has empty layers
- ERROR [model] Missing texture 'svframe:item/ghost_blade'
- WARN  [armor] 23 items share asset_id 'svframe:elitecreatures'
- WARN  [block] 'legendary_chest' is item-only and not placeable
- ERROR [json] UTF-8 BOM detected in assets/svframe/equipment/elitecreatures.json

## Safe auto-fixes

Safe in-place fixes:

- Strip UTF-8 BOM in JSON files
- Normalize JSON formatting and key ordering

Unsafe/speculative fixes are not auto-applied in v0.1.

## Known limitations

- Built-in vanilla models are recognized by prefix rules, but complete vanilla asset index validation is out of scope
- Source location currently reports file-level diagnostics, not full line/column mapping
- Decoration/block placement metadata checks are conservative and intentionally strict

## Dev workflow

- pnpm install
- node docs/create-bom-fixture.mjs
- pnpm typecheck
- pnpm lint
- pnpm test
- pnpm build

## Why locked to 1.21.1 + Filament 1.3.22

Version locking keeps diagnostics deterministic and avoids ambiguity around schema/behavior differences across Minecraft and Filament versions. This phase optimizes for deep correctness over broad compatibility.
