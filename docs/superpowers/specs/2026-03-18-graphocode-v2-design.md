# Graphocode v2 — Design Spec

## Overview

Graphocode v2 replaces v1's hook-based context injection with auto-generated `.claude/rules/` files (96% adherence) and a **complete reference graph** that tracks where every symbol is used across the entire codebase. The model gets the minimal context needed to never break code — not by dumping content into the context window, but by writing structured rules to disk that Claude Code loads automatically.

## Problems Solved (from user research)

| Problem | Frequency | How v2 solves it |
|---|---|---|
| Session amnesia (10-30 min lost per session) | Very high | Rules auto-generated from KG at SessionStart — zero rebuild |
| Breaks working code (33-67% requires fix) | Very high | Reference graph knows ALL usages, impact analysis prevents blind edits |
| Code duplication (8x more than human) | Very high | Rules show what exists already, PageRank ranks important symbols |
| Ignores conventions | High | Decisions in imperative rules (94% compliance) |
| Cross-file dependencies broken | High | Deterministic reference graph — not sampling, not hoping |
| Context loss after compaction | High | Rules are files on disk — compaction can't touch them |

## Research Foundation

| Finding | Source | Impact on design |
|---|---|---|
| .claude/rules/ path-specific: 96% adherence | SFEIR Institute | Use rules, not hooks, for persistent context |
| Imperative instructions: 94% compliance | SFEIR Institute | Write decisions as commands, not descriptions |
| 5 files × 30 lines > 1 file × 150 lines | SFEIR Institute | Modular rules per source file |
| Call graph info → up to 3x improvement | Apple ML Research (EACL 2024) | Reference graph is the highest-value feature |
| Removing stale context improves output | Demand Paging paper (2603.09023) | Don't dump context — let model fetch on demand |
| KG-based code generation: +70-75% vs baseline | arxiv 2505.14394 | Knowledge graph approach validated |
| 79.4% of conversation bytes are tool results | Demand Paging paper | Minimize injection, maximize structure |
| Only SessionStart/UserPromptSubmit inject stdout | Claude Code testing | PreToolUse/PostToolUse need additionalContext JSON |
| Aider PageRank repo map: 1K tokens | Aider architecture | Rank symbols by importance, not alphabetically |
| 70% of functions depend on cross-file entities | Repository-level code gen research | Reference graph is essential, not optional |

## Architecture

### Core Principle: Rules, Not Injection

v1 injected context via hooks (9 hooks, stdout/additionalContext). v2 writes **files to disk** that Claude Code loads natively with 96% adherence.

```
┌─────────────────────────────────────────────────────────────┐
│                    GRAPHOCODE v2                              │
│                                                               │
│  FOUNDATION: Reference Graph                                 │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Tree-sitter extracts definitions + ALL references:       │ │
│  │ call sites, field access, type usage, method calls       │ │
│  │ The KG knows deterministically where every symbol is used│ │
│  └─────────────────────────────────────────────────────────┘ │
│          │                                                    │
│          ▼                                                    │
│  DELIVERY: .claude/rules/ auto-generated                     │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ project-map.md  → module map with reference counts       │ │
│  │ decisions.md    → imperative architectural decisions     │ │
│  │ src-*.md        → path-specific per source file          │ │
│  │ 96% adherence, zero hook overhead, survives compaction   │ │
│  └─────────────────────────────────────────────────────────┘ │
│          │                                                    │
│          ▼                                                    │
│  HOOKS: only 4 (was 9)                                       │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ SessionStart      → sync-rules (side effect only)        │ │
│  │ PreToolUse(Edit)  → impact with pattern report           │ │
│  │                     (additionalContext JSON)              │ │
│  │ PostToolUse(Edit) → reindex (side effect only)           │ │
│  │ Stop              → snapshot (side effect only)          │ │
│  └─────────────────────────────────────────────────────────┘ │
│          │                                                    │
│          ▼                                                    │
│  PERSISTENCE: cross-session via KG → rules                   │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Session N: Stop → snapshot extracts decisions → KG       │ │
│  │ Session N+1: SessionStart → sync-rules → decisions.md   │ │
│  │ Zero amnesia, zero context rebuild, zero tokens wasted   │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## The Reference Graph

### What tree-sitter extracts

**Definitions (v1, unchanged):**
- Functions, structs, enums, traits, consts, methods, fields, imports

**References (NEW in v2):**
- Call expressions: `chunk_text(...)` in bootstrap.rs:67
- Field access (read): `node.confidence` in graph.rs:142
- Field access (write): `node.confidence = x` in reconcile.rs:95
- Type usage: `Vec<Node>` in reconcile.rs:30
- Method calls: `kg.add_node(...)` in impact.rs:55

### Data model

```rust
struct CodeReference {
    source_file: String,     // where the reference is
    source_line: usize,      // line number
    target_name: String,     // what is referenced
    ref_type: RefType,       // how
}

enum RefType {
    Calls,       // function call
    ReadsField,  // field read
    WritesField, // field write
    UsesType,    // type usage
    MethodCall,  // method call on an instance
}
```

### AST node kinds to match

| tree-sitter node kind | RefType | Example |
|---|---|---|
| `call_expression` | Calls | `chunk_text(text, 4000, 500)` |
| `field_expression` (read context) | ReadsField | `node.confidence` |
| `field_expression` (assignment LHS) | WritesField | `node.confidence = 0.9` |
| `type_identifier` | UsesType | `Vec<Node>`, `Option<NodeId>` |
| `method_call_expression` | MethodCall | `kg.add_node(node)` |

### Edge storage in KG

References become edges:
```
bootstrap.rs:67  →calls→     chunk_text (chunker.rs)
graph.rs:142     →reads→     Node.confidence (model.rs)
reconcile.rs:95  →writes→    Node.confidence (model.rs)
reconcile.rs:30  →uses_type→ Node (model.rs)
impact.rs:55     →calls→     add_node (graph.rs)
```

### Scale

- Current project: 571 entities, estimated 2,000-5,000 reference edges
- Large project (100K files): millions of edges
- All in-memory HashMap, O(1) lookup + O(neighbors) traversal
- MessagePack serialization scales well

## Auto-Generated Rules

### `autoclaw sync-rules`

Called at SessionStart. Reads KG, generates `.claude/rules/`:

### project-map.md (always loaded, ~15 lines)

```markdown
Progetto: 22 file, 571 entità, 2,847 riferimenti cross-file
Decisioni architetturali attive: 5 (autoclaw explore <nome>)
Usa: autoclaw impact <entità> prima di rename/refactor

Moduli per connettività:
  model.rs    (25 entità, 890 refs IN) ← tipi usati ovunque, toccare con cautela
  graph.rs    (45 entità, 312 refs IN) ← core engine
  python.rs   (30 entità, 0 refs IN)  ← SDK pubblico, breaking = utenti
  chunker.rs  (8 entità, 47 refs IN)
  reconcile.rs(20 entità, 12 refs IN)
```

### decisions.md (always loaded, ~10 lines, imperative)

```markdown
NON disabilitare ImportanceTier.Critical decay — è by design
NON rimuovere campi da Node senza migrare .kg esistenti (storage.rs)
NON esporre Source::CodeAnalysis nel Python SDK — è interno
USARE autoclaw impact prima di ogni rename o cambio di signature
USARE #[serde(default)] per nuovi campi su struct serializzate
```

### src-{name}.md (path-specific, loaded only when working on that file)

Example for `src/model.rs`:

```markdown
---
paths:
  - "src/model.rs"
---

Node: 13 campi, usato in 12/22 file
  .confidence: letto in 4 file (graph, resolver, context, reconcile), scritto in 2 (graph, reconcile), serializzato in storage
  .tier: letto in 3 file, scritto in 2
  .superseded_by: letto in 3 file, scritto in 1
Source: 5 varianti, match in 6 file
ImportanceTier: usato in 8 file

SE AGGIUNGI CAMPO A Node: aggiorna storage.rs, usa #[serde(default)]
SE RINOMINI CAMPO: autoclaw impact <campo>
SE AGGIUNGI VARIANTE A Source: aggiorna tutti i match (6 file)
```

### Token budget

- Always loaded: ~25 lines (project-map + decisions) ≈ 150 tokens
- Path-specific: ~20-30 lines per file, loaded only when needed
- Total context cost when working on one file: ~200 tokens
- v1 hook injection was ~800+ tokens per message

### PageRank for symbol ranking

Within each rule file, symbols are ordered by PageRank score on the reference graph. A function called by 20 files appears before a private helper called once. This ensures the most important symbols are visible even in truncated views.

## Impact Analysis v2

### Pattern-grouped reports

When the model is about to Edit/Write, the PreToolUse hook:

1. Reads the proposed diff from stdin (JSON)
2. Identifies which entities are being modified
3. Queries the reference graph in the KG
4. **Groups references by usage pattern** instead of listing all
5. Outputs `additionalContext` JSON (not stdout — stdout is invisible on PreToolUse)

### Example output

```json
{
  "hookSpecificOutput": {
    "additionalContext": "⚠️ IMPACT: chunk_text signature change\nREFERENCES: 47 call sites in 12 files\nPATTERNS:\n  43x chunk_text(_, 4000, 500) — bootstrap.rs, graph.rs, python.rs +9\n  3x  chunk_text(_, 8000, 1000) — test_multi_document.py\n  1x  chunk_text(_, custom, 0) — test_document_types.py\nRECOMMENDED: add default for new param → 0 sites to update\nBREAKING: python.rs exposes chunk_text in public SDK"
  }
}
```

### What to report based on modification type

| Modification type | What the model needs to know |
|---|---|
| Rename function/field | Total reference count + affected files |
| Signature change | Call patterns grouped + default parameter advice |
| Remove field/function | All references (it's a deletion — every one breaks) |
| Change field type | Who reads/writes that field + type compatibility |
| Internal logic change | Nothing (signature unchanged = no external impact) |

For internal logic changes, the hook outputs nothing — zero tokens when not needed.

### Pattern grouping algorithm

```rust
struct ReferencePattern {
    pattern: String,        // "chunk_text(_, 4000, 500)"
    count: usize,           // 43
    example_files: Vec<String>, // first 3-5 files as examples
    total_files: usize,     // 10
}

fn group_by_pattern(refs: &[CodeReference]) -> Vec<ReferencePattern> {
    // For call expressions: group by argument patterns
    // For field access: group by read vs write
    // For type usage: just count
}
```

3 lines of patterns cover 10,000 references. The model reads 3 lines, knows 10K files are affected, and makes the right decision.

## Hooks (4, was 9)

| Hook | Type | Action | Injects context? |
|---|---|---|---|
| SessionStart | command | `autoclaw sync-rules` | No (writes files to disk) |
| PreToolUse(Edit\|Write) | command | `autoclaw impact-from-diff` | **Yes** (additionalContext JSON) |
| PostToolUse(Edit\|Write) | command | `autoclaw reindex <file>` | No (side effect) |
| Stop | command | `autoclaw snapshot <transcript>` | No (side effect) |

### Removed from v1

| v1 Hook | Why removed |
|---|---|
| UserPromptSubmit | Rules path-specific cover this automatically |
| PostToolUse(Read) | Rules path-specific load when Claude opens the file |
| PostToolUse(tick every 20) | Snapshot at Stop is sufficient |
| PostToolUse(monitor 85%) | Rules on disk survive compaction — less critical |
| SessionStart(compact) | Rules are files — they survive compaction natively |

### hooks.json

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "autoclaw sync-rules 2>/dev/null || true"
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
            "command": "autoclaw impact-from-diff 2>/dev/null || true"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "FILE_PATH=$(cat | jq -r '.tool_input.file_path // empty' 2>/dev/null) && [ -n \"$FILE_PATH\" ] && autoclaw reindex \"$FILE_PATH\" 2>/dev/null || true"
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

## Cross-Session Persistence

```
SESSION 1:
  Bootstrap → tree-sitter parses everything → reference graph in KG
  User works → makes architectural decisions
  Stop hook → snapshot extracts decisions from transcript
  Session ends → KG on disk with code graph + decisions

SESSION 2:
  SessionStart → sync-rules reads KG, generates .claude/rules/:
    project-map.md   ← updated with session 1 decisions
    decisions.md      ← includes new Critical decisions
    src-model.md      ← reference counts updated
  Claude starts → knows everything from session 1 without reading anything
  Works → edits code → PostToolUse reindex updates reference graph
  Stop → new decisions into KG

SESSION 3:
  SessionStart → sync-rules regenerates everything
  Rules contain cumulative knowledge from session 1 + 2
  Zero amnesia. Zero context rebuild. Zero tokens wasted.
```

### What survives between sessions

| Data | Where | How |
|---|---|---|
| Code graph (entities + reference edges) | knowledge.kg | File on disk |
| Architectural decisions | knowledge.kg → .claude/rules/decisions.md | KG → rule at each SessionStart |
| Module map + reference counts | knowledge.kg → .claude/rules/project-map.md | KG → rule at each SessionStart |
| Per-file context | knowledge.kg → .claude/rules/src-*.md | KG → path-specific rule |
| Semantic facts (errors, reasoning) | knowledge.kg | Available via `autoclaw explore` |

### What doesn't survive (and that's fine)

| Data | Why not needed |
|---|---|
| Verbatim conversation | KG has extracted facts |
| Detailed tool output | Ephemeral context, not knowledge |
| Intermediate reasoning | Final decisions are in KG |

## CLI Commands

### New

**`autoclaw sync-rules`** — Generate `.claude/rules/` from KG
```bash
autoclaw sync-rules [--project-dir .]
```
1. Read all nodes and edges from KG
2. Generate project-map.md with modules ranked by connectivity (PageRank)
3. Generate decisions.md with Critical/Significant decisions in imperative form
4. For each source file with >5 entities: generate src-{name}.md with paths frontmatter
5. Write files to .claude/rules/, overwriting previous

### Modified from v1

**`autoclaw bootstrap`** — Now extracts references too
```bash
autoclaw bootstrap [--config graphocode.toml]
```
V1: definitions only. V2: definitions + all references (call sites, field access, type usage).

**`autoclaw impact`** — Now groups by pattern
```bash
autoclaw impact <entity> [--depth 2]
```
V1: listed neighbors. V2: groups references by usage pattern, counts, suggests action.

**`autoclaw impact-from-diff`** — Now outputs additionalContext JSON
```bash
echo '<tool_input>' | autoclaw impact-from-diff
```
V1: plain text stdout (invisible on PreToolUse). V2: JSON with `hookSpecificOutput.additionalContext`.

**`autoclaw reindex`** — Now extracts references
```bash
autoclaw reindex <file_path>
```
V1: re-parsed definitions. V2: also updates reference edges to/from this file.

### Unchanged from v1

- `autoclaw snapshot` — heuristic extraction from transcript
- `autoclaw reconcile` — merge semantic facts into KG
- `autoclaw context` — available for manual use
- `autoclaw relevant` — available for manual use
- `autoclaw stats`, `explore`, `connect`, `topics`, `recent`, `export`

### Removed

- `autoclaw monitor` — not managing compaction
- `autoclaw tick` — replaced by sync-rules + snapshot at Stop
- `autoclaw file-context` — replaced by path-specific rules

## Plugin Structure

```
autoclaw-plugin/
├── .claude-plugin/
│   └── plugin.json
├── hooks/
│   └── hooks.json              # 4 hooks (was 9)
├── skills/
│   ├── graphocode-start/SKILL.md
│   ├── graphocode-query/SKILL.md
│   ├── graphocode-impact/SKILL.md
│   └── graphocode-decide/SKILL.md
├── agents/
│   └── kg-extractor.md
├── scripts/
│   └── setup.sh               # autoCompactEnabled: false (optional now)
└── CLAUDE.md
```

## Scope

### In scope (v2)

- Reference extraction in tree-sitter parser (calls, field access, type usage, method calls)
- Pattern grouping for impact reports
- `autoclaw sync-rules` command
- `additionalContext` JSON output in impact-from-diff
- PageRank symbol ranking in rules
- Auto-generated `.claude/rules/` with path-specific frontmatter
- Modified bootstrap/reindex with reference extraction
- Reduced hook set (4 instead of 9)
- Updated plugin structure

### Out of scope (v2)

- LSP integration (v3 — deeper type-aware analysis)
- Python/TypeScript tree-sitter grammars (v2 focuses on Rust)
- Cross-repository reference tracking
- Embedding-based semantic search for conversations
- Visual KG explorer

## Success Criteria

1. After bootstrap, Claude knows the structure of every module without reading any file
2. Impact analysis catches **100%** of cross-file references (deterministic, not sampling)
3. Pattern-grouped reports cover 10K+ references in <5 lines
4. Zero session amnesia — session N+1 starts with session N's knowledge
5. Rules total <200 tokens always loaded, path-specific loads only when needed
6. No perceptible latency: sync-rules <500ms, reindex <50ms, impact <100ms
7. Compaction no longer causes context loss (rules on disk)
8. Developers report: "it feels like a different model" (qualitative)

## Comparison: v1 vs v2

| Aspect | v1 | v2 |
|---|---|---|
| Context delivery | 9 hooks injecting stdout/JSON | 4 hooks + auto-generated rules (96% adherence) |
| Code awareness | Definitions only (571 entities) | Definitions + ALL references (thousands of edges) |
| Impact analysis | Listed neighbors | Pattern-grouped with action recommendations |
| Cross-session | KG persists but needs hook to inject | KG → rules on disk, loaded automatically |
| Token cost per session | ~800+ tokens per message (hooks) | ~150 tokens always + ~50 per file (rules) |
| Compaction resilience | Hooks needed to re-inject after compact | Rules are files — survive compaction natively |
| Complexity | 9 hooks, 17 CLI commands | 4 hooks, 14 CLI commands |
