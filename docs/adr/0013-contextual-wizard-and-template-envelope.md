# ADR 0013: Contextual wizard and explicit template envelope

## Status

Accepted.

## Context

The workflow rail previously changed only an active label while every setup, fabrication, layout, import, output, and warning panel remained mounted. This made the interface visually dense and disconnected from its promised sequence. Folding templates also exposed family parameters but not a consistent overall envelope, and two 3D presentation selectors returned fresh empty arrays that caused React external-store update loops.

## Decision

- Mount one contextual panel for the active seven-step workflow in the left half and retain a persistent preview in the right half.
- Keep completed-step state transient, infer progress from hydrated artifacts, and invalidate only downstream work after meaningful edits.
- Drive generation from the Configure step and enter Inspect on success.
- Represent optional folding size as a serializable width/length/height envelope. Custom dimensions may enlarge the fitted convex profile but cannot shrink below it or mutate the source mesh.
- Keep viewport selectors referentially stable and make the rendering error boundary resettable.

## Consequences

The shell is quieter and navigation now controls real work. Existing project files remain compatible because size settings are additive and missing values mean auto-fit. Template hashes change with the `convex-template-v2` algorithm version. Advanced mesh-unfolding behavior is unaffected.
