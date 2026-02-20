---
layout: default
title: Home
nav_order: 1
permalink: /
---

# UbiSpec

**Behavioural Specification Format for Software Systems**

UbiSpec is a structured YAML format for capturing software behaviour. It describes *what a system does* — which actions are possible, under what conditions, what happens as a result, and what must be true afterwards — in a format that is both human-readable and machine-processable.

- **Make sure to visit the** — [Payground](https://mean-machine-gc.github.io/bspec/playground) to the UbiSpec in action!

## The Problem

Software behaviour lives in the wrong places. Acceptance criteria in tickets, rules in Confluence pages, test plans in spreadsheets, diagrams on whiteboards, decisions in people's heads. All of these try to express the same thing: "when X happens under conditions Y, then Z must be true." But they express it in prose that can't be validated, can't be cross-referenced, and can't generate anything.

The result is familiar: requirements that contradict each other, test cases that don't trace back to business rules, documentation that drifts from implementation, and conversations that get repeated because nobody can find where the decision was recorded.

## The Approach

UbiSpec gives behaviour a structured home:

```yaml
- When: ApproveRegistry
  And:
    - registry-is-submitted
    - reviewer-is-authorised
  Then:
    - RegistryApproved
    - PreviousRegistryArchived:
        - has-active-registry
  Outcome:
    _always:
      - state-is-active
      - effective-date-set
    PreviousRegistryArchived:
      - archival-target-correct
```

This says: *When someone approves a registry, it must be submitted and the reviewer must be authorised. The registry is approved. If another registry is active, it gets archived. Afterwards, the registry is active and the effective date is set. If archival happened, the target is correct.*

Every constraint, condition, and assertion has a **name** that reads as natural language. Anyone in the room — domain expert, product owner, developer, tester — can read it and say "that's right" or "that's wrong."

Even without expressions, adding **scope annotations** reveals the architecture — which data sources each constraint depends on:

```yaml
- When: ApproveRegistry
  And:
    - registry-is-submitted: dm.state
    - reviewer-is-authorised: dm.ctx
  Then:
    - RegistryApproved
    - PreviousRegistryArchived:
        - has-active-registry: dm.ctx
  Outcome:
    _always:
      - state-is-active: om.state
      - effective-date-set: [om.state, dm.cmd]
    PreviousRegistryArchived:
      - archival-target-correct: [om.evts, dm.ctx]
```

Now you can see: `registry-is-submitted` only needs the aggregate's own state. `reviewer-is-authorised` requires an external lookup. `effective-date-set` compares the new state against the original command. No code — but the integration points and data flow are already visible.

When the team is ready, each name gets an **executable predicate** — a precise expression that can be validated against a domain model, turned into a test, or used to generate implementation:

```yaml
- When: ApproveRegistry
  And:
    - registry-is-submitted: "dm.state.status.kind === 'SubmittedForReview'"
    - reviewer-is-authorised: "dm.ctx.isNationalAuthority"
  Then:
    - RegistryApproved
    - PreviousRegistryArchived:
        - has-active-registry: "dm.ctx.currentActiveRegistryId != null"
  Outcome:
    _always:
      - state-is-active: "om.state.status.kind === 'Active'"
      - effective-date-set: "om.state.status.effectiveDate === dm.cmd.effectiveDate"
    PreviousRegistryArchived:
      - archival-target-correct: >
          om.evts.find(e => e.kind === 'PreviousRegistryArchived')
            .registryId === dm.ctx.currentActiveRegistryId
```

Same structure. Same names. Now executable. Three levels of detail, each useful on its own, each building on the last.

## What UbiSpec Gives You

From a single source of truth, at each level of predicate detail:

| Output | Names only | + Scopes | + Expressions |
|--------|:---:|:---:|:---:|
| Structured behaviour catalog | ✓ | ✓ | ✓ |
| User stories with acceptance criteria | ✓ | ✓ | ✓ |
| Test scenarios and coverage matrices | ✓ | ✓ | ✓ |
| Workflow documentation | ✓ | ✓ | ✓ |
| Client validation checklists | ✓ | ✓ | ✓ |
| Shell / integration point manifests | | ✓ | ✓ |
| Data flow architecture | | ✓ | ✓ |
| Executable test suites | | | ✓ |
| Implementation skeletons | | | ✓ |

The first column requires zero code. A UbiSpec with names only is already a complete behavioural specification — structured enough to generate documentation and stories, precise enough to validate with stakeholders. Adding scope annotations (`dm.state`, `dm.ctx`) reveals the architecture. Adding expressions makes it executable.

## Where UbiSpec Fits

UbiSpec operationalises the output of collaborative modelling. It's not a replacement for domain discovery — it's what you write *after* discovery, to capture what you learned in a format that survives.

### Starting From Collaborative Modelling

If you've done EventStorming, Context Mapping, Example Mapping, or similar workshops, you already have the raw material: bounded contexts, aggregates, commands, events, policies, read models. UbiSpec gives that material a structured home:

```
EventStorming / Context Mapping / Domain Conversations
    ↓
Bounded contexts identified, aggregates sketched
    ↓
UbiSpec (one Lifecycle per aggregate, one Process per coordination flow)
    ↓
    ├→ Validation with domain experts (names pass)
    ├→ User stories, test scenarios, documentation
    ├→ Enrichment with predicates (developer pass)
    └→ Implementation, executable tests
```

The workshop gives you the big picture — contexts, boundaries, flows. UbiSpec zooms into each aggregate and captures the precise rules: which commands are accepted, under what conditions, what changes, what doesn't.

### Starting From Scratch

If there's no prior modelling, UbiSpec can be used as a discovery tool. Writing specs forces the questions that matter: *What can happen to this thing? When can it happen? What prevents it? What changes as a result? What must stay the same?*

Start with one aggregate. Write the lifecycle. Present it. The gaps and contradictions surface quickly — "wait, can a suspended lab be closed directly?" — because the structure demands answers the way prose doesn't.

As you write more aggregates, cross-cutting coordination surfaces naturally: "when this event happens on aggregate A, does anything need to happen on aggregate B?" That's a Process UbiSpec. The topology of your system emerges from the specs.

This works especially well when prototyping: sketch a few lifecycles, see how they interact, refactor boundaries. UbiSpec are cheap to rewrite because they're small and self-contained.

### Either Way

Whether you start from a week-long EventStorming or a single conversation, UbiSpec captures the output in the same format. The quality of the specs depends on the quality of the discovery — but the format ensures that whatever you discover doesn't evaporate.

## Specification Formats

UbiSpec currently defines two formats:

| Format | File | Captures |
|--------|------|----------|
| [**Lifecycle UbiSpec**](spec/lifecycle.md) | `*.lifecycle.ubispec.yaml` | Single aggregate behaviour: commands, conditions, outcomes |
| [**Process UbiSpec**](spec/process.md) | `*.process.ubispec.yaml` | Cross-aggregate coordination: event reactions, command dispatch |

### Lifecycle UbiSpec

Describes one aggregate's complete behavioural contract: what commands it accepts, under what conditions, what events it produces, and what must be true after.

```yaml
bspec: lifecycle/v1
decider: Order
identity: orderId
model: "./model.ts"

lifecycle:
  - When: PlaceOrder
    And:
      - order-is-draft
      - has-lines
      - all-in-stock
    Then: OrderPlaced
    Outcome:
      - state-is-placed
      - placed-at-recorded
```

### Process UbiSpec

Describes how aggregates coordinate: when an event on one aggregate triggers commands on another.

```yaml
bspec: process/v1
process: OrderFulfillmentManager
reacts_to: [Order]
emits_to: [Inventory, Payment]

reactions:
  - When: OrderPlaced
    From: Order
    Then:
      - ReserveInventory -> Inventory
      - InitiatePaymentCapture -> Payment
```

## Key Concepts

### Predicate Detail Levels

Every predicate has a name. The value — the part after the colon — is optional and takes four forms:

```yaml
- registry-is-draft                                            # Name only
- registry-is-draft: dm.state                                  # Scope: which data sources
- registry-is-draft: "Registry must be in Draft status"        # Prose description
- registry-is-draft: "dm.state.status.kind === 'Draft'"        # Executable expression
```

All four are valid UbiSpec. They represent a spectrum from general to precise. Use the level that fits your stage and audience. Levels can be mixed within a single spec — some predicates fully expressed, others still at name-only. See the [Conceptual Foundations](guide/conceptual-foundations.md#namespaces-over-expressions) for why this matters.

### Two-Pass Workflow

UbiSpec are designed for two audiences:

**Pass 1 — Domain Pass (names + scopes):** Work with domain experts. Write constraint and assertion names as natural language. Optionally annotate with scope (`dm.state`, `dm.ctx`). Validate the logic: "Is it true that a reviewer must be authorised? Is it true that archival only happens when another registry is active?" No code, just structured conversation output.

**Pass 2 — Precision Pass (add expressions):** Work with developers. Add executable expressions to each name. Validate against the domain model. Identify shell dependencies (`dm.ctx`). The spec becomes executable without changing structure.

Different people, different skills, same artifact evolving.

### The Namespaces (dm / om / rm)

The namespaces are the core vocabulary. They describe where behavioural data lives — a question every system must answer regardless of language or architecture.

**Decision Model (`dm`)** — input to a decision:

- **`dm.cmd`** — what the user sent (the command payload)
- **`dm.state`** — what we know right now (current state)
- **`dm.ctx`** — what we had to look up (external context, resolved before deciding)

**Outcome Model (`om`)** — verification after a decision:

- **`om.state`** — the state after (what changed)
- **`om.evts`** — the events produced (what happened)
- Plus access to `dm.state` (before) and `dm.cmd` (original input) for comparison

**Reaction Model (`rm`)** — input to a cross-aggregate reaction:

- **`rm.event`** — the triggering event (scalar or `any` triggers)
- **`rm.events`** — all triggering events by name (`all` triggers)
- **`rm.ctx`** — what we had to look up (read-model queries)

The `dm.ctx` and `rm.ctx` namespaces do quiet but important work: every reference to them is a **shell contract** — a declaration that something external must be resolved before the logic runs. Scan the spec for `.ctx` references and you have a complete manifest of integration points. This is true at every detail level — even a scope annotation of `dm.ctx` tells you there's a shell dependency.

### Implicit Failure

UbiSpec only describe success paths. When any constraint fails, the system produces a standard `DecisionFailed` event carrying the names of the failed constraints:

```
{ kind: 'DecisionFailed', decision: 'ApproveRegistry', failed: ['reviewer-is-authorised'] }
```

The constraint names **are** the error messages. This eliminates boilerplate failure specifications and keeps the spec focused on what the system *does*, not all the ways it can refuse.

### Additive Events

A command can produce multiple outcomes. Unconditional events always happen. Conditional events happen when their conditions are met. Everything that applies fires:

```yaml
Then:
  - RegistryApproved                          # always
  - PreviousRegistryArchived:                  # only when applicable
      - has-active-registry: "dm.ctx.currentActiveRegistryId != null"
```

## Examples

| Domain | Files | Shows |
|--------|-------|-------|
| [E-commerce Order](examples/ecommerce/) | `order.lifecycle.ubispec.yaml`, `order-fulfillment.process.ubispec.yaml` | Full order lifecycle with fulfillment coordination |
| [Laboratory Capability](examples/laboratory/) | `laboratory.lifecycle.ubispec.yaml`, `assessment-lifecycle.process.ubispec.yaml` | Assessment workflow with cross-aggregate process manager |

## Editor Support

UbiSpec includes JSON Schemas for both formats. With the [YAML extension for VS Code](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml), you get validation, autocomplete, and hover documentation.

Add to the top of your spec file:

```yaml
# yaml-language-server: $schema=https://mean-machine-gc.github.io/bspec/schema/lifecycle.v1.schema.json
```

Or configure globally in VS Code settings:

```json
{
  "yaml.schemas": {
    "https://mean-machine-gc.github.io/bspec/schema/lifecycle.v1.schema.json": "*.lifecycle.ubispec.yaml",
    "https://mean-machine-gc.github.io/bspec/schema/process.v1.schema.json": "*.process.ubispec.yaml"
  }
}
```

## Repo Structure

```
bspec/
├── spec/
│   ├── lifecycle.md                   ← Lifecycle UbiSpec specification
│   └── process.md                     ← Process UbiSpec specification
├── schema/
│   ├── lifecycle.v1.schema.json       ← JSON Schema for editor support
│   └── process.v1.schema.json         ← JSON Schema for editor support
├── examples/
│   ├── ecommerce/                     ← Order lifecycle + fulfillment process
│   └── laboratory/                    ← Lab capability + assessment process
└── guide/
    └── getting-started.md             ← From discovery to specs
```

## Design Principles

1. **Names are the specification.** Every constraint, condition, and assertion has a name that reads as natural language. The names alone are a complete behavioural spec. Predicates add precision but don't change the structure.

2. **Two passes, two audiences.** Domain experts validate names. Developers add expressions. Same artifact, no translation step.

3. **Success paths only.** Failure is implicit in constraints. The `DecisionFailed` convention keeps specs focused on what the system does.

4. **Types in the model, behaviour in the spec.** The domain model defines shapes. UbiSpec define what happens. Neither duplicates the other.

5. **Additive, not branching.** Commands produce all events whose conditions are met. No nested branches, no priority ordering. Complexity proportional to actual complexity.

6. **Integration points are visible.** Every `dm.ctx` / `rm.ctx` reference declares an external dependency. The spec is a manifest of what the system needs from the outside world.

7. **Namespaces are the architecture.** `dm.cmd`, `dm.state`, `dm.ctx` — these describe where data lives. A scope annotation (`dm.ctx`) is already architectural information, even without an expression.

8. **Detail is a spectrum, not a gate.** Name only, scope annotation, prose description, executable expression — all valid, mixable within one spec. Start where you are. Add precision when you need it.

## Practices UbiSpec Operationalises

UbiSpec is informed by and designed to complement:

- **Domain-Driven Design** — bounded contexts, aggregates, ubiquitous language
- **EventStorming** — commands, events, policies, read models, aggregate boundaries
- **Behaviour-Driven Development** — specifications as tests, natural language acceptance criteria
- **Specification by Example** — concrete scenarios that define expected behaviour
- **Example Mapping** — rules, examples, and questions structured by story

UbiSpec doesn't replace these practices. It gives their output a durable, structured format that generates downstream artifacts instead of gathering dust.

## Status

UbiSpec is in early development. The Lifecycle and Process formats are stable enough to use. Tooling (validator CLI, test generator, story generator) is planned.

Feedback, examples, and contributions are welcome.

## License

MIT
