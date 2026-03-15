# Autoclaw - Design Document

## Vision

A persistent artificial brain for AI agents. An SDK that transforms documents, memories, and knowledge into a navigable graph that any agent can use to deeply understand content.

**"Give your AI agent a brain for your documents"**

No vector databases. No chunk tuning. No query engineering. No external API keys.
Just understanding.

## Core Principles

1. **Agent-first**: Designed for LLM agents, humans get a nice interface for free
2. **Zero API keys**: The agent IS the LLM - the SDK never calls external APIs
3. **Single file**: All knowledge persists in one `.kg` file
4. **Ontology from content**: Schema is generated from the documents, not predefined
5. **Evidence-linked**: Every fact traces back to its source
6. **Embeddable**: A library, not a service

## Architecture

```
┌─────────────────────────────────────────────────┐
│           The Agent (Claude/GPT/Llama)           │
│     "The agent IS the LLM, no external calls"    │
├─────────────────────────────────────────────────┤
│           Interfaces                             │
│     CLI  │  Python SDK (PyO3)  │  REST (future)  │
├─────────────────────────────────────────────────┤
│           Agent Tools Layer                      │
│  Ingestion:                                      │
│  ├── analyze_content() → suggest ontology        │
│  ├── prepare_extraction() → structured prompt    │
│  ├── ingest() → validate + dedup + insert        │
│  ├── remember() → store agent memory             │
│  Navigation:                                     │
│  ├── lookup(name) → find entity                  │
│  ├── node.neighbors() → connected entities       │
│  ├── node.follow(rel, target) → traverse         │
│  ├── connect(a, b) → find paths                  │
│  ├── explore(topic) → subgraph                   │
│  ├── evidence(fact) → source documents           │
│  ├── topics() → main clusters                    │
│  ├── recent() → latest memories                  │
│  └── stats() → graph overview                    │
├─────────────────────────────────────────────────┤
│           Core Engine (Rust)                     │
│  Graph │ Ontology │ Entity Resolver │ Persist    │
│  Zero HTTP, zero cloud, zero dependencies        │
└─────────────────────────────────────────────────┘
```

## How It Works

### The Agent-SDK Collaboration

The SDK prepares structured prompts. The agent (which IS the LLM) processes them.
The SDK validates, deduplicates, and persists. No external API calls.

```
Agent: "Index these documents"
  │
  SDK: prepare text chunks
  SDK: analyze_content(chunk) → returns prompt for ontology suggestion
  │
  Agent: processes prompt → returns suggested entity/relation types
  │
  SDK: prepare_extraction(chunk, ontology) → returns extraction prompt
  │
  Agent: processes prompt → returns entities + relations as JSON
  │
  SDK: ingest(result)
    ├── validate JSON structure
    ├── check types against ontology
    ├── fuzzy dedup against existing entities
    ├── merge aliases
    ├── insert into graph
    └── persist to .kg file
```

### Navigation (No LLM needed)

Navigation is pure graph traversal. No LLM calls required.

```python
node = kg.lookup("Marco Bianchi")
node.neighbors()                        # all connected entities
node.neighbors(type="Project")          # filtered by type
node.follow("works_on", "Project Alpha") # traverse specific relation
node.evidence                           # source documents + pages

kg.path("Marco Bianchi", "Budget Q3")   # shortest path between entities
kg.topics()                             # main knowledge clusters
kg.recent()                             # latest additions
```

### Memory (Agent memories as graph nodes)

```python
# SDK prepares extraction prompt for the memory text
task = kg.prepare_memory("Project Alpha was cancelled on March 15")

# Agent extracts entities/relations from the memory
result = agent.process(task.prompt)

# SDK links to existing entities in the graph
kg.ingest_memory(result)
# → "Project Alpha" links to existing entity
# → tagged as source=memory with timestamp
```

## Data Model

### Node (Entity)

```rust
struct Node {
    id: u64,
    name: String,
    node_type: String,        // dynamic, from ontology
    properties: HashMap<String, Value>,
    aliases: Vec<String>,     // "M. Rossi", "Ing. Rossi"
    source: Source,           // Document | Memory | Inferred
    created_at: Timestamp,
    evidence: Vec<Evidence>,
}
```

### Edge (Relation)

```rust
struct Edge {
    id: u64,
    from: u64,
    to: u64,
    relation_type: String,    // dynamic, from ontology
    properties: HashMap<String, Value>,
    confidence: f32,
    source: Source,
    evidence: Vec<Evidence>,
}
```

### Evidence

```rust
struct Evidence {
    document: String,         // source filename
    page: Option<u32>,
    text_snippet: String,     // exact text excerpt
    offset: (usize, usize),  // start, end in document
}
```

### Ontology (Auto-generated)

```rust
struct Ontology {
    domain: String,           // detected from content
    node_types: Vec<NodeType>,
    edge_types: Vec<EdgeType>,
}

struct NodeType {
    name: String,             // e.g. "Party", "Clause"
    parent: Option<String>,   // optional hierarchy
    properties: Vec<PropertyDef>,
}

struct EdgeType {
    name: String,             // e.g. "binds", "references"
    from_types: Vec<String>,  // domain constraint
    to_types: Vec<String>,    // range constraint
}
```

The ontology is NOT predefined. When new content is fed:
1. SDK sends content to the agent with `analyze_content()`
2. Agent suggests entity types and relation types based on the domain
3. SDK merges with existing ontology (new types are added, existing preserved)
4. Extraction uses the merged ontology for consistency

### Graph

```rust
struct KnowledgeGraph {
    nodes: HashMap<u64, Node>,
    edges: Vec<Edge>,
    adjacency: HashMap<u64, Vec<u64>>,  // fast navigation
    ontology: Ontology,
    index_by_name: HashMap<String, Vec<u64>>,
    index_by_type: HashMap<String, Vec<u64>>,
}
```

## File Format (.kg)

V1: MessagePack binary format.

```
┌─────────────────┐
│ Magic: "AUTOKG"  │  4 bytes
│ Version: 1       │  2 bytes
├─────────────────┤
│ Ontology         │  schema, types, constraints
├─────────────────┤
│ Nodes            │  all entities
├─────────────────┤
│ Edges            │  all relations
├─────────────────┤
│ Indices          │  name + type indices
├─────────────────┤
│ Metadata         │  stats, timestamps, doc list
└─────────────────┘
```

Loaded fully into memory on open. Persisted to disk on changes.

## Entity Resolution

When new entities are extracted, the SDK resolves them against existing ones:

1. **Exact match**: normalized name matches existing entity
2. **Alias match**: name matches an alias of existing entity
3. **Fuzzy match**: SequenceMatcher ratio >= 0.85 on normalized names
4. **Type-aware**: only merge if entity types are compatible

On match: merge definitions (keep longest), union aliases, update confidence.
On no match: create new entity.

## Extraction Prompt Contract

The SDK provides structured prompts to the agent. The agent returns JSON.

### analyze_content() prompt output

Asks the agent to analyze text and suggest an ontology:

```
Given this text from a document, analyze the domain and suggest:
1. What types of entities appear (e.g. Person, Company, Concept...)
2. What types of relationships connect them (e.g. works_for, part_of...)
3. Domain classification

Current ontology (extend, don't replace):
{existing_ontology}

Text:
{text_chunk}

Return JSON:
{
  "domain": "...",
  "suggested_entity_types": [{"name": "...", "description": "..."}],
  "suggested_relation_types": [{"name": "...", "from_types": [...], "to_types": [...]}]
}
```

### prepare_extraction() prompt output

Asks the agent to extract entities and relations:

```
Extract entities and relations from this text.

Ontology (use these types):
Entity types: {entity_types}
Relation types: {relation_types}

Existing entities (reuse, don't duplicate):
{existing_entity_names_with_types}

Rules:
- Use only evidence from the provided text
- Every relation must have evidence_text (exact quote)
- Confidence: 0.9+ explicitly defined, 0.7-0.89 discussed in detail, 0.5-0.69 mentioned
- Reuse existing entity names when referring to the same concept

Text:
{text_chunk}

Return JSON:
{
  "entities": [
    {"name": "...", "type": "...", "definition": "...", "aliases": [...], "confidence": 0.85}
  ],
  "relations": [
    {"source": "...", "target": "...", "type": "...", "confidence": 0.8, "evidence_text": "..."}
  ]
}
```

## CLI

```bash
# Install
pip install autoclaw        # Python SDK + CLI
# or
cargo install autoclaw      # Rust CLI only

# Feed documents
autoclaw feed ./docs/report.pdf
autoclaw feed ./docs/         # entire directory

# Ask questions (requires agent for LLM response)
autoclaw ask "What connects Project Alpha to the Q3 budget?"

# Remember facts
autoclaw remember "Project Alpha was cancelled on March 15"

# Explore
autoclaw explore "Marco Bianchi"
autoclaw connect "Marco Bianchi" "Budget Q3"
autoclaw topics
autoclaw stats

# Export
autoclaw export --format json
autoclaw export --format dot   # Graphviz visualization
```

## Python SDK

```python
from autoclaw import KnowledgeGraph

# Create or open
kg = KnowledgeGraph("./my-brain.kg")

# --- Ingestion (agent collaboration) ---

# Step 1: Analyze content for ontology
task = kg.analyze_content(text="document text...")
# Agent processes task.prompt → returns ontology suggestion
kg.update_ontology(agent_result)

# Step 2: Extract entities and relations
task = kg.prepare_extraction(text="document text...")
# Agent processes task.prompt → returns entities + relations JSON
report = kg.ingest(agent_result)
# report: {added: 5, merged: 2, rejected: 1, errors: [...]}

# --- Memory ---
task = kg.prepare_memory("User prefers short answers")
kg.ingest_memory(agent_result)

# --- Navigation (no LLM needed) ---
node = kg.lookup("Marco Bianchi")
node.name                    # "Marco Bianchi"
node.node_type               # "Person"
node.properties              # {"role": "Project Manager"}
node.aliases                 # ["M. Rossi"]
node.evidence                # [{document, page, text_snippet}]

node.neighbors()             # all connected nodes
node.neighbors(type="Project")  # filtered
node.follow("works_on")     # follow specific relation

kg.path("A", "B")           # find path between entities
kg.topics()                  # main knowledge clusters
kg.recent()                  # latest additions
kg.stats()                   # {nodes: 142, edges: 389, documents: 10}

# --- Structured output for agents ---
result = kg.explore("Marco Bianchi")
result.entity                # {name, type, properties}
result.relations             # [{target, type, confidence}]
result.evidence              # [{source_doc, page, text_snippet}]
result.related_topics        # [navigable topics]
```

## Integration with Agent Frameworks

Works as a standard Python library. No special protocol needed.

```python
# Claude Code / Codex / OpenClaw / Antigravity
# Just import and use

from autoclaw import KnowledgeGraph

kg = KnowledgeGraph("./project.kg")

# The agent calls SDK methods directly
# The SDK returns structured prompts when LLM processing is needed
# The agent processes those prompts (it IS the LLM)
# The SDK handles everything else (validation, dedup, graph, persistence)
```

## V1 Scope

### In scope
- Rust core: in-memory graph + single file persistence (.kg)
- Ingestion: text and PDF documents
- Ontology: auto-generated from content by the agent
- Entity resolution: fuzzy dedup + alias merge
- Evidence tracking: every fact linked to source
- Memory: remember() for agent memories
- Navigation: lookup, neighbors, follow, path, explore, connect
- CLI: feed, ask, remember, explore, connect, topics, stats
- Python SDK via PyO3
- Structured output for agent consumption

### Out of scope (future)
- Custom graph database engine (V2)
- Web UI
- Cloud API
- Multi-user / permissions
- Image / OCR processing
- Embeddings / vector search
- Streaming ingestion

## Roadmap

### V1: Ship it
- Rust core with HashMap-based graph
- MessagePack persistence
- Python SDK via PyO3
- CLI
- Works with Claude Code, Codex, OpenClaw, Antigravity

### V2: Scale it
- Custom storage engine (memory-mapped files)
- B-tree indices
- Handle millions of nodes
- Incremental persistence (no full rewrite)

### V3: Own the storage
- Custom .kg file format optimized for graph traversal
- Query optimizer
- At this point: it IS a graph database

### Cloud: Monetize it
- Hosted API: send documents, get KG
- Pay per use
- Zero setup for end users
- Enterprise: self-hosted + SSO + audit + support
