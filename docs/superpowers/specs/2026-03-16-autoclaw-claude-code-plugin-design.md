# Autoclaw Claude Code Plugin — Design Spec

## Overview

Replace Claude Code's built-in lossy conversation compression with a knowledge graph (KG) that captures structured facts during the conversation. Combine deterministic code analysis (tree-sitter/LSP) with LLM-based semantic extraction (Haiku) to build a comprehensive, cumulative project memory. Add impact analysis before every code modification to eliminate blind spots.

## Problems Solved

### 1. Lossy compression
When Claude Code's context window fills up (~95%), Haiku produces a ~2K narrative summary. What's lost: why decisions were made, alternatives tried, implicit relationships, error root causes, chronological evolution of understanding.

### 2. No structural awareness
When Claude modifies a variable, function, or type, it doesn't know all the places that depend on it. This causes cascading breakage, missed updates, and hallucinated "fixes" that create new bugs.

### 3. Cold start every session
Each new conversation starts from zero. Claude must re-explore the codebase to understand structure, conventions, and project history.

## Architecture

### Core Principles

1. **Disable Claude Code's auto-compact** — we control the entire context lifecycle
2. **Dual ingestion** — deterministic (tree-sitter) for code structure, LLM (Haiku) for semantic knowledge
3. **Impact analysis before every edit** — query the code graph before modifying anything
4. **Bootstrap on first run** — full project indexing via `/graphocode:start`
5. **Zero-recall design** — Claude never needs to "remember" to use the KG; context is injected automatically at every step
6. **Continuous updating** — the KG stays current throughout the conversation, not just at compaction time

### System Overview

```
┌────────────────────────────────────────────────────────────┐
│                    AUTOCLAW PLUGIN                          │
│                                                             │
│  /graphocode:start                                         │
│  ┌────────────────────────────────────────────────────┐    │
│  │  BOOTSTRAP (first run or on-demand)                 │    │
│  │                                                      │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │    │
│  │  │  CODE    │  │  CHAT    │  │  DOCUMENTS       │  │    │
│  │  │          │  │          │  │  (user opt-in)   │  │    │
│  │  │ tree-    │  │ claude_  │  │                   │  │    │
│  │  │ sitter   │  │ parser   │  │  PDF, MD, docs/  │  │    │
│  │  │ src/**   │  │ ~/.claude│  │  wiki, specs     │  │    │
│  │  │          │  │          │  │                   │  │    │
│  │  │ 0 tokens │  │ 0 tokens │  │  Haiku extracts  │  │    │
│  │  │ instant  │  │ instant  │  │  semantics       │  │    │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────────────┘  │    │
│  │       └──────────────┼─────────────┘                │    │
│  │                      ▼                               │    │
│  │              autoclaw reconcile                      │    │
│  │              → KG complete                           │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  SessionStart                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  RE-INJECTION                                       │    │
│  │  autoclaw context --budget 2000                     │    │
│  │  → top-K facts by relevance into context            │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  PreToolUse (Edit|Write)                                   │
│  ┌────────────────────────────────────────────────────┐    │
│  │  IMPACT ANALYSIS                                    │    │
│  │  autoclaw impact <entities_being_modified>          │    │
│  │  → all references + breaking change warnings        │    │
│  │  → injected into context BEFORE the edit            │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  PostToolUse (monitor)                                     │
│  ┌────────────────────────────────────────────────────┐    │
│  │  CONTEXT MONITOR                                    │    │
│  │  If context >= 85%:                                 │    │
│  │    1. Haiku extracts semantics from transcript      │    │
│  │    2. Tree-sitter re-scans modified files           │    │
│  │    3. autoclaw reconcile (merge + invalidate + GC)  │    │
│  │    4. Trigger minimal /compact                      │    │
│  │    5. Re-inject from KG                             │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  PostToolUse (Edit|Write) — incremental                    │
│  ┌────────────────────────────────────────────────────┐    │
│  │  INCREMENTAL CODE INDEX UPDATE                      │    │
│  │  Tree-sitter re-parses only the modified file       │    │
│  │  → updates code entities/relations in KG            │    │
│  │  → instant, deterministic, 0 tokens                 │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  Skills                                                    │
│  ┌────────────────────────────────────────────────────┐    │
│  │  /graphocode:start  — full project bootstrap        │    │
│  │  /graphocode:query  — "what do you know about X?"   │    │
│  │  /graphocode:impact — "what breaks if I change X?"  │    │
│  │  /graphocode:decide — "record this decision"        │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

## Bootstrap: `/graphocode:start`

Full project indexing. Run once when someone has already been working on a project, or periodically to refresh.

### Three ingestion channels

| Channel | Input | Parser | LLM Cost | When |
|---------|-------|--------|----------|------|
| **Code** | `src/**/*.rs`, `*.py`, etc | Tree-sitter (AST) | Zero | Bootstrap + PostToolUse on Edit/Write |
| **Conversations** | `~/.claude/projects/*/*.jsonl` | `claude_parser.rs` + Haiku for semantics | Haiku for decisions/errors only | Bootstrap + PostCompact |
| **Documents** | PDF, MD, docs/, wiki, specs | Chunker + Haiku | Haiku for extraction | Bootstrap (user opt-in only) |

### Code indexing (deterministic, tree-sitter)

Extracts from source files without any LLM:

```
For each source file:
  tree-sitter parse → AST
  Extract:
    - Functions: name, signature, parameters, return type, line range
    - Structs/Classes: name, fields, methods, traits/interfaces
    - Imports/Use: what module imports what
    - Impl blocks: which struct implements which trait
    - Constants/Statics: name, type, value
    - Modules: hierarchy, visibility

  Relations (from AST analysis):
    - file → defines → function/struct
    - function → calls → function (via call expressions in AST)
    - struct → has_field → type
    - file → imports → module
    - struct → implements → trait
    - function → takes_param → type
    - function → returns → type
```

All entities get `tier: Minor` and `source: CodeAnalysis`. They don't decay — they're refreshed on every file change.

### Conversation indexing

```
For each session JSONL:
  1. claude_parser.rs parses messages (deterministic, 0 tokens)
  2. Filter: skip automated sessions (< 3 messages)
  3. Haiku extracts semantic knowledge:
     - Decisions + reasons + alternatives
     - Errors + root causes + resolutions
     - Implicit relations discovered during work
  4. autoclaw reconcile merges into KG
```

### Document indexing (user opt-in)

```
For each document in configured paths:
  1. Chunker splits text (sentence-aware, overlap)
  2. Haiku extracts:
     - Requirements, constraints, business rules
     - Architecture decisions
     - Domain entities and relationships
  3. autoclaw reconcile merges with evidence linking to source doc + page
```

### Configuration

In project root `graphocode.toml`:

```toml
[sources]
code = ["src/**/*.rs", "src/**/*.py"]
conversations = true
documents = ["docs/requirements.md", "docs/architecture.md"]

[bootstrap]
on_first_session = true

[extraction]
threshold = 85
budget = 2000
model = "haiku"

[impact]
enabled = true
```

## Impact Analysis

### The problem today

```
User: "rename confidence to certainty in model.rs"

Claude today:
  1. Opens model.rs, renames confidence → certainty
  2. Maybe remembers graph.rs uses it... updates that
  3. Forgets python.rs exposes it as "confidence" in SDK
  4. Forgets resolver.rs compares it with a threshold
  5. Forgets storage.rs serializes it → existing .kg files break
  → Bug. User frustrated.
```

### With impact analysis

PreToolUse hook on Edit|Write intercepts every modification:

```
Claude is about to edit model.rs
    │
    ▼
PreToolUse hook fires:
    │
    ├─ Parse the proposed edit to identify modified entities
    │  (functions renamed, signatures changed, fields removed, types changed)
    │
    ├─ autoclaw impact <entity_names>
    │  Query the code graph for ALL references
    │
    └─ Inject impact report into Claude's context:

    ┌──────────────────────────────────────────────────┐
    │ ⚠️  IMPACT ANALYSIS: Node.confidence             │
    │                                                   │
    │ DIRECT REFERENCES (6 in 5 files):                │
    │ • graph.rs:142 — read in relevance()             │
    │ • graph.rs:387 — written in ingest()             │
    │ • resolver.rs:56 — compared in merge_nodes()     │
    │ • python.rs:94 — exposed as Python SDK property  │
    │ • storage.rs:23 — serialized to .kg format       │
    │ • prompt.rs:67 — mentioned in extraction prompt  │
    │                                                   │
    │ INDIRECT (via call chain):                        │
    │ • python.py → python.rs:ingest() → graph.rs →    │
    │   sets confidence                                 │
    │                                                   │
    │ ⚠️  BREAKING CHANGES:                            │
    │ • storage.rs: field rename breaks deserialization │
    │   of existing .kg files                          │
    │ • python.rs: Python SDK property name change     │
    │   breaks downstream Python code                  │
    └──────────────────────────────────────────────────┘

Claude proceeds WITH this information:
  → Modifies ALL 5 files
  → Warns user about breaking changes in storage/SDK
  → Suggests migration strategy for existing .kg files
```

### New CLI command: `autoclaw impact`

```bash
autoclaw impact <entity_name> [--depth 2]
```

**Logic:**
1. Find entity in KG by name (function, struct, field, etc.)
2. Traverse code graph: all nodes connected by `calls`, `reads`, `writes`, `imports`, `has_field`, `implements`
3. Optionally follow indirect references (depth > 1): callers of callers
4. Identify breaking change patterns:
   - Field rename on serialized struct → deserialization breaks
   - Public API change → downstream consumer breaks
   - Function signature change → all callers must update
5. Format as impact report

**Output:** Markdown impact report (see example above)

### Incremental code index updates

After every Edit/Write, tree-sitter re-parses only the modified file:

```
PostToolUse hook (matcher: Edit|Write):
  1. Get file_path from tool output
  2. autoclaw reindex <file_path>
     - tree-sitter re-parses the single file
     - Removes old entities for this file from KG
     - Adds new entities from updated AST
     - Updates relations
  3. KG always reflects current code state
```

This keeps the code graph accurate without full re-indexing. Milliseconds per file.

## Seamless Integration: Zero-Recall Design

### The problem with manual recall

If Claude has to "remember" to query the KG, it won't. The KG becomes a tool that's available but rarely used — like documentation nobody reads. The integration must be **invisible**: context arrives automatically at every step of Claude's reasoning, without any conscious decision to "check the KG."

### Automatic context injection at every step

The KG injects relevant context at **7 lifecycle points**, covering every phase of Claude's work:

```
USER SENDS MESSAGE
    │
    ▼
┌─ UserPromptSubmit hook ───────────────────────────────┐
│                                                        │
│  autoclaw relevant "<user_message_text>"               │
│  - Extracts keywords/entity names from user's message  │
│  - Searches KG for matching entities + neighbors       │
│  - Returns: relevant decisions, facts, relations       │
│                                                        │
│  Injected BEFORE Claude starts reasoning:              │
│  ┌──────────────────────────────────────────┐          │
│  │ 📌 KG context for this request:          │          │
│  │                                          │          │
│  │ chunker.rs:                              │          │
│  │ - 3 functions: chunk_text, split_...     │          │
│  │ - depends on: model.rs (ChunkConfig)     │          │
│  │ - called by: python.rs, graph.rs         │          │
│  │                                          │          │
│  │ Decision: sentence-aware splitting       │          │
│  │ (reason: naive split broke entity names) │          │
│  │                                          │          │
│  │ Known constraint: overlap < chunk_size   │          │
│  └──────────────────────────────────────────┘          │
└────────────────────────────────────────────────────────┘
    │
    ▼
CLAUDE REASONS AND DECIDES TO READ A FILE
    │
    ▼
┌─ PostToolUse(Read) hook ──────────────────────────────┐
│                                                        │
│  autoclaw file-context <file_path>                     │
│  - What does the KG know about this file?              │
│  - Decisions related to this file                      │
│  - Known bugs, constraints, history                    │
│  - Who depends on this file                            │
│                                                        │
│  Injected after the file content:                      │
│  ┌──────────────────────────────────────────┐          │
│  │ 📌 KG context for resolver.rs:           │          │
│  │                                          │          │
│  │ Decision: Levenshtein (was LCS)          │          │
│  │ Reason: LCS failed on common prefixes    │          │
│  │ Alternatives tried: substring (too many  │          │
│  │   false positives), exact only (missed   │          │
│  │   too many matches)                      │          │
│  │                                          │          │
│  │ Known bug: threshold < 0.8 = false pos   │          │
│  │ Callers: graph.rs:ingest(), merge()      │          │
│  │ Last significant change: 2 sessions ago  │          │
│  └──────────────────────────────────────────┘          │
└────────────────────────────────────────────────────────┘
    │
    ▼
CLAUDE DECIDES TO EDIT A FILE
    │
    ▼
┌─ PreToolUse(Edit|Write) hook ─────────────────────────┐
│                                                        │
│  autoclaw impact-from-diff <tool_input>                │
│  - Parses the proposed edit (old_string → new_string)  │
│  - Identifies which entities are being modified         │
│  - For EACH entity: queries all references in KG       │
│  - Detects breaking change patterns                    │
│                                                        │
│  Injected BEFORE the edit executes:                    │
│  ┌──────────────────────────────────────────┐          │
│  │ ⚠️  IMPACT: Node.confidence              │          │
│  │                                          │          │
│  │ REFERENCES (6 in 5 files):              │          │
│  │ • graph.rs:142 — read in relevance()    │          │
│  │ • resolver.rs:56 — compared in merge()  │          │
│  │ • python.rs:94 — SDK property           │          │
│  │ • storage.rs:23 — serialized to .kg     │          │
│  │                                          │          │
│  │ ⚠️  BREAKING: storage.rs serialization  │          │
│  │ ⚠️  BREAKING: python SDK property name  │          │
│  └──────────────────────────────────────────┘          │
│                                                        │
│  This fires for EVERY Edit/Write, not once per task.   │
│  15 edits = 15 impact analyses, each specific to       │
│  the entities being changed in that particular edit.   │
└────────────────────────────────────────────────────────┘
    │
    ▼
EDIT EXECUTES
    │
    ▼
┌─ PostToolUse(Edit|Write) hook ────────────────────────┐
│                                                        │
│  autoclaw reindex <file_path>                          │
│  - Tree-sitter re-parses the modified file             │
│  - Updates code entities in KG                         │
│  - So the NEXT impact analysis reflects current state  │
│                                                        │
│  0 tokens, milliseconds, deterministic                 │
└────────────────────────────────────────────────────────┘
```

### Why this works: Claude never decides to use the KG

| Traditional tool | This design |
|---|---|
| Claude must remember the tool exists | Hooks inject automatically |
| Claude must decide when to query | Every lifecycle point is covered |
| Claude must formulate the right query | Hooks extract keywords from context |
| Claude might skip it "this time" | Hooks always fire, no exceptions |
| Context arrives late (after Claude already reasoned) | Context arrives BEFORE reasoning starts |

The KG is not a tool Claude uses. It's a **layer** that enriches every interaction. Like having peripheral vision — you don't decide to use it, it's just there.

### New CLI commands for seamless integration

#### `autoclaw relevant`

Finds KG facts relevant to a text query (user message, task description).

```bash
autoclaw relevant "<text>" [--budget 500]
```

**Logic:**
1. Tokenize input text, extract keywords and potential entity names
2. Search KG: exact match on entity names, then fuzzy match, then substring
3. For each matched entity: include its definition, tier, key relations
4. Expand to 1-hop neighbors for important matches
5. Format as concise markdown, fit within token budget
6. Output to stdout

#### `autoclaw file-context`

Returns what the KG knows about a specific file.

```bash
autoclaw file-context <file_path> [--budget 300]
```

**Logic:**
1. Find all code entities in KG with `source_file == file_path`
2. Find all semantic facts (Decisions, Errors) related to these entities
3. Find all incoming relations (who calls/imports/depends on this file)
4. Format as concise markdown
5. Output to stdout

## Continuous KG Updates

### The problem with extraction-only-at-85%

If semantic extraction only happens when context hits 85%, decisions made in the first 84% of a session may never enter the KG if the session ends early. The KG must stay current throughout.

### Three-tier update strategy

```
┌─────────────────────────────────────────────────────────┐
│                  CONTINUOUS UPDATES                       │
│                                                           │
│  TIER 1: Instant (every Edit/Write)                      │
│  ┌─────────────────────────────────────────────────┐     │
│  │  PostToolUse(Edit|Write) → autoclaw reindex      │     │
│  │  Tree-sitter re-parses modified file             │     │
│  │  Code entities always current                    │     │
│  │  Cost: 0 tokens, ~10ms                           │     │
│  └─────────────────────────────────────────────────┘     │
│                                                           │
│  TIER 2: Lightweight (every ~20 tool uses)               │
│  ┌─────────────────────────────────────────────────┐     │
│  │  PostToolUse (counter) → autoclaw snapshot        │     │
│  │  Reads last N transcript entries                  │     │
│  │  Rust heuristics extract obvious facts:           │     │
│  │  - "we decided/chose/use X" → Decision            │     │
│  │  - "the bug is/was caused by" → ErrorResolution   │     │
│  │  - "X depends on/calls/imports Y" → Relation      │     │
│  │  - "doesn't work because" → TechnicalFact         │     │
│  │  Cost: 0 tokens, ~50ms                            │     │
│  └─────────────────────────────────────────────────┘     │
│                                                           │
│  TIER 3: Deep (at 85% context OR session end)            │
│  ┌─────────────────────────────────────────────────┐     │
│  │  Haiku subagent reads full transcript             │     │
│  │  Extracts nuanced semantic knowledge              │     │
│  │  Compares with KG, invalidates, promotes, GC      │     │
│  │  Cost: Haiku tokens, ~60-120s                     │     │
│  └─────────────────────────────────────────────────┘     │
│                                                           │
│  + Stop hook: Tier 2 snapshot at session end              │
│    (catches decisions from sessions that never compact)   │
└─────────────────────────────────────────────────────────┘
```

### New CLI command: `autoclaw snapshot`

Lightweight heuristic extraction from recent transcript entries.

```bash
autoclaw snapshot <transcript_path> [--last-n 20]
```

**Logic:**
1. Read last N entries from transcript JSONL
2. Extract user and assistant text content
3. Apply Rust regex/pattern matching:
   - Decision patterns: "we decided", "let's use", "I chose", "the approach is", "instead of X we'll use Y"
   - Error patterns: "the bug is", "caused by", "doesn't work because", "the fix is"
   - Relation patterns: "X depends on Y", "X calls Y", "X imports Y", "after changing X, Y broke"
   - Supersession patterns: "instead of X", "replacing X with Y", "X was wrong, actually Y"
4. For each extracted fact: check KG for existing match, update or insert
5. Save .kg

**Output:**
```json
{"extracted": 3, "updated": 1, "new": 2, "errors": []}
```

## Complete Hook Map

| Hook | Trigger | Action | What it does | Cost |
|------|---------|--------|-------------|------|
| **SessionStart** | Every session start | `autoclaw context --budget 2000` | Inject top-K facts by relevance | 0 tokens, instant |
| **SessionStart("compact")** | After compaction | `autoclaw context --budget 2000` | Re-inject after context reset | 0 tokens, instant |
| **UserPromptSubmit** | Every user message | `autoclaw relevant "<message>"` | Inject facts relevant to user's request | 0 tokens, instant |
| **PreToolUse(Edit\|Write)** | Before every edit | `autoclaw impact-from-diff` | Impact analysis: all references + breaking changes | 0 tokens, instant |
| **PostToolUse(Read)** | After every file read | `autoclaw file-context <path>` | Inject KG knowledge about the file | 0 tokens, instant |
| **PostToolUse(Edit\|Write)** | After every edit | `autoclaw reindex <path>` | Re-parse modified file with tree-sitter | 0 tokens, ~10ms |
| **PostToolUse(every ~20)** | Every ~20 tool uses | `autoclaw snapshot` | Heuristic extraction from recent transcript | 0 tokens, ~50ms |
| **PostToolUse(85%)** | Context at 85% | Haiku extraction + reconcile + /compact | Deep extraction + minimal compaction | Haiku tokens |
| **Stop** | Session end | `autoclaw snapshot --all-since-last` | Final snapshot of entire session | 0 tokens, ~100ms |

**All hooks are automatic. Claude never needs to "remember" to use the KG.** The KG is an invisible layer that enriches every interaction and stays current through continuous updates.



### Pipeline (detailed)

```
Auto-compact: DISABLED (autoCompactEnabled: false)

NORMAL CONVERSATION
Claude works, context grows
    │
    ▼ (every tool use)
┌───────────────────────────────────────────────┐
│  PostToolUse hook (type: command)              │
│                                                │
│  autoclaw monitor <transcript_path>            │
│  - Reads last assistant message usage field    │
│  - Calculates: used_pct = context / window     │
│  - If < 85%: exit 0 (do nothing)              │
│  - If >= 85%: exit 1 (signal to extract)      │
└───────────────────────────────────────────────┘
    │
    │  (when 85% threshold reached)
    ▼
┌───────────────────────────────────────────────┐
│  Extraction (subagent, model: haiku)           │
│                                                │
│  Input:                                        │
│  - Transcript (conversation, NOT code)         │
│  - KG existing semantic facts                  │
│  - Extraction rules (structured prompt)        │
│                                                │
│  Haiku extracts ONLY semantic knowledge:       │
│  - Decisions + reasons + alternatives          │
│  - Errors + root causes + failed approaches    │
│  - Implicit relations from conversation        │
│  (Code structure already in KG via tree-sitter)│
│                                                │
│  Output: JSON → autoclaw reconcile             │
│  (Rust: ingest + invalidate + promote + GC)    │
└───────────────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────────────┐
│  Tree-sitter refresh                           │
│                                                │
│  Re-scan any files modified since last extract │
│  Update code entities in KG                    │
│  (deterministic, 0 tokens, instant)            │
└───────────────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────────────┐
│  Minimal /compact                              │
│                                                │
│  Trigger with instructions:                    │
│  "Minimal summary: current task and last step  │
│   only. One line. Project context comes from   │
│   the knowledge graph."                        │
└───────────────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────────────┐
│  SessionStart("compact") hook                  │
│                                                │
│  autoclaw context --budget 2000 --project .    │
│  (Rust: top-K facts by relevance, markdown)    │
│                                                │
│  Output injected into context:                 │
│  ┌───────────────────────────────────────┐     │
│  │ ## Knowledge Graph Context            │     │
│  │                                       │     │
│  │ ### Critical (always present)         │     │
│  │ - Storage: .kg file, no database      │     │
│  │   (reason: zero external deps)        │     │
│  │                                       │     │
│  │ ### Significant (recent)              │     │
│  │ - resolver.rs: Levenshtein, not LCS   │     │
│  │   (LCS failed on common prefixes)     │     │
│  │                                       │     │
│  │ ### Code structure                    │     │
│  │ - graph.rs: 15 functions, 3 structs   │     │
│  │ - resolver.rs → graph.rs (merge)      │     │
│  │                                       │     │
│  │ ### Known Errors                      │     │
│  │ - threshold < 0.8 = false positives   │     │
│  └───────────────────────────────────────┘     │
└───────────────────────────────────────────────┘
    │
    ▼
🧠 Claude continues with:
   - 1 line: "where I was" (minimal summary)
   - ~2000 tokens: "what I know" (KG structured)
   - CLAUDE.md (reloaded from disk)
```

## Data Model Changes

### Importance Tier

```rust
enum ImportanceTier {
    Critical,    // weight 1.0 — architectural decisions, project constraints
    Significant, // weight 0.6 — implementation decisions, bug fixes
    Minor,       // weight 0.3 — renames, style choices, code entities
}
```

### Relevance Score (computed at runtime, not stored)

```rust
fn relevance(node: &Node, now: DateTime) -> f64 {
    if node.superseded_by.is_some() { return 0.0; }

    match node.tier {
        Critical => 1.0,  // no decay, ever
        Significant => {
            let age = (now - node.created_at).num_days() as f64;
            0.6 * (-0.01 * age).exp()  // ~50% at 70 days
        }
        Minor => {
            let age = (now - node.created_at).num_days() as f64;
            0.3 * (-0.05 * age).exp()  // ~50% at 14 days
        }
    }
}
```

Note: Code entities from tree-sitter don't decay — they're refreshed on every file change. Decay applies only to semantic facts from conversations.

### Supersession

```rust
struct Node {
    // ... existing fields ...
    tier: ImportanceTier,
    superseded_by: Option<NodeId>,  // points to the replacing fact
    last_referenced: DateTime,       // boosted when re-encountered
}
```

### Entity Sources

```rust
enum EntitySource {
    CodeAnalysis,   // tree-sitter / LSP — deterministic, refreshable
    Conversation,   // extracted from chat by Haiku
    Document,       // extracted from business docs by Haiku
    Memory,         // agent memory (existing)
    Inferred,       // discovered by reconcile (existing)
}
```

### Relationship with Auto Memory

| | Auto Memory | Knowledge Graph |
|---|---|---|
| Format | Narrative markdown notes | Structured entities + relations |
| Scope | User preferences, feedback, workflow | Project facts, decisions, code structure |
| Written | Claude decides autonomously | Bootstrap + extraction + tree-sitter |
| Read | Always (first 200 lines at boot) | SessionStart + on-demand + PreToolUse |
| Example | "User prefers short answers" | "resolver.rs:lookup() calls resolve_name() — 6 callers across 3 files" |

Rule: The extraction subagent does NOT extract user preferences or behavioral feedback — that's auto memory's domain.

## Extraction Prompt

The subagent Haiku receives this prompt during semantic extraction. Note: it does NOT receive source code — tree-sitter handles that.

```
You are a knowledge extractor. You analyze coding conversation transcripts
and produce structured facts for a knowledge graph.

IMPORTANT: You extract ONLY semantic knowledge from conversations.
Code structure (functions, classes, imports, call graphs) is handled
separately by deterministic analysis. Do NOT extract code entities.

## Input
1. TRANSCRIPT: the conversation (parsed JSONL, text only — not code)
2. KG_EXISTING: semantic facts already in the knowledge graph

## What to extract

### Decisions (type: Decision)
Every time an approach, technology, or pattern was chosen.
INCLUDE the reason for the choice AND alternatives that were rejected.
INCLUDE why rejected alternatives failed.
Tier: critical if architectural, significant if implementation, minor if stylistic.

### Technical Facts (type: TechnicalFact)
Observed behaviors, discovered constraints, performance characteristics.
INCLUDE how they were discovered (from which action/error).
Do NOT include code structure facts (those come from tree-sitter).

### Error Resolutions (type: ErrorResolution)
Bugs found, root cause, solution applied, failed approaches.
INCLUDE why failed approaches didn't work.

### Implicit Relations
Relations between concepts discovered through conversation flow:
- "We changed X because of Y" → X depends_on Y
- "After fixing A, B started working" → B blocked_by A
- "We chose approach X for component Y" → Y uses X

## What NOT to extract
- Code structure (functions, imports, types) — handled by tree-sitter
- Compilation/test output (only the result: pass/fail)
- Explorations with no result
- Confirmations and acknowledgments
- User preferences or behavioral feedback (that's auto memory)

## Comparing with existing KG
For each extracted fact, check if it exists in KG_EXISTING:
- Exists and confirmed → promote tier if appropriate, explain why
- Exists and contradicted → mark as superseded, include the new fact and reason
- New → add with appropriate tier

## Timeline
Order facts chronologically. For each fact indicate approximate position
in conversation (start/middle/end).

## Output format
Produce valid JSON:
{
  "new_facts": [
    {
      "name": "string",
      "type": "Decision|TechnicalFact|ErrorResolution",
      "tier": "critical|significant|minor",
      "definition": "what the fact states",
      "reason": "why (for decisions: why chosen, for errors: root cause)",
      "supersedes": "name of old fact if applicable, null otherwise",
      "relations": [{"target": "entity name", "type": "relation_type"}],
      "evidence": {"text": "quote from transcript"}
    }
  ],
  "superseded": [{"old": "fact name", "reason": "why invalidated"}],
  "promotions": [{"name": "fact name", "new_tier": "new tier", "reason": "why"}],
  "relations": [{"from": "entity", "to": "entity", "type": "relation", "evidence": "context"}]
}
```

## New CLI Commands

### `autoclaw bootstrap`

Full project indexing. Called by `/graphocode:start`.

```bash
autoclaw bootstrap [--config graphocode.toml]
```

**Logic:**
1. Read config for source paths
2. Tree-sitter: scan all code files → extract code entities + relations
3. claude_parser: parse all conversation JSONL → prepare for Haiku extraction
4. (If documents configured) Chunk documents → prepare for Haiku extraction
5. Haiku extracts semantics from conversations + documents
6. autoclaw reconcile: merge everything into KG
7. Save .kg

### `autoclaw monitor`

Reads the transcript JSONL, checks context usage against threshold.

```bash
autoclaw monitor <transcript_path> [--threshold 85] [--window 200000]
```

**Logic:**
1. Read last assistant message entry from JSONL
2. Extract usage: `input_tokens + cache_creation_input_tokens + cache_read_input_tokens`
3. Calculate `used_pct = usage / window_size * 100`
4. If `used_pct >= threshold`: exit 1 (signal to extract)
5. If `used_pct < threshold`: exit 0 (do nothing)

**Output (stdout):**
```json
{"used_pct": 87, "used_tokens": 174000, "window_size": 200000, "should_extract": true}
```

### `autoclaw reconcile`

Ingests extraction results and reconciles with existing KG.

```bash
autoclaw reconcile < extraction.json
```

**Logic:**
1. Ingest new facts with tier and timestamp
2. For each superseded: find old node, set `superseded_by` to new node ID
3. Apply promotions: update tier on matching nodes
4. Garbage collect: remove nodes where `relevance < 0.05`
5. Save .kg

**Output:**
```json
{"added": 5, "superseded": 2, "promoted": 1, "gc_removed": 3, "errors": []}
```

### `autoclaw context`

Produces structured markdown context for re-injection.

```bash
autoclaw context --budget 2000 [--project /path]
```

**Logic:**
1. Calculate `relevance` for every node
2. Sort by relevance descending
3. Group by category: Critical decisions, Significant facts, Code structure summary, Relations, Known errors
4. Format as markdown
5. Truncate to fit token budget
6. Output to stdout

### `autoclaw impact`

Impact analysis for a code entity.

```bash
autoclaw impact <entity_name> [--depth 2]
```

**Logic:**
1. Find entity in KG (function, struct, field, etc.)
2. Traverse code graph: all connected via `calls`, `reads`, `writes`, `imports`, `has_field`, `implements`
3. Follow indirect references up to `--depth`
4. Identify breaking change patterns
5. Format as impact report with file:line references

**Output:** Markdown impact report

### `autoclaw reindex`

Re-parse a single file after modification.

```bash
autoclaw reindex <file_path>
```

**Logic:**
1. Tree-sitter parse the file
2. Remove old code entities for this file from KG
3. Add new entities from updated AST
4. Update relations
5. Save .kg

### `autoclaw relevant`

Find KG facts relevant to a text query (user message, task description).

```bash
autoclaw relevant "<text>" [--budget 500]
```

**Logic:**
1. Tokenize input text, extract keywords and potential entity names
2. Search KG: exact match on entity names, then fuzzy match, then substring
3. For each matched entity: include definition, tier, key relations
4. Expand to 1-hop neighbors for important matches
5. Format as concise markdown within token budget
6. Output to stdout

### `autoclaw file-context`

Return what the KG knows about a specific file.

```bash
autoclaw file-context <file_path> [--budget 300]
```

**Logic:**
1. Find all code entities in KG with source_file == file_path
2. Find all semantic facts (Decisions, Errors) related to these entities
3. Find all incoming relations (who calls/imports/depends on this file)
4. Format as concise markdown
5. Output to stdout

### `autoclaw snapshot`

Lightweight heuristic extraction from recent transcript entries. No LLM needed.

```bash
autoclaw snapshot <transcript_path> [--last-n 20] [--all-since-last]
```

**Logic:**
1. Read last N entries (or all since last snapshot marker) from transcript JSONL
2. Extract user and assistant text content
3. Apply Rust regex/pattern matching:
   - Decision patterns: "we decided", "let's use", "I chose", "the approach is", "instead of X we'll use Y"
   - Error patterns: "the bug is", "caused by", "doesn't work because", "the fix is"
   - Relation patterns: "X depends on Y", "X calls Y", "after changing X, Y broke"
   - Supersession patterns: "instead of X", "replacing X with Y", "X was wrong"
4. For each extracted fact: check KG for existing match, update or insert
5. Write snapshot marker to avoid re-processing
6. Save .kg

**Output:**
```json
{"extracted": 3, "updated": 1, "new": 2, "errors": []}
```

### `autoclaw tick`

Combined monitor + periodic snapshot. Called on every PostToolUse to minimize hook overhead.

```bash
autoclaw tick <transcript_path> [--snapshot-every 20] [--threshold 85]
```

**Logic:**
1. Increment internal counter (stored in .kg metadata or temp file)
2. If counter % snapshot_every == 0: run snapshot logic (heuristic extraction)
3. Read last assistant message usage from transcript
4. Calculate context percentage
5. If < threshold: exit 0
6. If >= threshold: exit 1 (triggers extraction + compact)

### `autoclaw impact-from-diff`

Parse a proposed edit and run impact analysis on affected entities.

```bash
autoclaw impact-from-diff <tool_input_json>
```

**Logic:**
1. Parse tool input: extract file_path, old_string, new_string
2. Diff old_string vs new_string to identify changed entities
   - Function/method renames or signature changes
   - Field additions/removals/renames
   - Type changes
   - Import changes
3. For each changed entity: run `impact` logic (all references + breaking change detection)
4. Format combined impact report
5. Output to stdout

## Plugin Structure

```
autoclaw-plugin/
├── .claude-plugin/
│   └── plugin.json
├── hooks/
│   └── hooks.json
├── skills/
│   ├── graphocode-start/SKILL.md    # /graphocode:start — full bootstrap
│   ├── graphocode-query/SKILL.md    # /graphocode:query — ask the KG
│   ├── graphocode-impact/SKILL.md   # /graphocode:impact — impact analysis
│   └── graphocode-decide/SKILL.md   # /graphocode:decide — record decision
├── agents/
│   └── kg-extractor.md              # Haiku subagent for semantic extraction
├── scripts/
│   └── extract-and-compact.sh       # Orchestrates extraction → compact
├── graphocode.toml                  # Default config template
└── CLAUDE.md                        # Instructions for using the KG
```

### hooks.json

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "autoclaw context --budget 2000 --project \"$CWD\" 2>/dev/null || echo 'No KG found. Run /graphocode:start to bootstrap.'"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "autoclaw relevant \"$(echo $HOOK_INPUT | jq -r .user_message)\" --budget 500 2>/dev/null || true"
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "autoclaw impact-from-diff \"$TOOL_INPUT\" 2>/dev/null || true"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Read",
        "hooks": [
          {
            "type": "command",
            "command": "autoclaw file-context \"$(echo $TOOL_INPUT | jq -r .file_path)\" --budget 300 2>/dev/null || true"
          }
        ]
      },
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "autoclaw reindex \"$(echo $TOOL_INPUT | jq -r .file_path)\" 2>/dev/null || true"
          }
        ]
      },
      {
        "hooks": [
          {
            "type": "command",
            "command": "autoclaw tick \"$TRANSCRIPT_PATH\" --snapshot-every 20 --threshold 85 2>/dev/null || bash scripts/extract-and-compact.sh \"$TRANSCRIPT_PATH\""
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "autoclaw snapshot \"$TRANSCRIPT_PATH\" --all-since-last 2>/dev/null || true"
          }
        ]
      }
    ]
  }
}
```

Note: `autoclaw tick` combines the monitor (context %) and snapshot (every N) logic into a single command to avoid running two separate hooks on every tool use. It maintains an internal counter and triggers snapshots every ~20 tool uses, while also checking context threshold.

## Configuration

### Disable auto-compact

In `~/.claude.json`:
```json
{
  "autoCompactEnabled": false
}
```

### Environment variables

```bash
AUTOCLAW_KG=./knowledge.kg          # Path to .kg file
AUTOCLAW_THRESHOLD=85               # Context % to trigger extraction
AUTOCLAW_CONTEXT_BUDGET=2000        # Max tokens for re-injection
AUTOCLAW_DECAY_LAMBDA_SIG=0.01      # Decay for significant (50% at 70 days)
AUTOCLAW_DECAY_LAMBDA_MIN=0.05      # Decay for minor (50% at 14 days)
AUTOCLAW_GC_THRESHOLD=0.05          # Relevance below which facts are GC'd
```

### graphocode.toml

```toml
[sources]
code = ["src/**/*.rs", "src/**/*.py"]
conversations = true
documents = ["docs/requirements.md", "docs/architecture.md"]

[bootstrap]
on_first_session = true

[extraction]
threshold = 85
budget = 2000
model = "haiku"

[impact]
enabled = true
depth = 2
```

## Scope

### In scope (v1)
- `/graphocode:start` — full project bootstrap
- Tree-sitter code indexing (Rust, Python, TypeScript)
- Conversation parsing + Haiku semantic extraction
- CLI commands: `bootstrap`, `monitor`, `reconcile`, `context`, `impact`, `reindex`, `relevant`, `file-context`, `snapshot`, `tick`, `impact-from-diff`
- ImportanceTier + supersession + decay in data model
- **Seamless integration hooks (zero-recall design):**
  - SessionStart: context re-injection
  - UserPromptSubmit: relevant facts for user's request
  - PreToolUse(Edit|Write): per-edit impact analysis
  - PostToolUse(Read): file-specific KG context
  - PostToolUse(Edit|Write): incremental tree-sitter reindex
  - PostToolUse(every ~20): heuristic snapshot extraction
  - PostToolUse(85%): deep Haiku extraction + compact
  - Stop: final session snapshot
- Continuous 3-tier update strategy (instant/lightweight/deep)
- Plugin packaging

### Out of scope (v1)
- LSP integration (rust-analyzer, Pyright) — v2, deeper type-aware analysis
- Document ingestion UI — v2
- Visual KG explorer — future
- Multi-project KG federation — future
- Custom decay curves per entity type — future
- Automatic tier calibration — future

## Success Criteria

1. After `/graphocode:start`, Claude has structural awareness of the entire codebase without reading any files
2. Impact analysis catches >90% of cross-file dependencies before edits
3. After 3+ compaction cycles, Claude retains knowledge of decisions from the first session
4. Contradicted decisions are correctly marked as superseded
5. Re-injection context is more useful than Haiku's narrative summary (qualitative)
6. No perceptible latency during normal conversation (monitor + reindex < 100ms)
7. Extraction + reconcile completes within 2 minutes at 150K token transcripts
8. Zero hallucinated "fixes" on entities with known cross-file dependencies
