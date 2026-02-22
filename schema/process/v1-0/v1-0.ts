/**
 * UbiSpec — Process Schema v1.0
 *
 * Describes cross-aggregate coordination via event-driven reactions.
 * One file per process manager. One entry per reaction.
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

// ─── Names & Patterns ───────────────────────────────────────────────────────

/** Decider name. PascalCase. */
export const DeciderName = PascalName
  .describe('Decider name. PascalCase.');

/** Event name. PascalCase. */
export const EventName = PascalName
  .describe('Event name. PascalCase.');

/**
 * Sourced event — event with its originating decider.
 *
 * Format: `EventName from DeciderName`
 * ```yaml
 * PaymentConfirmed from Payment
 * ```
 */
export const SourcedEvent = z
  .string()
  .regex(/^[A-Z][a-zA-Z0-9]* from [A-Z][a-zA-Z0-9]*$/)
  .describe('Event with source: `EventName from DeciderName`.');

/**
 * Targeted command — command with its target decider.
 *
 * Format: `CommandName -> DeciderName`
 * ```yaml
 * ReserveInventory -> Inventory
 * ```
 */
export const TargetedCommand = z
  .string()
  .regex(/^[A-Z][a-zA-Z0-9]* -> [A-Z][a-zA-Z0-9]*$/)
  .describe('Targeted command: `CommandName -> DeciderName`.');

// ─── When Spec (Triggers) ───────────────────────────────────────────────────

/**
 * Scalar trigger — single event.
 *
 * ```yaml
 * When: OrderPlaced
 * From: Order
 * ```
 * `rm.event` is the triggering event, concrete type.
 */
export const WhenScalar = EventName
  .describe('Scalar trigger: single event name.');

/**
 * Any (OR) trigger — one of several events fires the reaction.
 *
 * ```yaml
 * When:
 *   any: [AssessmentSubmittedFullyMet, AssessmentSubmittedWithGaps]
 * From: SelfAssessment
 * ```
 * `rm.event` is a discriminated union. Narrow with `.kind`.
 */
export const WhenAny = z
  .object({
    any: z.array(EventName).min(2)
      .describe('OR trigger: any one of these events fires the reaction.'),
  })
  .strict()
  .describe('Any (OR) trigger: reaction fires when any one of the listed events occurs.');

/**
 * All (AND) trigger with cross-decider sources.
 *
 * ```yaml
 * When:
 *   all:
 *     - PaymentConfirmed from Payment
 *     - InventoryReserved from Inventory
 * correlate: orderId
 * ```
 * `rm.events.PaymentConfirmed`, `rm.events.InventoryReserved` — keyed access.
 */
export const WhenAllCross = z
  .object({
    all: z.array(SourcedEvent).min(2)
      .describe('AND trigger with per-event sources: `EventName from DeciderName`.'),
  })
  .strict()
  .describe('All (AND) trigger: reaction fires when all listed cross-decider events have occurred.');

/**
 * All (AND) trigger with shared source (From field required).
 *
 * ```yaml
 * When:
 *   all: [StepOneCompleted, StepTwoCompleted]
 * From: Workflow
 * correlate: workflowId
 * ```
 */
export const WhenAllShared = z
  .object({
    all: z.array(EventName).min(2)
      .describe('AND trigger with shared source (From field required).'),
  })
  .strict()
  .describe('All (AND) trigger: reaction fires when all listed events from a shared source have occurred.');

/**
 * When specification — trigger for a reaction.
 *
 * Three forms:
 * - **Scalar**: single event — `When: OrderPlaced`
 * - **Any (OR)**: one of several — `When: { any: [...] }`
 * - **All (AND)**: wait for all — `When: { all: [...] }`
 */
export const WhenSpec = z
  .union([WhenScalar, WhenAny, WhenAllCross, WhenAllShared])
  .describe('Trigger: scalar (single event), any (OR), or all (AND).');

// ─── Then Spec (Command Dispatch) ───────────────────────────────────────────

/**
 * Conditional command — dispatched only when all conditions are met.
 *
 * Single-key object: `CommandName -> DeciderName` → list of conditions.
 * ```yaml
 * InitiateRefund -> Payment:
 *   - payment-was-captured: rm.ctx
 * ```
 */
export const ConditionalCommand = z
  .record(TargetedCommand, ConstraintList)
  .refine((obj) => Object.keys(obj).length === 1, {
    message: 'Conditional command must have exactly one key.',
  })
  .describe('Conditional command: `CommandName -> DeciderName` → list of conditions.');

/**
 * Command specification — unconditional or conditional.
 */
export const CommandSpec = z
  .union([TargetedCommand, ConditionalCommand])
  .describe('Command spec: unconditional (targeted string) or conditional (with predicate list).');

/**
 * Then specification — commands to dispatch.
 *
 * Scalar form: single unconditional command.
 * ```yaml
 * Then: ReserveInventory -> Inventory
 * ```
 *
 * List form: one or more commands. Additive — all whose conditions pass are dispatched.
 * ```yaml
 * Then:
 *   - ReserveInventory -> Inventory
 *   - InitiateRefund -> Payment:
 *       - payment-was-captured: rm.ctx
 * ```
 */
export const ThenSpec = z
  .union([
    TargetedCommand.describe('Scalar form: single unconditional command.'),
    z.array(CommandSpec).min(1).describe('List form: one or more commands. Additive — all whose conditions pass are dispatched.'),
  ])
  .describe('Commands to dispatch. Scalar (single command) or list (multiple, additive).');

// ─── Trigger Type ───────────────────────────────────────────────────────────

/**
 * Trigger type — automated or policy.
 *
 * - `automated` (default): runtime executes dispatched commands automatically.
 * - `policy`: expresses a causal expectation but is not automatically executed.
 *   A human or external process must fulfill it. `actor` is required.
 */
export const TriggerType = z
  .enum(['automated', 'policy'])
  .describe('`automated`: runtime executes commands. `policy`: causal expectation, not auto-executed. Actor required for policy.');

// ─── Reaction ───────────────────────────────────────────────────────────────

/**
 * Reaction — one event-triggered coordination step.
 *
 * ```yaml
 * - When: OrderPlaced
 *   From: Order
 *   trigger: automated
 *   Then:
 *     - ReserveInventory -> Inventory
 *     - InitiatePaymentCapture -> Payment
 *   Outcome:
 *     - reserve-before-pay
 * ```
 */
export const Reaction = z
  .object({
    When: WhenSpec
      .describe('Trigger: which event(s) fire this reaction.'),
    From: DeciderName.optional()
      .describe('Source decider. Required for scalar and any triggers. Optional for all triggers when all events share a source.'),
    correlate: z.string().optional()
      .describe('Field name that links events to the same instance. Required for all triggers.'),
    trigger: TriggerType.optional().default('automated')
      .describe('`automated` (default) or `policy`. Policy reactions require `actor`.'),
    actor: z.string().optional()
      .describe('Role or persona expected to fulfill this reaction. Required when trigger is `policy`.'),
    And: ConstraintList.optional()
      .describe('Guard constraints. All must hold for the reaction to proceed.'),
    Then: ThenSpec
      .describe('Commands to dispatch.'),
    Outcome: OutcomeSpec
      .describe('Assertions about dispatched commands.'),
  })
  .strict()
  .refine(
    (r) => r.trigger !== 'policy' || (r.actor !== undefined && r.actor.length > 0),
    { message: 'actor is required when trigger is policy.', path: ['actor'] },
  )
  .describe('Reaction: one event-triggered coordination step.');

// ─── Process (top-level) ────────────────────────────────────────────────────

/**
 * Process UbiSpec — top-level document schema.
 *
 * ```yaml
 * ubispec: process/v1.0
 * process: OrderFulfillmentManager
 * reacts_to: [Order, Payment, Inventory]
 * emits_to: [Inventory, Payment, Fulfillment]
 * model: "./model.ts"
 * reactions:
 *   - When: OrderPlaced
 *     ...
 * ```
 */
export const ProcessSpec = z
  .object({
    ubispec: z.literal('process/v1.0')
      .describe('Format identifier and version.'),
    process: PascalName
      .describe('Process manager name. PascalCase.'),
    reacts_to: z.array(DeciderName).min(1)
      .describe('Deciders whose events this process manager subscribes to.'),
    emits_to: z.array(DeciderName).min(1)
      .describe('Deciders to which this process manager dispatches commands.'),
    model: z.string()
      .describe('Relative path to the TypeScript model file.'),
    state: z.record(z.string(), z.string()).optional()
      .describe('Process manager state fields. Values are TypeScript type expressions. Only for stateful sagas.'),
    common: PredicateMap.optional()
      .describe('Reusable predicates referenced by bare name.'),
    reactions: z.array(Reaction).min(1)
      .describe('List of reactions.'),
  })
  .strict()
  .describe('Process UbiSpec: cross-aggregate coordination via event-driven reactions.');

// ─── Inferred Types ─────────────────────────────────────────────────────────

export type ProcessSpec = z.infer<typeof ProcessSpec>;
export type Reaction = z.infer<typeof Reaction>;
export type WhenSpec = z.infer<typeof WhenSpec>;
export type CommandSpec = z.infer<typeof CommandSpec>;
export type ConditionalCommand = z.infer<typeof ConditionalCommand>;
export type TriggerType = z.infer<typeof TriggerType>;