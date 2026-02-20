---
layout: default
title: Getting Started
nav_order: 3
---

# Getting Started with UbiSpec

This guide walks through creating UbiSpec for a system, starting from domain discovery and ending with a structured specification that can generate user stories, test scenarios, and documentation.

## Prerequisites

UbiSpec captures behaviour. Before writing specs, you need to understand the domain. This understanding can come from:

- **Collaborative modelling sessions** (EventStorming, Context Mapping, Example Mapping)
- **Domain conversations** with experts and stakeholders
- **Exploratory prototyping** — writing UbiSpec to surface questions

The first two are recommended. The third works when you're early in discovery and want to use the spec format itself as a thinking tool.

## Two Entry Points

### Entry A: You've Done Discovery

You've run EventStorming workshops or similar sessions. You have a sense of your bounded contexts, key aggregates, commands, events, and policies. You know what the major pieces are and roughly how they interact.

**Start here:** Pick one aggregate. Write its Lifecycle UbiSpec. Move to the next. Then write Process UbiSpec for the coordination between them.

### Entry B: You're Exploring

You have a domain to model but haven't done formal discovery yet. Maybe it's a greenfield project, or you're trying to understand an existing system, or you're in a conversation with a client.

**Start here:** Pick the most important "thing" in the domain. Ask: what can happen to it? Write a rough lifecycle. The gaps and questions that surface become your discovery backlog — and you've already got a structured artifact to show for the conversation.

Either way, the format is the same. The quality depends on the discovery, not the syntax.

---

## Step 1: Identify Your Aggregate

An aggregate is a "thing" that has a lifecycle — it gets created, moves through states, and eventually reaches a terminal state. It enforces its own rules.

Ask: **What are the key nouns in this domain that have rules governing what can happen to them?**

Examples:
- An **Order** that gets created, placed, confirmed, shipped, delivered, or cancelled
- A **Registry** that gets drafted, submitted for review, approved or rejected
- A **Laboratory** that gets registered, activated, suspended, reinstated, or closed
- A **Claim** that gets filed, assessed, approved, paid, or disputed

Pick one. Start there.

## Step 2: Discover the Lifecycle States

Ask the domain expert: **What states can this thing be in?**

Draw them out. Find the transitions. Identify:
- The **initial state** (what does it look like right after creation?)
- The **terminal states** (what's the end of the road?)
- Any **loops** (can it go back to a previous state?)

```
Order: Draft → Placed → Confirmed → Shipped → Delivered
                  ↓                               ↓
               Cancelled                    RefundRequested
```

## Step 3: Discover Commands Per State

For each state, ask: **What can happen to it when it's in this state?**

Each answer is a command. For each command, ask:
- **Who** initiates it? (A user role, another system, a scheduled job?)
- **What information** do they provide?
- **What must be true** for it to succeed?
- **What changes** as a result?

Don't try to be exhaustive on the first pass. Capture the main paths. You'll discover edge cases as you write.

## Step 4: Write the Lifecycle UbiSpec (Names Only)

Start with names only. No predicates. This is the **domain pass** — meant to be validated by anyone in the room.

Create a file: `order.lifecycle.bspec.yaml`

```yaml
bspec: lifecycle/v1

decider: Order
identity: orderId
model: "./model.ts"

lifecycle:

  - When: CreateOrder
    And:
      - valid-customer
    Then: OrderCreated
    Outcome:
      - state-is-draft
      - customer-set
      - no-lines

  - When: AddLineItem
    And:
      - order-is-draft
      - product-exists
      - positive-quantity
    Then: LineItemAdded
    Outcome:
      - line-present
      - lines-grew
      - status-unchanged

  - When: PlaceOrder
    And:
      - order-is-draft
      - has-lines
      - all-products-in-stock
    Then:
      - OrderPlaced
      - HighValueOrderFlagged:
          - high-value
    Outcome:
      _always:
        - state-is-placed
        - placed-at-recorded
      HighValueOrderFlagged:
        - requires-manual-review

  - When: CancelOrder
    And:
      - is-cancellable
      - has-reason
    Then:
      - OrderCancelled
      - InventoryReleased:
          - had-reservation
    Outcome:
      _always:
        - state-is-cancelled
        - reason-recorded
```

**This is already a complete specification.** Read it out loud in a meeting. Does the domain expert agree that:
- Creating an order requires a valid customer?
- Placing an order requires at least one line and all products in stock?
- A high-value order gets flagged for manual review?
- Cancellation releases inventory only if it was reserved?

If yes, you've captured behaviour. If no, revise. The YAML structure forces precision that prose allows you to dodge.

## Step 5: Validate and Iterate

Walk through each command with stakeholders. Common discoveries at this stage:

- **Missing states**: "Oh, an order can also be On Hold if payment verification is pending."
- **Missing constraints**: "Actually, you can only cancel before it ships."
- **Missing outcomes**: "When we cancel, we also need to notify the customer."
- **Wrong assumptions**: "High value isn't just about price — it's also about the customer's risk rating."

Update the spec. Each revision is a conversation turn captured in structure. The spec becomes the shared memory of what was decided and why.

## Step 6: Discover Cross-Aggregate Coordination

Once you have two or more lifecycles, ask: **When this event happens on aggregate A, does anything need to happen on aggregate B?**

Walk through every event. Most won't trigger anything. Some will. Those are your Process UbiSpec.

Create a file: `order-fulfillment.process.bspec.yaml`

```yaml
bspec: process/v1

process: OrderFulfillmentManager
reacts_to: [Order]
emits_to: [Inventory, Payment, Notification]

reactions:

  - When: OrderPlaced
    From: Order
    Then:
      - ReserveInventory -> Inventory
      - InitiatePaymentCapture -> Payment

  - When: OrderCancelled
    From: Order
    Then:
      - ReleaseInventory -> Inventory
      - InitiateRefund -> Payment:
          - payment-was-captured
      - SendNotification -> Notification
```

This reveals the **system topology** — which aggregates talk to each other and through what events. It's the wiring diagram of your system, derived from behaviour, not drawn on a whiteboard.

## Step 7: Generate Artifacts

From the names-only UbiSpec, you can already generate:

### User Stories

Each command entry generates a story:

> **As a** customer  
> **I can** place an order  
> **Given** the order is in draft, has lines, and all products are in stock  
> **So that** the order is placed and the timestamp is recorded  
> **And if** the order is high value, it is flagged for manual review

### Acceptance Criteria

Each constraint becomes a criterion:

> - Order must be in Draft status  
> - Order must have at least one line item  
> - All products must be in stock  
> - After placement, status is Placed  
> - Placed timestamp is recorded  
> - If order total exceeds threshold, manual review flag is set

### Test Scenarios

Each constraint generates a success and failure scenario:

> ✅ Place order with valid lines, all in stock → OrderPlaced  
> ✅ Place high-value order → OrderPlaced + HighValueOrderFlagged  
> ❌ Place order with no lines → DecisionFailed [has-lines]  
> ❌ Place order with out-of-stock product → DecisionFailed [all-products-in-stock]  
> ❌ Place order that's already placed → DecisionFailed [order-is-draft]

### Workflow Documentation

The process specs generate coordination flows:

> When **OrderPlaced** occurs:  
> → Reserve inventory (Inventory)  
> → Initiate payment capture (Payment)  
>  
> When **OrderCancelled** occurs:  
> → Release inventory (Inventory)  
> → Initiate refund (Payment) *only if payment was captured*  
> → Send cancellation notification (Notification)

All of this is mechanical transformation of the YAML structure. No predicates needed.

## Step 8: Add Predicates (When Ready)

When the team moves to implementation, add executable expressions to each name:

```yaml
  - When: PlaceOrder
    And:
      - order-is-draft: "dm.state.status.kind === 'Draft'"
      - has-lines: "dm.state.lines.length > 0"
      - all-products-in-stock: "dm.ctx.allInStock"  # shell: InventoryService.checkAll(dm.state.lines)
    Then:
      - OrderPlaced
      - HighValueOrderFlagged:
          - high-value: "dm.ctx.orderTotal > 10000"  # shell: PricingService.calculateTotal(dm.state.lines)
    Outcome:
      _always:
        - state-is-placed: "om.state.status.kind === 'Placed'"
        - placed-at-recorded: "om.state.status.placedAt != null"
      HighValueOrderFlagged:
        - requires-manual-review: "om.state.requiresManualReview === true"
```

Now the spec can generate executable tests, implementation skeletons, and integration point manifests (every `dm.ctx` reference is a service dependency).

This is a different pass by different people. The structure doesn't change. The names don't change. The domain expert validated the names. The developer fills in the expressions.

---

## Tips

**Start small.** One aggregate, five or six commands. Get the pattern right before scaling.

**Names matter more than expressions.** A good name (`reviewer-is-authorised`) communicates intent even without a predicate. A bad name (`check-3`) communicates nothing even with one.

**Outcomes are assertions, not steps.** Don't describe *how* the state changes. Describe what must be true *after*. "state-is-active" not "set status to active."

**Assert what doesn't change.** If placing an order shouldn't modify the customer ID, say so: `customer-unchanged`. The negative space catches bugs that positive assertions miss.

**Let the Process UbiSpec reveal architecture.** Don't design the coordination up front. Write the lifecycles first. Then ask "what needs to react to this event?" The topology emerges.

**Revisit after implementation.** Once code exists, the spec becomes a living contract. If the code can't satisfy an outcome assertion, either the code has a bug or the spec has a wrong assumption. Either way, the conversation is productive.
