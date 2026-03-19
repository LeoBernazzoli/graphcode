# Graphocode Plugin Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Autoclaw into a Claude Code plugin that replaces lossy conversation compression with a persistent knowledge graph — with zero-recall automatic context injection and pre-edit impact analysis.

**Architecture:** Dual ingestion (tree-sitter deterministic for code, Haiku LLM for conversation semantics). 9 Claude Code hooks inject context automatically at every step. Context monitor takes over compaction lifecycle.

**Tech Stack:** Rust (core engine + CLI), tree-sitter (code AST parsing via Python bindings), PyO3 (Python SDK), Claude Code hooks/skills/agents

---

## Current State

The Autoclaw project has a working knowledge graph engine with:
- **Data model**: Node, Edge, Evidence, Ontology, Source enum (Document/Memory/Inferred)
- **Graph operations**: add_node, add_edge, lookup, neighbors, path, explore, ingest
- **CLI**: stats, topics, explore, connect, recent, export
- **Python SDK**: Full PyO3 bindings for all graph operations + Claude conversation parsing
- **Storage**: MessagePack binary .kg format with atomic writes
- **Entity resolution**: LCS fuzzy matching with threshold
- **Claude parser**: JSONL conversation parser with substantive text extraction

**What does NOT exist yet:**
- ImportanceTier, supersession, relevance scoring
- Tree-sitter integration (not even in Cargo.toml)
- Any of the new CLI commands (monitor, reconcile, context, impact, reindex, relevant, file-context, snapshot, tick, impact-from-diff, bootstrap)
- Plugin structure (.claude-plugin/, hooks, skills, agents)
- Transcript usage field parsing (for context monitoring)
- Heuristic extraction (regex patterns)
- graphocode.toml config
- `autoCompactEnabled: false` in `~/.claude.json` (CRITICAL: we take over the compaction lifecycle)

## File Structure

### Files to create:
- `src/tier.rs` — ImportanceTier enum, relevance scoring, decay logic
- `src/treesitter.rs` — Tree-sitter code parsing, entity extraction from AST
- `src/monitor.rs` — Transcript JSONL usage parsing, context threshold checking
- `src/snapshot.rs` — Heuristic regex extraction from conversation text
- `src/reconcile.rs` — Ingestion reconciliation: supersession, promotion, GC
- `src/impact.rs` — Impact analysis: reference traversal, breaking change detection
- `src/context.rs` — Context generation: relevance ranking, markdown formatting
- `src/relevant.rs` — Keyword extraction, KG search for relevant facts
- `src/tick.rs` — Combined monitor + periodic snapshot for PostToolUse
- `src/config.rs` — graphocode.toml parsing
- `src/bootstrap.rs` — Full project indexing orchestration (code + conversations + documents)
- `graphocode.toml` — Default config template
- `autoclaw-plugin/.claude-plugin/plugin.json` — Plugin manifest
- `autoclaw-plugin/hooks/hooks.json` — All 9 hooks
- `autoclaw-plugin/skills/graphocode-start/SKILL.md`
- `autoclaw-plugin/skills/graphocode-query/SKILL.md`
- `autoclaw-plugin/skills/graphocode-impact/SKILL.md`
- `autoclaw-plugin/skills/graphocode-decide/SKILL.md`
- `autoclaw-plugin/agents/kg-extractor.md`
- `autoclaw-plugin/scripts/extract-and-compact.sh`
- `autoclaw-plugin/CLAUDE.md`

### Files to modify:
- `src/model.rs` — Add ImportanceTier, superseded_by, tier, last_referenced, new Source variants
- `src/graph.rs` — Add methods for relevance queries, code entity management, file-scoped queries
- `src/main.rs` — Add all new CLI subcommands
- `src/python.rs` — Expose new functionality to Python SDK
- `src/lib.rs` — Register new modules
- `src/storage.rs` — Handle new fields in serialization (backward compatible)
- `Cargo.toml` — Add tree-sitter, regex, toml dependencies
- `pyproject.toml` — Update if needed

---

## Chunk 1: Data Model Foundation

### Task 1: Add ImportanceTier enum and Node extensions

**Files:**
- Modify: `src/model.rs`
- Modify: `src/lib.rs`
- Create: `src/tier.rs`

- [ ] **Step 1: Write failing tests for ImportanceTier**

In `src/tier.rs`:
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tier_weights() {
        assert_eq!(ImportanceTier::Critical.weight(), 1.0);
        assert_eq!(ImportanceTier::Significant.weight(), 0.6);
        assert_eq!(ImportanceTier::Minor.weight(), 0.3);
    }

    #[test]
    fn test_relevance_critical_no_decay() {
        let now = 1000 * 86400; // day 1000
        let created = 0;        // day 0
        let r = relevance(ImportanceTier::Critical, created, now, false, false);
        assert_eq!(r, 1.0); // critical never decays
    }

    #[test]
    fn test_relevance_significant_decays() {
        let now = 70 * 86400; // 70 days later
        let created = 0;
        let r = relevance(ImportanceTier::Significant, created, now, false, false);
        // 0.6 * e^(-0.01 * 70) = 0.6 * 0.4966 ≈ 0.298
        assert!(r > 0.28 && r < 0.31);
    }

    #[test]
    fn test_relevance_minor_decays_fast() {
        let now = 14 * 86400; // 14 days later
        let created = 0;
        let r = relevance(ImportanceTier::Minor, created, now, false, false);
        // 0.3 * e^(-0.05 * 14) = 0.3 * 0.4966 ≈ 0.149
        assert!(r > 0.14 && r < 0.16);
    }

    #[test]
    fn test_relevance_superseded_is_zero() {
        let r = relevance(ImportanceTier::Critical, 0, 100 * 86400, true, false);
        assert_eq!(r, 0.0);
    }

    #[test]
    fn test_relevance_code_entity_no_decay() {
        // Code entities never decay — they are refreshed by tree-sitter
        let now = 365 * 86400; // 1 year later
        let r = relevance(ImportanceTier::Minor, 0, now, false, true);
        assert_eq!(r, 0.3); // Minor weight, no decay
    }

    #[test]
    fn test_tier_serialization() {
        let tier = ImportanceTier::Significant;
        let json = serde_json::to_string(&tier).unwrap();
        let back: ImportanceTier = serde_json::from_str(&json).unwrap();
        assert_eq!(back, tier);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cargo test --lib tier`
Expected: FAIL — module doesn't exist

- [ ] **Step 3: Implement ImportanceTier and relevance scoring**

In `src/tier.rs`:
```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ImportanceTier {
    Critical,
    Significant,
    Minor,
}

impl ImportanceTier {
    pub fn weight(&self) -> f64 {
        match self {
            ImportanceTier::Critical => 1.0,
            ImportanceTier::Significant => 0.6,
            ImportanceTier::Minor => 0.3,
        }
    }
}

impl Default for ImportanceTier {
    fn default() -> Self {
        ImportanceTier::Minor
    }
}

/// Calculate relevance score for a node.
/// `created_at` and `now` are Unix timestamps in seconds.
/// `superseded` — if true, relevance is 0.
/// `is_code_entity` — if true, no decay (code entities are refreshed on file change).
pub fn relevance(tier: ImportanceTier, created_at: u64, now: u64, superseded: bool, is_code_entity: bool) -> f64 {
    if superseded {
        return 0.0;
    }

    // Code entities never decay — they are refreshed by tree-sitter on every file change
    if is_code_entity {
        return tier.weight();
    }

    let age_days = (now.saturating_sub(created_at)) as f64 / 86400.0;

    match tier {
        ImportanceTier::Critical => 1.0,
        ImportanceTier::Significant => {
            0.6 * (-0.01 * age_days).exp()
        }
        ImportanceTier::Minor => {
            0.3 * (-0.05 * age_days).exp()
        }
    }
}
```

- [ ] **Step 4: Register module in lib.rs**

Add to `src/lib.rs`:
```rust
pub mod tier;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cargo test --lib tier`
Expected: All 6 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/tier.rs src/lib.rs
git commit -m "feat: add ImportanceTier enum with relevance scoring and decay"
```

### Task 2: Extend Node with tier, supersession, and new Source variants

**Files:**
- Modify: `src/model.rs`
- Modify: `src/storage.rs`

- [ ] **Step 1: Write failing tests for extended Node**

Add to `src/model.rs` tests:
```rust
#[test]
fn test_node_with_tier() {
    let node = Node {
        id: 1,
        name: "test".to_string(),
        node_type: "Decision".to_string(),
        definition: "test decision".to_string(),
        properties: HashMap::new(),
        aliases: vec![],
        confidence: 0.9,
        source: Source::Conversation,
        created_at: 0,
        evidence: vec![],
        tier: ImportanceTier::Critical,
        superseded_by: None,
        last_referenced: 0,
    };
    assert_eq!(node.tier, ImportanceTier::Critical);
    assert!(node.superseded_by.is_none());
}

#[test]
fn test_source_code_analysis() {
    let source = Source::CodeAnalysis { file: "src/main.rs".to_string() };
    match &source {
        Source::CodeAnalysis { file } => assert_eq!(file, "src/main.rs"),
        _ => panic!("wrong variant"),
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cargo test --lib model::tests`
Expected: FAIL — fields don't exist

- [ ] **Step 3: Update Source enum with new variants**

In `src/model.rs`, change Source:
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Source {
    Document { name: String, page: Option<u32> },
    Memory,
    Inferred,
    CodeAnalysis { file: String },
    Conversation,
}
```

- [ ] **Step 4: Add new fields to Node struct**

In `src/model.rs`, add to Node struct:
```rust
pub tier: ImportanceTier,
pub superseded_by: Option<NodeId>,
pub last_referenced: Timestamp,
```

Update `Node::new()` to accept and set tier (default Minor), superseded_by (None), last_referenced (same as created_at).

- [ ] **Step 5: Fix all compilation errors**

The new fields in Node will break every place that constructs a Node. Fix:
- `src/graph.rs` — ingest() creates Nodes, add default tier/superseded_by/last_referenced
- `src/model.rs` — Node::new() updated
- Test code throughout

Use `#[serde(default)]` on new fields for backward compatibility with existing .kg files:
```rust
#[serde(default)]
pub tier: ImportanceTier,
#[serde(default)]
pub superseded_by: Option<NodeId>,
#[serde(default)]
pub last_referenced: Timestamp,
```

- [ ] **Step 6: Run all tests**

Run: `cargo test`
Expected: ALL tests PASS (backward compatible)

- [ ] **Step 7: Test .kg file backward compatibility**

Add test in `src/storage.rs`:
```rust
#[test]
fn test_load_legacy_kg_without_tier() {
    // Create a KG, save it, then verify it loads correctly
    // with default tier values
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("test.kg");
    let mut kg = KnowledgeGraph::new();
    let node = Node::new(1, "test".into(), "Entity".into(), "def".into(), 0.9, Source::Memory);
    kg.add_node(node).unwrap();
    save(&kg, &path).unwrap();
    let loaded = load(&path).unwrap();
    let n = loaded.get_node(1).unwrap();
    assert_eq!(n.tier, ImportanceTier::Minor); // default
    assert!(n.superseded_by.is_none());
}
```

- [ ] **Step 8: Run storage tests**

Run: `cargo test --lib storage`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/model.rs src/graph.rs src/storage.rs
git commit -m "feat: extend Node with ImportanceTier, supersession, and new Source variants"
```

---

## Chunk 2: Context Generation & Relevance Queries

### Task 3: Implement `autoclaw context` — relevance-ranked context output

**Files:**
- Create: `src/context.rs`
- Modify: `src/main.rs`
- Modify: `src/lib.rs`

- [ ] **Step 1: Write failing tests for context generation**

In `src/context.rs`:
```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::*;
    use crate::graph::KnowledgeGraph;
    use crate::tier::ImportanceTier;

    fn make_test_kg() -> KnowledgeGraph {
        let mut kg = KnowledgeGraph::new();
        // Critical decision
        let mut n1 = Node::new(1, "Storage decision".into(), "Decision".into(),
            "Use .kg file, no database".into(), 0.95, Source::Conversation);
        n1.tier = ImportanceTier::Critical;
        kg.add_node(n1).unwrap();

        // Significant fact
        let mut n2 = Node::new(2, "Levenshtein choice".into(), "Decision".into(),
            "Use Levenshtein instead of LCS".into(), 0.9, Source::Conversation);
        n2.tier = ImportanceTier::Significant;
        kg.add_node(n2).unwrap();

        // Minor fact
        let mut n3 = Node::new(3, "variable rename".into(), "TechnicalFact".into(),
            "Renamed x to count".into(), 0.5, Source::Conversation);
        n3.tier = ImportanceTier::Minor;
        n3.created_at = 0; // old
        kg.add_node(n3).unwrap();

        kg
    }

    #[test]
    fn test_context_includes_critical_first() {
        let kg = make_test_kg();
        let now = 100 * 86400;
        let output = generate_context(&kg, 2000, now);
        assert!(output.contains("Storage decision"));
        // Critical should appear before Significant
        let crit_pos = output.find("Storage decision").unwrap();
        let sig_pos = output.find("Levenshtein choice").unwrap();
        assert!(crit_pos < sig_pos);
    }

    #[test]
    fn test_context_respects_budget() {
        let kg = make_test_kg();
        let output = generate_context(&kg, 50, 100 * 86400);
        // Should be truncated
        assert!(output.len() < 300); // rough char budget for 50 tokens
    }

    #[test]
    fn test_context_excludes_superseded() {
        let mut kg = make_test_kg();
        // Supersede node 2
        if let Some(n) = kg.get_node_mut(2) {
            n.superseded_by = Some(99);
        }
        let output = generate_context(&kg, 2000, 100 * 86400);
        assert!(!output.contains("Levenshtein choice"));
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cargo test --lib context`
Expected: FAIL — module doesn't exist

- [ ] **Step 3: Implement context generation**

In `src/context.rs`:
```rust
use crate::graph::KnowledgeGraph;
use crate::tier::{relevance, ImportanceTier};
use crate::model::NodeId;

/// Generate markdown context for re-injection, ranked by relevance.
/// `budget` is approximate token count (~4 chars per token).
pub fn generate_context(kg: &KnowledgeGraph, budget: usize, now: u64) -> String {
    let char_budget = budget * 4;

    // Collect all nodes with relevance > 0
    let mut scored: Vec<(NodeId, f64, &str, &str, &str)> = Vec::new();
    for node in kg.all_nodes() {
        let superseded = node.superseded_by.is_some();
        let r = relevance(node.tier, node.created_at, now, superseded);
        if r > 0.01 {
            scored.push((node.id, r, &node.name, &node.definition, &node.node_type));
        }
    }

    scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

    let mut output = String::from("## Knowledge Graph Context\n\n");
    let mut current_tier: Option<ImportanceTier> = None;
    let mut total_chars = output.len();

    for (id, rel, name, definition, node_type) in &scored {
        // Determine tier from relevance
        let tier = if *rel >= 0.99 {
            ImportanceTier::Critical
        } else if *rel >= 0.3 {
            ImportanceTier::Significant
        } else {
            ImportanceTier::Minor
        };

        // Add tier header if changed
        if current_tier != Some(tier) {
            let header = match tier {
                ImportanceTier::Critical => "\n### Critical\n",
                ImportanceTier::Significant => "\n### Significant\n",
                ImportanceTier::Minor => "\n### Minor\n",
            };
            if total_chars + header.len() > char_budget { break; }
            output.push_str(header);
            total_chars += header.len();
            current_tier = Some(tier);
        }

        let line = format!("- **{}** ({}): {}\n", name, node_type, definition);
        if total_chars + line.len() > char_budget { break; }
        output.push_str(&line);
        total_chars += line.len();
    }

    output
}
```

Note: `kg.all_nodes()` and `kg.get_node_mut()` may need to be added to `src/graph.rs`. Add:
```rust
pub fn all_nodes(&self) -> impl Iterator<Item = &Node> {
    self.nodes.values()
}
pub fn get_node_mut(&mut self, id: NodeId) -> Option<&mut Node> {
    self.nodes.get_mut(&id)
}
```

- [ ] **Step 4: Register module and add CLI subcommand**

Add to `src/lib.rs`:
```rust
pub mod context;
```

Add to `src/main.rs` the `context` subcommand:
```rust
"context" => {
    let budget: usize = args.get(2).and_then(|s| s.parse().ok()).unwrap_or(2000);
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH).unwrap().as_secs();
    let output = autoclaw::context::generate_context(&kg, budget, now);
    print!("{}", output);
}
```

- [ ] **Step 5: Run tests**

Run: `cargo test --lib context`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/context.rs src/graph.rs src/main.rs src/lib.rs
git commit -m "feat: add context generation with relevance ranking and budget"
```

### Task 4: Implement `autoclaw relevant` — query-based KG search

**Files:**
- Create: `src/relevant.rs`
- Modify: `src/main.rs`
- Modify: `src/lib.rs`

- [ ] **Step 1: Write failing tests for relevance search**

In `src/relevant.rs`:
```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::*;
    use crate::graph::KnowledgeGraph;
    use crate::tier::ImportanceTier;

    fn make_kg() -> KnowledgeGraph {
        let mut kg = KnowledgeGraph::new();
        let mut n1 = Node::new(1, "chunker.rs".into(), "File".into(),
            "Text chunking module".into(), 1.0, Source::CodeAnalysis { file: "src/chunker.rs".into() });
        n1.tier = ImportanceTier::Minor;
        kg.add_node(n1).unwrap();

        let mut n2 = Node::new(2, "sentence-aware splitting".into(), "Decision".into(),
            "Use sentence boundaries for chunking".into(), 0.9, Source::Conversation);
        n2.tier = ImportanceTier::Significant;
        kg.add_node(n2).unwrap();

        let mut n3 = Node::new(3, "resolver.rs".into(), "File".into(),
            "Entity resolution module".into(), 1.0, Source::CodeAnalysis { file: "src/resolver.rs".into() });
        n3.tier = ImportanceTier::Minor;
        kg.add_node(n3).unwrap();

        kg
    }

    #[test]
    fn test_relevant_finds_by_keyword() {
        let kg = make_kg();
        let result = find_relevant(&kg, "chunker splitting", 500);
        assert!(result.contains("chunker.rs"));
        assert!(result.contains("sentence-aware"));
    }

    #[test]
    fn test_relevant_no_match() {
        let kg = make_kg();
        let result = find_relevant(&kg, "database migration", 500);
        assert!(result.is_empty() || result.contains("No relevant"));
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cargo test --lib relevant`
Expected: FAIL

- [ ] **Step 3: Implement keyword-based KG search**

In `src/relevant.rs`:
```rust
use crate::graph::KnowledgeGraph;

/// Find KG facts relevant to a text query.
/// Extracts keywords, matches against entity names and definitions.
pub fn find_relevant(kg: &KnowledgeGraph, query: &str, budget: usize) -> String {
    let char_budget = budget * 4;
    let keywords: Vec<&str> = query.split_whitespace()
        .filter(|w| w.len() > 2)
        .collect();

    if keywords.is_empty() {
        return String::new();
    }

    // Score each node by keyword matches in name + definition
    let mut matches: Vec<(f64, &str, &str, &str)> = Vec::new();
    for node in kg.all_nodes() {
        let name_lower = node.name.to_lowercase();
        let def_lower = node.definition.to_lowercase();
        let mut score = 0.0;
        for kw in &keywords {
            let kw_lower = kw.to_lowercase();
            if name_lower.contains(&kw_lower) { score += 2.0; }
            if def_lower.contains(&kw_lower) { score += 1.0; }
        }
        if score > 0.0 {
            matches.push((score, &node.name, &node.node_type, &node.definition));
        }
    }

    if matches.is_empty() {
        return String::new();
    }

    matches.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));

    let mut output = String::new();
    let mut total = 0;
    for (_, name, ntype, def) in matches {
        let line = format!("- **{}** ({}): {}\n", name, ntype, def);
        if total + line.len() > char_budget { break; }
        output.push_str(&line);
        total += line.len();
    }
    output
}
```

- [ ] **Step 4: Add CLI subcommand and register module**

- [ ] **Step 5: Run tests**

Run: `cargo test --lib relevant`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/relevant.rs src/main.rs src/lib.rs
git commit -m "feat: add relevant query search for KG context injection"
```

### Task 5: Implement `autoclaw file-context` — file-specific KG knowledge

**Files:**
- Create: `src/file_context.rs`
- Modify: `src/main.rs`
- Modify: `src/lib.rs`

- [ ] **Step 1: Write failing tests**

In `src/file_context.rs`:
```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::*;
    use crate::graph::KnowledgeGraph;
    use crate::tier::ImportanceTier;

    #[test]
    fn test_file_context_finds_entities() {
        let mut kg = KnowledgeGraph::new();
        let n1 = Node::new(1, "chunk_text".into(), "Function".into(),
            "Main chunking function".into(), 1.0,
            Source::CodeAnalysis { file: "src/chunker.rs".into() });
        kg.add_node(n1).unwrap();

        let n2 = Node::new(2, "split_sentences".into(), "Function".into(),
            "Helper for sentence splitting".into(), 1.0,
            Source::CodeAnalysis { file: "src/chunker.rs".into() });
        kg.add_node(n2).unwrap();

        let n3 = Node::new(3, "resolve".into(), "Function".into(),
            "Entity resolver".into(), 1.0,
            Source::CodeAnalysis { file: "src/resolver.rs".into() });
        kg.add_node(n3).unwrap();

        let output = file_context(&kg, "src/chunker.rs", 300);
        assert!(output.contains("chunk_text"));
        assert!(output.contains("split_sentences"));
        assert!(!output.contains("resolve")); // different file
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cargo test --lib file_context`
Expected: FAIL

- [ ] **Step 3: Implement file context lookup**

In `src/file_context.rs`:
```rust
use crate::graph::KnowledgeGraph;
use crate::model::Source;

/// Return what the KG knows about entities in a specific file.
pub fn file_context(kg: &KnowledgeGraph, file_path: &str, budget: usize) -> String {
    let char_budget = budget * 4;
    let mut output = String::new();
    let mut total = 0;

    // Find code entities from this file
    for node in kg.all_nodes() {
        if let Source::CodeAnalysis { ref file } = node.source {
            if file == file_path || file_path.ends_with(file) || file.ends_with(file_path) {
                let line = format!("- **{}** ({}): {}\n", node.name, node.node_type, node.definition);
                if total + line.len() > char_budget { break; }
                output.push_str(&line);
                total += line.len();
            }
        }
    }

    // Find semantic facts related to entities in this file
    // (Decisions, Errors mentioning the file name)
    let file_stem = std::path::Path::new(file_path)
        .file_name()
        .and_then(|f| f.to_str())
        .unwrap_or(file_path);

    for node in kg.all_nodes() {
        match &node.source {
            Source::Conversation | Source::Document { .. } => {
                if node.name.contains(file_stem) || node.definition.contains(file_stem) {
                    let line = format!("- **{}** ({}): {}\n", node.name, node.node_type, node.definition);
                    if total + line.len() > char_budget { break; }
                    output.push_str(&line);
                    total += line.len();
                }
            }
            _ => {}
        }
    }

    output
}
```

- [ ] **Step 4: Register module, add CLI subcommand**

- [ ] **Step 5: Run tests**

Run: `cargo test --lib file_context`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/file_context.rs src/main.rs src/lib.rs
git commit -m "feat: add file-context command for file-specific KG knowledge"
```

---

## Chunk 3: Transcript Monitor & Heuristic Extraction

### Task 6: Implement `autoclaw monitor` — transcript usage parsing

**Files:**
- Create: `src/monitor.rs`
- Modify: `src/main.rs`
- Modify: `src/lib.rs`

- [ ] **Step 1: Write failing tests**

In `src/monitor.rs`:
```rust
#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn test_parse_usage_from_jsonl() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("session.jsonl");
        let mut f = std::fs::File::create(&path).unwrap();
        // Write a user message (no usage)
        writeln!(f, r#"{{"type":"user","message":{{"role":"user","content":"hello"}}}}"#).unwrap();
        // Write an assistant message with usage
        writeln!(f, r#"{{"type":"assistant","message":{{"role":"assistant","content":"hi","usage":{{"input_tokens":5000,"cache_creation_input_tokens":2000,"cache_read_input_tokens":1000,"output_tokens":500}}}}}}"#).unwrap();

        let result = check_context_usage(&path, 85, 200000).unwrap();
        // total = 5000 + 2000 + 1000 = 8000
        // pct = 8000 / 200000 * 100 = 4%
        assert_eq!(result.used_tokens, 8000);
        assert_eq!(result.used_pct, 4);
        assert!(!result.should_extract);
    }

    #[test]
    fn test_threshold_exceeded() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("session.jsonl");
        let mut f = std::fs::File::create(&path).unwrap();
        writeln!(f, r#"{{"type":"assistant","message":{{"role":"assistant","content":"x","usage":{{"input_tokens":170000,"cache_creation_input_tokens":5000,"cache_read_input_tokens":3000,"output_tokens":1000}}}}}}"#).unwrap();

        let result = check_context_usage(&path, 85, 200000).unwrap();
        // total = 170000 + 5000 + 3000 = 178000
        // pct = 178000 / 200000 * 100 = 89%
        assert_eq!(result.used_pct, 89);
        assert!(result.should_extract);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cargo test --lib monitor`
Expected: FAIL

- [ ] **Step 3: Implement transcript usage parser**

In `src/monitor.rs`:
```rust
use serde_json::Value;
use std::path::Path;
use std::io::{BufRead, BufReader};

pub struct UsageResult {
    pub used_tokens: u64,
    pub used_pct: u64,
    pub window_size: u64,
    pub should_extract: bool,
}

/// Read the last assistant message from a JSONL transcript and check context usage.
pub fn check_context_usage(transcript_path: &Path, threshold: u64, window_size: u64) -> Result<UsageResult, String> {
    let file = std::fs::File::open(transcript_path)
        .map_err(|e| format!("Cannot open transcript: {}", e))?;
    let reader = BufReader::new(file);

    let mut last_usage: Option<(u64, u64, u64)> = None;

    for line in reader.lines() {
        let line = line.map_err(|e| format!("Read error: {}", e))?;
        if line.trim().is_empty() { continue; }

        let v: Value = serde_json::from_str(&line)
            .map_err(|e| format!("JSON parse error: {}", e))?;

        if v.get("type").and_then(|t| t.as_str()) == Some("assistant") {
            if let Some(usage) = v.pointer("/message/usage") {
                let input = usage.get("input_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
                let cache_create = usage.get("cache_creation_input_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
                let cache_read = usage.get("cache_read_input_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
                last_usage = Some((input, cache_create, cache_read));
            }
        }
    }

    let (input, cache_create, cache_read) = last_usage
        .ok_or_else(|| "No assistant message with usage found".to_string())?;

    let used = input + cache_create + cache_read;
    let pct = (used * 100) / window_size;

    Ok(UsageResult {
        used_tokens: used,
        used_pct: pct,
        window_size,
        should_extract: pct >= threshold,
    })
}
```

- [ ] **Step 4: Add CLI subcommand**

```rust
"monitor" => {
    let transcript = args.get(2).expect("Usage: autoclaw monitor <transcript_path>");
    let threshold = args.iter().position(|a| a == "--threshold")
        .and_then(|i| args.get(i + 1))
        .and_then(|s| s.parse().ok())
        .unwrap_or(85u64);
    let window = args.iter().position(|a| a == "--window")
        .and_then(|i| args.get(i + 1))
        .and_then(|s| s.parse().ok())
        .unwrap_or(200000u64);

    match autoclaw::monitor::check_context_usage(Path::new(transcript), threshold, window) {
        Ok(result) => {
            println!(r#"{{"used_pct":{},"used_tokens":{},"window_size":{},"should_extract":{}}}"#,
                result.used_pct, result.used_tokens, result.window_size, result.should_extract);
            if result.should_extract {
                std::process::exit(1);
            }
        }
        Err(e) => {
            eprintln!("Monitor error: {}", e);
            std::process::exit(0); // Don't block on error
        }
    }
}
```

- [ ] **Step 5: Run tests**

Run: `cargo test --lib monitor`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/monitor.rs src/main.rs src/lib.rs
git commit -m "feat: add transcript monitor for context usage tracking"
```

### Task 7: Implement `autoclaw snapshot` — heuristic extraction

**Files:**
- Create: `src/snapshot.rs`
- Modify: `src/main.rs`
- Modify: `src/lib.rs`
- Modify: `Cargo.toml` (add regex)

- [ ] **Step 1: Add regex dependency**

In `Cargo.toml`:
```toml
regex = "1"
```

- [ ] **Step 2: Write failing tests for pattern extraction**

In `src/snapshot.rs`:
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_decision() {
        let text = "[User] let's use Levenshtein instead of LCS\n[Assistant] Good choice, switching to Levenshtein.";
        let facts = extract_heuristic(text);
        assert!(!facts.is_empty());
        assert!(facts.iter().any(|f| f.fact_type == FactType::Decision));
        assert!(facts.iter().any(|f| f.text.contains("Levenshtein")));
    }

    #[test]
    fn test_extract_error() {
        let text = "[Assistant] The bug is caused by threshold being too low, causing false positives.";
        let facts = extract_heuristic(text);
        assert!(facts.iter().any(|f| f.fact_type == FactType::Error));
    }

    #[test]
    fn test_extract_supersession() {
        let text = "[User] instead of LCS we'll use Levenshtein";
        let facts = extract_heuristic(text);
        assert!(facts.iter().any(|f| f.fact_type == FactType::Supersession));
    }

    #[test]
    fn test_no_extraction_from_noise() {
        let text = "[Assistant] Done. Let me know if you need anything else.";
        let facts = extract_heuristic(text);
        assert!(facts.is_empty());
    }
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cargo test --lib snapshot`
Expected: FAIL

- [ ] **Step 4: Implement heuristic extraction**

In `src/snapshot.rs`:
```rust
use regex::Regex;

#[derive(Debug, PartialEq)]
pub enum FactType {
    Decision,
    Error,
    Relation,
    Supersession,
}

#[derive(Debug)]
pub struct ExtractedFact {
    pub fact_type: FactType,
    pub text: String,
}

/// Extract facts from conversation text using regex patterns.
/// No LLM needed — pure Rust, milliseconds.
pub fn extract_heuristic(text: &str) -> Vec<ExtractedFact> {
    let mut facts = Vec::new();

    let decision_patterns = [
        r"(?i)(?:we |let's |I'll |I )?(?:decided?|chose?|use|switch(?:ed|ing)? to|go(?:ing)? with)\s+(.{5,80})",
        r"(?i)the approach is\s+(.{5,80})",
    ];

    let error_patterns = [
        r"(?i)(?:the )?bug (?:is|was) (?:caused by|in|due to)\s+(.{5,80})",
        r"(?i)doesn't work because\s+(.{5,80})",
        r"(?i)(?:the )?(?:fix|solution) (?:is|was)\s+(.{5,80})",
    ];

    let supersession_patterns = [
        r"(?i)instead of\s+(\S+(?:\s+\S+){0,3})\s+(?:we'll |let's )?use\s+(.{3,40})",
        r"(?i)replac(?:e|ing)\s+(\S+(?:\s+\S+){0,3})\s+with\s+(.{3,40})",
    ];

    for pattern in &decision_patterns {
        let re = Regex::new(pattern).unwrap();
        for cap in re.captures_iter(text) {
            facts.push(ExtractedFact {
                fact_type: FactType::Decision,
                text: cap[0].trim().to_string(),
            });
        }
    }

    for pattern in &error_patterns {
        let re = Regex::new(pattern).unwrap();
        for cap in re.captures_iter(text) {
            facts.push(ExtractedFact {
                fact_type: FactType::Error,
                text: cap[0].trim().to_string(),
            });
        }
    }

    for pattern in &supersession_patterns {
        let re = Regex::new(pattern).unwrap();
        for cap in re.captures_iter(text) {
            facts.push(ExtractedFact {
                fact_type: FactType::Supersession,
                text: cap[0].trim().to_string(),
            });
        }
    }

    facts
}
```

- [ ] **Step 5: Add snapshot CLI command that reads transcript and extracts**

Wire up `autoclaw snapshot <transcript_path>` to:
1. Parse JSONL using claude_parser
2. Extract text from recent messages
3. Run `extract_heuristic`
4. Ingest results into KG
5. Save

- [ ] **Step 6: Run tests**

Run: `cargo test --lib snapshot`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/snapshot.rs src/main.rs src/lib.rs Cargo.toml
git commit -m "feat: add heuristic snapshot extraction with regex patterns"
```

### Task 7b: Implement `autoclaw tick` — combined monitor + periodic snapshot

**Files:**
- Create: `src/tick.rs`
- Modify: `src/main.rs`
- Modify: `src/lib.rs`

This is the most frequently called command — runs on EVERY PostToolUse. Must be fast.

- [ ] **Step 1: Write failing tests**

In `src/tick.rs`:
```rust
#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn test_tick_no_action_below_threshold() {
        let dir = tempfile::tempdir().unwrap();
        let transcript = dir.path().join("session.jsonl");
        let counter_file = dir.path().join(".tick_counter");
        let mut f = std::fs::File::create(&transcript).unwrap();
        writeln!(f, r#"{{"type":"assistant","message":{{"role":"assistant","content":"x","usage":{{"input_tokens":5000,"cache_creation_input_tokens":0,"cache_read_input_tokens":0,"output_tokens":100}}}}}}"#).unwrap();

        let result = tick(&transcript, &counter_file, 20, 85, 200000);
        assert_eq!(result.action, TickAction::None);
        assert_eq!(result.counter, 1);
    }

    #[test]
    fn test_tick_triggers_snapshot_at_interval() {
        let dir = tempfile::tempdir().unwrap();
        let transcript = dir.path().join("session.jsonl");
        let counter_file = dir.path().join(".tick_counter");
        let mut f = std::fs::File::create(&transcript).unwrap();
        writeln!(f, r#"{{"type":"assistant","message":{{"role":"assistant","content":"x","usage":{{"input_tokens":5000,"cache_creation_input_tokens":0,"cache_read_input_tokens":0,"output_tokens":100}}}}}}"#).unwrap();

        // Simulate 19 previous ticks
        std::fs::write(&counter_file, "19").unwrap();

        let result = tick(&transcript, &counter_file, 20, 85, 200000);
        assert_eq!(result.action, TickAction::Snapshot);
        // Counter should reset to 0
        assert_eq!(result.counter, 0);
    }

    #[test]
    fn test_tick_triggers_extract_at_threshold() {
        let dir = tempfile::tempdir().unwrap();
        let transcript = dir.path().join("session.jsonl");
        let counter_file = dir.path().join(".tick_counter");
        let mut f = std::fs::File::create(&transcript).unwrap();
        writeln!(f, r#"{{"type":"assistant","message":{{"role":"assistant","content":"x","usage":{{"input_tokens":170000,"cache_creation_input_tokens":5000,"cache_read_input_tokens":3000,"output_tokens":1000}}}}}}"#).unwrap();

        let result = tick(&transcript, &counter_file, 20, 85, 200000);
        // 178000/200000 = 89% >= 85%
        assert_eq!(result.action, TickAction::Extract);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cargo test --lib tick`
Expected: FAIL

- [ ] **Step 3: Implement tick**

In `src/tick.rs`:
```rust
use std::path::Path;
use crate::monitor::check_context_usage;

#[derive(Debug, PartialEq)]
pub enum TickAction {
    None,       // Under threshold, not at snapshot interval
    Snapshot,   // Time for a lightweight heuristic snapshot
    Extract,    // Context threshold reached — deep extraction needed
}

pub struct TickResult {
    pub action: TickAction,
    pub counter: u64,
    pub used_pct: u64,
}

/// Combined monitor + periodic snapshot. Called on every PostToolUse.
/// Returns what action should be taken.
pub fn tick(
    transcript_path: &Path,
    counter_file: &Path,
    snapshot_every: u64,
    threshold: u64,
    window_size: u64,
) -> TickResult {
    // 1. Increment counter
    let prev = std::fs::read_to_string(counter_file)
        .ok()
        .and_then(|s| s.trim().parse::<u64>().ok())
        .unwrap_or(0);
    let current = prev + 1;

    // 2. Check context threshold first (takes priority)
    if let Ok(usage) = check_context_usage(transcript_path, threshold, window_size) {
        if usage.should_extract {
            // Reset counter on extract
            let _ = std::fs::write(counter_file, "0");
            return TickResult {
                action: TickAction::Extract,
                counter: 0,
                used_pct: usage.used_pct,
            };
        }
    }

    // 3. Check if snapshot interval reached
    if current >= snapshot_every {
        let _ = std::fs::write(counter_file, "0");
        return TickResult {
            action: TickAction::Snapshot,
            counter: 0,
            used_pct: 0,
        };
    }

    // 4. No action needed
    let _ = std::fs::write(counter_file, current.to_string());
    TickResult {
        action: TickAction::None,
        counter: current,
        used_pct: 0,
    }
}
```

- [ ] **Step 4: Add CLI subcommand**

```rust
"tick" => {
    let transcript = args.get(2).expect("Usage: autoclaw tick <transcript_path>");
    let snapshot_every = args.iter().position(|a| a == "--snapshot-every")
        .and_then(|i| args.get(i + 1))
        .and_then(|s| s.parse().ok())
        .unwrap_or(20u64);
    let threshold = args.iter().position(|a| a == "--threshold")
        .and_then(|i| args.get(i + 1))
        .and_then(|s| s.parse().ok())
        .unwrap_or(85u64);
    let window = args.iter().position(|a| a == "--window")
        .and_then(|i| args.get(i + 1))
        .and_then(|s| s.parse().ok())
        .unwrap_or(200000u64);

    let counter_file = Path::new(transcript).with_extension("tick");
    let result = autoclaw::tick::tick(
        Path::new(transcript), &counter_file, snapshot_every, threshold, window
    );

    match result.action {
        autoclaw::tick::TickAction::None => std::process::exit(0),
        autoclaw::tick::TickAction::Snapshot => {
            // Run snapshot inline
            // ... call snapshot logic ...
            std::process::exit(0);
        }
        autoclaw::tick::TickAction::Extract => {
            // Signal extraction needed
            std::process::exit(1);
        }
    }
}
```

- [ ] **Step 5: Register module in lib.rs**

- [ ] **Step 6: Run tests**

Run: `cargo test --lib tick`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/tick.rs src/main.rs src/lib.rs
git commit -m "feat: add tick command — combined monitor + periodic snapshot"
```

---

## Chunk 4: Reconciliation & Supersession

### Task 8: Implement `autoclaw reconcile` — merge, invalidate, promote, GC

**Files:**
- Create: `src/reconcile.rs`
- Modify: `src/main.rs`
- Modify: `src/lib.rs`

- [ ] **Step 1: Write failing tests**

In `src/reconcile.rs`:
```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::graph::KnowledgeGraph;
    use crate::model::*;
    use crate::tier::ImportanceTier;

    #[test]
    fn test_reconcile_adds_new_facts() {
        let mut kg = KnowledgeGraph::new();
        let input = ReconcileInput {
            new_facts: vec![NewFact {
                name: "Use Levenshtein".into(),
                fact_type: "Decision".into(),
                tier: "critical".into(),
                definition: "Use Levenshtein distance".into(),
                reason: "LCS fails on prefixes".into(),
                supersedes: None,
                relations: vec![],
                evidence_text: "we decided to use Levenshtein".into(),
            }],
            superseded: vec![],
            promotions: vec![],
            relations: vec![],
        };

        let report = reconcile(&mut kg, &input);
        assert_eq!(report.added, 1);
        assert!(kg.lookup("Use Levenshtein").is_some());
    }

    #[test]
    fn test_reconcile_supersedes_old_fact() {
        let mut kg = KnowledgeGraph::new();
        let mut old = Node::new(1, "Use LCS".into(), "Decision".into(),
            "Use LCS for matching".into(), 0.9, Source::Conversation);
        old.tier = ImportanceTier::Significant;
        kg.add_node(old).unwrap();

        let input = ReconcileInput {
            new_facts: vec![NewFact {
                name: "Use Levenshtein".into(),
                fact_type: "Decision".into(),
                tier: "critical".into(),
                definition: "Use Levenshtein distance".into(),
                reason: "LCS fails".into(),
                supersedes: Some("Use LCS".into()),
                relations: vec![],
                evidence_text: String::new(),
            }],
            superseded: vec![SupersededEntry {
                old: "Use LCS".into(),
                reason: "replaced by Levenshtein".into(),
            }],
            promotions: vec![],
            relations: vec![],
        };

        let report = reconcile(&mut kg, &input);
        assert_eq!(report.added, 1);
        assert_eq!(report.superseded, 1);
        let old_node = kg.lookup("Use LCS").unwrap();
        assert!(old_node.superseded_by.is_some());
    }

    #[test]
    fn test_reconcile_promotes_tier() {
        let mut kg = KnowledgeGraph::new();
        let mut n = Node::new(1, "overlap config".into(), "TechnicalFact".into(),
            "Overlap is 500 chars".into(), 0.8, Source::Conversation);
        n.tier = ImportanceTier::Minor;
        kg.add_node(n).unwrap();

        let input = ReconcileInput {
            new_facts: vec![],
            superseded: vec![],
            promotions: vec![PromotionEntry {
                name: "overlap config".into(),
                new_tier: "significant".into(),
                reason: "referenced 3 times".into(),
            }],
            relations: vec![],
        };

        let report = reconcile(&mut kg, &input);
        assert_eq!(report.promoted, 1);
        let node = kg.lookup("overlap config").unwrap();
        assert_eq!(node.tier, ImportanceTier::Significant);
    }

    #[test]
    fn test_reconcile_gc_removes_stale() {
        let mut kg = KnowledgeGraph::new();
        let mut n = Node::new(1, "old minor fact".into(), "TechnicalFact".into(),
            "Something trivial".into(), 0.3, Source::Conversation);
        n.tier = ImportanceTier::Minor;
        n.created_at = 0; // very old
        kg.add_node(n).unwrap();

        let now = 365 * 86400; // 1 year later
        let report = garbage_collect(&mut kg, 0.05, now);
        assert_eq!(report, 1); // removed 1 node
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cargo test --lib reconcile`
Expected: FAIL

- [ ] **Step 3: Implement reconcile logic**

In `src/reconcile.rs`:
```rust
use serde::Deserialize;
use crate::graph::KnowledgeGraph;
use crate::model::*;
use crate::tier::{ImportanceTier, relevance};

#[derive(Deserialize)]
pub struct ReconcileInput {
    pub new_facts: Vec<NewFact>,
    pub superseded: Vec<SupersededEntry>,
    pub promotions: Vec<PromotionEntry>,
    pub relations: Vec<RelationEntry>,
}

#[derive(Deserialize)]
pub struct NewFact {
    pub name: String,
    pub fact_type: String,
    pub tier: String,
    pub definition: String,
    pub reason: String,
    pub supersedes: Option<String>,
    pub relations: Vec<FactRelation>,
    pub evidence_text: String,
}

#[derive(Deserialize)]
pub struct FactRelation {
    pub target: String,
    pub r#type: String,
}

#[derive(Deserialize)]
pub struct SupersededEntry {
    pub old: String,
    pub reason: String,
}

#[derive(Deserialize)]
pub struct PromotionEntry {
    pub name: String,
    pub new_tier: String,
    pub reason: String,
}

#[derive(Deserialize)]
pub struct RelationEntry {
    pub from: String,
    pub to: String,
    pub r#type: String,
    pub evidence: String,
}

pub struct ReconcileReport {
    pub added: usize,
    pub superseded: usize,
    pub promoted: usize,
    pub gc_removed: usize,
    pub errors: Vec<String>,
}

fn parse_tier(s: &str) -> ImportanceTier {
    match s.to_lowercase().as_str() {
        "critical" => ImportanceTier::Critical,
        "significant" => ImportanceTier::Significant,
        _ => ImportanceTier::Minor,
    }
}

pub fn reconcile(kg: &mut KnowledgeGraph, input: &ReconcileInput) -> ReconcileReport {
    let mut report = ReconcileReport {
        added: 0, superseded: 0, promoted: 0, gc_removed: 0, errors: vec![],
    };

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap().as_secs();

    // 1. Add new facts
    for fact in &input.new_facts {
        let next_id = kg.next_node_id();
        let mut node = Node::new(
            next_id,
            fact.name.clone(),
            fact.fact_type.clone(),
            fact.definition.clone(),
            0.9,
            Source::Conversation,
        );
        node.tier = parse_tier(&fact.tier);
        node.created_at = now;
        node.last_referenced = now;

        match kg.add_node(node) {
            Ok(_) => report.added += 1,
            Err(e) => report.errors.push(format!("Add {}: {:?}", fact.name, e)),
        }
    }

    // 2. Process supersessions
    for sup in &input.superseded {
        if let Some(old_node) = kg.lookup(&sup.old) {
            let old_id = old_node.id;
            if let Some(node) = kg.get_node_mut(old_id) {
                // Find the new node that supersedes this one
                let new_id = input.new_facts.iter()
                    .find(|f| f.supersedes.as_deref() == Some(&sup.old))
                    .and_then(|f| kg.lookup(&f.name))
                    .map(|n| n.id);
                node.superseded_by = new_id.or(Some(0)); // mark as superseded
                report.superseded += 1;
            }
        }
    }

    // 3. Process promotions
    for prom in &input.promotions {
        if let Some(node) = kg.lookup(&prom.name) {
            let id = node.id;
            if let Some(node) = kg.get_node_mut(id) {
                node.tier = parse_tier(&prom.new_tier);
                report.promoted += 1;
            }
        }
    }

    report
}

/// Remove nodes with relevance below threshold.
/// Returns count of removed nodes.
pub fn garbage_collect(kg: &mut KnowledgeGraph, threshold: f64, now: u64) -> usize {
    let to_remove: Vec<NodeId> = kg.all_nodes()
        .filter(|n| {
            let r = relevance(n.tier, n.created_at, now, n.superseded_by.is_some());
            r < threshold && !matches!(n.source, Source::CodeAnalysis { .. })
        })
        .map(|n| n.id)
        .collect();

    let count = to_remove.len();
    for id in to_remove {
        kg.remove_node(id);
    }
    count
}
```

Note: `kg.next_node_id()` and `kg.remove_node(id)` need to be added to `src/graph.rs`:
```rust
pub fn next_node_id(&self) -> NodeId {
    self.nodes.keys().max().copied().unwrap_or(0) + 1
}
pub fn remove_node(&mut self, id: NodeId) {
    self.nodes.remove(&id);
    // Also remove edges referencing this node
    self.edges.retain(|_, e| e.from != id && e.to != id);
    // Update indices
    self.rebuild_indices();
}
```

- [ ] **Step 4: Add CLI subcommand that reads JSON from stdin**

- [ ] **Step 5: Run tests**

Run: `cargo test --lib reconcile`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/reconcile.rs src/graph.rs src/main.rs src/lib.rs
git commit -m "feat: add reconcile command with supersession, promotion, and GC"
```

---

## Chunk 5: Tree-sitter Code Indexing

### Task 9: Add tree-sitter and implement Rust code parsing

**Files:**
- Modify: `Cargo.toml`
- Create: `src/treesitter.rs`
- Modify: `src/lib.rs`

- [ ] **Step 1: Add tree-sitter dependencies**

In `Cargo.toml`:
```toml
tree-sitter = "0.24"
tree-sitter-rust = "0.23"
```

Note: tree-sitter Rust bindings. For Python/TS support, we add those grammars later (v1 focuses on Rust since the project is Rust).

- [ ] **Step 2: Write failing tests for Rust code parsing**

In `src/treesitter.rs`:
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_rust_functions() {
        let code = r#"
pub fn hello(name: &str) -> String {
    format!("Hello, {}", name)
}

fn private_helper() -> bool {
    true
}
"#;
        let entities = parse_rust_code(code, "src/test.rs");
        let fns: Vec<_> = entities.iter().filter(|e| e.entity_type == "Function").collect();
        assert_eq!(fns.len(), 2);
        assert!(fns.iter().any(|f| f.name == "hello"));
        assert!(fns.iter().any(|f| f.name == "private_helper"));
    }

    #[test]
    fn test_parse_rust_structs() {
        let code = r#"
pub struct Node {
    pub id: u64,
    pub name: String,
    confidence: f32,
}
"#;
        let entities = parse_rust_code(code, "src/model.rs");
        assert!(entities.iter().any(|e| e.entity_type == "Struct" && e.name == "Node"));
        // Fields should be extracted as relations or sub-entities
        let fields: Vec<_> = entities.iter()
            .filter(|e| e.entity_type == "Field")
            .collect();
        assert_eq!(fields.len(), 3);
    }

    #[test]
    fn test_parse_rust_use_statements() {
        let code = r#"
use crate::model::Node;
use std::collections::HashMap;
"#;
        let entities = parse_rust_code(code, "src/graph.rs");
        let imports: Vec<_> = entities.iter().filter(|e| e.entity_type == "Import").collect();
        assert_eq!(imports.len(), 2);
    }

    #[test]
    fn test_parse_rust_impl() {
        let code = r#"
impl Node {
    pub fn new(id: u64) -> Self {
        Node { id, name: String::new(), confidence: 0.0 }
    }
}
"#;
        let entities = parse_rust_code(code, "src/model.rs");
        assert!(entities.iter().any(|e| e.entity_type == "Method" && e.name == "new"));
    }
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cargo test --lib treesitter`
Expected: FAIL

- [ ] **Step 4: Implement Rust code parser using tree-sitter**

In `src/treesitter.rs`:
```rust
use tree_sitter::{Parser, Language};

extern "C" { fn tree_sitter_rust() -> Language; }

#[derive(Debug)]
pub struct CodeEntity {
    pub name: String,
    pub entity_type: String, // Function, Struct, Field, Import, Method, Enum, Trait
    pub definition: String,
    pub file: String,
    pub line_start: usize,
    pub line_end: usize,
}

#[derive(Debug)]
pub struct CodeRelation {
    pub from: String,
    pub to: String,
    pub relation_type: String, // defines, has_field, imports, implements, calls
}

pub struct ParseResult {
    pub entities: Vec<CodeEntity>,
    pub relations: Vec<CodeRelation>,
}

pub fn parse_rust_code(source: &str, file_path: &str) -> Vec<CodeEntity> {
    let mut parser = Parser::new();
    let language = unsafe { tree_sitter_rust() };
    parser.set_language(&language).expect("Error loading Rust grammar");

    let tree = parser.parse(source, None).expect("Parse failed");
    let root = tree.root_node();
    let bytes = source.as_bytes();

    let mut entities = Vec::new();
    extract_entities(&root, bytes, file_path, &mut entities);
    entities
}

fn extract_entities(
    node: &tree_sitter::Node,
    source: &[u8],
    file: &str,
    entities: &mut Vec<CodeEntity>,
) {
    match node.kind() {
        "function_item" => {
            if let Some(name_node) = node.child_by_field_name("name") {
                let name = node_text(name_node, source);
                let signature = node_text(*node, source)
                    .lines().next().unwrap_or("").to_string();
                entities.push(CodeEntity {
                    name,
                    entity_type: "Function".into(),
                    definition: signature,
                    file: file.into(),
                    line_start: node.start_position().row + 1,
                    line_end: node.end_position().row + 1,
                });
            }
        }
        "struct_item" => {
            if let Some(name_node) = node.child_by_field_name("name") {
                let name = node_text(name_node, source);
                entities.push(CodeEntity {
                    name: name.clone(),
                    entity_type: "Struct".into(),
                    definition: format!("struct {}", name),
                    file: file.into(),
                    line_start: node.start_position().row + 1,
                    line_end: node.end_position().row + 1,
                });

                // Extract fields
                if let Some(body) = node.child_by_field_name("body") {
                    let mut cursor = body.walk();
                    for child in body.children(&mut cursor) {
                        if child.kind() == "field_declaration" {
                            if let Some(field_name) = child.child_by_field_name("name") {
                                entities.push(CodeEntity {
                                    name: node_text(field_name, source),
                                    entity_type: "Field".into(),
                                    definition: node_text(child, source),
                                    file: file.into(),
                                    line_start: child.start_position().row + 1,
                                    line_end: child.end_position().row + 1,
                                });
                            }
                        }
                    }
                }
            }
        }
        "use_declaration" => {
            let text = node_text(*node, source);
            entities.push(CodeEntity {
                name: text.clone(),
                entity_type: "Import".into(),
                definition: text,
                file: file.into(),
                line_start: node.start_position().row + 1,
                line_end: node.end_position().row + 1,
            });
        }
        "impl_item" => {
            // Extract methods
            let type_name = node.child_by_field_name("type")
                .map(|n| node_text(n, source))
                .unwrap_or_default();
            if let Some(body) = node.child_by_field_name("body") {
                let mut cursor = body.walk();
                for child in body.children(&mut cursor) {
                    if child.kind() == "function_item" {
                        if let Some(name_node) = child.child_by_field_name("name") {
                            let name = node_text(name_node, source);
                            entities.push(CodeEntity {
                                name,
                                entity_type: "Method".into(),
                                definition: format!("impl {} method", type_name),
                                file: file.into(),
                                line_start: child.start_position().row + 1,
                                line_end: child.end_position().row + 1,
                            });
                        }
                    }
                }
            }
        }
        _ => {}
    }

    // Recurse into children
    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        extract_entities(&child, source, file, entities);
    }
}

fn node_text(node: tree_sitter::Node, source: &[u8]) -> String {
    std::str::from_utf8(&source[node.byte_range()]).unwrap_or("").to_string()
}
```

- [ ] **Step 5: Run tests**

Run: `cargo test --lib treesitter`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/treesitter.rs src/lib.rs Cargo.toml
git commit -m "feat: add tree-sitter Rust code parser for deterministic code indexing"
```

### Task 10: Implement `autoclaw reindex` — single file re-parse

**Files:**
- Modify: `src/main.rs`
- Modify: `src/graph.rs`

- [ ] **Step 1: Write test for reindex flow**

```rust
#[test]
fn test_reindex_updates_entities() {
    let mut kg = KnowledgeGraph::new();
    // Add an old entity for file
    let n = Node::new(1, "old_function".into(), "Function".into(),
        "old".into(), 1.0, Source::CodeAnalysis { file: "src/test.rs".into() });
    kg.add_node(n).unwrap();

    // Reindex with new code
    let code = "pub fn new_function() -> bool { true }";
    reindex_file(&mut kg, "src/test.rs", code);

    assert!(kg.lookup("old_function").is_none());
    assert!(kg.lookup("new_function").is_some());
}
```

- [ ] **Step 2: Implement reindex_file in graph.rs**

```rust
pub fn reindex_file(&mut self, file_path: &str, source_code: &str) {
    // Remove all code entities for this file
    let to_remove: Vec<NodeId> = self.all_nodes()
        .filter(|n| matches!(&n.source, Source::CodeAnalysis { file } if file == file_path))
        .map(|n| n.id)
        .collect();
    for id in to_remove {
        self.remove_node(id);
    }

    // Re-parse with tree-sitter
    let entities = crate::treesitter::parse_rust_code(source_code, file_path);

    // Add new entities
    for entity in entities {
        let id = self.next_node_id();
        let mut node = Node::new(
            id, entity.name, entity.entity_type, entity.definition,
            1.0, Source::CodeAnalysis { file: file_path.to_string() },
        );
        node.tier = ImportanceTier::Minor;
        let _ = self.add_node(node);
    }
}
```

- [ ] **Step 3: Add reindex CLI subcommand**

```rust
"reindex" => {
    let file_path = args.get(2).expect("Usage: autoclaw reindex <file_path>");
    let code = std::fs::read_to_string(file_path).expect("Cannot read file");
    kg.reindex_file(file_path, &code);
    storage::save(&kg, &kg_path).unwrap();
    println!("Reindexed: {}", file_path);
}
```

- [ ] **Step 4: Run tests**

Run: `cargo test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/graph.rs src/main.rs
git commit -m "feat: add reindex command for incremental tree-sitter file updates"
```

---

## Chunk 6: Impact Analysis

### Task 11: Implement `autoclaw impact` and `autoclaw impact-from-diff`

**Files:**
- Create: `src/impact.rs`
- Modify: `src/main.rs`
- Modify: `src/lib.rs`

- [ ] **Step 1: Write failing tests for impact analysis**

In `src/impact.rs`:
```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::graph::KnowledgeGraph;
    use crate::model::*;
    use crate::tier::ImportanceTier;

    fn make_code_kg() -> KnowledgeGraph {
        let mut kg = KnowledgeGraph::new();
        let n1 = Node::new(1, "confidence".into(), "Field".into(),
            "pub confidence: f32".into(), 1.0,
            Source::CodeAnalysis { file: "src/model.rs".into() });
        kg.add_node(n1).unwrap();

        let n2 = Node::new(2, "relevance".into(), "Function".into(),
            "fn relevance()".into(), 1.0,
            Source::CodeAnalysis { file: "src/graph.rs".into() });
        kg.add_node(n2).unwrap();

        let n3 = Node::new(3, "merge_nodes".into(), "Function".into(),
            "fn merge_nodes()".into(), 1.0,
            Source::CodeAnalysis { file: "src/resolver.rs".into() });
        kg.add_node(n3).unwrap();

        // Add edges: relevance reads confidence, merge_nodes reads confidence
        let e1 = Edge::new(1, 2, 1, "reads".into(), 1.0, Source::CodeAnalysis { file: "src/graph.rs".into() });
        kg.add_edge(e1).unwrap();
        let e2 = Edge::new(2, 3, 1, "reads".into(), 1.0, Source::CodeAnalysis { file: "src/resolver.rs".into() });
        kg.add_edge(e2).unwrap();

        kg
    }

    #[test]
    fn test_impact_finds_references() {
        let kg = make_code_kg();
        let report = impact_analysis(&kg, "confidence", 1);
        assert!(report.contains("relevance"));
        assert!(report.contains("merge_nodes"));
        assert!(report.contains("graph.rs"));
        assert!(report.contains("resolver.rs"));
    }

    #[test]
    fn test_impact_empty_for_unknown() {
        let kg = make_code_kg();
        let report = impact_analysis(&kg, "nonexistent", 1);
        assert!(report.contains("No entity found") || report.is_empty());
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cargo test --lib impact`
Expected: FAIL

- [ ] **Step 3: Implement impact analysis**

In `src/impact.rs`:
```rust
use crate::graph::KnowledgeGraph;

/// Analyze the impact of modifying an entity.
/// Returns markdown report of all references and breaking changes.
pub fn impact_analysis(kg: &KnowledgeGraph, entity_name: &str, depth: usize) -> String {
    let node = match kg.lookup(entity_name) {
        Some(n) => n,
        None => return format!("No entity found: {}", entity_name),
    };

    let node_id = node.id;
    let mut output = format!("## Impact: {}\n\n", entity_name);

    // Get all neighbors (direct references)
    let neighbors = kg.neighbors(node_id);
    if neighbors.is_empty() {
        output.push_str("No references found.\n");
        return output;
    }

    output.push_str(&format!("**References ({}):**\n", neighbors.len()));
    for n in &neighbors {
        let file = match &n.node.source {
            crate::model::Source::CodeAnalysis { file } => file.as_str(),
            _ => "unknown",
        };
        output.push_str(&format!(
            "- {}:{} — {} in {}() [{}]\n",
            file,
            n.node.id, // placeholder for line number
            n.relation_type,
            n.node.name,
            n.direction
        ));
    }

    // Detect breaking change patterns
    let mut warnings = Vec::new();
    for n in &neighbors {
        if let crate::model::Source::CodeAnalysis { ref file } = n.node.source {
            if file.contains("storage") || file.contains("serial") {
                warnings.push(format!("storage: field change may break deserialization of existing files"));
            }
            if file.contains("python") || n.node.node_type == "Method" {
                if n.relation_type == "reads" || n.relation_type == "writes" {
                    warnings.push(format!("python SDK: property/method change breaks downstream Python code"));
                }
            }
        }
    }

    if !warnings.is_empty() {
        output.push_str("\n**Breaking Changes:**\n");
        for w in &warnings {
            output.push_str(&format!("- {}\n", w));
        }
    }

    output
}

/// Parse a tool input JSON (Edit/Write) and run impact analysis on affected entities.
pub fn impact_from_diff(kg: &KnowledgeGraph, tool_input: &str) -> String {
    let v: serde_json::Value = match serde_json::from_str(tool_input) {
        Ok(v) => v,
        Err(_) => return String::new(),
    };

    let old_string = v.get("old_string").and_then(|s| s.as_str()).unwrap_or("");
    let new_string = v.get("new_string").and_then(|s| s.as_str()).unwrap_or("");

    if old_string.is_empty() { return String::new(); }

    // Extract entity names that appear in old_string but changed in new_string
    // Simple heuristic: find identifiers in old that don't appear in new
    let mut affected = Vec::new();
    for node in kg.all_nodes() {
        if old_string.contains(&node.name) {
            affected.push(node.name.clone());
        }
    }

    let mut output = String::new();
    for entity in &affected {
        output.push_str(&impact_analysis(kg, entity, 1));
        output.push('\n');
    }
    output
}
```

- [ ] **Step 4: Add CLI subcommands**

- [ ] **Step 5: Run tests**

Run: `cargo test --lib impact`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/impact.rs src/main.rs src/lib.rs
git commit -m "feat: add impact analysis for pre-edit dependency detection"
```

---

## Chunk 7: Bootstrap & Config

### Task 12: Implement config parsing and `autoclaw bootstrap`

**Files:**
- Create: `src/config.rs`
- Create: `src/bootstrap.rs`
- Create: `graphocode.toml`
- Modify: `Cargo.toml` (add toml)
- Modify: `src/main.rs`
- Modify: `src/lib.rs`

- [ ] **Step 1: Add toml dependency**

In `Cargo.toml`:
```toml
toml = "0.8"
```

- [ ] **Step 2: Write tests for config parsing**

In `src/config.rs`:
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_config() {
        let toml_str = r#"
[sources]
code = ["src/**/*.rs"]
conversations = true
documents = ["docs/spec.md"]

[extraction]
threshold = 85
budget = 2000
model = "haiku"

[impact]
enabled = true
depth = 2
"#;
        let config: GraphocodeConfig = toml::from_str(toml_str).unwrap();
        assert_eq!(config.sources.code, vec!["src/**/*.rs"]);
        assert!(config.sources.conversations);
        assert_eq!(config.extraction.threshold, 85);
        assert!(config.impact.enabled);
    }

    #[test]
    fn test_default_config() {
        let config = GraphocodeConfig::default();
        assert_eq!(config.extraction.threshold, 85);
        assert_eq!(config.extraction.budget, 2000);
    }
}
```

- [ ] **Step 3: Implement config struct**

In `src/config.rs`:
```rust
use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct GraphocodeConfig {
    #[serde(default)]
    pub sources: SourcesConfig,
    #[serde(default)]
    pub extraction: ExtractionConfig,
    #[serde(default)]
    pub impact: ImpactConfig,
}

#[derive(Debug, Deserialize)]
pub struct SourcesConfig {
    #[serde(default = "default_code_patterns")]
    pub code: Vec<String>,
    #[serde(default = "default_true")]
    pub conversations: bool,
    #[serde(default)]
    pub documents: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct ExtractionConfig {
    #[serde(default = "default_threshold")]
    pub threshold: u64,
    #[serde(default = "default_budget")]
    pub budget: usize,
    #[serde(default = "default_model")]
    pub model: String,
}

#[derive(Debug, Deserialize)]
pub struct ImpactConfig {
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default = "default_depth")]
    pub depth: usize,
}

#[derive(Debug, Deserialize)]
pub struct BootstrapConfig {
    #[serde(default = "default_true")]
    pub on_first_session: bool,
    #[serde(default = "default_snapshot_every")]
    pub snapshot_every: u64,
}

fn default_snapshot_every() -> u64 { 20 }

fn default_code_patterns() -> Vec<String> { vec!["src/**/*.rs".into()] }
fn default_true() -> bool { true }
fn default_threshold() -> u64 { 85 }
fn default_budget() -> usize { 2000 }
fn default_model() -> String { "haiku".into() }
fn default_depth() -> usize { 2 }

// ... Default impls for all config structs
impl Default for GraphocodeConfig { /* ... */ }
impl Default for SourcesConfig { /* ... */ }
impl Default for ExtractionConfig { /* ... */ }
impl Default for ImpactConfig { /* ... */ }

pub fn load_config(path: &std::path::Path) -> GraphocodeConfig {
    if path.exists() {
        let content = std::fs::read_to_string(path).unwrap_or_default();
        toml::from_str(&content).unwrap_or_default()
    } else {
        GraphocodeConfig::default()
    }
}
```

- [ ] **Step 4: Implement bootstrap — all three channels**

In `src/bootstrap.rs`:
```rust
use crate::config::GraphocodeConfig;
use crate::graph::KnowledgeGraph;
use crate::treesitter;
use crate::claude_parser;
use crate::model::{Node, Source};
use crate::tier::ImportanceTier;
use glob::glob; // add glob = "0.3" to Cargo.toml
use std::path::Path;

pub struct BootstrapReport {
    pub files_indexed: usize,
    pub code_entities: usize,
    pub conversations_parsed: usize,
    pub documents_processed: usize,
}

/// CHANNEL 1: Index all code files using tree-sitter. Deterministic, 0 tokens.
pub fn bootstrap_code(kg: &mut KnowledgeGraph, config: &GraphocodeConfig) -> (usize, usize) {
    let mut files = 0;
    let mut entities = 0;

    for pattern in &config.sources.code {
        if let Ok(paths) = glob(pattern) {
            for entry in paths.flatten() {
                let path_str = entry.to_string_lossy().to_string();
                if let Ok(code) = std::fs::read_to_string(&entry) {
                    let parsed = treesitter::parse_rust_code(&code, &path_str);
                    entities += parsed.len();
                    for entity in parsed {
                        let id = kg.next_node_id();
                        let node = Node::new(
                            id, entity.name, entity.entity_type, entity.definition,
                            1.0, Source::CodeAnalysis { file: path_str.clone() },
                        );
                        let _ = kg.add_node(node);
                    }
                    files += 1;
                }
            }
        }
    }
    (files, entities)
}

/// CHANNEL 2: Parse all Claude Code conversations. Deterministic parsing (0 tokens),
/// then returns extracted text for Haiku semantic extraction.
/// Returns Vec<(session_id, text)> ready for LLM extraction.
pub fn bootstrap_conversations(project_path: &Path) -> Vec<(String, String)> {
    let conversation_files = claude_parser::find_conversations(project_path);
    let mut results = Vec::new();

    for path in conversation_files {
        if let Some(conv) = claude_parser::parse_conversation(&path) {
            // Skip automated sessions
            if conv.is_automated() || conv.messages.len() < 3 {
                continue;
            }
            let text = conv.substantive_text(50000);
            if !text.is_empty() {
                results.push((conv.session_id.clone(), text));
            }
        }
    }
    results
}

/// CHANNEL 3: Process business documents. Returns chunked text for Haiku extraction.
pub fn bootstrap_documents(config: &GraphocodeConfig) -> Vec<(String, String)> {
    let mut results = Vec::new();
    for doc_path in &config.sources.documents {
        if let Ok(content) = std::fs::read_to_string(doc_path) {
            let chunks = crate::chunker::chunk_text(&content, 4000, 500);
            for chunk in chunks {
                results.push((doc_path.clone(), chunk.text));
            }
        }
    }
    results
}

/// Full bootstrap: runs all three channels.
/// Code indexing is done entirely in Rust. Conversations and documents
/// produce text that needs to be passed to Haiku for semantic extraction
/// (done by the /graphocode:start skill which orchestrates the LLM calls).
pub fn bootstrap(kg: &mut KnowledgeGraph, config: &GraphocodeConfig, project_path: &Path) -> BootstrapReport {
    let (files, code_entities) = bootstrap_code(kg, config);

    let conversations = if config.sources.conversations {
        bootstrap_conversations(project_path)
    } else {
        vec![]
    };

    let documents = bootstrap_documents(config);

    BootstrapReport {
        files_indexed: files,
        code_entities,
        conversations_parsed: conversations.len(),
        documents_processed: documents.len(),
    }
    // Note: conversation and document text is returned for LLM extraction
    // The /graphocode:start skill handles feeding this to Haiku
}
```
```

- [ ] **Step 5: Create default graphocode.toml**

```toml
[sources]
code = ["src/**/*.rs", "src/**/*.py"]
conversations = true
documents = []

[extraction]
threshold = 85
budget = 2000
model = "haiku"

[impact]
enabled = true
depth = 2
```

- [ ] **Step 6: Add bootstrap CLI subcommand and glob dependency**

Add `glob = "0.3"` to Cargo.toml.

- [ ] **Step 7: Run tests**

Run: `cargo test`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/config.rs src/bootstrap.rs src/lib.rs src/main.rs Cargo.toml graphocode.toml
git commit -m "feat: add bootstrap command and graphocode.toml config"
```

---

## Chunk 8: Plugin Packaging

### Task 13: Create Claude Code plugin structure

**Files:**
- Create: `autoclaw-plugin/.claude-plugin/plugin.json`
- Create: `autoclaw-plugin/hooks/hooks.json`
- Create: `autoclaw-plugin/skills/graphocode-start/SKILL.md`
- Create: `autoclaw-plugin/skills/graphocode-query/SKILL.md`
- Create: `autoclaw-plugin/skills/graphocode-impact/SKILL.md`
- Create: `autoclaw-plugin/skills/graphocode-decide/SKILL.md`
- Create: `autoclaw-plugin/agents/kg-extractor.md`
- Create: `autoclaw-plugin/scripts/extract-and-compact.sh`
- Create: `autoclaw-plugin/CLAUDE.md`

- [ ] **Step 1: Create plugin manifest**

`autoclaw-plugin/.claude-plugin/plugin.json`:
```json
{
  "name": "graphocode",
  "version": "0.1.0",
  "description": "Knowledge graph memory for Claude Code — replaces lossy compression with structured, persistent project memory with impact analysis"
}
```

- [ ] **Step 2: Create hooks.json with all 9 hooks**

Create `autoclaw-plugin/hooks/hooks.json` with every hook explicitly defined. Each hook fires automatically — Claude never needs to "remember" to use the KG.

**IMPORTANT: The PreToolUse(Edit|Write) hook fires per EVERY edit, not once per task. 15 edits in a task = 15 separate impact analyses, each receiving that specific edit's `$TOOL_INPUT`.**

All 9 hooks:

| # | Event | Matcher | Command | Purpose |
|---|-------|---------|---------|---------|
| 1 | SessionStart | (none) | `autoclaw context --budget 2000 --project "$CWD"` | Inject top-K facts at session start |
| 2 | SessionStart | compact | `autoclaw context --budget 2000 --project "$CWD"` | Re-inject after compaction |
| 3 | UserPromptSubmit | (none) | `autoclaw relevant "$(jq -r .user_message)" --budget 500` | Inject facts relevant to user's request |
| 4 | PreToolUse | Edit\|Write | `autoclaw impact-from-diff "$TOOL_INPUT"` | Impact analysis BEFORE every edit |
| 5 | PostToolUse | Read | `autoclaw file-context "$(jq -r .file_path)" --budget 300` | Inject KG knowledge after reading a file |
| 6 | PostToolUse | Edit\|Write | `autoclaw reindex "$(jq -r .file_path)"` | Tree-sitter re-parse after every edit |
| 7 | PostToolUse | (none) | `autoclaw tick "$TRANSCRIPT_PATH" --snapshot-every 20 --threshold 85` | Monitor context + periodic snapshot |
| 8 | Stop | (none) | `autoclaw snapshot "$TRANSCRIPT_PATH" --all-since-last` | Final session snapshot |

Use the full JSON from the design spec, ensuring all 8 entries above are present. Hook #7 exits with code 1 when threshold is reached, which triggers `extract-and-compact.sh`.

- [ ] **Step 3: Create /graphocode:start skill**

`autoclaw-plugin/skills/graphocode-start/SKILL.md`:
```yaml
---
name: graphocode-start
description: Bootstrap the knowledge graph by indexing all code, conversations, and documents. Run this when starting on a new project or to refresh the index.
disable-model-invocation: true
allowed-tools: Bash
---

# Bootstrap Knowledge Graph

Run a full project bootstrap:

1. Run: `autoclaw bootstrap --config graphocode.toml`
2. Report results to user
3. Confirm KG is ready for use
```

- [ ] **Step 4: Create /graphocode:query skill**

```yaml
---
name: graphocode-query
description: Query the knowledge graph about entities, decisions, or relationships in the project
allowed-tools: Bash
---

# Query Knowledge Graph

Use `autoclaw explore "$ARGUMENTS"` to find information about the requested entity.
Also use `autoclaw relevant "$ARGUMENTS"` for broader context.
Present results in a readable format.
```

- [ ] **Step 5: Create /graphocode:impact skill**

```yaml
---
name: graphocode-impact
description: Run impact analysis to see what would be affected by changing an entity
disable-model-invocation: true
allowed-tools: Bash
---

# Impact Analysis

Run: `autoclaw impact "$ARGUMENTS" --depth 2`
Present the full impact report to the user.
```

- [ ] **Step 6: Create /graphocode:decide skill**

```yaml
---
name: graphocode-decide
description: Record a decision in the knowledge graph with reasoning and alternatives
allowed-tools: Bash
---

# Record Decision

Parse the user's decision from $ARGUMENTS and create a reconcile JSON:
{
  "new_facts": [{
    "name": "<decision summary>",
    "fact_type": "Decision",
    "tier": "significant",
    "definition": "<full decision>",
    "reason": "<why>",
    ...
  }],
  ...
}
Pipe to: `autoclaw reconcile`
```

- [ ] **Step 7: Create kg-extractor agent**

`autoclaw-plugin/agents/kg-extractor.md`:
```yaml
---
name: kg-extractor
description: Extract semantic knowledge from conversation transcripts into the knowledge graph. Used during compaction to preserve decisions, errors, and relationships.
model: haiku
tools: Bash, Read
---

You are a knowledge extractor. [Full extraction prompt from spec]
```

- [ ] **Step 8: Create extract-and-compact.sh**

```bash
#!/bin/bash
set -e
TRANSCRIPT_PATH="$1"
KG_PATH="${AUTOCLAW_KG:-./knowledge.kg}"

# 1. Run heuristic snapshot first (instant, 0 tokens)
autoclaw snapshot "$TRANSCRIPT_PATH" --all-since-last 2>/dev/null || true

# 2. Export existing KG for comparison
EXISTING=$(autoclaw export 2>/dev/null || echo "{}")

# 3. Tree-sitter refresh of recently modified files
git diff --name-only HEAD 2>/dev/null | while read file; do
    autoclaw reindex "$file" 2>/dev/null || true
done

# 4. Signal that deep extraction is needed
# (The agent hook handles the Haiku extraction)
echo "EXTRACTION_NEEDED"

# Note: After this script, the agent hook in hooks.json
# triggers the kg-extractor subagent for deep semantic extraction.
# Then /compact is triggered with minimal instructions.
```

- [ ] **Step 9: Create plugin CLAUDE.md**

```markdown
# Graphocode Plugin

This project uses the Graphocode knowledge graph plugin.

## Available commands
- `/graphocode:start` — Bootstrap: index all code, conversations, documents
- `/graphocode:query <entity>` — Query what the KG knows about something
- `/graphocode:impact <entity>` — See what would break if you change something
- `/graphocode:decide <decision>` — Record a decision with reasoning

## Automatic behavior
Context is automatically injected via hooks at every step. You don't need to query the KG manually.

## Compact Instructions
Minimal summary: current task and last step only. One line.
Project context comes from the knowledge graph.
```

- [ ] **Step 10: Add autoCompactEnabled: false setup instruction**

The plugin MUST disable Claude Code's built-in auto-compact. We take over the entire compaction lifecycle.

Add to `autoclaw-plugin/scripts/setup.sh`:
```bash
#!/bin/bash
# Disable Claude Code auto-compact — Graphocode manages compaction
CLAUDE_JSON="${HOME}/.claude.json"
if [ -f "$CLAUDE_JSON" ]; then
    # Add autoCompactEnabled: false if not already set
    if ! grep -q "autoCompactEnabled" "$CLAUDE_JSON"; then
        tmp=$(mktemp)
        jq '. + {"autoCompactEnabled": false}' "$CLAUDE_JSON" > "$tmp" && mv "$tmp" "$CLAUDE_JSON"
        echo "Disabled auto-compact in $CLAUDE_JSON"
    fi
else
    echo '{"autoCompactEnabled": false}' > "$CLAUDE_JSON"
    echo "Created $CLAUDE_JSON with auto-compact disabled"
fi
```

The `/graphocode:start` skill should run this setup script as its first step.

- [ ] **Step 11: Verify compact instructions are in plugin CLAUDE.md**

Confirm the plugin `CLAUDE.md` contains:
```markdown
## Compact Instructions
Minimal summary: current task and last step only. One line.
Project context comes from the knowledge graph.
```

This guides Claude Code's built-in compaction (when we trigger it manually via `/compact`) to produce a minimal summary, since the KG provides all the real context.

- [ ] **Step 12: Commit**

```bash
git add autoclaw-plugin/
git commit -m "feat: add Claude Code plugin structure with hooks, skills, and agents"
```

---

## Chunk 9: Integration Testing & Polish

### Task 14: End-to-end integration test

**Files:**
- Create: `tests/integration_test.rs`

- [ ] **Step 1: Write integration test that exercises the full pipeline**

```rust
#[test]
fn test_full_pipeline() {
    // 1. Create empty KG
    // 2. Bootstrap with tree-sitter on src/ files
    // 3. Verify code entities exist
    // 4. Reconcile with some semantic facts
    // 5. Generate context and verify it includes both code + semantic
    // 6. Run impact analysis on a known entity
    // 7. Verify relevance search works
    // 8. Verify file-context works
    // 9. Supersede a fact and verify it disappears from context
    // 10. GC and verify stale facts are removed
}
```

- [ ] **Step 2: Run integration test**

Run: `cargo test --test integration_test`
Expected: PASS

- [ ] **Step 3: Test bootstrap on the autoclaw project itself**

Run: `AUTOCLAW_KG=./test.kg cargo run -- bootstrap`
Verify: Output shows files indexed, entities extracted

Run: `AUTOCLAW_KG=./test.kg cargo run -- context 2000`
Verify: Structured markdown output with code entities

Run: `AUTOCLAW_KG=./test.kg cargo run -- impact lookup`
Verify: Shows references to lookup function across files

- [ ] **Step 4: Clean up test artifacts**

```bash
rm -f test.kg
```

- [ ] **Step 5: Commit**

```bash
git add tests/integration_test.rs
git commit -m "test: add end-to-end integration test for full pipeline"
```

### Task 15: Wire up all CLI commands and Python bindings

**Files:**
- Modify: `src/main.rs`
- Modify: `src/python.rs`

- [ ] **Step 1: Verify all CLI subcommands are wired up**

Check that `src/main.rs` handles:
- `stats` (existing)
- `topics` (existing)
- `explore` (existing)
- `connect` (existing)
- `recent` (existing)
- `export` (existing)
- `context` (new)
- `relevant` (new)
- `file-context` (new)
- `monitor` (new)
- `snapshot` (new)
- `tick` (new)
- `reconcile` (new)
- `impact` (new)
- `impact-from-diff` (new)
- `reindex` (new)
- `bootstrap` (new)

- [ ] **Step 2: Add Python bindings for new commands**

Add to `src/python.rs`:
```rust
// Context generation
fn context(&self, budget: usize) -> String
// Relevant search
fn relevant(&self, query: &str, budget: usize) -> String
// File context
fn file_context(&self, file_path: &str, budget: usize) -> String
// Impact analysis
fn impact(&self, entity_name: &str, depth: usize) -> String
// Reindex
fn reindex(&mut self, file_path: &str)
// Bootstrap
fn bootstrap(&mut self, config_path: &str) -> String
```

- [ ] **Step 3: Run full test suite**

Run: `cargo test`
Expected: ALL PASS

- [ ] **Step 4: Build Python wheel**

Run: `maturin develop`
Expected: Builds successfully

- [ ] **Step 5: Commit**

```bash
git add src/main.rs src/python.rs
git commit -m "feat: wire up all CLI commands and Python bindings"
```

---

## Summary

| Chunk | Tasks | What it delivers |
|-------|-------|-----------------|
| 1 | 1-2 | ImportanceTier, relevance scoring (with code entity no-decay), Node extensions |
| 2 | 3-5 | `context`, `relevant`, `file-context` commands |
| 3 | 6-7b | `monitor`, `snapshot`, `tick` commands |
| 4 | 8 | `reconcile` with supersession, promotion, GC |
| 5 | 9-10 | Tree-sitter code parsing, `reindex` command |
| 6 | 11 | `impact`, `impact-from-diff` commands (per-edit, not per-task) |
| 7 | 12 | Config parsing, `bootstrap` with all 3 channels (code + conversations + documents) |
| 8 | 13 | Full Claude Code plugin (9 hooks, 4 skills, 1 agent, autoCompactEnabled: false) |
| 9 | 14-15 | Integration testing, CLI wiring, Python bindings |

Each chunk is independently testable and produces a working increment. Chunks 1-7 are the Rust core. Chunk 8 is the plugin packaging. Chunk 9 ties everything together.

## Key architectural invariants to verify during implementation

1. **autoCompactEnabled: false** — MUST be set. We control the compaction lifecycle.
2. **Code entities never decay** — `is_code_entity` flag bypasses decay in relevance().
3. **Impact analysis fires per-edit** — 15 edits = 15 separate impact analyses.
4. **Haiku never receives source code** — only conversation transcript text.
5. **Tree-sitter handles all code structure** — Haiku extracts only semantic knowledge.
6. **Auto memory and KG are complementary** — auto memory = user preferences, KG = project facts.
7. **`tick` combines monitor + snapshot** — single command to reduce per-tool-use overhead.
