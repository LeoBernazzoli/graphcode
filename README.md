<p align="center">
  <h1 align="center">autoclaw</h1>
  <p align="center"><strong>Document memory for AI agents.</strong></p>
  <p align="center">Feed your documents. Your agent understands everything. No queries needed.</p>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> &bull;
  <a href="#how-it-works">How It Works</a> &bull;
  <a href="#python-sdk">Python SDK</a> &bull;
  <a href="#cli">CLI</a> &bull;
  <a href="DESIGN.md">Design Doc</a>
</p>

---

**autoclaw** turns documents into a knowledge graph that AI agents can navigate like memory. Not chunks. Not embeddings. A structured brain with entities, relationships, and evidence — all traced back to the source.

- **No API keys needed** — your agent IS the LLM. autoclaw never calls external APIs.
- **Single file** — everything persists in one `.kg` file. No databases. No servers.
- **Built in Rust** — fast, embeddable, zero dependencies.
- **Agent-first** — designed for Claude Code, Codex, OpenClaw, Antigravity, or any agent.

## The Problem

RAG gives your AI chunks of text. It can't connect ideas across documents. It can't tell you *how* two concepts relate. It doesn't understand — it searches.

**autoclaw** builds a real knowledge graph with typed entities, validated relationships, and source evidence. Your agent doesn't search — it *navigates knowledge*.

## Quick Start

```bash
pip install autoclaw
```

```python
from autoclaw import PyKnowledgeGraph as KnowledgeGraph

kg = KnowledgeGraph("./my-brain.kg")

# 1. Agent analyzes content → suggests ontology
prompt = kg.analyze_content("your document text here...")
# Agent processes the prompt, returns JSON
kg.update_ontology(agent_response)

# 2. Agent extracts entities and relations
prompt = kg.prepare_extraction("your document text here...")
# Agent processes the prompt, returns JSON
report = kg.ingest(agent_response)
# → {added: 12, merged: 3, rejected: 0, edges_added: 18, errors: []}

# 3. Navigate — no LLM needed
node = kg.lookup("Marco Bianchi")
neighbors = kg.neighbors("Marco Bianchi")
path = kg.connect("Marco Bianchi", "Budget Q3")
# → Marco Bianchi --[manages]--> Project Alpha --[has_budget]--> Budget Q3

# 4. Save
kg.save()
```

## How It Works

```
┌──────────────────────────────────────────────────┐
│           Your Agent (Claude/GPT/Llama)           │
│         The agent IS the LLM. No API keys.        │
├──────────────────────────────────────────────────┤
│           autoclaw SDK                            │
│  analyze_content() → ontology prompt              │
│  prepare_extraction() → extraction prompt         │
│  ingest() → validate, dedup, insert               │
│  lookup/neighbors/follow/path → pure traversal    │
│  remember() → agent memories as graph nodes       │
├──────────────────────────────────────────────────┤
│           Rust Core Engine                        │
│  In-memory graph │ Entity resolver │ .kg file     │
└──────────────────────────────────────────────────┘
```

The SDK prepares structured prompts. Your agent (which already IS an LLM) processes them and returns JSON. The SDK validates, deduplicates entities, and builds the graph. Navigation is pure graph traversal — no LLM calls needed.

## Python SDK

### Ingestion

```python
# Analyze content — agent suggests entity/relation types for the domain
prompt = kg.analyze_content(text)
kg.update_ontology(agent_response_json)

# Extract — agent finds entities and relations
prompt = kg.prepare_extraction(text)
report = kg.ingest(agent_response_json)

# With document source tracking
report = kg.ingest_document(agent_response_json, "report.pdf", page=3)

# Agent memories
prompt = kg.prepare_memory("Project Alpha was cancelled on March 15")
kg.ingest_memory(agent_response_json)
```

### Navigation

```python
# Lookup by name or alias
kg.lookup("Marco Bianchi")      # exact/alias match
kg.lookup("M. Bianchi")         # alias works too

# Explore connections
kg.neighbors("Marco Bianchi")              # all connections
kg.neighbors_by_type("Marco Bianchi", "Project")  # filtered
kg.follow("Marco Bianchi", "manages")      # specific relation

# Find paths
kg.path("Marco Bianchi", "Budget Q3")      # JSON with full path
kg.connect("Marco Bianchi", "Budget Q3")   # readable string

# Explore (entity + all connections + evidence)
kg.explore("Project Alpha")

# Overview
kg.stats()     # {node_count, edge_count, document_count, ...}
kg.topics()    # entities grouped by type
kg.recent()    # latest additions
```

### Persistence

```python
kg = KnowledgeGraph("./brain.kg")  # loads existing or creates new
kg.save()                          # persist to disk
kg.export_json()                   # full graph as JSON
```

## CLI

```bash
autoclaw stats                    # graph overview
autoclaw topics                   # main knowledge clusters
autoclaw explore "Marco Bianchi"  # entity + connections
autoclaw connect "A" "B"          # find path between entities
autoclaw recent                   # latest entities
autoclaw export                   # full JSON export
```

## What Makes This Different

| | RAG | GraphRAG | autoclaw |
|---|---|---|---|
| **Understanding** | Chunks | Naive triples | Typed ontology with validation |
| **Cross-document** | No | Limited | Full entity resolution across docs |
| **Evidence** | Lost | Partial | Every fact traced to source |
| **Entity resolution** | None | None | Fuzzy matching + alias merge |
| **Speed** | Python | Python | Rust core |
| **Setup** | Vector DB + embeddings | LLM API + config | `pip install` + one file |
| **API keys** | Required | Required | None (your agent is the LLM) |

## Use Cases

- **Personal AI agent** — give your assistant memory across all your documents
- **Enterprise knowledge** — onboarding, institutional knowledge, decision history
- **Research** — connect papers, findings, citations across publications
- **Code understanding** — map codebases, architectural decisions, past bugs
- **Legal** — connect contracts, clauses, precedents
- **Medical** — patient history, drug interactions, guidelines

All with the same SDK. Different documents, same brain.

## Roadmap

- [x] Rust core engine (in-memory graph, single file persistence)
- [x] Entity resolution (fuzzy matching, alias merge)
- [x] Python SDK via PyO3
- [x] CLI
- [ ] PDF text extraction (built-in)
- [ ] Chunking strategies
- [ ] Graph visualization (DOT/Graphviz export)
- [ ] Benchmark suite vs RAG/GraphRAG
- [ ] Custom graph storage engine (V2)
- [ ] Cloud API (V3)

## License

Apache 2.0
