# MocknSlice

Fabrication plans, from model to material.

MocknSlice is a browser-based, local-first fabrication design tool for makers, students, and small workshop projects. It turns simple parametric forms and imported STL models into practical cutting, scoring, folding, and interlocking plans.

Projects are saved locally in the browser. No account, backend, or upload is required.

## What you can do

- Import ASCII or binary STL models and inspect their mesh health.
- Start with a built-in cube or create a parametric folding form from dimensions.
- Generate fabrication parts with stacked slices, interlocking waffle slices, folding templates, low-poly mesh unfolding, or panel construction.
- Preview the result as an assembled 3D model and as a labelled 2D sheet layout.
- Arrange parts across multiple sheets with material-aware spacing, margins, rotation, and validation checks.
- Prepare output with kerf compensation, fold-line conversion, perforation patterns, operation styles, labels, and registration marks.
- Export layered SVG for laser/CNC workflows, vector PDF assembly sheets, and editable MocknSlice project files.
- Work in Simple or Advanced mode, with English and Hebrew interface support.

## Fabrication workflows

| Workflow                | Best for                                                                           |
| ----------------------- | ---------------------------------------------------------------------------------- |
| **Stacked slices**      | Building a form from parallel contour slices                                       |
| **Interlocking slices** | Making orthogonal waffle-style structures with complementary slots                 |
| **Folding template**    | Creating boxes, trays, sleeves, envelopes, prisms, and pyramid/frustum forms       |
| **3D model unfolding**  | Producing bounded low-poly nets from closed, manifold triangular meshes            |
| **Panel construction**  | Designing material-thickness-aware boxes with butt, finger, or tab-and-slot joints |

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

Open the local URL printed by Vite. To try the built-in demonstration path, create a new project and generate the default cube, or choose **Create from template**.

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

The current implementation covers the foundation through the first advanced panel-construction workflow. Complex polygon nesting, radial slicing, living hinges, guided assembly, PWA packaging, and cloud collaboration remain future work. The tool prioritizes predictable fabrication output and explicit validation over unrestricted CAD functionality.

More detail is available in [the product specification](docs/PRODUCT_SPEC.md), [architecture notes](docs/ARCHITECTURE.md), and [testing guide](docs/TESTING.md).
