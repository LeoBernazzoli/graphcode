---
paths:
  - "./src/reconcile.rs"
---

ReconcileInput: 3 refs IN
  .promotions: letto in 1 file, scritto in 0
  .superseded: letto in 1 file, scritto in 0
RelationEntry: 1 refs IN
  .relation_type: letto in 2 file, scritto in 0
SupersededEntry: 1 refs IN
FactRelation: 1 refs IN
PromotionEntry: 1 refs IN
  .new_tier: letto in 1 file, scritto in 0
ReconcileReport: 1 refs IN
  .promoted: letto in 1 file, scritto in 0
  .gc_removed: letto in 0 file, scritto in 1
NewFact: 1 refs IN
  .fact_type: letto in 1 file, scritto in 0
  .supersedes: letto in 1 file, scritto in 0
  .reason: letto in 1 file, scritto in 0

garbage_collect (Function): 18 refs IN
test_reconcile_adds_relations (Function): 3 refs IN
reconcile (Function): 2 refs IN
test_reconcile_adds_new_facts (Function): 1 refs IN
parse_tier (Function): 1 refs IN
test_gc_preserves_code_entities (Function): 1 refs IN
test_gc_removes_superseded (Function): 1 refs IN

SE MODIFICHI STRUCT: autoclaw impact <nome> per vedere tutti i riferimenti
SE RINOMINI FUNZIONE: autoclaw impact <nome> prima di procedere
