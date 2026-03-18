# Graphocode v2 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade Graphocode from definition-only code indexing to a complete reference graph with auto-generated `.claude/rules/`, pattern-grouped impact analysis, and 4 minimal hooks.

**Architecture:** Extend tree-sitter parser to extract references (calls, field access, type usage). Add `sync-rules` command that generates `.claude/rules/` from KG with PageRank ranking. Upgrade impact analysis to group by pattern and output `additionalContext` JSON. Reduce hooks from 9 to 4.

**Tech Stack:** Rust, tree-sitter, serde_json (for additionalContext output)

---

## Current State (v1)

- 12 Rust modules, 115 tests (112 unit + 3 integration), all passing
- tree-sitter parser extracts **definitions only** (CodeEntity: name, type, definition, file, lines)
- No reference extraction (calls, field access, type usage)
- Impact analysis lists neighbors, no pattern grouping, outputs plain text
- 9 hooks in plugin, but only SessionStart/UserPromptSubmit inject into model
- Test command: `cargo test --no-default-features --lib`

## File Structure

### Files to create:
- `src/references.rs` — Reference extraction from tree-sitter AST (calls, field access, type usage)
- `src/sync_rules.rs` — Generate `.claude/rules/` from KG with PageRank
- `src/pagerank.rs` — PageRank algorithm on the reference graph

### Files to modify:
- `src/treesitter.rs` — Add `CodeReference` struct, return references alongside entities
- `src/graph.rs` — Add methods to store/query reference edges, inbound reference counting
- `src/impact.rs` — Pattern grouping, `additionalContext` JSON output
- `src/bootstrap.rs` — Call reference extraction during bootstrap
- `src/main.rs` — Add `sync-rules` subcommand, update `impact-from-diff` output
- `src/lib.rs` — Register new modules
- `autoclaw-plugin/hooks/hooks.json` — Reduce from 9 to 4 hooks

### Files to remove (cleanup, not delete — just stop using):
- v1 hooks for UserPromptSubmit, PostToolUse(Read), tick, monitor in hooks.json

---

## Chunk 1: Reference Extraction

### Task 1: Add CodeReference type and RefType enum

**Files:**
- Modify: `src/treesitter.rs`

- [ ] **Step 1: Write failing tests for CodeReference extraction**

Add to `src/treesitter.rs` tests:
```rust
#[test]
fn test_extract_call_references() {
    let code = r#"
fn caller() {
    let result = chunk_text("hello", 4000, 500);
    let x = other_func();
}
"#;
    let (_, refs) = parse_rust_code_v2(code, "src/test.rs");
    let calls: Vec<_> = refs.iter().filter(|r| r.ref_type == RefType::Calls).collect();
    assert!(calls.iter().any(|r| r.target_name == "chunk_text"));
    assert!(calls.iter().any(|r| r.target_name == "other_func"));
}

#[test]
fn test_extract_field_read_references() {
    let code = r#"
fn reader(node: &Node) {
    let c = node.confidence;
    let t = node.tier;
}
"#;
    let (_, refs) = parse_rust_code_v2(code, "src/test.rs");
    let reads: Vec<_> = refs.iter().filter(|r| r.ref_type == RefType::ReadsField).collect();
    assert!(reads.iter().any(|r| r.target_name == "confidence"));
    assert!(reads.iter().any(|r| r.target_name == "tier"));
}

#[test]
fn test_extract_field_write_references() {
    let code = r#"
fn writer(node: &mut Node) {
    node.confidence = 0.9;
}
"#;
    let (_, refs) = parse_rust_code_v2(code, "src/test.rs");
    let writes: Vec<_> = refs.iter().filter(|r| r.ref_type == RefType::WritesField).collect();
    assert!(writes.iter().any(|r| r.target_name == "confidence"));
}

#[test]
fn test_extract_type_references() {
    let code = r#"
fn processor(nodes: Vec<Node>, edges: &[Edge]) -> Option<NodeId> {
    None
}
"#;
    let (_, refs) = parse_rust_code_v2(code, "src/test.rs");
    let types: Vec<_> = refs.iter().filter(|r| r.ref_type == RefType::UsesType).collect();
    assert!(types.iter().any(|r| r.target_name == "Node"));
    assert!(types.iter().any(|r| r.target_name == "Edge"));
    assert!(types.iter().any(|r| r.target_name == "NodeId"));
}

#[test]
fn test_extract_method_call_references() {
    let code = r#"
fn user(kg: &mut KnowledgeGraph) {
    kg.add_node(node);
    let n = kg.lookup("test");
}
"#;
    let (_, refs) = parse_rust_code_v2(code, "src/test.rs");
    let methods: Vec<_> = refs.iter().filter(|r| r.ref_type == RefType::MethodCall).collect();
    assert!(methods.iter().any(|r| r.target_name == "add_node"));
    assert!(methods.iter().any(|r| r.target_name == "lookup"));
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cargo test --no-default-features --lib treesitter::tests::test_extract_call`
Expected: FAIL — `parse_rust_code_v2` doesn't exist

- [ ] **Step 3: Add CodeReference and RefType types**

In `src/treesitter.rs`, add:
```rust
#[derive(Debug, Clone, PartialEq)]
pub enum RefType {
    Calls,
    ReadsField,
    WritesField,
    UsesType,
    MethodCall,
}

#[derive(Debug, Clone)]
pub struct CodeReference {
    pub source_file: String,
    pub source_line: usize,
    pub target_name: String,
    pub ref_type: RefType,
}
```

- [ ] **Step 4: Implement parse_rust_code_v2 returning (entities, references)**

Add a new function `parse_rust_code_v2` that calls the existing entity extraction AND a new `extract_references` function that walks the AST looking for:
- `call_expression` → extract function name from first child → RefType::Calls
- `field_expression` → extract field name → RefType::ReadsField (default) or WritesField (if inside assignment_expression LHS)
- `type_identifier` → RefType::UsesType
- `method_call_expression` → extract method name → RefType::MethodCall

```rust
pub fn parse_rust_code_v2(source: &str, file_path: &str) -> (Vec<CodeEntity>, Vec<CodeReference>) {
    let mut parser = Parser::new();
    parser.set_language(&tree_sitter_rust::LANGUAGE.into())
        .expect("Error loading Rust grammar");
    let tree = match parser.parse(source, None) {
        Some(t) => t,
        None => return (Vec::new(), Vec::new()),
    };
    let root = tree.root_node();
    let bytes = source.as_bytes();
    let mut entities = Vec::new();
    extract_from_node(&root, bytes, file_path, &mut entities, None);
    let mut references = Vec::new();
    extract_references(&root, bytes, file_path, &mut references);
    (entities, references)
}

fn extract_references(
    node: &tree_sitter::Node,
    source: &[u8],
    file: &str,
    refs: &mut Vec<CodeReference>,
) {
    match node.kind() {
        "call_expression" => {
            // First child is the function being called
            if let Some(func_node) = node.child_by_field_name("function") {
                let name = node_text(&func_node, source).to_string();
                // For simple calls like func(), name is "func"
                // For method calls like obj.method(), this is handled by method_call below
                if !name.contains('.') {
                    refs.push(CodeReference {
                        source_file: file.into(),
                        source_line: node.start_position().row + 1,
                        target_name: name,
                        ref_type: RefType::Calls,
                    });
                }
            }
        }
        "field_expression" => {
            if let Some(field_node) = node.child_by_field_name("field") {
                let field_name = node_text(&field_node, source).to_string();
                // Check if this is an assignment LHS (write) or read
                let is_write = node.parent()
                    .map(|p| p.kind() == "assignment_expression" &&
                         p.child_by_field_name("left")
                           .map(|l| l.id() == node.id())
                           .unwrap_or(false))
                    .unwrap_or(false);
                refs.push(CodeReference {
                    source_file: file.into(),
                    source_line: node.start_position().row + 1,
                    target_name: field_name,
                    ref_type: if is_write { RefType::WritesField } else { RefType::ReadsField },
                });
            }
        }
        "type_identifier" => {
            let name = node_text(node, source).to_string();
            // Filter out common Rust primitives
            if !["Self", "str", "bool", "u8", "u16", "u32", "u64", "i8", "i16", "i32", "i64",
                 "f32", "f64", "usize", "isize", "String", "Vec", "Option", "Result",
                 "HashMap", "HashSet", "Box", "Arc", "Rc", "Path", "PathBuf"].contains(&name.as_str()) {
                refs.push(CodeReference {
                    source_file: file.into(),
                    source_line: node.start_position().row + 1,
                    target_name: name,
                    ref_type: RefType::UsesType,
                });
            }
        }
        _ => {}
    }

    // Check for method calls: expr.method(args)
    if node.kind() == "call_expression" {
        if let Some(func_node) = node.child_by_field_name("function") {
            if func_node.kind() == "field_expression" {
                if let Some(method_node) = func_node.child_by_field_name("field") {
                    refs.push(CodeReference {
                        source_file: file.into(),
                        source_line: node.start_position().row + 1,
                        target_name: node_text(&method_node, source).to_string(),
                        ref_type: RefType::MethodCall,
                    });
                }
            }
        }
    }

    // Recurse
    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        extract_references(&child, source, file, refs);
    }
}
```

- [ ] **Step 5: Run tests**

Run: `cargo test --no-default-features --lib treesitter`
Expected: All tests PASS (old + new)

- [ ] **Step 6: Commit**

```bash
git add src/treesitter.rs
git commit -m "feat(v2): add reference extraction — calls, field access, type usage, method calls"
```

### Task 2: Store reference edges in KG and update bootstrap/reindex

**Files:**
- Modify: `src/graph.rs`
- Modify: `src/bootstrap.rs`

- [ ] **Step 1: Write tests for reference edge storage and querying**

Add to `src/graph.rs` tests:
```rust
#[test]
fn test_inbound_reference_count() {
    let mut kg = KnowledgeGraph::new();
    kg.reindex_file_v2("src/model.rs", "pub struct Node { pub confidence: f32 }");
    kg.reindex_file_v2("src/graph.rs", r#"
fn relevance(node: &Node) {
    let c = node.confidence;
}
fn ingest(node: &mut Node) {
    node.confidence = 0.9;
}
"#);
    // Node.confidence should have 2 inbound references
    let count = kg.inbound_reference_count("confidence");
    assert!(count >= 2, "Expected >=2 refs, got {}", count);
}

#[test]
fn test_references_for_entity() {
    let mut kg = KnowledgeGraph::new();
    kg.reindex_file_v2("src/chunker.rs", "pub fn chunk_text(text: &str) {}");
    kg.reindex_file_v2("src/bootstrap.rs", "fn boot() { chunk_text(\"x\"); }");
    kg.reindex_file_v2("src/graph.rs", "fn proc() { chunk_text(\"y\"); }");

    let refs = kg.references_to("chunk_text");
    assert_eq!(refs.len(), 2);
    assert!(refs.iter().any(|r| r.source_file.contains("bootstrap")));
    assert!(refs.iter().any(|r| r.source_file.contains("graph")));
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cargo test --no-default-features --lib graph::tests::test_inbound`
Expected: FAIL

- [ ] **Step 3: Add `reindex_file_v2`, `inbound_reference_count`, `references_to` to graph.rs**

`reindex_file_v2` calls `parse_rust_code_v2`, stores entities as nodes (like v1), and stores references as edges with appropriate relation types (calls/reads/writes/uses_type).

`inbound_reference_count(name)` counts edges pointing to the entity with that name.

`references_to(name)` returns all `CodeReference` objects pointing to that entity.

- [ ] **Step 4: Update bootstrap to use v2 parsing**

In `src/bootstrap.rs`, change `bootstrap_code` to call `parse_rust_code_v2` and store both entities and reference edges.

- [ ] **Step 5: Run all tests**

Run: `cargo test --no-default-features --lib`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add src/graph.rs src/bootstrap.rs
git commit -m "feat(v2): store reference edges in KG, update bootstrap with reference extraction"
```

---

## Chunk 2: PageRank and sync-rules

### Task 3: Implement PageRank on the reference graph

**Files:**
- Create: `src/pagerank.rs`
- Modify: `src/lib.rs`

- [ ] **Step 1: Write failing tests**

```rust
#[test]
fn test_pagerank_ranks_highly_referenced() {
    // Node referenced by 10 others should rank higher than node referenced by 1
    let mut edges: Vec<(String, String)> = Vec::new();
    for i in 0..10 {
        edges.push((format!("caller_{}", i), "popular_func".into()));
    }
    edges.push(("single_caller".into(), "unpopular_func".into()));

    let ranks = pagerank(&edges, 20, 0.85);
    assert!(ranks["popular_func"] > ranks["unpopular_func"]);
}

#[test]
fn test_pagerank_empty_graph() {
    let edges: Vec<(String, String)> = Vec::new();
    let ranks = pagerank(&edges, 20, 0.85);
    assert!(ranks.is_empty());
}
```

- [ ] **Step 2: Run tests — fail**

- [ ] **Step 3: Implement PageRank**

```rust
use std::collections::{HashMap, HashSet};

pub fn pagerank(
    edges: &[(String, String)],
    iterations: usize,
    damping: f64,
) -> HashMap<String, f64> {
    let mut nodes: HashSet<&str> = HashSet::new();
    for (from, to) in edges {
        nodes.insert(from);
        nodes.insert(to);
    }
    let n = nodes.len() as f64;
    if n == 0.0 { return HashMap::new(); }

    let mut rank: HashMap<&str, f64> = nodes.iter().map(|&n| (n, 1.0 / n as f64)).collect();
    // ... standard PageRank iteration
}
```

- [ ] **Step 4: Run tests — pass**
- [ ] **Step 5: Commit**

```bash
git add src/pagerank.rs src/lib.rs
git commit -m "feat(v2): add PageRank algorithm for symbol ranking"
```

### Task 4: Implement `autoclaw sync-rules`

**Files:**
- Create: `src/sync_rules.rs`
- Modify: `src/main.rs`
- Modify: `src/lib.rs`

- [ ] **Step 1: Write failing tests**

```rust
#[test]
fn test_generate_project_map() {
    let mut kg = KnowledgeGraph::new();
    kg.reindex_file_v2("src/model.rs", "pub struct Node { pub id: u64 }");
    kg.reindex_file_v2("src/graph.rs", "fn test(n: Node) { let x = n.id; }");

    let map = generate_project_map(&kg);
    assert!(map.contains("model.rs"));
    assert!(map.contains("graph.rs"));
    assert!(map.contains("refs IN")); // shows inbound reference count
}

#[test]
fn test_generate_file_rule() {
    let mut kg = KnowledgeGraph::new();
    kg.reindex_file_v2("src/model.rs", r#"
pub struct Node {
    pub id: u64,
    pub confidence: f32,
}
"#);
    kg.reindex_file_v2("src/graph.rs", "fn r(n: &Node) { let c = n.confidence; }");
    kg.reindex_file_v2("src/resolver.rs", "fn m(n: &Node) { let c = n.confidence; }");

    let rule = generate_file_rule(&kg, "src/model.rs");
    assert!(rule.contains("paths:"));
    assert!(rule.contains("src/model.rs"));
    assert!(rule.contains("Node"));
    assert!(rule.contains("confidence"));
    assert!(rule.contains("letto in")); // read reference info
}

#[test]
fn test_generate_decisions_rule() {
    let mut kg = KnowledgeGraph::new();
    // Add a Critical decision
    let mut node = Node::new(1, "No decay for Critical".into(), "Decision".into(),
        "Critical tier never decays".into(), 0.95, Source::Conversation);
    node.tier = ImportanceTier::Critical;
    kg.add_node(node).unwrap();

    let rule = generate_decisions_rule(&kg);
    assert!(rule.contains("No decay for Critical"));
}

#[test]
fn test_sync_rules_writes_files() {
    let dir = tempfile::tempdir().unwrap();
    let rules_dir = dir.path().join(".claude").join("rules");
    let mut kg = KnowledgeGraph::new();
    kg.reindex_file_v2("src/model.rs", "pub struct Node { pub id: u64 }");

    sync_rules(&kg, &rules_dir);

    assert!(rules_dir.join("project-map.md").exists());
    assert!(rules_dir.join("decisions.md").exists());
}
```

- [ ] **Step 2: Run tests — fail**
- [ ] **Step 3: Implement sync_rules**

```rust
use std::path::Path;
use std::fs;
use crate::graph::KnowledgeGraph;
use crate::model::Source;
use crate::tier::ImportanceTier;

pub fn sync_rules(kg: &KnowledgeGraph, rules_dir: &Path) {
    fs::create_dir_all(rules_dir).ok();

    // 1. project-map.md
    let map = generate_project_map(kg);
    fs::write(rules_dir.join("project-map.md"), map).ok();

    // 2. decisions.md
    let decisions = generate_decisions_rule(kg);
    fs::write(rules_dir.join("decisions.md"), decisions).ok();

    // 3. Per-file rules for files with >5 entities
    let files = collect_source_files(kg);
    for file_path in files {
        let rule = generate_file_rule(kg, &file_path);
        if !rule.is_empty() {
            let safe_name = file_path.replace('/', "-").replace('\\', "-");
            fs::write(rules_dir.join(format!("{}.md", safe_name)), rule).ok();
        }
    }
}

pub fn generate_project_map(kg: &KnowledgeGraph) -> String {
    // Count entities and inbound references per file
    // Sort by inbound reference count (most connected first = PageRank proxy)
    // Format as compact markdown
}

pub fn generate_decisions_rule(kg: &KnowledgeGraph) -> String {
    // Find all Decision/TechnicalFact nodes with tier Critical or Significant
    // Format as imperative rules: "NON...", "USARE..."
}

pub fn generate_file_rule(kg: &KnowledgeGraph, file_path: &str) -> String {
    // Get all entities defined in this file
    // For each entity, count and describe inbound references (reads, writes, calls)
    // Add "SE..." imperative instructions
    // Add YAML frontmatter with paths
}
```

- [ ] **Step 4: Add CLI subcommand**

```rust
"sync-rules" => {
    let kg = load_kg(&kg_path);
    let project_dir = args.iter().position(|a| a == "--project-dir")
        .and_then(|i| args.get(i + 1))
        .map(|s| PathBuf::from(s))
        .unwrap_or_else(|| std::env::current_dir().unwrap());
    let rules_dir = project_dir.join(".claude").join("rules");
    autoclaw::sync_rules::sync_rules(&kg, &rules_dir);
    eprintln!("Rules synced to {}", rules_dir.display());
}
```

- [ ] **Step 5: Run tests — pass**
- [ ] **Step 6: Commit**

```bash
git add src/sync_rules.rs src/pagerank.rs src/main.rs src/lib.rs
git commit -m "feat(v2): add sync-rules command — auto-generates .claude/rules/ from KG"
```

---

## Chunk 3: Pattern-Grouped Impact Analysis

### Task 5: Pattern grouping for impact reports

**Files:**
- Create: `src/patterns.rs`
- Modify: `src/impact.rs`
- Modify: `src/lib.rs`

- [ ] **Step 1: Write failing tests for pattern grouping**

```rust
#[test]
fn test_group_call_patterns() {
    let refs = vec![
        CodeReference { source_file: "a.rs".into(), source_line: 10, target_name: "chunk_text".into(), ref_type: RefType::Calls },
        CodeReference { source_file: "b.rs".into(), source_line: 20, target_name: "chunk_text".into(), ref_type: RefType::Calls },
        CodeReference { source_file: "c.rs".into(), source_line: 30, target_name: "chunk_text".into(), ref_type: RefType::Calls },
    ];
    let patterns = group_by_pattern(&refs);
    assert_eq!(patterns.len(), 1); // all same pattern
    assert_eq!(patterns[0].count, 3);
}

#[test]
fn test_group_read_write_separately() {
    let refs = vec![
        CodeReference { source_file: "a.rs".into(), source_line: 10, target_name: "confidence".into(), ref_type: RefType::ReadsField },
        CodeReference { source_file: "b.rs".into(), source_line: 20, target_name: "confidence".into(), ref_type: RefType::ReadsField },
        CodeReference { source_file: "c.rs".into(), source_line: 30, target_name: "confidence".into(), ref_type: RefType::WritesField },
    ];
    let patterns = group_by_pattern(&refs);
    assert_eq!(patterns.len(), 2); // reads vs writes
    assert!(patterns.iter().any(|p| p.pattern.contains("read") && p.count == 2));
    assert!(patterns.iter().any(|p| p.pattern.contains("write") && p.count == 1));
}
```

- [ ] **Step 2: Run tests — fail**

- [ ] **Step 3: Implement pattern grouping**

```rust
pub struct ReferencePattern {
    pub pattern: String,
    pub count: usize,
    pub example_files: Vec<String>,
    pub total_files: usize,
}

pub fn group_by_pattern(refs: &[CodeReference]) -> Vec<ReferencePattern> {
    // Group by ref_type
    // For Calls: all grouped as "calls <target>"
    // For ReadsField: "reads <field> in N files"
    // For WritesField: "writes <field> in N files"
    // For UsesType: "uses type <name> in N files"
    // For MethodCall: "calls .<method>() in N files"
    // Collect example files (first 3-5)
}

pub fn format_impact_report(entity: &str, patterns: &[ReferencePattern]) -> String {
    // Format as compact markdown report
}
```

- [ ] **Step 4: Run tests — pass**
- [ ] **Step 5: Commit**

```bash
git add src/patterns.rs src/lib.rs
git commit -m "feat(v2): add pattern grouping for impact reports"
```

### Task 6: Update impact-from-diff to output additionalContext JSON

**Files:**
- Modify: `src/impact.rs`
- Modify: `src/main.rs`

- [ ] **Step 1: Write test for JSON output**

```rust
#[test]
fn test_impact_from_diff_outputs_json() {
    let mut kg = KnowledgeGraph::new();
    kg.reindex_file_v2("src/model.rs", "pub struct Node { pub confidence: f32 }");
    kg.reindex_file_v2("src/graph.rs", "fn r(n: &Node) { let c = n.confidence; }");

    let tool_input = r#"{"file_path":"src/model.rs","old_string":"pub confidence: f32","new_string":"pub certainty: f32"}"#;
    let output = impact_from_diff_v2(&kg, tool_input);

    // Should be valid JSON with hookSpecificOutput.additionalContext
    let json: serde_json::Value = serde_json::from_str(&output).unwrap();
    assert!(json.pointer("/hookSpecificOutput/additionalContext").is_some());
}

#[test]
fn test_impact_from_diff_empty_for_internal_change() {
    let mut kg = KnowledgeGraph::new();
    kg.reindex_file_v2("src/chunker.rs", "fn internal() { let x = 1; }");

    let tool_input = r#"{"file_path":"src/chunker.rs","old_string":"let x = 1;","new_string":"let x = 2;"}"#;
    let output = impact_from_diff_v2(&kg, tool_input);

    // Internal logic change — no entities affected — empty output
    assert!(output.is_empty());
}
```

- [ ] **Step 2: Run tests — fail**

- [ ] **Step 3: Implement impact_from_diff_v2**

Update `impact_from_diff` to:
1. Find affected entities in the diff
2. Query reference graph for each
3. Group by pattern
4. If no references found → output nothing (internal change)
5. If references found → output JSON with `hookSpecificOutput.additionalContext`

```rust
pub fn impact_from_diff_v2(kg: &KnowledgeGraph, tool_input: &str) -> String {
    // ... find affected entities ...
    // ... get references, group by pattern ...

    if patterns.is_empty() {
        return String::new();
    }

    let report = format_impact_report(&entity_name, &patterns);

    serde_json::json!({
        "hookSpecificOutput": {
            "additionalContext": report
        }
    }).to_string()
}
```

- [ ] **Step 4: Update main.rs `impact-from-diff` subcommand** to read from stdin and output JSON

- [ ] **Step 5: Run tests — pass**
- [ ] **Step 6: Commit**

```bash
git add src/impact.rs src/main.rs
git commit -m "feat(v2): impact-from-diff outputs additionalContext JSON with pattern-grouped reports"
```

---

## Chunk 4: Plugin Update and Integration Test

### Task 7: Update hooks.json from 9 to 4 hooks

**Files:**
- Modify: `autoclaw-plugin/hooks/hooks.json`

- [ ] **Step 1: Replace hooks.json with v2 version**

Use the exact hooks.json from the v2 spec (4 hooks: SessionStart sync-rules, PreToolUse impact, PostToolUse reindex, Stop snapshot).

- [ ] **Step 2: Update plugin CLAUDE.md** to reflect v2 changes

- [ ] **Step 3: Commit**

```bash
git add autoclaw-plugin/
git commit -m "feat(v2): reduce hooks from 9 to 4, update plugin for rules-based architecture"
```

### Task 8: End-to-end integration test for v2

**Files:**
- Modify: `tests/integration_test.rs`

- [ ] **Step 1: Write v2 integration test**

```rust
#[test]
fn test_v2_full_pipeline() {
    let dir = tempfile::tempdir().unwrap();
    let kg_path = dir.path().join("test.kg");
    let rules_dir = dir.path().join(".claude").join("rules");

    // 1. Bootstrap with v2 (definitions + references)
    let mut kg = KnowledgeGraph::new();
    let config = GraphocodeConfig { /* src/tier.rs */ };
    bootstrap(&mut kg, &config, Path::new("."));

    // 2. Verify reference edges exist
    let refs = kg.references_to("relevance");
    assert!(!refs.is_empty(), "relevance function should have callers");

    // 3. Sync rules
    sync_rules(&kg, &rules_dir);
    assert!(rules_dir.join("project-map.md").exists());
    assert!(rules_dir.join("decisions.md").exists());

    // 4. Verify project-map contains reference counts
    let map = std::fs::read_to_string(rules_dir.join("project-map.md")).unwrap();
    assert!(map.contains("refs IN"));

    // 5. Test pattern-grouped impact
    let impact = impact_from_diff_v2(&kg, r#"{"file_path":"src/tier.rs","old_string":"pub fn relevance","new_string":"pub fn compute_relevance"}"#);
    if !impact.is_empty() {
        let json: serde_json::Value = serde_json::from_str(&impact).unwrap();
        assert!(json.pointer("/hookSpecificOutput/additionalContext").is_some());
    }

    // 6. Save and reload
    save(&kg, &kg_path).unwrap();
    let loaded = load_or_create(&kg_path).unwrap();
    assert_eq!(loaded.stats().node_count, kg.stats().node_count);
}
```

- [ ] **Step 2: Run integration test**

Run: `cargo test --no-default-features --test integration_test test_v2`
Expected: PASS

- [ ] **Step 3: Run full test suite**

Run: `cargo test --no-default-features --lib && cargo test --no-default-features --test integration_test`
Expected: ALL PASS

- [ ] **Step 4: Test on the project itself**

```bash
AUTOCLAW_KG=/tmp/v2_test.kg autoclaw bootstrap
autoclaw sync-rules --project-dir .
ls -la .claude/rules/
cat .claude/rules/project-map.md
cat .claude/rules/decisions.md
autoclaw impact relevance --depth 1
rm /tmp/v2_test.kg
```

- [ ] **Step 5: Commit**

```bash
git add tests/integration_test.rs
git commit -m "test(v2): add end-to-end integration test for reference graph + sync-rules + impact"
```

---

## Summary

| Chunk | Tasks | What it delivers |
|-------|-------|-----------------|
| 1 | 1-2 | Reference extraction (calls, field access, type usage) + storage in KG |
| 2 | 3-4 | PageRank + `sync-rules` command generating `.claude/rules/` |
| 3 | 5-6 | Pattern grouping + `additionalContext` JSON impact output |
| 4 | 7-8 | Plugin update (4 hooks) + integration test |

Each chunk is independently testable. Chunk 1 is the foundation — without reference edges, nothing else works. Chunks 2-3 are independent of each other but both depend on chunk 1. Chunk 4 ties everything together.

## Key invariants to verify

1. `parse_rust_code_v2` returns BOTH entities AND references — existing entity tests must still pass
2. `reindex_file_v2` stores reference edges — `references_to()` returns accurate results
3. `sync-rules` generates valid YAML frontmatter with `paths:` field
4. `impact-from-diff` outputs valid JSON with `hookSpecificOutput.additionalContext`
5. Pattern grouping reduces 10K references to <5 patterns
6. PageRank ranks highly-connected nodes higher than isolated ones
7. Rules files are <30 lines each
8. All 115 existing v1 tests still pass
