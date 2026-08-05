# ADR 0016: Persist typed settings for every fabrication mode

## Status

Accepted

## Context

The project currently stores every mode's controls in one string-keyed parameter bag. This permits invalid combinations, couples unrelated modes, and makes migration and stale detection depend on UI naming.

## Decision

Project format 7 stores a complete `ModeSettingsByMode` object with a dedicated serializable settings type for stacked slices, waffle slices, standalone folding templates, mesh unfolding, and panel construction. Inactive settings remain persisted when the active mode changes. Domain-facing settings types live under `src/domain/`; geometry consumes them but does not own them.

State exposes typed patch actions per mode and a complete panel-composer replacement action. The generic string-keyed setter is removed from production use.

## Consequences

All settings are validated and migrated at the project boundary. Mode switching preserves work, while TypeScript prevents controls from writing another mode's fields.
