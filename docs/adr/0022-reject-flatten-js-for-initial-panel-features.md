# ADR 0022: Keep initial panel-feature geometry dependency-free

## Status

Accepted

## Context

Phase 4 needs deterministic containment, boundary distance, polygon overlap, and circle approximation for a small number of rectangular, circular, and label footprints. ADR 0021 requires a browser-worker and bundle spike before adopting an external geometry library.

On 2026-08-04, `@flatten-js/core` 1.6.13 was evaluated with a Vite ES-module main entry and worker entry using polygon containment and polygon-to-circle distance. Both executed correctly and remained serializable at the adapter boundary. The package reported 1,279,310 unpacked bytes. The minified spike was 107,171 raw / 23,743 gzip bytes in the main entry and 107,158 raw / 23,746 gzip bytes in the worker entry. This would more than double the current 86,556-byte geometry worker for operations that can be expressed by a bounded set of point/segment functions.

## Decision

Do not install `@flatten-js/core` for the initial panel composer. Implement only the required pure point-in-polygon, segment-distance, polygon-overlap, rotation, and fixed-segment circle helpers using MocknSlice `Point2D` values.

Re-evaluate a geometry library if later bounded profiles or Boolean operations exceed this deliberately narrow implementation. Do not expand these helpers into a general CAD kernel.

## Consequences

No library objects enter project data, worker messages, Zustand, previews, or exporters. Main-bundle impact stays limited to the feature UI, and the worker receives only the small operations it uses. The initial feature set remains intentionally limited to rectangles, polygon-approximated circles, and label footprints.
