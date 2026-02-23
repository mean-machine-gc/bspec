---
layout: default
title: Overview
parent: next (unstable)
grand_parent: Process UbiSpec
nav_order: 1
---


# Process UbiSpec

**Behavioural Specification Format for Cross-Aggregate Coordination**

Version: 0.4.0
Part of: UbiSpec (Behavioural Specification Format for Software Systems)

---

## 1. Purpose

A Process UbiSpec describes the coordination logic between aggregates. It captures:

- Which events trigger cross-aggregate reactions
- Under what conditions each reaction proceeds
- Which commands are dispatched to which target deciders
- What must be true about the commands produced

A process manager sits between deciders. It subscribes to events from source deciders and dispatches commands to target deciders. It may be stateless (a reactor) or stateful (a saga).

A Process UbiSpec only describes **active reactions**. If an event is observed and no conditions are met, no commands are dispatched — this is a valid no-op that does not need to be specified.

## 2. Scope

One Process UbiSpec per process manager. A system may have zero or many process managers. Each coordinates between two or more aggregates whose lifecycles are described in Lifecycle UbiSpec.

## 3. Relationship to Model and Lifecycle Specs

A Process UbiSpec references the same TypeScript model as the Lifecycle UbiSpec it coordinates. It also references the Lifecycle UbiSpec themselves — the event names in `When` must match events specified in the source decider's lifecycle, and the command names in `Then` must match commands specified in the target decider's lifecycle.

This cross-reference is the **contract boundary**: the process manager is guaranteed to receive events with the shapes defined by the source decider, and must emit commands with the shapes expected by the target decider.

## 4. Document Structure

```yaml
bspec: process/v1

process: <ProcessManagerName>
reacts_to: [<DeciderName>, ...]
emits_to: [<DeciderName>, ...]
model: <path to TypeScript model file>

state:
  <fieldName>: <TypeScript type>

common:
  <predicate-name>: <expression>

reactions:
  - When: <trigger>
    From: <source>
    And: [...]
    Then: <command specification>
    Outcome: <assertions>
```

### 4.1 Header

| Field | Required | Description |
|-------|----------|-------------|
| `bspec` | Yes | Format identifier. Must be `process/v1`. |
| `process` | Yes | Process manager name. PascalCase. |
| `reacts_to` | Yes | List of decider names whose events this process manager subscribes to. |
| `emits_to` | Yes | List of decider names to which this process manager dispatches commands. |
| `model` | Yes | Relative path to the TypeScript model file. |

The `reacts_to` and `emits_to` lists declare the **topology** — which aggregates this process manager connects. An agent can extract the full system wiring diagram from these declarations.

### 4.2 State

```yaml
state:
  <fieldName>: <TypeScript type>
```

Optional. Only present for **stateful sagas** — process managers that need to track custom state beyond what `When: { all: [...] }` handles automatically. See §9 for when manual state is appropriate.

When present, the state fields are available as `rm.state` in predicates and the reaction's outcome can assert on `om.state`.

### 4.3 Common

Same as Lifecycle UbiSpec §4.2. Reusable predicates referenced by bare name.

## 5. Reaction

Each element under `reactions` specifies the behaviour for one event-triggered reaction.

```yaml
reactions:
  - When: <trigger>
    From: <source>
    And:
      <constraints>
    Then: <commands>
    Outcome:
      <assertions>
```

### 5.1 When + From — Trigger

Together, these identify the trigger: which event(s) from which decider(s) cause the reaction to fire.

Three forms exist, addressing three distinct coordination patterns:

#### Scalar — Single Event

```yaml
When: OrderPlaced
From: Order
```

One event from one decider. The simplest form. The reaction fires once when this specific event occurs.

#### Any — One of Several Events (OR)

```yaml
When:
  any: [AssessmentSubmittedFullyMet, AssessmentSubmittedWithGaps]
From: SelfAssessment
```

The reaction fires when **any one** of the listed events occurs. This is an OR — exactly one event fires, and the reaction runs once for that event.

Rules:

- All listed events must come from the same decider (named in `From`).
- All listed events must be defined in the source decider's Lifecycle UbiSpec.
- Each invocation receives exactly one event. `rm.event` is typed as the discriminated union of the listed events. Use `rm.event.kind` to distinguish variants (§7.1).

**Use `any` when** multiple events represent variants of the same domain occurrence and the reaction logic is mostly identical, with small differences handled by conditional commands or event narrowing.

#### All — Wait for Multiple Events (AND)

```yaml
When:
  all:
    - PaymentConfirmed from Payment
    - InventoryReserved from Inventory
correlate: orderId
```

The reaction fires only when **all** listed events have arrived for the same correlated instance. This is an AND — the runtime accumulates events until the set is complete, then fires the reaction once with all event payloads accessible.

Rules:

- Events can come from different deciders. Each event is annotated with its source decider using the `EventName from DeciderName` syntax.
- All listed deciders must appear in `reacts_to`.
- All listed events must be defined in their respective source decider's Lifecycle UbiSpec.
- The `correlate` field declares which field links the events to the same instance. The named field must exist on every listed event.
- `From` is not used. Source deciders are declared per-event.
- Events may arrive in any order. The runtime handles accumulation.
- When all events have arrived, each event payload is accessible by name: `rm.events.PaymentConfirmed`, `rm.events.InventoryReserved` (§7.1). There is no union — each event has its concrete type.

**Use `all` when** multiple events must have occurred before the reaction can proceed — the scatter-gather or join pattern.

**When all events come from the same decider**, the source can be written once:

```yaml
When:
  all: [OrderPlaced, OrderApproved]
From: Order
correlate: orderId
```

This is equivalent to annotating each event with `from Order`. The `From` field is valid with `all` when all events share the same source.

#### Summary

| Form | Syntax | Fires when | rm namespace | From |
|------|--------|-----------|-------------|------|
| Scalar | `When: EventName` | Event occurs | `rm.event` (concrete) | Required |
| Any | `When: { any: [...] }` | Any one event occurs | `rm.event` (union) | Required (shared) |
| All | `When: { all: [...] }` + `correlate` | All events have arrived | `rm.events.EventName` (each concrete) | Per-event or shared |

### 5.2 And — Constraints

```yaml
And:
  - <constraint-name>: <expression>
  - <constraint-name>
```

Same semantics as Lifecycle UbiSpec §5.2. All constraints must hold for the reaction to proceed. If any fails, no commands are dispatched.

For `all` triggers, constraints are evaluated **after** all events have arrived. The constraint predicates have access to every event payload via `rm.events`.

Constraints are evaluated against the **Reaction Model** (§7).

`And` is optional. A reaction with no constraints always proceeds.

**No implicit failure event.** Unlike deciders, process managers do not emit `DecisionFailed`. A process manager that doesn't react simply does nothing. The event was observed; no action was needed. This is by design — the source event is a fact that already happened, and the process manager's silence is a valid outcome.

### 5.3 Then — Commands

Specifies which commands are dispatched on reaction. Each command is annotated with its target decider using `-> DeciderName`.

#### Scalar Form

```yaml
Then: <CommandName> -> <DeciderName>
```

Shorthand. Dispatches exactly one command, unconditionally.

#### List Form

```yaml
Then:
  - <CommandName> -> <DeciderName>
  - <CommandName> -> <DeciderName>:
      - <condition-name>: <expression>
  - <CommandName> -> <DeciderName>
```

Each entry is a command that may or may not be dispatched:

- **Unconditional command**: bare `CommandName -> DeciderName`. Always dispatched on reaction.
- **Conditional command**: command with conditions. Dispatched only when all conditions hold.

Rules:

- **All qualifying commands are dispatched.** Additive, same as Lifecycle UbiSpec events.
- Commands are dispatched **in list order**. Order matters — a target decider may reject a command if a prior command hasn't been processed first.
- Conditions are evaluated against the **Reaction Model** (§7).
- If all commands are conditional and none match, no commands are dispatched (valid no-op).
- The `-> DeciderName` must reference a decider in `emits_to`.
- The `CommandName` must match a command in the target decider's Lifecycle UbiSpec.

#### Patterns

**Single unconditional command**:
```yaml
Then: UpdateAssignment -> Laboratory
```

**Multiple unconditional commands** (ordered sequence):
```yaml
Then:
  - WithdrawAssignment -> Laboratory
  - AssignProfile -> Laboratory
```

**Conditional command** (only when conditions met):
```yaml
Then:
  - WithdrawAssignment -> Laboratory:
      - has-active-assignment: >
          rm.ctx.laboratory.assignments.some(a =>
            a.area.kind === rm.event.area.kind)
```

**Mixed** (base + conditional):
```yaml
Then:
  - UpdateAssignment -> Laboratory
  - NotifyCompliance -> Notification:
      - is-regulated-area: "rm.event.area.regulated === true"
```

**Multi-target** (commands to different deciders):
```yaml
Then:
  - ArchiveRegistry -> Registry
  - TriggerReassessment -> Laboratory
```

**Event-discriminated with `any`** (different commands for different triggering events):
```yaml
When:
  any: [OrderPlaced, OrderConfirmed]
From: Order
Then:
  - ReserveInventory -> Inventory:
      - is-placement: "rm.event.kind === 'OrderPlaced'"
  - ScheduleShipment -> Fulfillment:
      - is-confirmation: "rm.event.kind === 'OrderConfirmed'"
```

**Cross-event data assembly with `all`** (combine data from both events):
```yaml
When:
  all:
    - PaymentConfirmed from Payment
    - InventoryReserved from Inventory
correlate: orderId
Then: ScheduleShipment -> Fulfillment
Outcome:
  - uses-payment-data: >
      om.commands.find(c => c.kind === 'ScheduleShipment')
        .amount === rm.events.PaymentConfirmed.amount
  - uses-inventory-data: >
      om.commands.find(c => c.kind === 'ScheduleShipment')
        .lines === rm.events.InventoryReserved.reservedLines
```

### 5.4 Outcome — Assertions

Specifies what must be true about the commands dispatched. Two forms:

#### Flat Form

```yaml
Outcome:
  - <assertion-name>: <expression>
```

A flat list. All assertions must hold.

#### Keyed Form

```yaml
Outcome:
  _always:
    - <assertion-name>: <expression>
  <CommandName> -> <DeciderName>:
    - <assertion-name>: <expression>
```

Assertions grouped by relevance:

- **`_always`**: assertions that hold for every reaction execution.
- **Command-keyed sections**: assertions evaluated only when that command was dispatched.

The key format is `CommandName -> DeciderName`, matching the Then entries.

All assertions use the **Outcome Model** (§8).

## 6. Predicate Entry

Same as Lifecycle UbiSpec §6. All four detail levels apply — name only, scope annotation, prose description, and executable expression. Levels can be mixed within a single spec.

For process manager predicates, scope annotations reference `rm.*` and `om.*` namespaces instead of `dm.*`:

```yaml
# Level 1: name only
- has-active-assignment

# Level 2: scope annotation
- has-active-assignment: rm.ctx
- correct-amount: [rm.events.PaymentConfirmed, om.commands]

# Level 3: prose
- has-active-assignment: "Target laboratory has an active assignment in this area (rm.ctx)"

# Level 4: executable
- has-active-assignment: "rm.ctx.laboratory.assignments.some(a => a.area.kind === rm.event.area.kind)"
```

## 7. Reaction Model (rm)

The input context for process manager constraints and command conditions.

### 7.1 rm.event / rm.events — Triggering Events

The namespace depends on the When form:

#### Scalar and Any — `rm.event` (singular)

For scalar and `any` triggers, the reaction receives exactly one event. `rm.event` is a concrete runtime value — an object with a `kind` field and payload fields.

**Scalar When** — `rm.event` is that event's type, directly accessible:

```yaml
When: AssessmentConfirmed
From: SelfAssessment
# rm.event is an AssessmentConfirmed — all fields directly accessible
And:
  - has-reviewer: "rm.event.reviewedBy.length > 0"
```

**Any When** — `rm.event` is a discriminated union. Use `rm.event.kind` to narrow:

```yaml
When:
  any: [AssessmentSubmittedFullyMet, AssessmentSubmittedWithGaps]
From: SelfAssessment
# rm.event is one of the two types — narrow with .kind
Then:
  - UpdateAssignment -> Laboratory
  - ForwardGaps -> Laboratory:
      - has-gaps: "rm.event.kind === 'AssessmentSubmittedWithGaps'"
```

**Narrowing rules for `any`:**

Fields common to all events in the union can be accessed directly without narrowing (e.g., `rm.event.laboratoryId` if all events carry it). Variant-specific fields require narrowing:

**Inline narrowing with `&&` (preferred):** TypeScript narrows within a single `&&` expression. Safe at runtime — short-circuit prevents invalid access:

```yaml
- has-gaps: "rm.event.kind === 'AssessmentSubmittedWithGaps' && rm.event.gaps.length > 0"
```

**Conditional structure as narrowing context:** A conditional command's conditions establish which variant is present. Outcome assertions under that command's key inherit the narrowing:

```yaml
Then:
  - ForwardGaps -> Laboratory:
      - has-gaps: "rm.event.kind === 'AssessmentSubmittedWithGaps'"
Outcome:
  ForwardGaps -> Laboratory:
    # Only evaluated when ForwardGaps dispatched → rm.event.kind is 'AssessmentSubmittedWithGaps'
    - gaps-forwarded: "om.commands.find(c => c.kind === 'ForwardGaps').gaps === rm.event.gaps"
```

**Optional chaining as fallback:**
```yaml
- gaps-if-present: "rm.event.gaps?.length ?? 0 > 0"
```

#### All — `rm.events` (plural, keyed by event name)

For `all` triggers, every event payload is accessible by its event name. Each is its own concrete type — no union, no narrowing needed:

```yaml
When:
  all:
    - PaymentConfirmed from Payment
    - InventoryReserved from Inventory
correlate: orderId
And:
  - both-approved: >
      rm.events.PaymentConfirmed.status === 'captured' &&
      rm.events.InventoryReserved.status === 'reserved'
Then: ScheduleShipment -> Fulfillment
Outcome:
  - correct-amount: >
      om.commands.find(c => c.kind === 'ScheduleShipment')
        .amount === rm.events.PaymentConfirmed.amount
  - correct-lines: >
      om.commands.find(c => c.kind === 'ScheduleShipment')
        .lines === rm.events.InventoryReserved.reservedLines
  - same-order: >
      rm.events.PaymentConfirmed.orderId === rm.events.InventoryReserved.orderId
```

Rules:

- `rm.events.<EventName>` is the concrete event type — no discrimination needed.
- Every event listed in `all` is guaranteed present when the reaction fires.
- The field name matches the event name exactly as declared in the `all` list.
- `rm.event` (singular) is not available in `all` reactions. Use `rm.events`.

#### Summary

| When form | Namespace | Type | Narrowing needed |
|-----------|-----------|------|:---:|
| Scalar | `rm.event` | Concrete event type | No |
| Any | `rm.event` | Discriminated union | Yes (`.kind`) |
| All | `rm.events.EventName` | Each concrete type | No |

### 7.2 rm.state — Process Manager State

Only for stateful sagas. The process manager's own state before the reaction.

```yaml
- not-already-tracking: "!(rm.event.registryId in rm.state.pendingReassessments)"
```

Stateless reactors and reactions using `When: { all: [...] }` without custom state do not reference `rm.state`. The `all` trigger handles event accumulation automatically — the spec author does not need to manage saga state for the join pattern.

### 7.3 rm.ctx — Shell-Resolved Context

Async context resolved before the reaction runs. Typically read-model queries — looking up the current state of target aggregates.

```yaml
- has-assignment: >
    rm.ctx.laboratory.assignments.some(a =>
      a.area.kind === rm.event.area.kind)
  # shell: LaboratoryReadModel.findById(rm.event.laboratoryId)

- adjusted-profile-exists: "rm.ctx.adjustedProfileExists"
  # shell: RegistryReadModel.profileExists(rm.event.adjustedProfileId)
```

Convention: annotate with `# shell: <resolution hint>`.

Note: `rm.ctx` queries target **read models**, which are eventually consistent. The spec should be written with this in mind — a reaction that depends on split-second consistency should be flagged.

For `all` triggers, shell expressions can reference any event payload via `rm.events`:

```yaml
- current-stock: "rm.ctx.availableStock >= rm.events.OrderPlaced.requestedQuantity"
  # shell: InventoryReadModel.getStock(rm.events.OrderPlaced.productId)
```

### 7.4 Derivations

An agent scans the specification to derive:

- **Context type per reaction**: TypeScript type from `rm.ctx.*` paths.
- **Shell function per reaction**: async function that resolves the context.
- **Event type for scalar/any**: concrete type or discriminated union for `rm.event`.
- **Event record type for all**: `{ PaymentConfirmed: PaymentConfirmedEvent; InventoryReserved: InventoryReservedEvent }` for `rm.events`.
- **Correlation key**: from `correlate` field, verified present on all events.
- **Contract verification**: `rm.event` / `rm.events` field paths checked against source decider event types. Command payloads checked against target decider command types.

## 8. Outcome Model (om)

The context for postcondition assertions.

### 8.1 om.commands — Dispatched Commands

The ordered list of commands to be dispatched. Each command has a `kind` field (the command name) and payload fields matching the target decider's command type.

```yaml
- review-triggered: >
    om.commands.some(c =>
      c.kind === 'UpdateAssignment' &&
      c.targetKind === 'UnderReview' &&
      c.laboratoryId === rm.event.laboratoryId)

- correct-count: "om.commands.length === 2"

- correct-order: >
    om.commands.findIndex(c => c.kind === 'WithdrawAssignment') <
      om.commands.findIndex(c => c.kind === 'AssignProfile')
```

### 8.2 om.state — Process Manager State After

Only for stateful sagas with custom state. The process manager's state after the reaction.

```yaml
- reassessments-tracked: >
    om.state.pendingReassessments[rm.event.registryId]?.length ===
      rm.ctx.affectedLaboratories.length
```

### 8.3 Cross-Model Access

| Namespace | Available in | Purpose |
|-----------|-------------|---------|
| `om.commands` | All reactions | Commands dispatched — what will happen |
| `om.state` | Stateful sagas | New PM state |
| `rm.event` | Scalar, Any | Triggering event — data flow verification |
| `rm.events` | All | All triggering events — data flow verification |
| `rm.state` | Stateful sagas | Old PM state — before/after comparison |
| `rm.ctx` | All reactions | Resolved context — cross-referencing |

### 8.4 Outcome Completeness

A thorough Outcome includes:

1. **Command presence** — correct commands dispatched to correct targets
2. **Command payload** — data flows correctly from events to commands
3. **Command ordering** — sequence matters when target decider has dependencies
4. **Command count** — no unexpected extra commands
5. **Correlation integrity** (for `all`) — all events reference the same instance
6. **State tracking** (sagas) — correlation state updated correctly

## 9. Stateless vs Stateful

### 9.1 Stateless Reactor

Most process managers are stateless. They receive an event (or a completed set of events for `all`), optionally query context, and emit commands. No `state` section. No `rm.state` or `om.state` references.

```yaml
bspec: process/v1
process: AssessmentLifecycleManager
reacts_to: [SelfAssessment]
emits_to: [Laboratory]
model: "./model.ts"

reactions:
  - When: AssessmentConfirmed
    From: SelfAssessment
    Then: UpdateAssignment -> Laboratory
    Outcome:
      - confirmed: >
          om.commands.some(c =>
            c.kind === 'UpdateAssignment' &&
            c.targetKind === 'Confirmed')
```

Note: `When: { all: [...] }` reactions are also stateless from the spec author's perspective. The runtime manages event accumulation. The spec describes what happens when all events are present — not how to accumulate them.

### 9.2 Stateful Saga

When a process manager needs custom state beyond what `all` provides — for example, tracking a dynamic set of expected events, implementing timeouts, or managing multi-step compensation — it declares a `state` section and uses `rm.state`/`om.state`.

```yaml
bspec: process/v1
process: RegistryVersionManager
reacts_to: [Registry, Laboratory]
emits_to: [Laboratory]
model: "./model.ts"

state:
  pendingReassessments: "Record<string, string[]>"  # registryId -> labIds

reactions:
  - When: RegistryArchived
    From: Registry
    And:
      - has-affected-labs: "rm.ctx.affectedLaboratories.length > 0"
    Then: TriggerReassessment -> Laboratory
    Outcome:
      - reassessments-tracked: >
          om.state.pendingReassessments[rm.event.registryId]?.length ===
            rm.ctx.affectedLaboratories.length

  - When: AssignmentReassessmentTriggered
    From: Laboratory
    And:
      - is-tracked: "rm.event.registryId in rm.state.pendingReassessments"
    Then:
      - CompleteReassessmentCycle -> Registry:
          - all-done: >
              rm.state.pendingReassessments[rm.event.registryId]
                .filter(id => id !== rm.event.laboratoryId).length === 0
    Outcome:
      CompleteReassessmentCycle -> Registry:
        - tracking-cleared: >
            !(rm.event.registryId in om.state.pendingReassessments)
```

### 9.3 Choosing

| Need | Solution |
|------|----------|
| React to one event | Scalar When (stateless) |
| React to one of several events | `When: { any: [...] }` (stateless) |
| Wait for a known set of events | `When: { all: [...] }` (stateless) |
| Track a dynamic set of events | Custom `state` section (stateful saga) |
| Implement timeouts or deadlines | Custom `state` section (stateful saga) |
| Multi-step compensation | Custom `state` section (stateful saga) |

Prefer stateless. Use `all` before reaching for manual state. Only go stateful when the coordination logic cannot be expressed as a fixed set of awaited events.

## 10. Interpretation

### 10.1 As a Wiring Diagram

The `reacts_to` and `emits_to` headers, combined with `When`/`From` and `Then -> Target`, define the full event-command topology of the system:

```
DeciderA --[EventX]--> ProcessManager --[CommandY]--> DeciderB
                                      --[CommandZ]--> DeciderC
```

For `all` triggers, the diagram shows multiple inbound arrows converging:

```
Payment    --[PaymentConfirmed]---\
                                   --> ReadyToShipManager --[ScheduleShipment]--> Fulfillment
Inventory  --[InventoryReserved]--/
```

An agent can extract the full topology from all Process UbiSpec and Lifecycle UbiSpec in the system.

### 10.2 As Test Cases

Each reaction generates:

- **Happy path**: given event(s) and context satisfying all constraints, assert correct commands dispatched with correct payloads and ordering.
- **Per-constraint no-op**: for each constraint, given a violation, assert no commands dispatched.
- **Conditional command coverage**: for each conditional command, test with conditions met and not met.
- **`any` trigger coverage**: for each event variant, test separately.
- **`all` arrival order coverage**: test all permutations of event arrival order.
- **`all` correlation**: verify events with different correlation values are handled independently.
- **Contract verification**: command payloads type-check against target decider's command types.
- **Ordering tests**: when ordering assertions exist, verify sequence.
- **Saga state** (if stateful): given events in sequence, verify state accumulation.

### 10.3 As Implementation Contract

- **react function**: translates constraints and command conditions into code.
- **Shell function**: derived from `rm.ctx` references.
- **Event subscription**: derived from When + From. `any` subscribes to multiple events. `all` sets up accumulation with correlation.
- **Event types**: concrete for scalar, discriminated union for `any`, record for `all`.
- **Correlation**: from `correlate` field, verified present on all events in `all`.
- **Contract types**: event types from source deciders, command types for target deciders.
- **Saga state machine** (if stateful): state transitions derived from reactions.

## 11. Complete Examples

### 11.1 Stateless Reactor with `any` Trigger

```yaml
bspec: process/v1

process: AssessmentLifecycleManager
reacts_to: [SelfAssessment]
emits_to: [Laboratory]
model: "./model.ts"

reactions:

  # ── any: two events, same core reaction ──

  - When:
      any: [AssessmentSubmittedFullyMet, AssessmentSubmittedWithGaps]
    From: SelfAssessment
    Then:
      - UpdateAssignment -> Laboratory
      - ForwardGaps -> Laboratory:
          - has-gaps: "rm.event.kind === 'AssessmentSubmittedWithGaps'"
    Outcome:
      _always:
        - review-triggered: >
            om.commands.some(c =>
              c.kind === 'UpdateAssignment' &&
              c.targetKind === 'UnderReview' &&
              c.laboratoryId === rm.event.laboratoryId)
      ForwardGaps -> Laboratory:
        - gaps-forwarded: >
            om.commands.find(c => c.kind === 'ForwardGaps')
              .gaps === rm.event.gaps

  # ── Scalar: one event, one command ──

  - When: AssessmentConfirmed
    From: SelfAssessment
    Then: UpdateAssignment -> Laboratory
    Outcome:
      - assignment-confirmed: >
          om.commands.some(c =>
            c.kind === 'UpdateAssignment' &&
            c.targetKind === 'Confirmed' &&
            c.confirmedBy === rm.event.reviewedBy)

  # ── Ordered sequence ──

  - When: AssessmentAdjusted
    From: SelfAssessment
    And:
      - adjusted-profile-exists: "rm.ctx.adjustedProfileExists"
    Then:
      - WithdrawAssignment -> Laboratory
      - AssignProfile -> Laboratory
    Outcome:
      - old-withdrawn: >
          om.commands.some(c =>
            c.kind === 'WithdrawAssignment' &&
            c.area.kind === rm.event.area.kind)
      - new-assigned: >
          om.commands.some(c =>
            c.kind === 'AssignProfile' &&
            c.profileId === rm.event.adjustedProfileId &&
            c.source === 'authority')
      - correct-order: >
          om.commands.findIndex(c => c.kind === 'WithdrawAssignment') <
            om.commands.findIndex(c => c.kind === 'AssignProfile')

  - When: AssessmentDevelopmentPlanIssued
    From: SelfAssessment
    Then: UpdateAssignment -> Laboratory
    Outcome:
      - development-plan-set: >
          om.commands.some(c =>
            c.kind === 'UpdateAssignment' &&
            c.targetKind === 'Development' &&
            c.actions === rm.event.actions)

  - When: RevisionRequested
    From: SelfAssessment
    Then: UpdateAssignment -> Laboratory
    Outcome:
      - assignment-reverted: >
          om.commands.some(c =>
            c.kind === 'UpdateAssignment' &&
            c.targetKind === 'SelfAssessed')

  # ── Conditional command ──

  - When: AssessmentCancelled
    From: SelfAssessment
    Then:
      - WithdrawAssignment -> Laboratory:
          - has-active-assignment: >
              rm.ctx.laboratory.assignments.some(a =>
                a.area.kind === rm.event.area.kind &&
                (a.kind === 'SelfAssessed' || a.kind === 'UnderReview'))
    Outcome:
      WithdrawAssignment -> Laboratory:
        - correct-area: >
            om.commands.find(c => c.kind === 'WithdrawAssignment')
              .area.kind === rm.event.area.kind
```

### 11.2 Cross-Aggregate Join with `all` Trigger

```yaml
bspec: process/v1

process: ReadyToShipManager
reacts_to: [Payment, Inventory]
emits_to: [Fulfillment]
model: "./model.ts"

reactions:

  - When:
      all:
        - PaymentConfirmed from Payment
        - InventoryReserved from Inventory
    correlate: orderId
    Then: ScheduleShipment -> Fulfillment
    Outcome:
      - shipment-for-correct-order: >
          om.commands.find(c => c.kind === 'ScheduleShipment')
            .orderId === rm.events.PaymentConfirmed.orderId
      - uses-payment-amount: >
          om.commands.find(c => c.kind === 'ScheduleShipment')
            .amount === rm.events.PaymentConfirmed.capturedAmount
      - uses-reserved-lines: >
          om.commands.find(c => c.kind === 'ScheduleShipment')
            .lines.length === rm.events.InventoryReserved.reservedLines.length
      - single-command: "om.commands.length === 1"
```

### 11.3 Same-Decider Join with `all` Trigger

```yaml
bspec: process/v1

process: OrderReadyForProcessingManager
reacts_to: [Order]
emits_to: [Fulfillment]
model: "./model.ts"

reactions:

  - When:
      all: [OrderPlaced, PaymentVerified]
    From: Order
    correlate: orderId
    And:
      - no-fraud-flag: "rm.events.PaymentVerified.fraudScore < 0.7"
    Then: BeginFulfillment -> Fulfillment
    Outcome:
      - fulfillment-initiated: >
          om.commands.some(c =>
            c.kind === 'BeginFulfillment' &&
            c.orderId === rm.events.OrderPlaced.orderId &&
            c.lines === rm.events.OrderPlaced.lines)
```

## 12. Grammar Summary

```
Document         := Header State? Common? Reactions
Header           := 'bspec: process/v1' Process ReactsTo EmitsTo Model
Process          := 'process:' ProcessName
ReactsTo         := 'reacts_to:' '[' DeciderName (',' DeciderName)* ']'
EmitsTo          := 'emits_to:' '[' DeciderName (',' DeciderName)* ']'
State            := 'state:' FieldMap
Common           := 'common:' PredicateMap
Reactions        := 'reactions:' Reaction+

Reaction         := Trigger And? Then Outcome

Trigger          := ScalarTrigger | AnyTrigger | AllTrigger
ScalarTrigger    := 'When:' EventName 'From:' DeciderName
AnyTrigger       := 'When:' '{' 'any:' EventList '}' 'From:' DeciderName
AllTrigger       := AllTriggerCross | AllTriggerShared
AllTriggerCross  := 'When:' '{' 'all:' SourcedEventList '}' 'correlate:' FieldName
AllTriggerShared := 'When:' '{' 'all:' EventList '}' 'From:' DeciderName 'correlate:' FieldName
EventList        := '[' EventName (',' EventName)+ ']'
SourcedEventList := SourcedEvent+
SourcedEvent     := '- ' EventName ' from ' DeciderName

And              := 'And:' Constraint+
Constraint       := PredicateEntry | CommonRef

Then             := ScalarThen | ListThen
ScalarThen       := 'Then:' TargetedCommand
ListThen         := 'Then:' CommandSpec+
CommandSpec      := UnconditionalCommand | ConditionalCommand
UnconditionalCommand  := '- ' TargetedCommand
ConditionalCommand    := '- ' TargetedCommand ':' PredicateEntry+
TargetedCommand  := CommandName ' -> ' DeciderName

Outcome          := FlatOutcome | KeyedOutcome
FlatOutcome      := 'Outcome:' PredicateEntry+
KeyedOutcome     := 'Outcome:' AlwaysBlock? CommandOutcome+
AlwaysBlock      := '_always:' PredicateEntry+
CommandOutcome   := TargetedCommand ':' PredicateEntry+

PredicateEntry   := '- ' PredicateName ':' Expression
PredicateMap     := (PredicateName ':' Expression)+
FieldMap         := (FieldName ':' TypeExpression)+
PredicateName    := kebab-case-identifier
Expression       := TypeScript boolean expression over rm.* | om.*
ProcessName      := PascalCase identifier
DeciderName      := PascalCase identifier
EventName        := PascalCase identifier
CommandName      := PascalCase identifier
FieldName        := camelCase identifier
```

## 13. Comparison with Lifecycle UbiSpec

| Concept | Lifecycle UbiSpec | Process UbiSpec |
|---------|-----------------|----------------|
| Triggered by | Command (`When`) | Event(s) (`When` + `From`) |
| Produces | Events (`Then`) | Commands (`Then` + `-> Target`) |
| Input model | `dm` (cmd, state, ctx) | `rm` (event/events, state, ctx) |
| Output model | `om` (state, evts) | `om` (commands, state) |
| Failure | `DecisionFailed` event | No-op (silence) |
| State | Always (aggregate) | Optional (saga) |
| Identity | Aggregate ID | Correlation (from events) |
| Topology | Self-contained | Declares `reacts_to` / `emits_to` |
| Single trigger | One command | Scalar: one event |
| OR trigger | N/A | `any`: one of several events |
| AND trigger | N/A | `all`: wait for all events + `correlate` |

## 14. Versioning

Format: `process/v1`. Declared in the `bspec` header. Breaking changes increment the version.
