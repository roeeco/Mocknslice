# MocknSlice upgrade handoff and remaining phases

## Scope and approval boundary

This document maps the attached implementation plan and execution brief to the implemented repository and the work still needed. Direct user instructions govern the work: no FEFCO design without a real template; finish the current phase, commit to GitHub, and pause before proceeding. The earlier request to commit the unfinished phase 10 was satisfied by checkpoint `7fdc51f`. The resumed work completes phase 10's software implementation and local verification. It does **not** establish the plan's full release exit gate: physical laser checks and observed GitHub CI results remain outstanding.

The additional phases below are proposed follow-up work, not phases already authorized for implementation. No merge, deployment, legacy removal, physical certification or FEFCO additions are included in this checkpoint.

## Implementation plan against completed work

| Original phase / goal                           | Implemented evidence                                                                                                                                                                                                                         | Remaining intersection with the plan                                                                                                                                                                |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0: baseline and guardrails                      | `b71b517`; `UPGRADE_BASELINE.md`, literal legacy output/project fixtures, CI workflow, ADR 0026                                                                                                                                              | Preserve these fixtures when introducing future geometry; never regenerate them to hide a failure.                                                                                                  |
| 1: common fabrication graph                     | `09368d6`; pure serializable graph, adapters, shared primitives and synchronization checks                                                                                                                                                   | Keep unsupported legacy adapters inspection-only. Migrate a new generator only when its physical boundary and ID correspondence are verified.                                                       |
| 2: registry                                     | `1077efb`; seven actual folding families with bounded parameters and geometry fixtures                                                                                                                                                       | Real FEFCO style modules are still absent. Registry architecture is ready, but the proposed 2–4 accurate codes have not been delivered.                                                             |
| 3: Studio and catalog                           | `3b291a6`; Create/Design/Manufacture workspace, English/Hebrew RTL, search, original previews, undo-safe inputs and named projects                                                                                                           | Catalog currently contains seven generic folding families plus five actual construction recipes. No reference-only FEFCO designs. Add any approved style only after implementing its template.      |
| 4: independent papercraft kernel                | `cc4f6ce`; manifold preflight, half-edges, signed folds, rigid forests, deterministic bounded optimization and workers                                                                                                                       | Complex curved/high-poly sources remain outside the conservative native output limits. No GPL implementation was imported.                                                                          |
| 5: physical net boundaries                      | `ce3076f`; closed cut contours, integrated tabs, paired labels, collision checks and graph bridge                                                                                                                                            | Validate tab bonding, score direction and practical assembly on real stock. Digital tab/collision checks are not a physical certificate.                                                            |
| 6: durable editor                               | `f640073`; direct 2D/3D edge editing, island transforms/locks, keyboard controls and persistent v9 data                                                                                                                                      | Legacy removal awaits separate parity evidence. Phase 10 now adds explicit source-update review and unresolved-intent preservation.                                                                 |
| 7: prepared output and migration                | `4d75b7f`; one frozen prepared snapshot, post-kerf shape/placement gates, draft/production distinction, all-sheet SVG/PDF and v1–v8 migration                                                                                                | Verify machine-specific operation mappings and measured kerf with physical cuts. Keep nominal-fit warnings and review gates.                                                                        |
| 8: sliced/panel engines and layout              | `8d7609c`; closed slices and waffle mouths, registration holes, decomposed panel boundaries, per-role stock, deterministic MaxRects and retained locks                                                                                       | Physical slot accessibility and fit still need material testing. Historical press-fit slits remain inspectable and unverified for production.                                                       |
| 9: bounded authoring                            | `1421360`; immutable versioned definitions, bounded numeric AST, real cross-tray authoring, variants/clone/reset, library and definition import/export                                                                                       | More authoring primitives or new style families need their own verified implementation. Existing library entries never silently alter saved projects.                                               |
| 10: source updates, performance and reliability | ADR 0035; confirmed relinking, retained unmatched edits, stable accepted simplification, source-oriented multi-body folding, worker lifecycle/cancellation, buffered inputs, autosave race protection and concave/hole preview triangulation | Full release gate remains open until remote CI is observed and physical evidence is recorded. Mixed formats beyond tested STL/project/definition JSON and removal of legacy workflows are deferred. |

## What changed in the resumed phase 10

- Mesh updates require review before acceptance; cancel preserves the source, and accept is one undoable transaction. Exact matches retain edits. Unique geometric matches transfer intent; ambiguous edits are saved for explicit remapping/discard and block production output.
- Accepted simplified meshes remain stable for seam/tab editing and reload. The original source is retained. Guarded simplification preserves sharp coordinates and manifold/body topology, and requires a continuous symmetric deviation proof.
- Failed candidates expose explicit tab correction controls while preserving last valid output. Tab-only edits no longer unnecessarily change the search forest.
- Undo, project replacement and cancel invalidate workers. Late hydration/save completions cannot erase newer edits/history or mark them saved. Failed hydration does not automatically replace the last saved record.
- Reload selects an occupied sheet, so persisted net edges remain accessible. Folded disconnected bodies retain source orientation and spacing. Concave panel previews exclude holes correctly.
- New regression coverage exercises source confirmation, unmatched intent, simplification/cache validation, cancellation, reload, continuous deviation bounds, fold pose correspondence, autosave races and schema-version bypass rejection. Legacy literal goldens are unchanged.

## Next phase A: implement the missing FEFCO templates

**Plan goals:** sections 4–5, PRs 2–3 and the classic-box row in the physical matrix. **Foundation already available:** registry, graph compiler, stock settings, 2D/3D shared IDs, closed contours, prepared export and test harnesses.

1. Select the first actual style (the plan proposes 0201, 0401 and 0453), verify an authoritative dimensional reference and its usage rights, and document internal finished L/W/H conventions and stock allowance. The attached files contain no approved FEFCO drawings. Do not infer manufacturing dimensions from a bitmap silhouette.
2. Implement the style as original parametric geometry using common panel/crease/flap/glue/receiver/notch primitives. Include true closure partners, assembled poses, measurement conventions and explicit invalid-dimension errors.
3. Test three shape ratios with two stock thicknesses, closed contours, unique cut/score operations, closure reachability, edge lengths, internal finished dimensions and exact 1:1 SVG/PDF dimensions. Include undo, save/reload, Hebrew/English and 2D/3D/export synchronization.
4. Only then register that implemented template and generate its original preview. No unsupported style entries, extracted artwork collection or false physical-verification badge.
5. Deliver one reviewable style and its evidence first. Extend to the remaining agreed codes only after review.

**Acceptance:** a real selectable and editable template with passing geometry/browser/export checks and an honest digital-only status. **Approval needed before starting:** which first style/reference to use. Physical certification belongs to the next phase.

## Next phase B: physical fabrication and release evidence

**Plan goals:** testing section 11, definition of done 8 and PR 10's manual laser exit gate. **Software already available:** production readiness checks, exact mm exports, layer profiles, stock-aware layouts and paired labels.

1. Observe GitHub Actions for the final pushed commit and record the run URL, selected commit and actual results. The configured pipeline runs Node 24, `npm ci`, formatting, types, lint, tests, build and Playwright Chromium. Local checks are evidence for this instance; they do not prove remote CI passed. The current CLI API cannot read Actions results, although authenticated Git push works.
2. Produce reviewed production exports for cube papercraft and implemented tray/box prototypes. If FEFCO styles are included, use actual implemented 0201/0453 or the explicitly agreed substitutes; do not pretend a generic box is a specific code.
3. Cut and assemble at least one sample in 1 mm card and one thicker corrugated/cardboard stock. Record stock identification, measured thickness, machine settings, actual kerf, slot clearance, fold/score direction, tab strength, paired-label readability and assembled dimensions.
4. Store measured results and photographs alongside the exported specimen IDs and source project hashes. Record failures and proposed parameter adjustments, then rerun geometry/export tests for any resulting software change.
5. Calibrate fit/kerf guidance from those measurements. Keep nominal fit and fold-allowance warnings until evidence supports their removal.
6. Review the release notes and demo paths below, then approve a release/merge separately.

**Acceptance:** passing observed CI and traceable physical measurements with disclosed limitations. **External prerequisite:** access to the actual cutter, stock and assembly results. This cloud environment cannot perform physical fabrication.

## Next phase C: migration parity and optional scope

**Plan goals:** PR 10's conditional legacy removal and tested input-format support. **Existing behavior:** old files/modes remain available; unsafe legacy geometry is inspectable as drafts, and native paths have strict production gates.

- Establish a representative v1–v8 corpus, including manual edits, locked layouts, multiple sheets and material profiles. Review native/legacy correspondence and data-loss recovery before proposing removal of the old wizard or triangular fallback. Record a dedicated ADR; do not remove either automatically.
- Treat OBJ/DXF, UV/artwork transfer, curved fabrication, a full collision-free folding sequence and additional custom primitives as separate scoped proposals. Do not advertise them before implementation and format-specific round-trip/geometry tests.
- Any future third-party reuse must retain applicable license notices and verified permissions. No GPL Papercraft Rust/WASM or unknown-license OpenDieline implementation is included in this upgrade.

**Acceptance:** explicit parity evidence and approval for the selected scope. This optional phase is not required to retain the current working experience.

## Release notes and functional demonstration paths

The upgrade provides a bilingual Studio, a catalog backed by actual generators, synchronized graph-based geometry, editable collision-checked papercraft nets, bounded custom authoring, stock-aware layout and shared preflight/export. This checkpoint adds confirmed source replacement and reliable editable simplification. Existing projects and the legacy workflow remain supported.

1. **Template:** Create → choose Open box → change dimensions/material → inspect 2D and 3D → Undo/Redo → save a named project → Manufacture → review warnings and placements → export SVG/PDF in mm. Repeat in Hebrew; numeric inputs remain LTR.
2. **Papercraft:** Create → Import a 3D model → import a closed low-poly STL → inspect source health → Use collision-safe unfolding → optionally accept bounded simplification → Optimize net → edit a real edge/tab → arrange/lock islands → review readiness → export → reload and verify editable intent.
3. **Source update:** in the edited papercraft project, import a replacement STL → Review source update → Cancel and verify the old net remains → repeat and Accept → explicitly remap or discard unmatched edits → verify production readiness → Undo restores the previous source and intent.
4. **Recovery:** start optimization and Cancel calculation → the last valid net remains; optimize again → reload. A failed import/preflight must leave the prior project accessible. Review mesh preparation is explicit and preserves unmatched intent.
5. **Authoring:** create a custom cross-tray definition → change bounded parameters/topology → save a version → create a variant → export/import definition and project JSON → verify the project keeps its exact embedded definition.

## Verified commands, environment and limitations

Use the existing isolated checkout; no extra worktree is required. Installation/start instructions are already saved in the cloud configuration draft. Node 24 and system Chromium support this instance; `playwright.cloud.ts.local` is ignored and selects `/usr/bin/chromium`, two workers and software WebGL. The runner starts/stops its own Vite service on port 4173. A published environment snapshot or a new-task validation is not claimed.

Required local gates: `npm run format:check`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and `npm run test:e2e -- --config=playwright.cloud.ts.local`. Final results are recorded in `UPGRADE_PROGRESS.md` after completion.

Boundaries remain explicit: project imports are limited to 20 MiB/100,000 triangles; automatic native preparation accepts at most 5,000 source triangles; native targets are 4–200 triangles; optional optimization/preparation checks a six-second deadline between operations. Continuous deviation proof has a 200,000-query/depth-10 bound and rejects unproven cases. Preview animation proves rigid correspondence, not a collision-free assembly sequence. No physical cuts or FEFCO certification are claimed.

**Pause here:** review this checkpoint and approve the next selected phase before additional implementation, physical-release certification or legacy removal.
