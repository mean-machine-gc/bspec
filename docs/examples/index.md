---
layout: default
title: Examples
nav_order: 6
---

# Examples

Complete UbiSpec examples across different domains, demonstrating that the format is general-purpose.

## E-commerce Order

A familiar domain: orders that move through a lifecycle from draft to delivery, with fulfillment coordination across inventory, payment, and notification systems.

**Files:**
- [`order.lifecycle.ubispec.yaml`](https://github.com/mean-machine-gc/bspec/blob/main/examples/ecommerce/order.lifecycle.ubispec.yaml) — Order aggregate lifecycle (create, add lines, place, confirm, ship, deliver, cancel, refund)
- [`order-fulfillment.process.ubispec.yaml`](https://github.com/mean-machine-gc/bspec/blob/main/examples/ecommerce/order-fulfillment.process.ubispec.yaml) — Fulfillment coordination (inventory reservation, payment capture, notifications)
- [`model.ts`](https://github.com/mean-machine-gc/bspec/blob/main/examples/ecommerce/model.ts) — TypeScript domain model

**Patterns demonstrated:**
- Single unconditional events (`OrderCreated`, `LineItemAdded`)
- Additive events: base + conditional (`OrderPlaced` + `HighValueOrderFlagged`)
- `all` trigger: cross-aggregate join (`PaymentConfirmed` + `InventoryReserved` → `ScheduleShipment`)
- Conditional commands with context queries (`InitiateRefund` only if payment captured)
- Cross-aggregate coordination with ordering constraints

## Laboratory Capability Framework

A governance domain: laboratories undergo capability assessment against a national registry, with assignments tracked through review and confirmation workflows.

**Files:**
- [`laboratory.lifecycle.ubispec.yaml`](https://github.com/mean-machine-gc/bspec/blob/main/examples/laboratory/laboratory.lifecycle.ubispec.yaml) — Laboratory aggregate lifecycle (register, activate, suspend, assign profiles, update assignments)
- [`assessment-lifecycle.process.ubispec.yaml`](https://github.com/mean-machine-gc/bspec/blob/main/examples/laboratory/assessment-lifecycle.process.ubispec.yaml) — Assessment coordination (submission → review → confirmation/adjustment)

**Patterns demonstrated:**
- `any` trigger: `[AssessmentSubmittedFullyMet, AssessmentSubmittedWithGaps]` on one reaction
- Ordered command sequences: withdraw then assign
- Conditional commands based on read-model context (`rm.ctx`)
- Discriminated union narrowing with `rm.event.kind`
