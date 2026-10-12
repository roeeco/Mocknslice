# ADR 0027: Separate template registration from legacy geometry dispatch

## Status

Accepted.

## Decision

Keep the seven existing family discriminants and signature-version-2 input contract. Register versioned metadata, bounded typed parameters, complete resolved instances and local generator functions outside the legacy monolith. Worker dispatch calls the registry without changing its request/result type. Metadata-only UI imports avoid pulling geometry orchestration into the inspector. A new graph generator requires a module/registry entry, not another branch in the legacy generator.

Extract the unchanged open-box family and its shared pure helpers first. Preserve every existing golden result, path, label and export byte. This also preserves its use for trays and separate lids. Native registry generation initially wraps legacy geometry; graph manufacturing stays `legacy-unverified` until its closed-contour preflight phase.

Keep catalog status distinct from old workflow availability. All seven new catalog definitions initially remain experimental because this task has no physical inspection records. Existing controls and generation remain available for compatibility. Catalog-only entries have no usable generator; unsupported versions or supplied parameters fail rather than silently falling back/clamping. A verified catalog definition requires an explicit reference and physical inspection record.

The existing frustum parameter `topScale` is dimensionless. Add a bounded `ratio` parameter kind to the illustrative plan's five kinds; label it without millimetres or degrees. This extends the registry contract without changing geometry, persisted v8 settings or expression execution privileges. User definitions cannot supply executable generators or remote thumbnail URLs.

## Consequences

PR 2 introduces no project/IndexedDB migration, new fabrication mode or third-party dependency. The original seven families still generate identical results (including the recorded frustum cap failure). Catalog and authoring can build on stable definition/version IDs while old projects retain resolved settings. Promotion, new FEFCO geometry and embedded-definition persistence remain later phases.
