/**
 * UbiSpec — Shared Schema Primitives
 *
 * Common Zod schemas used by both lifecycle and process specs.
 * This is the source of truth — JSON Schema and docs are derived from these definitions.
 */
import { z } from 'zod';

// ─── Patterns ───────────────────────────────────────────────────────────────

export const PASCAL_CASE = /^[A-Z][a-zA-Z0-9]*$/;
export const KEBAB_CASE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

// ─── Atomic Types ───────────────────────────────────────────────────────────

/** PascalCase name for aggregates, commands, events, process managers. */
export const PascalName = z
  .string()
  .regex(PASCAL_CASE)
  .describe('PascalCase identifier.');

/** kebab-case name for predicates and constraints. */
export const PredicateName = z
  .string()
  .regex(KEBAB_CASE)
  .describe('kebab-case identifier that reads as natural language.');

/**
 * Scope annotation, prose description, or TypeScript boolean expression.
 *
 * Four valid forms:
 * - Scope: `dm.state`, `dm.ctx`, `[om.state, dm.cmd]`
 * - Prose: `"Order must be in Draft status"`
 * - Expression: `"dm.state.status.kind === 'Draft'"`
 * - Empty string is not valid.
 */
export const Expression = z
  .string()
  .min(1)
  .describe('Scope annotation, prose description, or TypeScript boolean expression over dm.*/om.*/rm.* namespaces.');

// ─── Predicates ─────────────────────────────────────────────────────────────

/** Map of predicate names to expressions. Used in `common` section. */
export const PredicateMap = z
  .record(PredicateName, Expression)
  .describe('Map of predicate names to expressions.');

/**
 * Inline predicate: a single-key object mapping name → expression.
 *
 * Example: `{ "order-is-draft": "dm.state.status.kind === 'Draft'" }`
 */
export const InlinePredicate = z
  .record(PredicateName, Expression)
  .refine((obj) => Object.keys(obj).length === 1, {
    message: 'Inline predicate must have exactly one key.',
  })
  .describe('Inline predicate: name → expression.');

/**
 * A predicate entry — either a bare name (common reference) or an inline definition.
 *
 * - Bare name: `"order-is-draft"` — resolved from the `common` section.
 * - Inline: `{ "order-is-draft": "dm.state.status.kind === 'Draft'" }` — defined in place.
 *
 * Four detail levels are valid for the expression value:
 * Level 1 (name only): `"order-is-draft"`
 * Level 2 (scope): `{ "order-is-draft": "dm.state" }`
 * Level 3 (prose): `{ "order-is-draft": "Order must be in Draft status" }`
 * Level 4 (expression): `{ "order-is-draft": "dm.state.status.kind === 'Draft'" }`
 */
export const PredicateEntry = z
  .union([PredicateName, InlinePredicate])
  .describe('Predicate entry: bare name (common reference) or inline definition (name → expression).');

/** List of predicates. All must hold. */
export const ConstraintList = z
  .array(PredicateEntry)
  .min(1)
  .describe('List of predicates. All must hold.');

// ─── Assertions ─────────────────────────────────────────────────────────────

/** Single assertion: a one-key object mapping name → expression. */
export const AssertionEntry = z
  .record(PredicateName, Expression)
  .refine((obj) => Object.keys(obj).length === 1, {
    message: 'Assertion entry must have exactly one key.',
  })
  .describe('Assertion: name → expression evaluated in outcome context.');

/** List of assertions. All must hold after state change. */
export const AssertionList = z
  .array(AssertionEntry)
  .min(1)
  .describe('List of assertions. All must hold after state change.');

/**
 * Outcome specification — assertions that must hold after evolve.
 *
 * Flat form: list of assertions that apply to every success path.
 * ```yaml
 * Outcome:
 *   - state-is-placed: "om.state.status.kind === 'Placed'"
 * ```
 *
 * Keyed form: `_always` for universal assertions, plus event/command-keyed blocks.
 * ```yaml
 * Outcome:
 *   _always:
 *     - state-is-placed: "om.state.status.kind === 'Placed'"
 *   HighValueOrderFlagged:
 *     - requires-manual-review: om.state
 * ```
 */
export const OutcomeSpec = z
  .union([
    AssertionList.describe('Flat form: all assertions apply to every success path.'),
    z
      .record(z.string(), AssertionList)
      .describe('Keyed form: `_always` for universal assertions, event/command names for conditional assertions.'),
  ])
  .describe('Outcome assertions. Flat list or keyed by event/command name.');