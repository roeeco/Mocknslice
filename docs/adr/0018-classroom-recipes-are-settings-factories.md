# ADR 0018: Model classroom recipes as settings factories

## Status

Accepted

## Context

Classroom kits need outcome-oriented starting points without creating recipe-specific geometry or exporters.

## Decision

A recipe is a versioned, localized registry entry whose pure factory returns complete resolved panel-composer settings. Saved projects retain optional recipe ID/revision as provenance and persist every resolved dimension, joint, divider, and feature as source of truth.

Loading a project never re-runs the current recipe factory. Recipe registry changes affect only newly applied recipes.

## Consequences

Recipes remain UI presets over the normal panel pipeline. Existing projects are stable when defaults evolve, and no recipe-specific output path is permitted.
