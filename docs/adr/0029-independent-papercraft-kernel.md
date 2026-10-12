# ADR 0029: Independent papercraft kernel with atomic forest joins

Status: accepted for the upgrade's PR 4 internal kernel. The legacy `triangle-tree-v1` dispatch and persisted v8 projects are unchanged.

The new `papercraft-v2` implementation is original TypeScript. No Papercraft GPL source, translated code or executable is incorporated. It reuses MocknSlice's indexed topology, conservative QEM reducer, planar region discovery and the polygon clipping primitives introduced in PR 1.

Preflight checks finite indexed triangles, duplicate/zero-area faces, closed oriented edge manifoldness and vertex links. Disconnected closed bodies are independent components. Simplification requires an explicit input flag, retains the original source, measures deviation, rechecks manifoldness, per-body Euler characteristic and volume orientation, and verifies that original sharp edges remain. Edits cannot silently follow changed simplification indices. The 200-face default is a supported target; failure to reach it produces an issue.

Planar regions are validated in a source-plane basis as simple polygons within 0.01 mm / 2 degrees. Validated patch membership favors soft coplanar edges, while triangles remain the exact collision primitives. Unsupported multi-loop regions fall back to triangles. There is no projected polygon flattening approximation.

For signed dihedrals A is the lower source face index, and the axis follows A's source winding. `atan2(dot(u,cross(nA,nB)),dot(nA,nB))` yields +90 degrees on an outward-wound convex cube. Reversing all source winding reverses this sign. A join rotates and translates the whole child island across reversed shared endpoints without scaling. Every accepted join preserves a forest, passes positive-area triangle clipping at 1e-8 square mm, and passes boundary tracing at 1e-6 mm. Rejected attempts allocate tentative geometry and do not mutate faces, edits or hinges. Hard join cycles are diagnosed before geometric attempts.

Search uses up to 32 deterministic candidates (default 12), followed by at most two passes of 32 hinge/seam exchanges. Only numeric score improvements are accepted by the local pass. A dedicated worker reports typed progress, compares the returned canonical input hash and terminates immediately on cancellation. The six-second worker budget can stop optional search and reports informational exhaustion; it never permits overlap or relaxes constraints. Pure synchronous calls have no clock dependence unless a caller supplies a budget hook.

PR 5 adds physical closure tabs, paired labels, graph compilation and fabrication preflight. This kernel alone does not claim a production cutting result, nor is it exposed as a replacement UI before the editor/migration phases.
