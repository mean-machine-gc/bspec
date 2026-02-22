---
layout: default
title: Lifecycle UbiSpec
nav_order: 4
---

# Lifecycle UbiSpec

**Behavioural Specification Format for Event-Sourced Aggregate Deciders**

Version: 0.2.0
Part of: UbiSpec (Behavioural Specification Format for Software Systems)

---

## 1. Purpose

A Lifecycle UbiSpec describes the complete behavioural contract of an event-sourced aggregate decider. It captures:

- Which commands the aggregate accepts
- Under what conditions each command is accepted or rejected
- Which events each command produces on success
- What must be true after those events are applied

The spec is both human-readable (constraint names are natural language) and machine-executable (predicates are TypeScript expressions). It serves simultaneously as a domain conversation artifact, a test suite, and an implementation contract.

A Lifecycle UbiSpec only describes **success paths**. Failure handling is implicit (§9).

## 2. Scope

One Lifecycle UbiSpec per aggregate. Cross-aggregate coordination is specified separately in a Process UbiSpec.

## 3. Relationship to Model

A Lifecycle UbiSpec references a TypeScript model file that defines all domain types. The model is the type authority. The spec is the behaviour authority. The spec does not define types.

## 4. Document Structure

```yaml
bspec: lifecycle/v1

decider: <AggregateName>
identity: <identityFieldName>
model: <path to TypeScript model file>

common:
  <predicate-name>: <expression>

lifecycle:
  - When: <CommandName>
    And: [...]
    Then: <event specification>
    Outcome: <assertions>
```

### 4.1 Header

| Field | Required | Description |
|-------|----------|-------------|
| `bspec` | Yes | Format identifier. Must be `lifecycle/v1`. |
| `decider` | Yes | Aggregate name. PascalCase. |
| `identity` | Yes | Field that uniquely identifies aggregate instances. |
| `model` | Yes | Relative path to the TypeScript model file. |

### 4.2 Common

```yaml
common:
  <predicate-name>: <expression>
```

Optional. Reusable predicates referenced by bare name in `And` blocks. Each entry is a kebab-case name and a TypeScript boolean expression.

## 5. Decision

Each element under `lifecycle` specifies one **decision** — the complete behaviour for one command, from acceptance through outcome.

```yaml
lifecycle:
  - When: <CommandName>
    And:
      <constraints>
    Then: <events>
    Outcome:
      <assertions>
```

### 5.1 When

```yaml
When: <CommandName>
```

Names the command. One decision per command. PascalCase, must match a type in the model.

### 5.2 And — Constraints

```yaml
And:
  - <constraint-name>: <expression>
  - <constraint-name>
```

Constraints that must **all** hold for the command to succeed. If any constraint fails, the command produces a `DecisionFailed` event (§9) and no success events.

Each entry is one of:

- **Inline**: `name: expression` — name is natural language, expression is executable.
- **Common reference**: `name` (bare, no value) — resolved from `common`.

Constraints are evaluated against the **Decision Model** (§7).

`And` is optional. A command with no constraints always succeeds.

### 5.3 Then — Events

Specifies which events are produced on success. A command can produce one or more events.

#### Scalar Form

```yaml
Then: <EventName>
```

Shorthand. The command produces exactly this one event, unconditionally.

#### List Form

```yaml
Then:
  - <EventName>
  - <EventName>:
      - <condition-name>: <expression>
  - <EventName>
```

Each entry is an event that may or may not be emitted:

- **Unconditional event**: bare event name. Always emitted on success.
- **Conditional event**: event name with a list of `name: expression` conditions. Emitted only when **all** conditions hold.

Rules:

- **All qualifying events are emitted.** Every unconditional event fires. Every conditional event whose conditions all pass fires. This is not first-match-wins — it is additive.
- Conditions are evaluated against the **Decision Model** (§7), same as constraints.
- At least one event must be emitted on success. If all events are conditional and none match, this is a spec error (the constraints should have prevented this state).
- Events are emitted in list order. Order may matter for evolve.

#### Patterns

**Single unconditional event** (most common):
```yaml
Then: TestEntryAdded
```

**Multiple unconditional events** (batch):
```yaml
Then:
  - LaboratoryRegistered
  - AuditTrailCreated
```

**Base event plus conditional extras** (additive):
```yaml
Then:
  - RegistryApproved
  - PreviousRegistryArchived:
      - has-active-registry: "dm.ctx.currentActiveRegistryId != null"
```

**Mutually exclusive events** (alternative — predicates ensure exclusivity):
```yaml
Then:
  - AssessmentSubmittedFullyMet:
      - fully-met: "dm.ctx.overallResult === 'FullyMet'"
  - AssessmentSubmittedWithGaps:
      - has-gaps: "dm.ctx.overallResult !== 'FullyMet'"
```

**Mixed**:
```yaml
Then:
  - RegistryApproved
  - PreviousRegistryArchived:
      - has-active-registry: "dm.ctx.currentActiveRegistryId != null"
  - TransitionPeriodStarted:
      - has-transition-period: "dm.cmd.transitionDays > 0"
```

### 5.4 Outcome — Assertions

Specifies what must be true after all emitted events have been applied (after evolve). Two forms:

#### Flat Form

```yaml
Outcome:
  - <assertion-name>: <expression>
  - <assertion-name>: <expression>
```

A flat list. All assertions must hold after evolve. Use this when:
- Then is scalar (single event), or
- All assertions apply regardless of which conditional events fired.

#### Keyed Form

```yaml
Outcome:
  _always:
    - <assertion-name>: <expression>
  <EventName>:
    - <assertion-name>: <expression>
  <EventName>:
    - <assertion-name>: <expression>
```

Assertions grouped by relevance:

- **`_always`**: assertions that hold after every successful execution, regardless of which events were emitted.
- **Event-keyed sections**: assertions that are evaluated **only when that event was emitted**. If the event's conditions didn't fire, its outcome section is skipped.

Rules:
- `_always` is optional. If present, it runs on every success.
- Event keys must match event names from `Then`.
- All assertions (both `_always` and event-specific) are evaluated against the **final state** after all emitted events have been evolved, in order.
- Assertions use the **Outcome Model** (§8).

Flat form is syntactic shorthand — it is equivalent to putting all assertions in `_always`.

## 6. Predicate Entry

The atomic element of the spec. Appears in `common`, `And`, `Then` conditions, and `Outcome`.

### 6.1 Naming

Every predicate has a name — a kebab-case identifier that reads as natural language. The name is the specification. It carries the meaning across all audiences.

- Constraints: `registry-is-draft`, `reviewer-is-authorised`, `entry-exists-in-catalog`
- Conditions: `has-active-registry`, `is-sampling-activity`, `has-downstream-refs`
- Assertions: `state-is-active`, `entry-in-catalog`, `catalog-unchanged`

### 6.2 Detail Levels

The value of a predicate — the part after the colon — can take four forms, from least to most precise. All four are valid UbiSpec. They represent a spectrum, not a hierarchy. Use the level that fits your stage and audience.

#### Level 1: Name Only

```yaml
- registry-is-draft
```

The constraint exists. The name says what it means. No further detail. This is the form used in the domain pass — the first pass where domain experts validate the behavioural logic. A specification with only Level 1 predicates is already a complete behavioural contract: it captures what commands exist, what conditions apply, what events are produced, and what outcomes are asserted.

#### Level 2: Scope Annotation

```yaml
- registry-is-draft: dm.state
- reviewer-is-authorised: dm.ctx
- entry-matches-area: [dm.cmd, dm.state]
- state-is-active: om.state
- event-carries-effective-date: [om.evts, dm.cmd]
```

The predicate names which **data sources** are involved, without specifying how they are evaluated. This tells you:

- `dm.state` — the constraint depends only on the aggregate's current state.
- `dm.ctx` — the constraint requires an external lookup (an async shell dependency).
- `[dm.cmd, dm.state]` — the constraint compares the command payload against current state.
- `om.state` — the assertion checks the new state after evolve.
- `[om.evts, dm.cmd]` — the assertion verifies that event payloads carry data from the command.

Scope annotations are language-agnostic. They work whether you're implementing in TypeScript, Kotlin, F#, or describing the system in a document. They already provide architectural information: you know which constraints are pure (dm.state, dm.cmd), which require the shell (dm.ctx), and which assertions compare before/after state (om.state vs dm.state).

#### Level 3: Prose Description

```yaml
- registry-is-draft: "Registry must be in Draft status"
- reviewer-is-authorised: "The reviewer must be a national authority (dm.ctx)"
- entry-matches-area: "The submitted entry's area must match the registry's area (dm.cmd, dm.state)"
```

The predicate describes the rule in natural language. Optionally annotates with scope. This is useful for teams that want specifications readable as documentation but aren't ready or don't need to write code expressions. The parenthetical scope annotation preserves the architectural information.

#### Level 4: Executable Expression

```yaml
- registry-is-draft: "dm.state.status.kind === 'Draft'"
- reviewer-is-authorised: "dm.ctx.isNationalAuthority"
- entry-matches-area: "dm.cmd.area.kind === dm.state.area.kind"
```

The predicate is a boolean expression evaluable against the domain model. This is the most precise form — it can be validated against the model, used to generate tests, and used to generate implementation. Expressions must:

- Reference only `dm.*` or `om.*` namespaces
- Be pure (no side effects, no variables, no async)
- Use `?.` for optional fields, `?? default` for safe defaults

The expression language used in this specification is TypeScript, chosen because it is widely readable and because it matches the domain model format. The UbiSpec structure (names, namespaces, When/And/Then/Outcome) is language-agnostic. Teams working in other languages can write expressions in their own syntax while using the same namespaces and the same specification structure.

### 6.3 Mixing Levels

Levels can be mixed within a single spec. This is expected and encouraged — it reflects the natural state of evolving specifications:

```yaml
- When: ApproveRegistry
  And:
    - registry-is-submitted: "dm.state.status.kind === 'SubmittedForReview'"   # Level 4
    - reviewer-is-authorised: dm.ctx                                            # Level 2
    - no-unresolved-comments                                                    # Level 1
  Then:
    - RegistryApproved
    - PreviousRegistryArchived:
        - has-active-registry: "dm.ctx.currentActiveRegistryId != null"         # Level 4
  Outcome:
    _always:
      - state-is-active: "om.state.status.kind === 'Active'"                    # Level 4
      - effective-date-set: [om.state, dm.cmd]                                  # Level 2
    PreviousRegistryArchived:
      - archival-target-correct: "Previous registry's ID matches context"       # Level 3
```

This spec is incomplete from an execution standpoint but complete from a behavioural standpoint. Every constraint is named. Most have scope or expressions. One is still prose. This is a legitimate intermediate state — and in practice, most specifications live here for a while.

### 6.4 Common Predicates

Reusable predicates defined once in the `common` section:

```yaml
common:
  registry-is-draft: "dm.state.status.kind === 'Draft'"
  registry-is-submitted: "dm.state.status.kind === 'SubmittedForReview'"
```

Referenced by bare name:

```yaml
And:
  - registry-is-draft
  - valid-name: "dm.cmd.name.length > 0"
```

Common predicates can also use any detail level. A common predicate at Level 2 (`registry-is-draft: dm.state`) tells every consumer of that predicate which data source is involved.

## 7. Decision Model (dm)

The input context for constraints and event conditions.

### 7.1 dm.cmd — Command Payload

```yaml
- valid-name: "dm.cmd.name.length > 0"
- entry-id-unique: "!(dm.cmd.entryId in dm.state.testCatalog)"
```

### 7.2 dm.state — Current State (before)

```yaml
- registry-is-draft: "dm.state.status.kind === 'Draft'"
- has-profiles: "Object.keys(dm.state.profiles).length > 0"
```

### 7.3 dm.ctx — Shell-Resolved Context

Async context resolved **before** decide runs. Every `dm.ctx` reference is a shell contract.

```yaml
- reviewer-is-authorised: "dm.ctx.isNationalAuthority"  # shell: AuthorityService.check(dm.cmd.reviewedBy)
- facility-exists: "dm.ctx.facilityExists"               # shell: FacilityRegistry.lookup(dm.cmd.facilityRegistryId)
```

Convention: annotate with `# shell: <resolution hint>` on first use.

Rule: context must never carry information derivable from `dm.state`.

### 7.4 Derivations

From a Lifecycle UbiSpec, an agent can mechanically derive:

- **Context type per command**: scan all `dm.ctx.*` references → generate TypeScript type.
- **Shell function per command**: one async function per command with context dependencies.
- **Command types**: verify `dm.cmd.*` paths against the model.

## 8. Outcome Model (om)

The context for postcondition assertions.

### 8.1 om.state — State After Evolve

The aggregate state after **all** emitted events have been evolved, in order.

```yaml
- state-is-active: "om.state.status.kind === 'Active'"
- entry-in-catalog: "dm.cmd.entryId in om.state.testCatalog"
```

### 8.2 om.evts — Emitted Events

The list of events produced by the decide function, in emission order.

```yaml
- archival-event-present: >
    om.evts.some(e => e.kind === 'PreviousRegistryArchived')
- event-count: "om.evts.length === 2"
- event-carries-data: >
    om.evts.find(e => e.kind === 'RegistryApproved')
      .effectiveDate === dm.cmd.effectiveDate
```

### 8.3 Cross-Model Access

Outcome assertions can reference both models:

| Namespace | Purpose |
|-----------|---------|
| `om.state` | New state — what changed |
| `om.evts` | Emitted events — what happened |
| `dm.state` | Old state — before/after comparison |
| `dm.cmd` | Original command — payload verification |
| `dm.ctx` | Resolved context — cross-referencing |

```yaml
# Before/after comparison
- catalog-grew: >
    Object.keys(om.state.testCatalog).length ===
      Object.keys(dm.state.testCatalog).length + 1

# Payload verification
- event-carries-entry-id: >
    om.evts.find(e => e.kind === 'TestEntryAdded')
      .entryId === dm.cmd.entryId
```

### 8.4 Outcome Completeness

A thorough Outcome includes:

1. **Positive** — what changed (state transitions, field values)
2. **Negative** — what must NOT change (unrelated state preserved)
3. **Event payload** — events carry correct data from command/context
4. **Event composition** — correct events were emitted (count, presence)

## 9. Implicit Failure Convention

A Lifecycle UbiSpec only describes success paths. Failure is handled by convention.

### 9.1 The DecisionFailed Event

When any constraint in `And` fails, the decide function emits a single event:

```typescript
{
  kind: 'DecisionFailed',
  decision: string,      // the command name from When
  failed: string[],      // names of constraints that failed
}
```

No other events are emitted. The evolve function does not modify state for `DecisionFailed` — the aggregate is unchanged.

### 9.2 Why This Works

- Every constraint has a **name** that reads as natural language. The failure payload is human-readable: `{ decision: "ApproveRegistry", failed: ["reviewer-is-authorised"] }`.
- The spec doesn't need to enumerate failure events per command. The constraint names **are** the failure specification.
- Test generation for failures is mechanical: for each constraint, construct a state/command/context that violates it, assert `DecisionFailed` with that constraint name.
- UI error handling maps directly: the `failed` array tells the frontend which fields or conditions to highlight.

### 9.3 Implementation

The decide function follows this pattern:

```typescript
function decide(cmd, state, ctx): Event[] {
  // 1. Evaluate all And constraints
  const failed = evaluateConstraints(cmd, state, ctx);
  if (failed.length > 0) {
    return [{ kind: 'DecisionFailed', decision: cmd.type, failed }];
  }

  // 2. Evaluate Then conditions and emit qualifying events
  const events = [];
  // ... for each event in Then, check conditions, push if pass
  return events;
}
```

### 9.4 DecisionFailed and Evolve

The evolve function must handle `DecisionFailed`:

```typescript
function evolve(state, event): State {
  if (event.kind === 'DecisionFailed') return state; // no-op
  // ... normal event handling
}
```

This is the only event that does not change state. It exists so that:
- The event stream records that a command was attempted and rejected (audit trail)
- Subscribers (including the UI) can observe failures
- The pattern stays consistent: every command produces at least one event

## 10. Interpretation

### 10.1 As a Decision Table

Each decision is a row:

| Command | Constraints (all pass?) | Events (all matching) | Assertions (all hold) |
|---------|------------------------|----------------------|----------------------|
| When | And | Then | Outcome |
| *(fail)* | *(any fail)* | DecisionFailed | *(state unchanged)* |

### 10.2 As Test Cases

Each decision generates:

- **Success path**: given (state, cmd, ctx) satisfying all constraints, when decide + evolve, then all qualifying events are emitted and all outcome assertions hold.
- **Per-constraint failure**: for each constraint, given a violation, assert `DecisionFailed` with that constraint name and state unchanged.
- **Conditional event coverage**: for each conditional event, test with conditions met (event present) and not met (event absent).
- **Event composition**: when multiple events can fire, test all valid combinations.
- **Property-based**: given any (state, cmd, ctx) satisfying all constraints, outcome assertions hold.

### 10.3 As Implementation Contract

- **decide function**: constraints → guard. Then conditions → event selection. All qualifying events emitted.
- **evolve function**: must produce state satisfying all outcome assertions after processing events in order.
- **shell function**: derived from `dm.ctx` references. One per command with context dependencies.
- **DecisionFailed handler**: mechanical, same for all aggregates.

## 11. Complete Example

```yaml
bspec: lifecycle/v1

decider: Registry
identity: registryId
model: "./model.ts"

common:
  registry-is-draft: "dm.state.status.kind === 'Draft'"
  registry-is-submitted: "dm.state.status.kind === 'SubmittedForReview'"

lifecycle:

  # ── Simple: one unconditional event ──

  - When: CreateRegistry
    And:
      - no-existing-draft: "!dm.ctx.existingDraftId"  # shell: RegistryRepo.findDraftId()
    Then: RegistryCreated
    Outcome:
      - state-is-draft: "om.state.status.kind === 'Draft'"
      - empty-catalog: "Object.keys(om.state.testCatalog).length === 0"
      - empty-capabilities: "Object.keys(om.state.capabilities).length === 0"
      - empty-profiles: "Object.keys(om.state.profiles).length === 0"

  - When: AddTestEntry
    And:
      - registry-is-draft
      - entry-id-unique: "!(dm.cmd.entryId in dm.state.testCatalog)"
    Then: TestEntryAdded
    Outcome:
      - entry-in-catalog: "dm.cmd.entryId in om.state.testCatalog"
      - catalog-grew: >
          Object.keys(om.state.testCatalog).length ===
            Object.keys(dm.state.testCatalog).length + 1
      - capabilities-unchanged: >
          Object.keys(om.state.capabilities).length ===
            Object.keys(dm.state.capabilities).length

  - When: SubmitForReview
    And:
      - registry-is-draft
      - has-profiles: "Object.keys(dm.state.profiles).length > 0"
      - all-capability-refs-valid: >
          Object.values(dm.state.profiles).every(p =>
            p.requiredCapabilities.every(ref =>
              ref.id in dm.state.capabilities))
      - all-entry-refs-valid: >
          Object.values(dm.state.capabilities)
            .flatMap(c => c.entries ?? [])
            .every(ref => ref.id in dm.state.testCatalog)
    Then: RegistrySubmittedForReview
    Outcome:
      - state-is-submitted: "om.state.status.kind === 'SubmittedForReview'"
      - submitted-date-recorded: "om.state.status.submittedDate != null"
      - catalog-unchanged: >
          Object.keys(om.state.testCatalog).length ===
            Object.keys(dm.state.testCatalog).length

  # ── Additive: base event plus conditional extra ──

  - When: ApproveRegistry
    And:
      - registry-is-submitted
      - reviewer-is-authorised: "dm.ctx.isNationalAuthority"  # shell: AuthorityService.check(dm.cmd.reviewedBy)
    Then:
      - RegistryApproved
      - PreviousRegistryArchived:
          - has-active-registry: "dm.ctx.currentActiveRegistryId != null"  # shell: RegistryRepo.findActiveId()
    Outcome:
      _always:
        - state-is-active: "om.state.status.kind === 'Active'"
        - effective-date-set: "om.state.status.effectiveDate === dm.cmd.effectiveDate"
        - approval-event-carries-data: >
            om.evts.find(e => e.kind === 'RegistryApproved')
              .effectiveDate === dm.cmd.effectiveDate
      PreviousRegistryArchived:
        - archival-target-correct: >
            om.evts.find(e => e.kind === 'PreviousRegistryArchived')
              .registryId === dm.ctx.currentActiveRegistryId
        - archival-superseded-by-self: >
            om.evts.find(e => e.kind === 'PreviousRegistryArchived')
              .supersededBy === dm.state.registryId

  - When: RejectRegistry
    And:
      - registry-is-submitted
      - reviewer-is-authorised: "dm.ctx.isNationalAuthority"
      - has-reason: "dm.cmd.reason.length > 0"
    Then: RegistryRejected
    Outcome:
      - state-is-draft: "om.state.status.kind === 'Draft'"
      - rejection-carries-reason: >
          om.evts.find(e => e.kind === 'RegistryRejected')
            .reason === dm.cmd.reason

  # ── Alternative: mutually exclusive events ──

  - When: SubmitAssessment
    And:
      - assessment-in-progress: "dm.state.status.kind === 'InProgress'"
      - all-requirements-responded: "dm.ctx.allRequirementsResponded"  # shell: completeness check
    Then:
      - AssessmentSubmittedFullyMet:
          - fully-met: "dm.ctx.overallResult === 'FullyMet'"
      - AssessmentSubmittedWithGaps:
          - has-gaps: "dm.ctx.overallResult !== 'FullyMet'"
    Outcome:
      _always:
        - state-is-submitted: "om.state.status.kind === 'Submitted'"
      AssessmentSubmittedFullyMet:
        - result-recorded: "om.state.status.overallResult === 'FullyMet'"
      AssessmentSubmittedWithGaps:
        - gaps-recorded: "om.state.gaps.length > 0"
        - result-recorded: "om.state.status.overallResult !== 'FullyMet'"

  # ── Batch: multiple unconditional events ──

  - When: RegisterLaboratory
    And:
      - valid-facility-ref: "dm.ctx.facilityExists"  # shell: FacilityRegistry.lookup(dm.cmd.facilityRegistryId)
      - unique-facility-binding: "!dm.ctx.facilityAlreadyBound"  # shell: LaboratoryRepo.findByFacility(dm.cmd.facilityRegistryId)
      - valid-name: "dm.cmd.name.length > 0"
    Then:
      - LaboratoryRegistered
      - AuditTrailCreated
    Outcome:
      - state-is-planned: "om.state.status.kind === 'Planned'"
      - name-set: "om.state.name === dm.cmd.name"
      - facility-bound: "om.state.facilityRegistryId === dm.cmd.facilityRegistryId"
      - no-assignments: "om.state.assignments.length === 0"
      - two-events: "om.evts.length === 2"

  # ── Mixed: unconditional + conditional + conditional ──

  - When: RemoveCapability
    And:
      - registry-is-draft
      - capability-exists: "dm.cmd.capabilityId in dm.state.capabilities"
      - no-profile-refs: >
          !Object.values(dm.state.profiles).some(p =>
            p.requiredCapabilities.some(ref => ref.id === dm.cmd.capabilityId) ||
            (p.allowedCapabilities ?? []).some(ref => ref.id === dm.cmd.capabilityId))
    Then:
      - CapabilityRemoved
      - ChildCapabilitiesRemoved:
          - has-children: "(dm.state.capabilities[dm.cmd.capabilityId].children ?? []).length > 0"
    Outcome:
      _always:
        - capability-gone: "!(dm.cmd.capabilityId in om.state.capabilities)"
        - test-entries-preserved: >
            Object.keys(dm.state.testCatalog).every(id => id in om.state.testCatalog)
      ChildCapabilitiesRemoved:
        - children-gone: >
            dm.state.capabilities[dm.cmd.capabilityId].children
              .every(child => !(child.id in om.state.capabilities))
```

## 12. Grammar Summary

```
Document         := Header Common? Lifecycle
Header           := 'bspec: lifecycle/v1' Decider Identity Model
Common           := 'common:' PredicateMap
Lifecycle        := 'lifecycle:' Decision+

Decision         := When And? Then Outcome

When             := 'When:' CommandName
And              := 'And:' Constraint+
Constraint       := PredicateEntry | CommonRef
CommonRef        := '- ' PredicateName

Then             := ScalarThen | ListThen
ScalarThen       := 'Then:' EventName
ListThen         := 'Then:' EventSpec+
EventSpec        := UnconditionalEvent | ConditionalEvent
UnconditionalEvent := '- ' EventName
ConditionalEvent := '- ' EventName ':' PredicateEntry+

Outcome          := FlatOutcome | KeyedOutcome
FlatOutcome      := 'Outcome:' PredicateEntry+
KeyedOutcome     := 'Outcome:' AlwaysBlock? EventOutcome+
AlwaysBlock      := '_always:' PredicateEntry+
EventOutcome     := EventName ':' PredicateEntry+

PredicateEntry   := '- ' PredicateName ':' Expression
PredicateMap     := (PredicateName ':' Expression)+
PredicateName    := kebab-case-identifier
Expression       := TypeScript boolean expression over dm.* | om.*
CommandName      := PascalCase identifier
EventName        := PascalCase identifier
```

## 13. Versioning

Format: `lifecycle/v1`. Declared in the `bspec` header. Breaking changes increment the version.
