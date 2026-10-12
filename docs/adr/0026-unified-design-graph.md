# ADR 0026: Introduce a canonical design graph alongside legacy results

## Status

Accepted for incremental implementation; PR 0 introduces this contract only.

## Context

At `de26e1bb44536c4ea243cd285569e3fecc3d9c74`, five generators return separate serializable result types. Folding already exposes physical connections, editable edges, panels, tabs, and assembled vertices. Panel construction carries role-specific stocks, paired joints, feature holes, and exact assembled outlines. Mesh unfolding has a bounded triangle forest. Export and preview derive prepared paths without mutating source parts. Replacing these simultaneously would risk saved projects and physical geometry.

The supplied MocknSlice 2.0 plan calls for a common graph, typed templates, independent papercraft algorithms, and strict export preflight. PR 0 establishes evidence; each later phase must meet its own gate. The user's subsequent instruction authorizes continuing through all phases without pausing at the attached execution brief's PR 0 review checkpoint.

## Decision

1. Introduce `FabricationDesignGraph` in pure TypeScript with explicit schema/algorithm versions, millimetres, stable semantic entity IDs, deterministic ordering, structured issues, and finite serializable values. Reuse existing operation and geometry types. Panel-local vertex IDs must be explicit: the plan's illustrative point arrays alone cannot satisfy connection references to named vertices.
2. Add adapters beside current results. PR 1 covers open-box, sleeve, and a butt-joint panel enclosure behind a disabled internal feature flag. Preserve every original path, label, placement, panel, and assembled vertex. A clearly identified legacy projection may bridge adapters while graph compilation is established; it is not independent editable authority and cannot certify new geometry. Later registered generators produce graph geometry directly.
3. Distinguish physical connection from flat adjacency. Seam partners may live in different flat pieces. Enforce reversed edge correspondence only for joined flat adjacency, not separated seam positions. Hinge traversal must form a forest. Named receiving face slots and divider half-laps are not ordinary boundary hinges; do not fabricate endpoint correspondence for them.
4. Validate ID/reference integrity, positive finite stock, simple nondegenerate outer loops, contained nonintersecting holes, edge lengths within `max(0.05 mm, 1e-6 * length)`, closure ownership, finite poses, hinge cycles, and duplicate production cuts. Centralize numerical tolerances. Labels and guides are distinct from manufacturing cuts. Preserve failure details and the prior valid result.
5. Compile manufacturing parts and assembled poses from the same validated graph. Synchronization tests must compare actual IDs, endpoint lengths, outlines, holes, and ownership, not just counts or screenshots. Keep original mesh and user intent independently of generated artifacts.
6. Keep all five mode discriminants and all seven folding families. PR 1 makes no public UI, project-schema, IndexedDB, canonical signature, worker-protocol, or exporter changes. New version-9 fields and signature-version-3 records arrive with strict readers and explicit v8 migration; v1–v8 imports remain supported. Migration never regenerates user geometry or upgrades embedded template definitions automatically.
7. Keep ADRs 0023–0025: role-specific thickness; paired overrides; bounded profiles; transient selection; explicit regeneration; acyclic crease components; no resurrection of retired panel tab-slot joints. Existing closed/open paths remain regression evidence until their designated hardening phase. A passing baseline is not fabrication certification.
8. New papercraft joins use independently implemented rigid transforms, positive-area intersection, rollback, bounded deterministic search, and user hard constraints. GPL source must never be translated, ported, linked, or shipped. New workers retain request/input hash checks, progress, cancellation, and last-valid-result behavior.

## Independent licensing safeguards

- Papercraft README and LICENSE confirm GPL-3.0-or-later. Refer only to publicly described interaction ideas; write geometry and tests independently. Do not add its Rust source, executable, or WASM.
- OpenBox3D LICENSE confirms MIT, copyright 2026 yuyou-dev. Any future copied/adapted code must include that notice and full MIT license beside the attribution. PR 0 copies no implementation code.
- OpenDieline root `LICENSE` returned HTTP 404 and its package metadata contains no license declaration. This does not establish that the whole project lacks a license, but reuse permission remains unverified. No code reuse until an applicable license is verified.
- FEFCO diagram rights and exact dimension instructions have not been supplied. Use original computed illustrations; do not publish PDF-extracted artwork or declare a catalog style verified without its actual geometry and inspection.
- No new dependency or external implementation is introduced in PR 0. Package metadata is an inventory, not a complete transitive legal audit. See `../UPGRADE_SOURCES.md`.

## Consequences and known constraints

Adapters add temporary compatibility work and require explicit invariant gates before becoming authoritative. Existing files, export bytes, and public controls remain unchanged in PR 0. Frozen source/expected JSON plus SVG/PDF fixtures protect all modes, family identities, legacy import, manual edits, and material roles.

The baseline discovered four `FOLD_CONNECTION_PANEL_MISSING` errors in nonzero-top-scale frustum generation. `buildFoldNet` validates cap connections before their receiver panels are present in its local panel collection. Preserve that defect in PR 0 evidence; repair only in a later verified geometry phase with a documented snapshot delta. Existing exporters can write that invalid artifact because their gate checks preparation errors rather than all generation errors. Such output is an inspection baseline, never ready for cutting. Physical scrap cutting remains an external prerequisite for manufactured-reliability claims.
