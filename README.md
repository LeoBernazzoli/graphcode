# autoclaw

**AI coding tools don't understand your codebase.**

Autoclaw is an open-source memory and code understanding layer for AI coding tools. It gives coding agents persistent project memory and structural awareness of the codebase, so they stop losing context and stop making blind changes.

Designed to sit under Claude, Codex, Cursor, and similar AI coding workflows. Local-first. Powered by a persistent knowledge graph.

[Quick Start](#quick-start) • [Why](#why-autoclaw) • [How It Works](#how-it-works) • [Current Workflow](#current-workflow) • [CLI](#cli) • [Python SDK](#python-sdk) • [Design Docs](#design-docs)

---

## Why Autoclaw

Most AI coding tools can write code. They still fail in the same ways:

- They forget decisions after long sessions
- They lose context across restarts and compaction
- They edit code without understanding dependencies or blast radius
- They force you to restate project context over and over

Autoclaw is built to make those tools more reliable on real codebases.

It does that with two internal engines:

### 1. Memory Engine

Persistent memory for project decisions, conversation history, and evolving project context.

### 2. Code Understanding Engine

Structural understanding of files, symbols, references, and change impact.

Together, they give AI coding tools what they are usually missing: continuity and grounded code understanding.

## What You Get

- Better continuity across sessions
- Less context loss
- More grounded edits
- Safer changes on growing codebases
- Less repeated prompting and restating of project context

## Quick Start

Autoclaw is still alpha. The most complete workflow today is the local CLI plus the Claude-oriented assets in [`autoclaw-plugin/`](./autoclaw-plugin), but the product direction is broader: a memory and code understanding layer for AI coding tools in general.

### 1. Install the CLI

From a local checkout:

```bash
cargo install --path . --no-default-features
```

If you want to run it without installing:

```bash
cargo run --no-default-features -- --help
```

### 2. Add a `graphocode.toml`

Use the repo's default config or start with this:

```toml
[sources]
code = ["**/*.rs", "**/*.py", "**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx", "**/*.go", "**/*.java", "**/*.cs"]
conversations = true
documents = []

[bootstrap]
on_first_session = true
snapshot_every = 20

[extraction]
threshold = 85
budget = 2000
model = "haiku"

[impact]
enabled = true
depth = 2
```

### 3. Bootstrap the project

```bash
autoclaw init
```

This currently:

- bootstraps code and project sources into a local `.kg`
- builds a fast index for hook-time lookups
- generates `.claude/rules/` from the graph

`autoclaw init` is currently the high-level convenience path around bootstrap plus rule generation.

### 4. Query the graph

```bash
autoclaw stats
autoclaw explore lookup
autoclaw impact lookup --depth 2
autoclaw relevant "where is authentication state handled?" --budget 800
autoclaw file-context src/main.rs --budget 800
```

## How It Works

Autoclaw is one product with two engines inside it.

### Memory Engine

The memory side stores structured project context over time:

- decisions
- useful conversation history
- technical facts
- error resolutions
- project-specific context that should survive session boundaries

The goal is not "store everything forever." The goal is to keep the right context alive so the next agent run starts from project reality instead of starting cold.

### Code Understanding Engine

The code understanding side builds a graph of the codebase:

- files
- functions, methods, structs, classes, fields
- references and cross-file dependencies
- impact surface for a proposed change

This is what turns blind edits into informed edits.

### Under The Hood

Both engines feed the same local knowledge graph:

- persisted to a single `.kg` file
- stored locally, no hosted service required
- no database or server required
- the core does not call external APIs on its own
- queryable through CLI and Python bindings
- designed to support hook-driven AI coding workflows

## Current Workflow

Today, the strongest workflow in this repo is:

1. Index a project with `autoclaw init` or `autoclaw bootstrap`
2. Generate path-specific rules with `autoclaw sync-rules`
3. Use impact analysis before changes with `autoclaw impact` or `autoclaw impact-from-diff`
4. Reindex touched files with `autoclaw reindex`
5. Pull targeted context with `autoclaw relevant` and `autoclaw file-context`

The repo also includes Claude-oriented hook and skill assets under [`autoclaw-plugin/`](./autoclaw-plugin).

## CLI

### Core graph commands

```bash
autoclaw stats
autoclaw topics
autoclaw explore <entity>
autoclaw connect <a> <b>
autoclaw recent
autoclaw export
```

### Coding workflow commands

```bash
autoclaw init
autoclaw bootstrap [--config graphocode.toml]
autoclaw sync-rules
autoclaw context [budget]
autoclaw impact <entity> [--depth 2]
autoclaw impact-from-diff
autoclaw reindex <file_path>
autoclaw relevant <query> [--budget N]
autoclaw file-context <path> [--budget N]
autoclaw monitor <transcript> [--threshold N] [--window N]
autoclaw tick <transcript> [--snapshot-every N] [--threshold N] [--window N]
```

Set `AUTOCLAW_KG` to control where the graph is stored:

```bash
export AUTOCLAW_KG=./knowledge.kg
```

## Python SDK

The repo still exposes the underlying knowledge graph engine as a Python SDK. That part of the project is useful on its own, but it is no longer the best top-level way to think about Autoclaw.

Under the hood, the SDK prepares structured prompts, accepts agent-produced JSON, validates it, deduplicates entities, and persists the graph locally.

```python
from autoclaw import PyKnowledgeGraph as KnowledgeGraph

kg = KnowledgeGraph("./brain.kg")

# Agent suggests ontology and extraction output
prompt = kg.analyze_content("your document text here...")
kg.update_ontology(agent_response)

prompt = kg.prepare_extraction("your document text here...")
report = kg.ingest(agent_response)

# Query the graph
node = kg.lookup("Marco Bianchi")
neighbors = kg.neighbors("Marco Bianchi")
path = kg.connect("Marco Bianchi", "Budget Q3")

kg.save()
```

## What Makes This Different

Autoclaw is not trying to be another coding agent.

It is trying to become the missing layer under coding agents:

- memory that survives beyond one fragile session
- code understanding that is grounded in real project structure
- impact awareness before edits
- local project context without constant prompt rebuilding

## Status

Alpha, active development.

The project is in transition from a generic document-memory SDK toward a broader memory + code understanding product for AI coding tools. Today the repo includes:

- a Rust knowledge graph core
- local `.kg` persistence
- a CLI for indexing, graph queries, impact analysis, and context lookup
- a Python SDK for the underlying graph engine
- Claude-oriented plugin assets and design work for deeper coding-tool integration

## Design Docs

- [Graphocode v2 design](./docs/superpowers/specs/2026-03-18-graphocode-v2-design.md)
- [Claude Code plugin design](./docs/superpowers/specs/2026-03-16-autoclaw-claude-code-plugin-design.md)
- [Original design document](./DESIGN.md)

## License

Apache 2.0
