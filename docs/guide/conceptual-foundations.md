---
layout: default
title: Conceptual Foundations
nav_order: 5
---

# Conceptual Foundations

This page explains the reasoning behind UbiSpec: where the format comes from, why it takes the shape it does, and how each design choice follows from the one before it.

## Starting Point: EventStorming's Visual Grammar

UbiSpec owes its primary debt to [EventStorming](https://www.eventstorming.com/), created by Alberto Brandolini. EventStorming provides a visual grammar for exploring system behaviour using sticky notes — commands, events, policies, aggregates, read models — that a room full of people can arrange on a wall to build a shared understanding of a domain.

What makes EventStorming powerful is not the sticky notes. It is the **two fundamental sequences** that compose all system behaviour:

**The command-led sequence.** A user (or system) issues a command. The command is evaluated against the current state. If accepted, one or more events are produced. These events represent what happened — facts about the system's history.

```
Command → [conditions] → Event(s)
```

**The policy sequence.** An event is observed. A policy decides whether and how to react. If it reacts, it issues one or more commands, which feed into other command-led sequences.

```
Event(s) → [policy logic] → Command(s)
```

These two sequences compose. A command produces events, which trigger policies, which issue commands, which produce events. Any system behaviour — however complex — can be decomposed into these two building blocks chained together.

UbiSpec formalises these two sequences into two specification formats:

| EventStorming | UbiSpec | File |
|---------------|---------|------|
| Command-led sequence | **Decision** | Lifecycle UbiSpec |
| Policy sequence | **Reaction** | Process UbiSpec |

The entire format follows from this decomposition.

## Decisions: The Structure of a Command-Led Sequence

A decision is what happens when a command arrives. If we dissect a decision carefully, an intrinsic logical structure emerges that can explain all possible configurations.

**A command produces one or more events if some conditions are met.** These conditions are constraints — business rules, state guards, authorisation checks, validation rules. They must all hold for the command to succeed.

**If any constraint fails, the result is a domain failure.** The command was attempted but could not proceed. The failure is directly linked to the constraints that were not satisfied.

**If we abstract the failure by convention** — by saying that a failed constraint always produces a standard `DecisionFailed` event carrying the names of the constraints that failed — then we can focus the specification entirely on the success path. The failure scenarios are implicit: for each constraint, there is a failure scenario where it is violated. The constraint names become the failure reasons. No separate failure specification is needed.

This is not a simplification for convenience. It is a design principle: the specification describes **what the system can do**, not all the ways it can refuse. The refusal cases are mechanically derivable from the success cases.

**But not all events are always emitted on success.** Some events are conditional — they depend on additional branching logic beyond the entry constraints. An order approval might always produce an `OrderApproved` event, but only produce an `ArchivalTriggered` event when a previous active version exists.

So a decision has four elements:

1. **Command** — the trigger
2. **Constraints** — what must hold for the command to succeed
3. **Events** — what is produced on success, some unconditional, some conditional
4. **Branching logic** — conditions determining which conditional events fire

This accounts for every configuration a command-led sequence can take.

## The Decision Model: What Data Does a Decision Need?

To evaluate constraints and branching logic, the decision needs data. If we ask *what data?* systematically, three distinct sources emerge:

**The command itself (`dm.cmd`).** The command carries the user's intent and any request metadata — the payload they submitted. "Approve this registry. Here is my reviewer ID and the effective date."

**The current state of the aggregate (`dm.state`).** The system's current knowledge about this entity — its status, its contents, its history of changes. "The registry is in Submitted status. It has three profiles."

**External context (`dm.ctx`).** Information that lives outside the aggregate — in another service, in a clock, in a read model. The aggregate can't know this from its own history; something must look it up before the decision runs. "Is this reviewer authorised? Is another registry currently active?"

These three sources — command, state, context — are the **decision model**. In UbiSpec, they form the `dm` namespace: `dm.cmd`, `dm.state`, `dm.ctx`.

The context namespace does quiet but important work. Every `dm.ctx` reference in a specification is a **shell contract**: a declaration that the runtime environment must resolve this value before the decision function is called. An agent or developer can scan a specification for all `dm.ctx` references and mechanically derive the integration points for each command. Nothing is hidden.

The three-namespace structure also makes the **purity boundary** explicit. `dm.cmd` and `dm.state` are synchronous and deterministic — they are values already available. `dm.ctx` is the seam where the outside world enters. The decision function itself is pure: given (cmd, state, ctx), it produces the same events every time. The impurity is isolated in the shell that resolves the context before the decision runs.

## Events and State: What Changes?

A decision produces events. But what are events? Do they represent a change in state, or do they trigger a change in state?

This is where the work of Jérémie Chassaing on the **Decider pattern** becomes foundational. Chassaing formalised a functional representation of an event-sourced aggregate as three elements:

```
decide:  (command, state) → event[]
evolve:  (state, event) → state
initial: state
```

The `decide` function makes the decision — given a command and the current state, what events are produced? The `evolve` function applies an event to a state, producing the new state. The `initial` value is the starting state before any events have occurred.

State is derived by folding events: `state = events.reduce(evolve, initial)`. The events are the source of truth. State is a computation over them.

This separation offers several practical advantages:

**Auditability.** The event stream is a complete record of what happened and why. State is a projection — a view derived from history. You can always explain how the system arrived at its current state by replaying the events.

**Testability.** The decide function is pure: same inputs, same outputs. No side effects, no database calls, no external dependencies (those are resolved in the context before decide runs). This makes property-based testing natural: for any valid combination of command, state, and context, assert that the produced events satisfy the specification.

**Composability.** Multiple views (read models, projections, analytics) can be derived from the same event stream. Each view folds the events differently. The events are shared; the interpretations are independent.

**Separation of concerns.** The decision logic (what events to produce) is separate from the state transition logic (how to apply an event). This prevents a common mistake: mixing business rule validation with state mutation, which makes both harder to reason about and test.

UbiSpec captures the decide side of this pattern — what events a command produces under what conditions. The evolve side is implied by the outcome assertions: "after these events are applied, these things must be true about the state." The Lifecycle UbiSpec is, in essence, a formal contract for both sides of the Decider pattern.

It is worth noting that event sourcing is a natural fit for this model but not a requirement. The decision/reaction decomposition, the namespace model, and the specification structure all work regardless of how state is persisted. A system using traditional state storage can still benefit from specifying behaviour as decisions and reactions with clear input and output models.

## The Outcome Model: Verifying What Happened

A decision produces events. Events are applied to state via evolve. But how do we verify that the right thing happened?

The outcome model (`om`) provides the verification context. After all events have been applied, the outcome model exposes:

**`om.state`** — the new state after evolve. This is where we assert what changed: "the registry is now Active", "the line item is in the catalog."

**`om.evts`** — the events that were emitted. This is where we assert what happened: "a RegistryApproved event was produced", "the event carries the correct effective date."

Crucially, outcome assertions also have access to the decision model — `dm.state` (the state before), `dm.cmd` (the original command), and `dm.ctx` (the resolved context). This enables three essential categories of assertion:

**Positive assertions.** What changed. "State is Active. Effective date is set."

**Negative assertions.** What must not change. "The test catalog is unchanged. Other assignments are preserved." These catch accidental side effects — an evolve function that inadvertently clears unrelated state would fail a negative assertion even if all positive assertions pass.

**Data flow assertions.** The outputs carry the right data from the inputs. "The event's effective date matches the command's effective date. The archival event targets the correct registry ID from the context." These verify that information flows correctly through the decision without being lost or garbled.

The outcome model closes the specification loop. The decision model defines what goes in. The constraints and event conditions define the logic. The outcome model defines what must come out. Together, they form a complete behavioural contract that can be verified mechanically — as a test suite, as a property-based test, or as a runtime assertion.

## Reactions: The Structure of a Policy Sequence

Where a decision transforms commands into events within one aggregate, a reaction coordinates between aggregates. An event on one aggregate triggers commands on another.

The reaction model (`rm`) mirrors the decision model, but the inputs are different:

**`rm.event`** — the triggering event, analogous to `dm.cmd`. Where a decision is triggered by a user's intent (a command), a reaction is triggered by a fact about what happened (an event).

**`rm.state`** — the process manager's own state, if it is stateful. Most reactions are stateless — they receive an event and immediately determine what commands to dispatch. Stateful reactions (sagas) track progress across multiple events, for example waiting for several confirmations before proceeding.

**`rm.ctx`** — external context, same role as `dm.ctx`. For reactions, this is typically read-model queries: "what is the current state of the target aggregate?" These queries target eventually consistent projections — a fact worth keeping visible in the specification.

The outcome model for reactions contains `om.commands` — the ordered list of commands to be dispatched — instead of `om.evts`. Assertions verify that the right commands are dispatched to the right targets with the right data.

### Multiple Triggers

A reaction may be triggered by more than one event. Two patterns exist, and they are fundamentally different:

**OR — any of these events.** Several events trigger the same reaction. Only one event has occurred; the reaction runs once. This is common when events are variants of the same domain occurrence: "assessment submitted fully met" and "assessment submitted with gaps" both trigger the same review workflow.

In UbiSpec, this is expressed with `When: { any: [...] }`. The `rm.event` is typed as a discriminated union of the listed events — it is always exactly one event, and the reaction uses the event's `kind` field to distinguish variants when the logic differs.

A note on typing: each predicate in a UbiSpec is a standalone expression. Discriminated union narrowing in TypeScript is control-flow based — it works within an expression (e.g., `rm.event.kind === 'X' && rm.event.specificField`) but does not carry across separate predicate expressions. In UbiSpec, the conditional structure provides the narrowing context: a conditional command's predicates establish which event variant is present, and outcome assertions under that command key can safely reference variant-specific fields. This is a specification convention, not a language feature — tooling that validates predicate expressions should respect the conditional hierarchy as a narrowing boundary.

**AND — all of these events must arrive.** The reaction waits for multiple events — potentially from different aggregates, arriving at different times — before acting. This is the scatter-gather or join pattern.

In UbiSpec, this is expressed with `When: { all: [...] }` combined with a `correlate` field that declares how events are matched to the same instance. Each event's payload is accessible by name via `rm.events.EventName` — no union, no narrowing needed, each event has its concrete type.

The runtime handles accumulation: events arrive in any order, are stored by correlation key, and the reaction fires once when the set is complete. The spec author describes the completed state — what happens when all events are present — not the mechanics of accumulation.

The distinction matters because OR is a specification convenience (deduplicating similar reactions), while AND is a coordination mechanism (waiting for convergence). UbiSpec makes this distinction explicit: `any` for OR, `all` for AND, each with its own namespace pattern.

## Composition: From Decisions to Systems

Decisions and reactions are the atomic building blocks. They compose into larger structures:

**An aggregate** is one or more decisions sharing an identity. In the simplest case, one decision per command, all operating on the same state. In Eric Evans' Domain-Driven Design, an aggregate is a consistency boundary — everything inside it is transactionally consistent. A Lifecycle UbiSpec captures one aggregate.

**A process** emerges when decisions are linked by reactions within the same subsystem. Event A on aggregate X triggers a command on aggregate Y, which produces event B, which triggers a command on aggregate Z. The reactions form a choreography — a chain of cause and effect. A Process UbiSpec captures these reactions.

**A workflow** spans subsystem boundaries. When reactions connect processes in different bounded contexts — each with their own models, their own language, their own deployment boundaries — the coordination becomes a long-running workflow. The same Process UbiSpec format applies, but the `reacts_to` and `emits_to` declarations cross context boundaries, making the coupling explicit and visible.

This composition is fractal. A complex system is processes made of reactions linking decisions. A complex process is a chain of reactions. A complex decision is constraints and conditional events. At every level, the same two primitives — "command in, events out" and "events in, commands out" — do the work.

## The Naming Principle

Every constraint, condition, and assertion in a UbiSpec has a **name** — a kebab-case identifier that reads as natural language.

```yaml
- reviewer-is-authorised
- has-active-registry
- state-is-active
- catalog-unchanged
```

This is not documentation. The names are the specification. They carry the meaning. A domain expert can read a UbiSpec with names only (no predicate expressions) and validate whether the behaviour is correct. The expressions add precision for developers and machines, but the names are what the team agrees on.

This design enables the **two-pass workflow** that UbiSpec is built around. The first pass — with domain experts — produces a specification in natural language, structured as When/And/Then/Outcome. The second pass — with developers — adds executable expressions to each name. Same artifact, different audiences, no translation step between them.

The names also serve as the **ubiquitous language** that Eric Evans identified as central to domain-driven design. When a constraint is named `reviewer-is-authorised`, that phrase should mean the same thing in conversations, in specifications, in code, and in error messages. The implicit failure convention reinforces this: when a constraint fails, the `DecisionFailed` event carries the constraint name as the failure reason. The specification, the error message, and the test assertion all use the same words.

## Namespaces Over Expressions

If names are the specification, what is the role of the value — the part after the colon?

The instinct is to say "that's where the code goes." And it can be. But the real value is not in code. It is in the **namespaces**: `dm.cmd`, `dm.state`, `dm.ctx`, `om.state`, `om.evts`, `rm.event`, `rm.events`, `rm.ctx`, `om.commands`. These namespaces are the conceptual contribution. They provide a vocabulary for describing where behavioural data lives, which is a question every system must answer regardless of implementation language, persistence strategy, or architecture style.

Consider the difference between these two predicates:

```yaml
- reviewer-is-authorised
```

```yaml
- reviewer-is-authorised: dm.ctx
```

The first says the constraint exists. The second says *the data needed to evaluate this constraint lives outside the aggregate*. That single annotation — `dm.ctx` — tells you:

- This is a **shell dependency**. Something must look this up before the decision runs.
- The decision function is **not self-contained** for this command. It needs external context.
- There is an **integration point** here. A service, a read model, an external system.
- This constraint **cannot be tested** with just the aggregate's own state and the command.

All of that from two words. No code. No type system. No language dependency.

Now consider the full spectrum of what a predicate value can be:

```yaml
# The constraint exists
- reviewer-is-authorised

# The constraint needs external context
- reviewer-is-authorised: dm.ctx

# The constraint means this, needs external context
- reviewer-is-authorised: "The reviewer must be a national authority (dm.ctx)"

# The constraint evaluates to this expression
- reviewer-is-authorised: "dm.ctx.isNationalAuthority"
```

These four levels are not a progression from incomplete to complete. They are a progression from general to precise, and each level is a valid specification for a different audience and a different stage of the work.

A specification at Level 1 (names only) is what you write during or immediately after a discovery session. It captures the behavioural structure — what commands exist, what constrains them, what they produce — without committing to data shapes or implementation details. This is already sufficient to generate user stories, acceptance criteria, test scenario outlines, and workflow documentation.

A specification at Level 2 (scope annotations) adds architectural information. Scanning a spec for `dm.ctx` references tells you which commands have shell dependencies. Scanning for `[dm.cmd, dm.state]` tells you which constraints compare inputs against current state. Scanning for `[om.state, dm.state]` tells you which assertions verify change detection. This is the information an architect needs to understand the system's integration surface and purity boundaries — and it requires no code at all.

A specification at Level 3 (prose descriptions) serves as documentation. Each predicate reads as a sentence: "The reviewer must be a national authority." This is the level that works in contractual or regulatory contexts where behaviour must be described in natural language but still structured enough to trace and validate.

A specification at Level 4 (executable expressions) is where machines take over. The expressions can be validated against a domain model, used to generate test assertions, used to generate implementation code. This is the precision pass — the developer pass — and it adds executable power to the structural foundation laid by the earlier levels.

The key insight is that **the namespaces work at every level**. `dm.ctx` is meaningful whether the value is an empty annotation, a prose description, or a TypeScript expression. The namespace vocabulary — decision model, outcome model, reaction model — is the constant. The expression language is a variable.

This is why UbiSpec is not tied to TypeScript, despite using TypeScript expressions in its examples and tooling. The namespace structure (`dm.cmd`, `dm.state`, `dm.ctx`) is a general vocabulary for describing behavioural data flow. A team working in Kotlin would write `dm.state.status is Draft` instead of `dm.state.status.kind === 'Draft'`. A team working in F# would write `dm.state.Status = Draft`. The structure and the namespaces are the same. The expressions are native to the implementation language.

And a team that is not writing code at all — that is capturing behaviour for documentation, validation, or contractual purposes — can use Levels 1 through 3 and never write an expression. The specification is still structured, still traceable, still capable of generating stories and test scenarios. The expressions are an option, not a requirement.

## Acknowledgements

UbiSpec builds on the work of:

- **Alberto Brandolini** — [EventStorming](https://www.eventstorming.com/) and its visual grammar of commands, events, and policies
- **Jérémie Chassaing** — the [Decider pattern](https://thinkbeforecoding.com/post/2021/12/17/functional-event-sourcing-decider) (decide/evolve/initial)
- **Eric Evans** — [Domain-Driven Design](https://www.domainlanguage.com/ddd/), aggregates, bounded contexts, ubiquitous language
- **Dan North** — [Behaviour-Driven Development](https://dannorth.net/introducing-bdd/) and the Given/When/Then structure
- **Gojko Adzic** — [Specification by Example](https://gojko.net/books/specification-by-example/), executable specifications as living documentation
- **Matt Wynne and the BDD community** — [Example Mapping](https://cucumber.io/blog/bdd/example-mapping-introduction/) as a structured discovery technique

UbiSpec does not replace these practices. It gives their output a structured, durable format — one that survives the workshop, generates downstream artifacts, and evolves with the system.
