---
layout: default
title: Schema reference
parent: next (unstable)
grand_parent: Lifecycle UbiSpec
nav_order: 2
---

# Lifecycle UbiSpec next — Schema Reference

## LifecycleSpec Object

Lifecycle UbiSpec: complete behavioural contract for a single aggregate.

| Field | Type | Description |
|-------|------|-------------|
| `ubispec` | `"lifecycle/v1.1"` | **Required.** Format identifier and version. |
| `decider` | [PascalName](#pascalname) | **Required.** Aggregate name. PascalCase. |
| `identity` | `string` | **Required.** Field that uniquely identifies aggregate instances. |
| `model` | `string` | **Required.** Relative path to the TypeScript model file. |
| `common` | [PredicateMap](#predicatemap) (optional) | _Optional._ Reusable predicates referenced by bare name in And blocks. |
| `lifecycle` | List of [Decision](#decision) | **Required.** List of decisions — one per command. |

## Decision Object

Decision: one command's complete behavioural contract.

| Field | Type | Description |
|-------|------|-------------|
| `When` | [PascalName](#pascalname) | **Required.** Command name. PascalCase. One decision per command. |
| `actor` | `string` (optional) | _Optional._ Role or persona that typically initiates this command. Documentation hint, not enforced at runtime. |
| `And` | [ConstraintList](#constraintlist) (optional) | _Optional._ Constraints that must all hold for the command to succeed. If any fails, the command is rejected with a DecisionFailed event. |
| `Then` | [ThenSpec](#thenspec) | **Required.** Events produced on success. |
| `Outcome` | [OutcomeSpec](#outcomespec) | **Required.** Assertions that must hold after state change. |

## ThenSpec

Events produced on success. Scalar (single event) or list (multiple, additive).

| Option | Type | Description |
|--------|------|-------------|
| 1 | [PascalName](#pascalname) | Scalar form: single unconditional event. |
| 2 | [ConstraintList](#constraintlist) | List form: one or more events. Additive — all whose conditions pass are emitted. |

## ConditionalEvent

Conditional event: EventName → list of conditions. Emitted only when all conditions pass.

| Constraint | Value |
|------------|-------|
| **Type** | `Record<PascalName, ConstraintList>` |
| **Key Type** | [PascalName](#pascalname) |
| **Value Type** | [ConstraintList](#constraintlist) |
| **Key Format** | Event name (PascalCase) |
| **Description** | Maps event names to their conditions |

## EventName

Event name. PascalCase, must match a type in the model.

| Constraint | Value |
|------------|-------|
| **Type** | `string` |
| **Pattern** | PascalCase |
| **Description** | Must match a type in the model |

## EventSpec

Event spec: unconditional (bare name) or conditional (name with predicate list).

| Option | Type | Description |
|--------|------|-------------|
| 1 | [EventName](#eventname) | Event name. PascalCase, must match a type in the model. |
| 2 | [ConditionalEvent](#conditionalevent) | Conditional event: EventName → list of conditions. Emitted only when all conditions pass. |

## ConstraintList

List of predicates. All must hold.

| Constraint | Value |
|------------|-------|
| **Type** | `Array<PredicateEntry>` |
| **Item Type** | [PredicateEntry](#predicateentry) |
| **Description** | All predicates must hold |
| **Min Length** | 1 |

## OutcomeSpec

Outcome assertions. Flat list or keyed by event/command name.

| Option | Type | Description |
|--------|------|-------------|
| 1 | [AssertionList](#assertionlist) | Flat form: all assertions apply to every success path. |
| 2 | [AssertionEntry](#assertionentry) | Keyed form: `_always` for universal assertions, event/command names for conditional assertions. |

## PascalName

PascalCase identifier.

| Constraint | Value |
|------------|-------|
| **Type** | `string` |
| **Pattern** | PascalCase identifier |

## PredicateEntry

Predicate entry: bare name (common reference) or inline definition (name → expression).

| Option | Type | Description |
|--------|------|-------------|
| 1 | [PredicateName](#predicatename) | kebab-case identifier that reads as natural language. |
| 2 | [InlinePredicate](#inlinepredicate) | Inline predicate: name → expression. |

## PredicateMap

Map of predicate names to expressions.

| Constraint | Value |
|------------|-------|
| **Type** | `Record<PredicateName, Expression>` |
| **Key Type** | [PredicateName](#predicatename) |
| **Value Type** | [Expression](#expression) |
| **Key Format** | kebab-case predicate names |
| **Description** | Maps predicate names to expressions |

## PredicateName

kebab-case identifier that reads as natural language.

| Constraint | Value |
|------------|-------|
| **Type** | `string` |
| **Pattern** | kebab-case identifier |
| **Description** | Must read as natural language |

## AssertionEntry

Assertion: name → expression evaluated in outcome context.

| Constraint | Value |
|------------|-------|
| **Type** | `Record<PredicateName, Expression>` |
| **Key Type** | [PredicateName](#predicatename) |
| **Value Type** | [Expression](#expression) |

## AssertionList

List of assertions. All must hold after state change.

| Constraint | Value |
|------------|-------|
| **Type** | `Array<AssertionEntry>` |
| **Item Type** | [AssertionEntry](#assertionentry) |
| **Description** | All assertions must hold after state change |
| **Min Length** | 1 |

## Expression

Scope annotation, prose description, or TypeScript boolean expression over dm.*/om.*/rm.* namespaces.

| Constraint | Value |
|------------|-------|
| **Type** | `string` |
| **Min Length** | 1 |
| **Description** | Scope annotation, prose description, or TypeScript expression |

## InlinePredicate

Inline predicate: name → expression.

| Constraint | Value |
|------------|-------|
| **Type** | `Record<PredicateName, Expression>` |
| **Key Type** | [PredicateName](#predicatename) |
| **Value Type** | [Expression](#expression) |
| **Key Format** | kebab-case predicate name |
| **Constraint** | Must have exactly one key |
| **Description** | Single predicate definition |
