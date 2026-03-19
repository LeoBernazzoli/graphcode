---
name: graphocode-start
description: Bootstrap the knowledge graph by indexing all code and generating .claude/rules/. Run on first use or to refresh.
disable-model-invocation: true
allowed-tools: Bash, Read
---

# Bootstrap Knowledge Graph

Run these steps in order:

1. **Bootstrap** (indexes all code with tree-sitter, 0 LLM tokens):
   ```bash
   autoclaw init
   ```

2. **Verify**:
   ```bash
   autoclaw stats
   ```

3. Report the results to the user: nodes, edges, rule files generated.

That's it. The `init` command does bootstrap + sync-rules automatically.
If `autoclaw` is not found, install it: `cargo install autoclaw` or download from https://github.com/LeoBernazzoli/graphcode/releases
