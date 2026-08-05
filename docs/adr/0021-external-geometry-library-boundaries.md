# ADR 0021: Contain optional geometry libraries behind pure adapters

## Status

Accepted

## Context

Panel-feature containment and distance checks may benefit from a geometry library, but library objects must not leak into persistence, state, rendering, or worker messages.

## Decision

Any external geometry dependency requires a focused browser-worker, determinism, performance, and bundle-size spike before adoption. Approved libraries may be used only inside pure geometry functions through adapters to and from MocknSlice `Point2D` arrays.

Persisted projects, Zustand state, worker protocol results, previews, and exporters contain only MocknSlice's plain serializable contracts. General canvas/vector frameworks and initial Clipper/WASM integration remain out of scope.

## Consequences

Dependencies can be replaced without migrations, geometry remains directly testable, and the main presentation bundle does not inherit avoidable drawing-framework weight.
