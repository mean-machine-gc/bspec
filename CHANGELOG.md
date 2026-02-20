# Changelog

All notable changes to UbiSpec will be documented in this file.

## [0.4.0] - 2025-02-19

### Changed
- Process UbiSpec: unified When trigger syntax with three explicit forms:
  - Scalar: `When: EventName` — single event
  - Any: `When: { any: [...] }` — OR, one of several events (`rm.event` as union)
  - All: `When: { all: [...] }` + `correlate` — AND, wait for all events (`rm.events.EventName` keyed access)
- `all` triggers are stateless from the spec author's perspective — runtime handles event accumulation
- Manual saga state (`state:` section) reserved for genuinely complex coordination (dynamic sets, timeouts, compensation)
- Updated JSON Schema, examples, and conceptual foundations for new syntax

## [0.2.0] - 2025-02-19

### Added
- Lifecycle UbiSpec `lifecycle/v1` — aggregate decider behavioural specification
- Process UbiSpec `process/v1` — cross-aggregate coordination specification
- JSON Schema for both formats (editor autocomplete and validation)
- E-commerce order example (lifecycle + process)
- Laboratory capability framework example (lifecycle + process)
- VS Code workspace configuration for schema association

### Design decisions
- Additive event model: commands emit all qualifying events, not first-match-wins
- Implicit failure convention: `DecisionFailed` event with constraint names as reasons
- Two-pass friendly: names first (domain expert), predicates second (developer)
- `dm`/`om` namespace separation: decision model for inputs, outcome model for verification
- `rm`/`om` namespace separation for process managers: reaction model for inputs
