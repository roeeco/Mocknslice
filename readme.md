# MocknSlice

Fabrication plans, from model to material.

MocknSlice is a browser-based, local-first fabrication design tool for makers, students, and small workshop projects. It turns simple parametric forms and imported STL models into practical cutting, scoring, folding, and interlocking plans.

Projects are saved locally in the browser. No account, backend, or upload is required.

## What you can do

- Import ASCII or binary STL models and inspect their mesh health.
- Start with a built-in cube or create a parametric folding form from dimensions.
- Generate fabrication parts with stacked slices, interlocking waffle slices, folding templates, low-poly mesh unfolding, or panel construction.
- Start panel projects from five classroom recipes: survey/ballot box, sorting tray, flash-card holder, game-component box, or a blank panel box.
- Add rectangular or circular cutouts and engraved labels in a panel-local editor with drag, keyboard, and exact numeric controls.
- Mix paired butt/finger connections and choose bounded arch, gable, or stepped profiles for open front/back panels.
- Preview the result as an assembled 3D model and as a labelled 2D sheet layout.
- Arrange parts across multiple sheets with material-aware spacing, margins, rotation, and validation checks.
- Prepare output with kerf compensation, fold-line conversion, perforation patterns, operation styles, labels, and registration marks.
- Export layered SVG for laser/CNC workflows, vector PDF assembly sheets, and editable MocknSlice project files.
- Work in Simple or Advanced mode, with English and Hebrew interface support.

## Fabrication workflows

| Workflow                | Best for                                                                     |
| ----------------------- | ---------------------------------------------------------------------------- |
| **Stacked slices**      | Building a form from parallel contour slices                                 |
| **Interlocking slices** | Making orthogonal waffle-style structures with complementary slots           |
| **Folding template**    | Creating boxes, trays, sleeves, envelopes, prisms, and pyramid/frustum forms |
| **3D model unfolding**  | Producing bounded low-poly nets from closed, manifold triangular meshes      |
| **Panel construction**  | Designing mixed-thickness boxes with butt or complementary finger joints     |

Each workflow generates deterministic millimetre geometry and reports warnings or blocking issues when the input or layout needs attention.

## Quick start

### Requirements

- Node.js with npm
- A modern desktop browser with WebGL support

### Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. To try the built-in demonstration path, create a new project and generate the default cube, choose **Create from template**, or select **Panel construction** and pick a classroom kit.

### Build and preview the production bundle

```bash
npm run build
npx vite preview
```

## Development commands

```bash
npm run typecheck       # strict TypeScript checks
npm run lint            # ESLint with zero warnings
npm run format:check    # verify Prettier formatting
npm test                # unit and component tests
npm run test:e2e        # Playwright browser smoke tests
npm run build           # production build
```

## Local-first project files

MocknSlice autosaves the current project to IndexedDB in the browser. Use **Export project** to create a portable `.mocknslice.json` file and **Import project** to continue work on another browser or machine. Fabrication output is exported separately so the editable project remains available.

## Output formats

- **SVG** — layered vector paths for cuts, scores, folds, perforations, engraves, guides, labels, and registration marks.
- **PDF** — deterministic vector assembly sheets for printing or reference.
- **MocknSlice project JSON** — versioned, editable project data with migration support.

All generated dimensions are expressed in millimetres. The output preparation layer preserves the generated source geometry while applying export-time settings such as kerf and fold-line treatment.

## Project structure

```text
src/domain/       Serializable project and fabrication types
src/geometry/     Pure mesh, slicing, unfolding, layout, and output geometry
src/workers/      Typed Web Worker protocol for expensive generation tasks
src/state/        Zustand project, workflow, history, and persistence state
src/components/   Workflow panels and application UI
src/viewports/    Synchronized Three.js 3D and SVG 2D previews
docs/             Product, architecture, testing, and decision records
e2e/              Playwright smoke tests
```

The domain and geometry layers are independent of React and Three.js. Persisted state contains serializable data only; presentation objects are recreated at the viewport boundary.

## Project status

The current implementation covers the architecture campaign through paired panel connections and bounded open-top profiles. Complex polygon nesting, radial slicing, arbitrary profile editing, living hinges, guided assembly, PWA packaging, and cloud collaboration remain future work. The tool prioritizes predictable fabrication output and explicit validation over unrestricted CAD functionality.

The current project format is version 8, with typed settings for every fabrication mode, canonical generation provenance, and a bilingual classroom recipe registry. Recipes are ordinary settings factories: applying one resolves a complete editable panel setup, and saved projects retain those resolved values even if registry defaults later change. Panel features use stable IDs and panel-local coordinates, generate deterministic cut or engrave geometry, and remain editable after export and re-import.

Panel construction and folding results expose selectable assembled edges in the 3D viewport. After initial generation, the Configure inspector can replace panel finger joints with butt joints or scored creases, split folding creases into cuts, choose explicit glue-tab ownership, and add tabs to eligible exposed edges. A keyboard edge list mirrors 3D selection. Regeneration emits direct score operations, merges crease-connected panel components, splits cut folding components, and blocks invalid cycles, stock-thickness mismatches, missing edges, and unsafe tab dimensions. Crease positions are nominal: cardboard bend allowance and real fit still require a physical test.

Panel construction keeps its presets inside Configure and uses direct 1–10 mm sliders for base/wall, divider, and lid stock. Divider sliders derive their maximum from the available inner span and report the resulting clear width × depth × height of every equal-sized cell. Tabs and through-slots are temporarily retired; older project settings are converted to finger joints with a visible warning before regeneration.

Panel-feature validation is a digital geometry check, not a fabrication certification. Real material fit, laser cutting, and assembly quality have not been physically verified.

More detail is available in [the product specification](docs/PRODUCT_SPEC.md), [architecture notes](docs/ARCHITECTURE.md), and [testing guide](docs/TESTING.md).
