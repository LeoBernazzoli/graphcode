# Autoclaw as Claude Code Persistent Memory

## Problem

When Claude Code's context window fills up (~95%), Haiku produces a narrative summary and discards the full conversation. This summary loses:

- **Why** decisions were made (only keeps the "what")
- Alternatives that were tried and rejected
- Implicit relationships between components discovered during exploration
- Error resolution context (which approaches failed and why)
- Cross-session accumulated knowledge

Each new session or post-compact continuation starts nearly from scratch.

## Solution

Use Autoclaw's knowledge graph as a persistent memory layer that:

1. **Extracts** structured facts from the conversation before compaction
2. **Accumulates** knowledge across sessions and compactions
3. **Re-injects** only the most relevant facts after compaction, using minimal tokens

The existing Haiku summary is reduced to a single-line bookmark ("what was I doing"). The KG becomes the real source of truth.

## Architecture

### Pipeline

```
CONVERSATION (normal work)
    |
    |  ~95% context window
    v
PreCompact hook (type: agent, model: haiku)
    |
    |  1. Read transcript JSONL
    |  2. Read existing KG (autoclaw export)
    |  3. Extract new facts (structured prompt)
    |  4. autoclaw reconcile < extracted_json
    |     (Rust: ingest + invalidate + promote + GC)
    |
    v
Claude Code built-in compression (unchanged)
    |
    |  Haiku produces minimal summary (guided by
    |  Compact Instructions in CLAUDE.md):
    |  "Task: fix fuzzy matching in resolver.rs.
    |   Last action: changed threshold to 0.85"
    |
    v
SessionStart("compact") hook (type: command)
    |
    |  autoclaw context --budget 2000 --focus "<from summary>"
    |  (Rust: top-K facts by relevance, formatted as text)
    |
    v
Claude resumes with:
  - 1 line "where I was" (minimal summary)
  - ~2000 tokens "what I know" (structured KG context)
  - CLAUDE.md (reloaded from disk)
```

### Why not MCP?

MCP servers have well-documented problems:

- **Token bloat**: 5 MCP servers = ~55K tokens consumed before conversation starts
- **Tool poisoning**: malicious instructions hidden in tool descriptions
- **Latency**: p99 > 1000ms without connection pooling
- **Over-engineering**: an LLM calling an SDK directly uses 98.7% fewer tokens than MCP tool descriptions

Our approach uses hooks + CLI, consuming zero tokens when idle and minimal tokens at injection time.

## Data Model Changes

### Importance Tiers

Every fact in the KG gets an importance tier:

| Tier | Weight | Decay | Example |
|------|--------|-------|---------|
| `critical` | 1.0 | None (never decays) | "Storage: single .kg file, no DB" |
| `significant` | 0.6 | Half-life ~70 days | "resolver.rs: switched to Levenshtein" |
| `minor` | 0.3 | Half-life ~14 days | "renamed variable x to entity_name" |

### Relevance Score

Computed at query time, never stored:

```
relevance(fact) =
  if fact.superseded_by is Some → 0.0
  if fact.tier == Critical → 1.0 (no decay)
  else → tier_weight × e^(-λ × age_in_days)

where λ =
  significant: 0.01 (50% at 70 days)
  minor: 0.05 (50% at 14 days)
```

### Supersession

When a new decision contradicts an old one:

```
Old: "Entity resolution uses LCS" (critical)
New: "Entity resolution uses Levenshtein" (critical)

→ Old gets: superseded_by = new.id
→ New gets: supersedes = old.id, with reason
→ Old's relevance becomes 0.0
→ Old is NOT deleted (audit trail)
```

### Node additions to model.rs

```rust
enum ImportanceTier {
    Critical,     // weight 1.0, no decay
    Significant,  // weight 0.6, λ = 0.01
    Minor,        // weight 0.3, λ = 0.05
}

// Added fields to Node:
// tier: ImportanceTier
// superseded_by: Option<NodeId>
// last_referenced: DateTime (for future boost mechanics)
```

## New CLI Commands

### `autoclaw reconcile`

Reads JSON from stdin, reconciles with existing KG.

**Input format:**

```json
{
  "new_facts": [
    {
      "name": "Levenshtein decision",
      "type": "Decision",
      "tier": "critical",
      "definition": "Use Levenshtein distance for fuzzy matching",
      "reason": "LCS failed on names with common prefixes",
      "supersedes": "LCS decision",
      "relations": [
        {"target": "resolver.rs", "type": "implemented_in"},
        {"target": "LCS decision", "type": "supersedes"}
      ],
      "evidence": {
        "document": "session-abc-123",
        "text": "abbiamo deciso di usare Levenshtein..."
      }
    }
  ],
  "promotions": [
    {"name": "chunker overlap", "new_tier": "significant", "reason": "referenced 3 times"}
  ]
}
```

**Internal operations:**

1. Ingest new facts with tier and timestamp
2. For each `supersedes`: mark old fact as `superseded_by: new_id`
3. Apply promotions (tier changes)
4. Garbage collect: remove facts with `relevance < 0.05`
5. Save .kg

**Output:**

```json
{
  "added": 5,
  "superseded": 2,
  "promoted": 1,
  "gc_removed": 3,
  "errors": []
}
```

### `autoclaw context`

Produces text context for re-injection within a token budget.

```bash
autoclaw context --budget 2000 --focus "resolver.rs fuzzy matching"
```

**Budget allocation (3 tiers):**

```
Total: 2000 tokens

ALWAYS (max 500 tokens):
  Active critical decisions
  (architecture, project constraints)

CONTEXTUAL (max 1000 tokens):
  Facts connected to --focus query
  (neighbors of mentioned entities in KG)

RECENT (max 500 tokens):
  Latest significant decisions/errors
  (last 3-5 days by timestamp)
```

**Internal operations:**

1. Compute `relevance` for all non-superseded facts
2. Query neighbors of `--focus` entities
3. Fill budget tiers in order: ALWAYS → CONTEXTUAL → RECENT
4. Format as markdown sections
5. Truncate to budget, output to stdout

**Output example:**

```markdown
## Knowledge Graph Context

### Architecture (critical)
- Storage: single .kg file, MessagePack binary, no external DB
- Bindings: Rust core + PyO3 Python SDK
- Entity resolution: Levenshtein distance (replaced LCS — LCS failed on common prefixes)

### Current context: resolver.rs, fuzzy matching
- Threshold: 0.85 (< 0.8 causes false positives on short names)
- resolver.rs calls graph.rs for entity merge
- LCS approach tried and rejected (too many false matches on "Project X" vs "Project XY")

### Recent (last 3 days)
- chunker.rs: overlap set to 500 chars, sentence-aware splitting
- graph.rs: new explore() method added for entity + connections + evidence
```

## Extraction Prompt

The PreCompact subagent (Haiku) receives this prompt:

```
You are a knowledge extraction agent. You analyze coding conversation
transcripts and produce structured facts for a knowledge graph.

## Input
1. TRANSCRIPT: the complete conversation (parsed JSONL)
2. KG_EXISTING: facts already in the knowledge graph

## What to extract

### Decisions (type: Decision)
Every time an approach, technology, or pattern was chosen.
INCLUDE the reason for the choice AND alternatives that were rejected.
Tier: critical if architectural, significant if implementation, minor if stylistic.

### Technical Facts (type: TechnicalFact)
Dependencies between components, observed behaviors, discovered constraints.
INCLUDE how they were discovered (from which action/error).

### Error Resolutions (type: ErrorResolution)
Bugs found, root cause, solution applied, failed approaches.
INCLUDE why failed approaches didn't work.

### Implicit Relations
If during the conversation file A was read and then file B was modified
as a consequence, that's a relation (A -> affects -> B).
If an entity was mentioned in different contexts, connect the contexts.

## What NOT to extract
- Compilation/test output (only the result: pass/fail)
- Explorations with no result ("looked at X, nothing useful")
- Confirmations and acknowledgments
- User preferences or feedback on agent behavior (that's auto-memory's domain)

## Comparison with existing KG
For each extracted fact, check if it already exists in the KG:
- If it exists and is confirmed -> promote tier if appropriate
- If it exists and is contradicted -> mark as superseded, explain why
- If it's new -> add with appropriate tier

## Timeline
Order facts chronologically. For each fact indicate approximate position
in the conversation (start/middle/end).

## Output format
Produce valid JSON:
{
  "new_facts": [
    {
      "name": "string",
      "type": "Decision|TechnicalFact|ErrorResolution",
      "tier": "critical|significant|minor",
      "definition": "what this fact states",
      "reason": "why (for decisions: why chosen; for errors: root cause)",
      "supersedes": "name of old fact if contradicted, null otherwise",
      "relations": [{"target": "entity name", "type": "relation type", "evidence": "quote"}],
      "evidence": {"document": "session id", "text": "relevant quote"}
    }
  ],
  "promotions": [
    {"name": "existing fact name", "new_tier": "new tier", "reason": "why promoted"}
  ]
}
```

## Compact Instructions (CLAUDE.md addition)

```markdown
## Compact Instructions

Produce a minimal one-line summary: "[current task] + [last file touched] + [last action taken]".
All project context, decisions, architecture, and error history are provided
separately by the knowledge graph at session resumption. Do not duplicate them.
```

## Plugin Structure

```
autoclaw-plugin/
├── .claude-plugin/
│   └── plugin.json
├── hooks/
│   └── hooks.json              # PreCompact + SessionStart("compact")
├── skills/
│   ├── kg-query/SKILL.md       # On-demand KG queries
│   └── kg-ingest/SKILL.md      # Manual document ingestion
├── agents/
│   └── kg-analyst.md           # Deep graph analysis subagent
└── CLAUDE.md                   # Compact Instructions + KG usage guide
```

### hooks.json

```json
{
  "hooks": {
    "PreCompact": [
      {
        "hooks": [
          {
            "type": "agent",
            "model": "haiku",
            "prompt": "<extraction prompt above, with transcript_path and KG_EXISTING injected>",
            "allowedTools": ["Bash", "Read"],
            "timeout": 300000
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "matcher": "compact",
        "hooks": [
          {
            "type": "command",
            "command": "autoclaw context --budget 2000 --focus \"$(cat /tmp/autoclaw-last-summary.txt 2>/dev/null || echo '')\" --project $CWD"
          }
        ]
      }
    ]
  }
}
```

## Auto Memory vs KG — Separation of Concerns

| | Auto Memory | Knowledge Graph |
|---|---|---|
| **Format** | Narrative markdown notes | Structured entities + relations |
| **Scope** | User preferences, feedback, collaboration style | Project facts, decisions, architecture |
| **Written** | Claude decides autonomously | At PreCompact, structured extraction |
| **Read** | Always (first 200 lines at boot) | At SessionStart post-compact + on-demand |
| **Example** | "User prefers short responses" | "resolver.rs uses Levenshtein (replaces LCS)" |

Rule: the extraction prompt explicitly excludes user preferences and behavioral feedback — those remain auto-memory's domain.

## Implementation Order

1. **Model changes**: Add ImportanceTier, superseded_by, last_referenced to Node in model.rs
2. **`autoclaw reconcile` CLI**: New command, ingest + invalidate + promote + GC
3. **`autoclaw context` CLI**: New command, relevance scoring + budget allocation + markdown output
4. **Extraction prompt**: Write and test with real transcripts
5. **Plugin packaging**: hooks.json, skills, agents, CLAUDE.md
6. **Testing**: Run on autoclaw's own conversations, validate extraction quality

## Success Criteria

- Post-compact context contains structured facts, not just narrative
- Decisions from 5+ sessions ago are still accessible if critical
- Superseded decisions are explicitly marked with reason
- Token budget for re-injection stays under 2000 tokens
- No regression in Claude Code's normal behavior (compaction still works)
- KG grows meaningfully across sessions without unbounded bloat

## Open Questions

- Exact λ values for decay need calibration with real usage
- Should `autoclaw context` also consider the current git branch/diff for relevance?
- How to handle the focus string extraction from the minimal summary (regex? first line?)
- Should GC archive facts to cold storage or delete permanently?
- Budget allocation ratios (500/1000/500) may need tuning
