# MocknSlice 2.0 baseline — PR 0

Captured 2026-10-12 from branch `work`, HEAD `de26e1bb44536c4ea243cd285569e3fecc3d9c74`, with a clean tracked/untracked status. Work continues on `upgrade/mocknslice-2-pr0`. The original checkout is used; no worktree was created. PR 0 adds guardrails, CI, test evidence and documentation, without changing application behavior, dependencies, lockfile, original tests, original goldens, project schema or generated production code.

The controlling inputs are the attached `MocknSlice_Sol_Upgrade_Implementation_Plan.md` and `MocknSlice_Sol_Execution_Prompt.md`. The first brief specifies PR 0 only; the user's later explicit instruction supersedes that stopping point and authorizes continuing through all phases in order. [PR 1 checklist](UPGRADE_PR1_CHECKLIST.md) records the next concrete scope; [ADR 0026](adr/0026-unified-design-graph.md) records the transition contract.

## Fresh pre-change checks

Runtime: Node 24.19.0, npm 11.9.0, five reported CPUs. Frozen installation: `npm ci --cache /workspace/.npm --no-audit --no-fund`, exit 0, 307 installed packages. No services or credentials are needed by this local-first app.

| Command                                                                   | Actual result before application changes                                                                                                                                            |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run format:check`                                                    | Passed.                                                                                                                                                                             |
| `npm run typecheck`                                                       | Passed.                                                                                                                                                                             |
| `npm run lint`                                                            | Passed, zero warnings.                                                                                                                                                              |
| `npm test`                                                                | Passed: 53 files, 271 tests, no skipped tests.                                                                                                                                      |
| `npm run build`                                                           | Passed; existing >500 KB main-chunk warning.                                                                                                                                        |
| `PLAYWRIGHT_HTML_OPEN=never npm run test:e2e -- --workers=2`              | Failed: 20 browser launch failures because bundled `chromium_headless_shell-1234` is missing. No UI assertion was exercised.                                                        |
| `npm run test:e2e -- --config=playwright.cloud.ts.local`                  | Failed: 2 passed, 18 connection-refused failures after a reused pre-existing Vite process stopped.                                                                                  |
| `CI=1 npm run test:e2e -- --config=playwright.cloud.ts.local --retries=0` | Passed: all 20 tests, Playwright-managed Vite server, no retries.                                                                                                                   |
| `npm audit --json`                                                        | Exit 1: 27 high-severity package findings, zero critical, including transitive development-tool findings. No automatic dependency/lockfile changes. See source/dependency evidence. |

The ignored cloud configuration predates PR 0. It chooses `/usr/bin/chromium` (154.0.8037.57), two workers and `--enable-unsafe-swiftshader`. It is an explicit browser-version deviation from bundled Playwright Chromium; CI uses the bundled browser and `--with-deps`. CI YAML has been prepared and local commands exercised; no remote GitHub Actions run is claimed.

## Frozen physical and file evidence

`src/test-fixtures/upgrade-baseline/` contains 17 complete canonical inputs/results/projects; literal per-sheet SVG and PDF exports; eight saved v1–v8 project inputs; and their exact expected hydrated data. Fixed project/model/sheet IDs and timestamps remove nondeterministic metadata. Compare JSON wire representation without dropping algorithm version, hashes, editable edges, joint keys, labels or stock. JSON's normalization of signed zero is serialization behavior, not geometric rounding.

Coverage includes all five modes, all seven folding families, butt and finger panels, lid, each divider axis, simultaneous dividers with 1/2/3 mm stocks, panel holes/labels/crease/tab ownership, and a manually cut folding connection. The v1–v6 project files contain actual stacked geometry and placements; v7 contains mixed-stock panel geometry plus a legacy paired override requiring regeneration; v8 retains active panel edits and inactive folding edits. Frozen expected imports record existing migration warnings and stale provenance rather than treating old output as ready.

`src/domain/upgradeBaselines.test.ts` adds 27 checks: all 17 result/vector/project comparisons, all eight historical imports/round-trips, v7 stale migration, and the known frustum failure. SVG checks parse vector XML and verify exact physical sheet dimensions. PDF bytes are compared literally. Existing `architectureBaselines.test.ts` hashes and original `golden/*.svg` remain unchanged. Fixture capture was performed with unchanged application code at the baseline commit; tests never regenerate expected files.

### Confirmed existing frustum defect

The nonzero-top-scale `pyramid-frustum` fixture at 80 × 60 × 40 mm, top scale 0.5, 1 mm stock returns two parts and four error-level `FOLD_CONNECTION_PANEL_MISSING` issues. Cap-tab connections refer to receiving side panels outside the cap's local `buildFoldNet` panel collection. The aggregate output has the panels, but the per-piece validation has already emitted errors. The historical hash test freezes this result without requiring no errors, so the original 271-test suite passes.

The fixture is deliberately retained as invalid (`deriveGenerationState` is `invalid`). Direct SVG/PDF serializers currently gate preparation errors rather than all generation issues and can serialize it. Its frozen exports are inspection evidence; they are not cutting-ready artifacts. Correct it in its designated later geometry phase with an explicit reviewed reason for changed output. Physical card/board cutting and assembly have not been performed.

### Current experience screenshots

Four original captures at 1440 × 1000 px show the existing shell without UX changes:

- [English start](upgrade-baseline/en-start.png)
- [English Advanced panel editor, 3D](upgrade-baseline/en-panel-3d.png)
- [English Advanced panel editor, 2D](upgrade-baseline/en-panel-2d.png)
- [Hebrew RTL panel editor](upgrade-baseline/he-panel-rtl.png)

Reproduce with Vite running on port 4173: `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node scripts/capture-upgrade-baseline.mjs`. Default screenshots go to ignored `test-results/upgrade-baseline`; do not overwrite reviewed baseline captures as part of normal tests. The script asserts generation, actual SVG paths, RTL, and absence of uncaught page errors.

## PR 0 validation and limits

The added golden suite passed all 27 tests. Final full-tree verification is recorded below when completed. Dependency advisories, bundled-browser availability in this restricted environment, the frustum defect, and unperformed physical fabrication remain explicit constraints. No new GPL/MIT/unlicensed implementation source or FEFCO artwork is shipped. Newly added CI installs a supported Node 24 LTS and bundled Chromium; it does not add an audit gate that would pretend the existing advisory set was resolved.

The first post-PR-0 run passed 298 unit tests but browser coverage returned 19 passed / 1 failed: the project-name undo test found Undo disabled. No production source had changed. Startup `hydrateProject` asynchronously clears history, so editing before hydration can lose undo state; this is consistent with the observed failure under concurrent verification load. Record this existing timing issue even if a subsequent run passes. Initial new-test type checks also required test-only Node type activation, and the screenshot helper required an explicit Node console import; both were corrected without changing production configuration.

Final PR 0 gate: formatting, strict typecheck, lint, 54 test files / 298 unit-component tests, production build, and a complete 20/20 browser rerun passed. The successful rerun did not erase the earlier failure record. Main/worker asset names and generated bytes remained unchanged. CI publication/execution and physical fabrication are unrun.
