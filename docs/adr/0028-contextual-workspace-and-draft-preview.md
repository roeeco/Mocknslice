# ADR 0028: Contextual workspace with runtime-only draft geometry

## Status

Accepted.

## Decision

Introduce Create, Design and Manufacture destinations alongside a persistent selectable legacy workflow. Keep all old mode settings, manual features, layouts and export controls reachable. Catalog entries without approved generators remain review-only; existing families retain their experimental inspection status until the appropriate readiness/inspection gates.

Draft numeric buffers stay outside project state and autosave. A bounded template preview is calculated after 150 ms from a cloned canonical input and provided to both viewports through a runtime context; it never replaces the saved result or enables current production export. Blur/Enter commits one typed settings change. Successful automatic worker generation may merge its artifact into that same history entry only when the captured input hash and last history snapshot still match. An intervening edit or failure cannot overwrite the previous valid geometry. Heavy mesh changes remain explicit worker operations.

The existing startup hydration/history race recorded in PR 0 would make the new editor unsafe. Move its protection forward from PR 10: render a localized loading boundary until IndexedDB hydration completes. No editable control is mounted before history initialization. Later reliability testing still covers hydration, import and autosave; this is not permission to drop PR 10's gate.

Use the same panel/feature IDs in both previews. Keep numeric axes LTR in RTL text. Camera positioning responds to explicit fit/preset/model identity, not each parametric draft frame. Rendering data and camera state stay outside persisted geometry. Maintain a functional 2D fallback when WebGL fails.

Automatic template recalculation cannot erase manual placements. Bring minimal stable-ID retention forward from PR 8 for this path: keep existing part translations/rotations, visibly validate resized parts, and place genuinely new parts on additional sheets. The full cross-mode layout/packing phase still implements locking, optimized placement and acceptance tests. Legacy explicit generation remains unchanged in this phase.

## Constraints

No approved FEFCO dimension reference or physical cut record is currently supplied. The user's explicit later instruction forbids adding FEFCO designs without implemented templates. Therefore the catalog contains no FEFCO reference-only entries. Add a style only with its implemented/tested generator; no thumbnail is treated as a parametric generator and no third-party PDF artwork is published. Template authoring appears only when its real compiler/editor is available in PR 9.
