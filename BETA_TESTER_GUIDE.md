# Autoclaw - Beta Tester Guide

> Questo documento è stato generato automaticamente dal Knowledge Graph del progetto.
> Ogni fatto è tracciabile a una conversazione sorgente. Zero token LLM consumati per il retrieval.

## Cos'è Autoclaw

Autoclaw è un **Knowledge Graph Builder SDK** open source scritto in Rust con bindings Python. Trasforma documenti, conversazioni e memorie in un grafo di conoscenza navigabile da agenti AI.

**In una frase:** dai i tuoi documenti all'agente, lui capisce tutto — senza query, senza vector database, senza API key esterne.

## Il Problema che Risolve

RAG (Retrieval-Augmented Generation) ha una limitazione fondamentale: non capisce il contesto. Taglia i documenti in chunk, cerca per similarità vettoriale, e ritorna frammenti. Non connette idee tra documenti. Non sa che "Marco Bianchi" e "M. Bianchi" sono la stessa persona. Non sa che il Progetto Alpha è collegato al Budget Q3.

Autoclaw costruisce un **grafo di conoscenza reale** con:
- Entità tipizzate (persone, concetti, tecnologie, organizzazioni...)
- Relazioni validate con vincoli di tipo
- Evidenza tracciabile al documento sorgente
- Entity resolution automatica (fuzzy match, alias, singolare/plurale)
- Ontologia auto-generata dal contenuto (non predefinita)

## Come Funziona

```
┌──────────────────────────────────────────────────┐
│           Il tuo agente (Claude/GPT/Llama)        │
│         L'agente È l'LLM. Zero API key.           │
├──────────────────────────────────────────────────┤
│           Autoclaw SDK                            │
│  analyze_content() → prompt per ontologia         │
│  prepare_extraction() → prompt per estrazione     │
│  ingest() → valida, dedup, inserisce nel grafo    │
│  lookup/explore/connect → puro traversal Rust     │
├──────────────────────────────────────────────────┤
│           Rust Core Engine                        │
│  Grafo in-memory │ Entity resolver │ File .kg     │
└──────────────────────────────────────────────────┘
```

**Zero API key esterne:** l'SDK non chiama nessun LLM. Prepara prompt strutturati che il tuo agente (che già È un LLM) processa. L'SDK si occupa solo di validazione, dedup e struttura del grafo.

**Un file:** tutto il knowledge graph persiste in un singolo file `.kg` (MessagePack binario). Nessun database, nessun server.

## Architettura Tecnica

- **Core:** Rust (performance, zero dipendenze)
- **Python SDK:** via PyO3 (bindings nativi, non wrapper)
- **Storage:** file `.kg` (MessagePack, caricato in memoria)
- **CLI:** `autoclaw stats|explore|connect|topics|export`
- **30 test** unitari Rust

### Componenti

| Modulo | Funzione |
|--------|----------|
| `model.rs` | Strutture dati: Node, Edge, Evidence, Ontology |
| `graph.rs` | KnowledgeGraph engine, navigazione, ingestion, dedup |
| `resolver.rs` | Entity resolution: fuzzy match, alias, singular/plural |
| `storage.rs` | Persistenza .kg (MessagePack binary) |
| `prompt.rs` | Generazione prompt strutturati per l'agente |
| `chunker.rs` | Chunking testo con overlap a boundary di frase |
| `claude_parser.rs` | Parser conversazioni Claude Code (JSONL) |
| `python.rs` | Python SDK via PyO3 |

## Risultati dei Test

### Test su 5 tipi di documento isolati

| Documento | Grade | Entità | Relazioni | Coverage | Orphans | related_to |
|-----------|-------|--------|-----------|----------|---------|------------|
| Contratto legale | A | 24 | 33 | 100% | 0.0% | 0.0% |
| Report medico | A | 34 | 61 | 83% | 2.9% | 0.0% |
| Paper scientifico | A | 28 | 56 | 100% | 0.0% | 0.0% |
| Note meeting | A | 29 | 47 | 100% | 0.0% | 0.0% |
| Ricetta/procedura | A | 44 | 70 | 100% | 0.0% | 0.0% |

**5/5 Grade A, 97% coverage media, 0% related_to.**

L'ontologia si adatta automaticamente al dominio:
- Legale → LegalClause, FinancialTerm, Party, SLA
- Medico → Medication, Procedure, Diagnosis, LabResult
- Ricetta → Ingredient, Equipment, Step, Technique

### Test multi-documento (5 documenti, 5 domini)

| Metrica | Valore |
|---------|--------|
| Entità totali | 175 |
| Relazioni totali | 274 |
| Documenti | 5 |
| Orphan ratio | 3.4% |
| related_to ratio | 5.5% |
| Avg degree | 3.1 |

**Path cross-documento funzionanti:**
```
Maria Chen → ACME Corporation → Project Horizon → Machine Learning
Apache Kafka → DataFlow → Apache Spark → MLlib → Machine Learning
VOPA → FalkorDB (diretto)
```

### Test ingestion progetto (conversazioni Claude Code)

| Metrica | Valore |
|---------|--------|
| Conversazioni processate | 3 (da 111 totali, filtrate automatiche) |
| Entità estratte | 89 |
| Relazioni | 88 |
| Coverage concetti chiave | 85% |
| Token LLM per retrieval | **0** |

**Il grafo sa:**
- L'idea iniziale (OpenClaw + self-evolution)
- Il pivot (da self-improving agent a KG builder)
- I competitor (RAGFlow, GraphRAG, LightRAG, Graphiti)
- Le tecnologie scelte (Rust, PyO3, MessagePack)
- I 13 requisiti del progetto
- Il percorso: VOPA → FalkorDB → esperienza KG → nuovo SDK

## Quick Start per il Beta Tester

### Installazione

```bash
git clone <repo>
cd autoclaw
python3 -m venv .venv
source .venv/bin/activate
pip install maturin
maturin develop
```

### Uso base con Python

```python
from autoclaw import PyKnowledgeGraph as KnowledgeGraph

kg = KnowledgeGraph("./test.kg")

# 1. L'agente analizza il contenuto e suggerisce l'ontologia
prompt = kg.analyze_content("testo del documento...")
# → dai questo prompt al tuo LLM, ricevi JSON
kg.update_ontology(risposta_json)

# 2. L'agente estrae entità e relazioni
prompt = kg.prepare_extraction("testo del documento...")
# → dai questo prompt al tuo LLM, ricevi JSON
report = kg.ingest(risposta_json)
# → {added: 12, merged: 3, edges_added: 18}

# 3. Naviga (zero LLM, puro Rust)
kg.lookup("Marco Bianchi")           # trova entità
kg.neighbors("Marco Bianchi")       # connessioni
kg.explore("Marco Bianchi")         # entità + relazioni + evidence
kg.connect("Marco", "Budget Q3")    # trova il percorso
kg.topics()                         # panoramica per tipo
kg.stats()                          # metriche

# 4. Post-processing
kg.connect_orphans()                # collega nodi isolati
kg.discover_connections()           # scopri connessioni implicite

# 5. Salva
kg.save()
```

### Ingestion conversazioni Claude Code

```python
from autoclaw import list_claude_projects, parse_claude_project, get_claude_conversation_text

# Lista progetti
projects = list_claude_projects()

# Analizza conversazioni di un progetto
convs = parse_claude_project("/path/to/project")

# Estrai testo (modalità "user" = solo messaggi utente, dove ci sono le decisioni)
text = get_claude_conversation_text("/path/to/project", session_id, 40000, "user")
```

### CLI

```bash
autoclaw stats                     # overview del grafo
autoclaw explore "Marco Bianchi"   # entità + connessioni
autoclaw connect "A" "B"           # trova percorso
autoclaw topics                    # cluster di conoscenza
autoclaw export                    # JSON completo
```

## Cosa Testare

1. **Diversi tipi di documenti:** prova con i tuoi documenti (PDF, testo, note). L'ontologia si adatta?
2. **Entity resolution:** crea entità con nomi simili. Le riconosce come la stessa?
3. **Cross-document:** indicizza 2+ documenti che parlano degli stessi concetti. I path funzionano?
4. **Ingestion Claude Code:** prova su un tuo progetto con `parse_claude_project()`. Cattura le decisioni?
5. **Performance:** quanto è veloce il lookup/explore su grafi grandi?
6. **Qualità ontologia:** i tipi generati hanno senso per il tuo dominio?

## Cosa NON funziona ancora

- Nessun supporto PDF nativo (serve testo estratto)
- Nessuna UI web (solo CLI + Python SDK)
- Nessun cloud API
- Il nome "autoclaw" è placeholder
- Hook automatico per Claude Code (compaction replacement) non ancora implementato
- Grafi molto grandi (>100k nodi) non testati

## Metriche di Qualità

Il sistema misura automaticamente:

```python
metrics = kg.quality_metrics()
# {
#   "orphan_ratio": 0.034,      # % nodi senza connessioni (target: <5%)
#   "related_to_ratio": 0.055,  # % relazioni generiche (target: <10%)
#   "avg_degree": 3.1,          # connessioni medie per nodo (target: >2)
# }
```

## Perché è Diverso

| | RAG | GraphRAG | Autoclaw |
|---|---|---|---|
| Comprensione | Chunk di testo | Triplette naive | Ontologia tipizzata con validazione |
| Cross-documento | No | Limitato | Entity resolution completa |
| Evidenza | Persa | Parziale | Ogni fatto tracciato alla sorgente |
| Entity resolution | Nessuna | Nessuna | Fuzzy match + alias + singular/plural |
| Velocità | Python | Python | Rust core |
| Setup | Vector DB + embeddings | LLM API + config | `pip install` + un file |
| API key | Necessaria | Necessaria | Nessuna (l'agente è l'LLM) |
| Costo retrieval | ~2-5k token/query | ~2-5k token/query | **Zero token** |
