# ADR 0024: Pair connection overrides and bound panel profiles

## Status

Accepted.

## Context

Independent edge settings can describe two contradictory treatments for one physical connection. Free-form profile nodes would also introduce a general CAD surface, unclear fabrication constraints, and separate 2D/3D geometry paths.

## Decision

Store enclosure overrides under eight stable panel-pair keys. One resolved specification supplies the joint family and optional finger clearance to both participating edges. The retired tab-slot family is not reintroduced.

Store complete front/back choices from `flat`, `arch`, `gable`, and `stepped`. Raised profiles are valid only on open-top front/back panels. They replace the nominal top segment while preserving its two side endpoints. The generated fabrication outline is the sole source for assembled preview vertices.

## Consequences

Mixed joint families cannot conflict across one connection, settings remain deterministic and serializable, and profile geometry stays identical in 2D and 3D. Arbitrary node editing, side-panel profiles, and raised profiles combined with a lid remain unsupported and receive explicit validation rather than silent repair.
