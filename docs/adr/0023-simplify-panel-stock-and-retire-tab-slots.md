# ADR 0023: Simplify panel stock and retire tab-slot boundary joints

## Status

Accepted

## Context

Panel construction inherited the global material-profile selector and one thickness for every part. That made a common classroom case—thin dividers or a lid made from different stock—impossible to describe. Presets also occupied a complete workflow step. The tab/through-slot boundary implementation did not produce reliable geometry and must not remain selectable as if it did.

## Decision

- Move the five classroom presets into one bilingual select menu in Configure and remove the dedicated Choose-kit step.
- Replace panel-construction material-profile selection with explicit 1–10 mm base/wall, divider, and lid thickness settings. Retain the project material snapshot only for kerf, category guidance, sheet defaults, and legacy exchange.
- Position dividers after subtracting their stock thickness so all cells have equal clear spans. Limit each slider to the count that leaves at least four divider thicknesses of clear space per cell, while keeping zero available as “no divider.”
- Support only butt and complementary finger boundary joints in current settings and generation. Keep `tab-slot` only at legacy file/result boundaries. Import converts it to `finger` with `PANEL_TAB_SLOT_REPLACED`; direct legacy generator calls return `PANEL_JOINT_UNSUPPORTED` and no parts.
- Persist all three role-specific thicknesses in project format v7 using optional-read/required-write compatibility for older v7 files.

## Consequences

The panel workflow is shorter and stock selection is direct. Generated parts and 3D extrusion now use role-specific thickness, and the UI can report exact nominal clear cell dimensions. Older generated tab-slot artifacts remain inspectable but require regeneration with finger or butt joints. Real fit remains physically unverified, so scrap tests are still required.
