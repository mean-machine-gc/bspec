/**
 * UbiSpec — Lifecycle Schema v1.1
 *
 * Describes the complete behavioural contract of a single aggregate (decider).
 * One file per aggregate. One entry per command.
 *
 * Source of truth — JSON Schema, documentation tables, and TypeScript types
 * are all derived from these Zod definitions.
 */
import { z } from 'zod';
import {
  PascalName,
  Expression,
  PredicateMap,
  ConstraintList,
  OutcomeSpec,
} from '../../shared';

// ─── Events ─────────────────────────────────────────────────────────────────

/** Event name. PascalCase, must match a type in the model. */
export const EventName = PascalName
  .describe('Event name. PascalCase, must match a type in the model.');

/**
 * Conditional event — emitted only when all conditions are met.
 *
 * Single-key object: EventName → list of conditions.
 * ```yaml
 * HighValueOrderFlagged:
 *   - high-value: dm.ctx
 * ```
 */
export const ConditionalEvent = z
  .record(PascalName, ConstraintList)
  .refine((obj) => Object.keys(obj).length === 1, {
    message: 'Conditional event must have exactly one key (the event name).',
  })
  .describe('Conditional event: EventName → list of conditions. Emitted only when all conditions pass.');

/**
 * Event specification — unconditional (bare name) or conditional (name with predicates).
 *
 * ```yaml
 * - OrderPlaced                    # unconditional
 * - HighValueOrderFlagged:         # conditional
 *     - high-value: dm.ctx
 * ```
 */
export const EventSpec = z
  .union([EventName, ConditionalEvent])
  .describe('Event spec: unconditional (bare name) or conditional (name with predicate list).');

/**
 * Then specification — events produced on command success.
 *
 * Scalar form: single unconditional event.
 * ```yaml
 * Then: OrderPlaced
 * ```
 *
 * List form: one or more events, each unconditional or conditional.
 * Additive semantics — ALL events whose conditions pass are emitted.
 * ```yaml
 * Then:
 *   - OrderPlaced
 *   - HighValueOrderFlagged:
 *       - high-value: dm.ctx
 * ```
 */
export const ThenSpec = z
  .union([
    EventName.describe('Scalar form: single unconditional event.'),
    z.array(EventSpec).min(1).describe('List form: one or more events. Additive — all whose conditions pass are emitted.'),
  ])
  .describe('Events produced on success. Scalar (single event) or list (multiple, additive).');

// ─── Decision ───────────────────────────────────────────────────────────────

/**
 * Decision — one command's complete behavioural contract.
 *
 * ```yaml
 * - When: PlaceOrder
 *   actor: Customer
 *   And:
 *     - order-is-draft
 *     - has-lines
 *   Then: OrderPlaced
 *   Outcome:
 *     - state-is-placed
 * ```
 */
export const Decision = z
  .object({
    When: PascalName
      .describe('Command name. PascalCase. One decision per command.'),
    actor: z.string().optional()
      .describe('Role or persona that typically initiates this command. Documentation hint, not enforced at runtime.'),
    And: ConstraintList.optional()
      .describe('Constraints that must all hold for the command to succeed. If any fails, the command is rejected with a DecisionFailed event.'),
    Then: ThenSpec
      .describe('Events produced on success.'),
    Outcome: OutcomeSpec
      .describe('Assertions that must hold after state change.'),
  })
  .strict()
  .describe('Decision: one command\'s complete behavioural contract.');

// ─── Lifecycle (top-level) ──────────────────────────────────────────────────

/**
 * Lifecycle UbiSpec — top-level document schema.
 *
 * ```yaml
 * ubispec: lifecycle/v1.0
 * decider: Order
 * identity: orderId
 * model: "./model.ts"
 * common:
 *   order-is-draft: "dm.state.status.kind === 'Draft'"
 * lifecycle:
 *   - When: PlaceOrder
 *     ...
 * ```
 */
export const LifecycleSpec = z
  .object({
    ubispec: z.literal('lifecycle/v1.0')
      .describe('Format identifier and version.'),
    decider: PascalName
      .describe('Aggregate name. PascalCase.'),
    identity: z.string()
      .describe('Field that uniquely identifies aggregate instances.'),
    model: z.string()
      .describe('Relative path to the TypeScript model file.'),
    common: PredicateMap.optional()
      .describe('Reusable predicates referenced by bare name in And blocks.'),
    lifecycle: z.array(Decision).min(1)
      .describe('List of decisions — one per command.'),
  })
  .strict()
  .describe('Lifecycle UbiSpec: complete behavioural contract for a single aggregate.');

// ─── Inferred Types ─────────────────────────────────────────────────────────

export type LifecycleSpec = z.infer<typeof LifecycleSpec>;
export type Decision = z.infer<typeof Decision>;
export type EventSpec = z.infer<typeof EventSpec>;
export type ConditionalEvent = z.infer<typeof ConditionalEvent>;