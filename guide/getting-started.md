---
layout: default
title: Getting Started
nav_order: 2
---

# Getting Started

## VS Code Setup

1. Install the [YAML extension](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml) by Red Hat.

2. Add to your workspace `.vscode/settings.json`:

```json
{
  "yaml.schemas": {
    "https://mean-machine-gc.github.io/ubispec/schema/lifecycle.v1.0.schema.json": "*.lifecycle.ubispec.yaml",
    "https://mean-machine-gc.github.io/ubispec/schema/process.v1.0.schema.json": "*.process.ubispec.yaml"
  }
}
```

3. Create a file ending in `.lifecycle.ubispec.yaml` or `.process.ubispec.yaml`. You get validation, autocomplete, and hover docs immediately.

Alternatively, add a schema comment at the top of any file:

```yaml
# yaml-language-server: $schema=https://mean-machine-gc.github.io/ubispec/schema/lifecycle.v1.0.schema.json
```

## Your First Lifecycle

Create `order.lifecycle.ubispec.yaml`:

```yaml
ubispec: lifecycle/v1.0
decider: Order
identity: orderId
model: "./model.ts"

lifecycle:
  - When: PlaceOrder
    actor: Customer
    And:
      - order-is-draft
      - has-lines
      - all-products-in-stock
    Then: OrderPlaced
    Outcome:
      - state-is-placed
      - placed-at-recorded

  - When: CancelOrder
    actor: Customer
    And:
      - is-cancellable
    Then: OrderCancelled
    Outcome:
      - state-is-cancelled
```

That's a valid UbiSpec. No predicates needed. Read it out loud — anyone can confirm or challenge it.

### Adding Detail Incrementally

Start with names. Add scopes when you want to see the architecture. Add expressions when you're ready to implement.

```yaml
# Level 1 — name only (domain pass)
- order-is-draft

# Level 2 — scope annotation (shows data source)
- order-is-draft: dm.state

# Level 3 — prose (documentation)
- order-is-draft: "Order must be in Draft status"

# Level 4 — expression (executable)
- order-is-draft: "dm.state.status.kind === 'Draft'"
```

Mix levels freely. Some predicates at Level 4, others still at Level 1. That's a legitimate intermediate state, not an incomplete spec.

## Your First Process

Create `order-fulfillment.process.ubispec.yaml`:

```yaml
ubispec: process/v1.0
process: OrderFulfillmentManager
reacts_to: [Order]
emits_to: [Inventory, Payment]
model: "./model.ts"

reactions:
  - When: OrderPlaced
    From: Order
    trigger: automated
    Then:
      - ReserveInventory -> Inventory
      - InitiatePaymentCapture -> Payment

  - When: OrderCancelled
    From: Order
    trigger: automated
    Then:
      - ReleaseInventory -> Inventory
      - InitiateRefund -> Payment:
          - payment-was-captured: rm.ctx
```

`trigger: automated` means the runtime executes these commands when the event arrives. Use `trigger: policy` for links that express a causal expectation but require human action:

```yaml
  - When: OrderFlagged
    From: Order
    trigger: policy
    actor: ReviewTeam
    Then: ReviewOrder -> Order
```

## Using UbiSpec with LLM Agents

Point an agent at the spec index to discover the current format:

```
https://mean-machine-gc.github.io/ubispec/spec/index.json
```

Returns:

```json
{
  "specs": {
    "lifecycle": {
      "latest": "v1.0",
      "stable": ["v1.0"],
      "unstable": [],
      "schema": "https://mean-machine-gc.github.io/ubispec/schema/lifecycle.v1.0.schema.json",
      "spec": "https://mean-machine-gc.github.io/ubispec/spec/lifecycle/v1.0"
    },
    "process": {
      "latest": "v1.0",
      "stable": ["v1.0"],
      "unstable": [],
      "schema": "https://mean-machine-gc.github.io/ubispec/schema/process.v1.0.schema.json",
      "spec": "https://mean-machine-gc.github.io/ubispec/spec/process/v1.0"
    }
  }
}
```

### Agent Workflow

A typical agent prompt for generating UbiSpec from a domain conversation:

```
1. Fetch https://mean-machine-gc.github.io/ubispec/spec/index.json
2. Fetch the latest lifecycle spec and schema
3. Given the following domain context: { ... }
4. Generate a lifecycle UbiSpec that validates against the schema
```

The schema is a standard JSON Schema. Any agent that can validate YAML against JSON Schema can produce and verify UbiSpec.

### Feeding Existing Specs to Agents

When asking an agent to work with your specs, provide:

```
Here is the UbiSpec format reference:
{ paste or link to spec page }

Here is our current domain model:
{ paste model.ts }

Here are our current specs:
{ paste *.ubispec.yaml files }

Task: add a new command ReturnOrder to the Order lifecycle.
```

The agent has the format, the types, and the existing behaviour. It can generate a spec entry that's consistent with what exists.

## Versioning

The `ubispec:` field in your YAML declares which version of the format you're using:

```yaml
ubispec: lifecycle/v1.0    # stable — guaranteed not to break
ubispec: lifecycle/v1.1    # added optional fields, backward compatible
ubispec: lifecycle/v2.0    # breaking structural changes
```

**Minor bumps** (v1.0 → v1.1) add optional fields. Your existing specs remain valid.

**Major bumps** (v1 → v2) change required fields or structure. Your specs need migration.

Match your schema URL to the version you're using. The schema validates that your YAML conforms to that version's structure.

## Playground

Try the [interactive playground](/playground) to write specs in the browser with live visualization — topology graphs, decision tables, test scenarios, and validation checklists rendered as you type.

## Next Steps

- Read the [Conceptual Foundations](conceptual-foundations.md) for why UbiSpec is shaped this way
- Browse the [Examples](/examples) for complete lifecycle and process specs
- Explore the [Lifecycle spec](/spec/lifecycle/latest) and [Process spec](/spec/process/latest) for the full format reference