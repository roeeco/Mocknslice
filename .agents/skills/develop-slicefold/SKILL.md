---
name: develop-slicefold
description: Build, review, or extend the SliceFold browser fabrication application. Use for repository work involving its React shell, serializable fabrication domain, pure geometry engine, worker protocol, local project persistence, material rules, 3D or 2D viewports, import/export formats, validation, tests, documentation, or staged roadmap implementation.
---

# Develop SliceFold

Implement SliceFold in verified roadmap phases while protecting the boundary between domain, geometry, application state, and presentation.

## Start every task

1. Read `references/engineering-guardrails.md`.
2. Inspect the repository, current documentation, Git status, and available commands.
3. Identify the current completed phase and keep work within the requested phase.
4. Preserve user changes and report architectural conflicts before replacing working systems.

## Implement changes

- Keep fabrication dimensions explicit in millimetres.
- Keep domain and geometry code pure TypeScript without React imports.
- Store only serializable data in persistent state; recreate Three.js objects at the presentation boundary.
- Represent warnings as structured domain data and make automated corrections visible.
- Route expensive geometry through typed worker messages while keeping the functions directly testable.
- Centralize interface strings and preserve keyboard access, visible focus, and non-colour operation labels.
- Add deterministic fixtures and tests with each geometry behaviour.
- Record significant dependency or architecture decisions in `docs/adr/`.

## Verify and report

Run formatting checks, strict type checking, lint, unit/component tests, the production build, and relevant Playwright smoke tests. Do not claim a feature works if its applicable checks were not run successfully.

Report implemented behaviour, changed files, commands and results, available workflows, limitations, decisions, and the smallest logical next task.
