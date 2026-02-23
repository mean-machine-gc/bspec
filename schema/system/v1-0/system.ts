/**
 * UbiSpec — System Schema v1.0
 *
 * Describes the system-level map: modules, their contexts, and cross-module flows.
 * One file per system. The top-level view from which lifecycle and process specs
 * are scoped.
 *
 * Source of truth — JSON Schema, documentation tables, and TypeScript types
 * are all derived from these Zod definitions.
 */
import { z } from 'zod';
import { PascalName } from '../../shared';

// ─── Flow ───────────────────────────────────────────────────────────────────

/**
 * Trigger type for cross-module flows.
 *
 * - `automated`: infrastructure wiring handles delivery (event bus, subscription).
 * - `policy`: a human or external process decides when to act.
 */
export const FlowTrigger = z
  .enum(['automated', 'policy'])
  .describe('`automated`: infrastructure handles delivery. `policy`: human or external process must act.');

/**
 * A cross-module flow — one directed connection between modules.
 *
 * Same pattern as a process reaction but stripped to just the wiring:
 * event from module → command on module. No constraints, no outcomes.
 *
 * ```yaml
 * - event: RegistryApproved
 *   from: RegistryManagement
 *   triggers: ActivateLaboratory
 *   on: LaboratoryManagement
 *   trigger: automated
 * ```
 */
export const Flow = z
  .object({
    event: PascalName
      .describe('Event name that crosses the module boundary. PascalCase.'),
    from: PascalName
      .describe('Source module that publishes the event.'),
    triggers: PascalName
      .describe('Command name invoked on the target module. PascalCase.'),
    on: PascalName
      .describe('Target module that receives the command.'),
    trigger: FlowTrigger.optional().default('automated')
      .describe('`automated` (default) or `policy`. Policy flows require `actor`.'),
    actor: z.string().optional()
      .describe('Role or persona expected to fulfill a policy flow. Required when trigger is `policy`.'),
  })
  .strict()
  .refine(
    (f) => f.trigger !== 'policy' || (f.actor !== undefined && f.actor.length > 0),
    { message: 'actor is required when trigger is policy.', path: ['actor'] },
  )
  .describe('Cross-module flow: event from one module triggers a command on another.');

// ─── Module ─────────────────────────────────────────────────────────────────

/**
 * A module — a group of closely related deciders that share a consistency boundary.
 *
 * Deciders within a module coordinate via a process spec using internal events.
 * Cross-module coordination is declared in the `flows` section of the system spec.
 *
 * ```yaml
 * - name: RegistryManagement
 *   context: AccreditationGovernance
 *   deciders: [Registry, Profile, Comment]
 * ```
 */
export const Module = z
  .object({
    name: PascalName
      .describe('Module name. PascalCase. Referenced by process specs and flows.'),
    context: PascalName
      .describe('Bounded context this module belongs to. PascalCase. Grouping label for related modules.'),
    deciders: z.array(PascalName).min(1)
      .describe('Deciders in this module. Each must have a corresponding lifecycle spec.'),
    description: z.string().optional()
      .describe('Brief description of the module\'s responsibility.'),
  })
  .strict()
  .describe('Module: a group of closely related deciders sharing a consistency boundary.');

// ─── System (top-level) ─────────────────────────────────────────────────────

/**
 * System UbiSpec — top-level document schema.
 *
 * Maps the full system: contexts, modules, deciders, and cross-module flows.
 * The highest-level UbiSpec artifact. One per system.
 *
 * ```yaml
 * ubispec: system/v1.0
 * system: SILNAS
 * modules:
 *   - name: RegistryManagement
 *     context: AccreditationGovernance
 *     deciders: [Registry, Profile, Comment]
 * flows:
 *   - event: RegistryApproved
 *     from: RegistryManagement
 *     triggers: ActivateLaboratory
 *     on: LaboratoryManagement
 * ```
 */
export const SystemSpec = z
  .object({
    ubispec: z.literal('system/v1.0')
      .describe('Format identifier and version.'),
    system: PascalName
      .describe('System name. PascalCase.'),
    description: z.string().optional()
      .describe('Brief description of the system.'),
    modules: z.array(Module).min(1)
      .describe('Modules in this system. Each groups related deciders under a bounded context.'),
    flows: z.array(Flow).optional().default([])
      .describe('Cross-module flows. Each connects an event from one module to a command on another.'),
  })
  .strict()
  .refine(
    (s) => {
      const moduleNames = new Set(s.modules.map((m) => m.name));
      return s.flows.every((f) => moduleNames.has(f.from) && moduleNames.has(f.on));
    },
    { message: 'Every flow must reference modules declared in the modules list.', path: ['flows'] },
  )
  .refine(
    (s) => {
      const moduleNames = s.modules.map((m) => m.name);
      return new Set(moduleNames).size === moduleNames.length;
    },
    { message: 'Module names must be unique.', path: ['modules'] },
  )
  .refine(
    (s) => s.flows.every((f) => f.from !== f.on),
    { message: 'Flows must connect different modules. Use a process spec for within-module coordination.', path: ['flows'] },
  )
  .describe('System UbiSpec: top-level map of modules, contexts, and cross-module flows.');

// ─── Inferred Types ─────────────────────────────────────────────────────────

export type SystemSpec = z.infer<typeof SystemSpec>;
export type Module = z.infer<typeof Module>;
export type Flow = z.infer<typeof Flow>;
export type FlowTrigger = z.infer<typeof FlowTrigger>;