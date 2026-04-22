# Architecture

Filament Workbench is split by concern to keep core logic reusable for future web integration.

## Packages

- packages/schemas: shared zod contracts.
- packages/core: parser, graph, validator, fixer, generator, report.
- packages/cli: command-line interface over the core package.

## Pipeline

1. Parse directory/zip input into typed pack entities.
2. Build an asset graph with forward and reverse references.
3. Validate with Minecraft-focused diagnostics.
4. Apply deterministic safe fixes when requested.
5. Generate normalized output packs and reports.

## Future web integration

A web UI can call core functions directly and reuse diagnostics/graph/report payloads.
