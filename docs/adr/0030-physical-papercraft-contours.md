# ADR 0030: Physical papercraft perimeter and closure preflight

Status: accepted for PR 5.

The original v2 net compiler traces oriented boundary half-edges and suppresses every joined internal edge from the cut layer. Each connected physical island gets exactly one simple CCW exterior cut loop and any validated CW holes. Glue tabs replace the owner border segment in that loop; their bases are scored once. Coplanar triangulation edges are not emitted as creases. The graph remains the authoritative fabrication geometry and compiles through `compileToParts`; the existing unfold renderer receives an explicit compatibility bridge.

Tab fitting begins at the minimum of requested depth, 40 percent of edge length, receiver clearance and 15 mm. It tries both owners unless an owner is explicit, checks exact positive-area face/tab collisions and the resulting perimeter, and shrinks by 0.5 mm to a physical floor of max(1 mm, 1.5 times stock). The exact floor is also checked when the starting depth does not align with the shrink step. An unfittable enabled closure is unresolved and blocks parts compilation. Explicit suppression produces a visible assembly warning and no fabricated tab. No press-fit papercraft slots are offered.

Each cut seam has two labels with a shared stable pair number and current face/island ownership. Guides are separate from cuts. Preflight rechecks face/tab intersections, simple closed exterior count, duplicate cuts, references, contour length and material area. It certifies only nominal digital geometry. Physical cut/fit testing remains external evidence.

The new literal cube SVG fixture is independent of the preserved legacy output goldens: 222 × 96 mm with six 40 mm faces, seven nonoverlapping tabs, paired guide labels, and one closed exterior contour. Rigid folding is checked against source distances, not just triangle edge lengths. The fixture is a new algorithm output, not a replacement of the old triangle-tree baseline.
