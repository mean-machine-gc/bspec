---
layout: default
title: Home
nav_order: 1
permalink: /
---

# UbiSpec

**Ubiquitous Specification Format for Software Systems' Behaviour**

UbiSpec is a structured YAML/JSON format used to encode the **intended behaviour** of software systems, *a.k.a.* their underlying **domain model**. It is ***ubiquitous*** because it is meant to support different actors involved in different stages of the entire Software Development Lyfecycle (SDLC). The format is readable by humans, deterministic machines, and LLM Agents, enabling manual, deterministic or agentic use and artifacts generation. 

In essence, UbiSpec enables allignment between all participants - humans, deterministic machines, LLM agents - at all stages of the SDLC, by providing a **consistent formalization of the undelying domain model** for any software system under design, construction, or maintenance.

{: .warning }
UbiSpec is in **early development**. Feel free to look around, experiment, and make sure to reach out for any comments and suggestions. We beleive this has potential.

[Get started](https://just-the-docs.com){: .btn  }
[Specs](https://just-the-docs.com){: .btn  }
[Guide](https://just-the-docs.com){: .btn  }
[Design principles](https://just-the-docs.com){: .btn  }
[Go to Playground](https://mean-machine-gc.github.io/bspec/playground){: .btn .btn-purple }

# Specifications

## Specification Formats

UbiSpec currently defines two formats:

| Format | File | Captures |
|--------|------|----------|
| [**Lifecycle UbiSpec**](spec/lifecycle.md) | `*.lifecycle.ubispec.yaml` | Single aggregate behaviour: commands, conditions, outcomes |
| [**Process UbiSpec**](spec/process.md) | `*.process.ubispec.yaml` | Cross-aggregate coordination: event reactions, command dispatch |


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
