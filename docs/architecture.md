# Architecture

Filament Workbench is split by concern to keep core logic reusable for future web integration.

## Packages

- packages/schemas: shared zod contracts.
- packages/core: parser, graph, validator, runtime-check, fixer, generator, report.
- packages/cli: command-line interface over the core package.

## Pipeline

1. Parse directory/zip input into typed pack entities.
2. Classify item, armor, decoration, block, equipment, model, and texture surfaces.
3. Build an asset graph with forward and reverse references.
4. Validate with Minecraft-focused diagnostics.
5. Run runtime-check for execution-like failure heuristics.
6. Apply deterministic safe fixes when requested.
7. Generate normalized output packs and reports from parsed entities.

## Future web integration

A future web UI can call core functions directly and reuse diagnostics, graph, runtime-check, and report payloads.
