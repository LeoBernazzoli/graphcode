#!/usr/bin/env python3
"""
Isolated document type tests. Each document is processed independently
in its own KG to verify extraction quality per domain.

Tests: legal contract, medical report, research paper abstract,
meeting notes, financial filing, recipe/procedure.

Usage:
    source .venv/bin/activate
    python examples/test_document_types.py
"""

import json
import os
import subprocess
import sys
import time
import re

# ── Helpers ──────────────────────────────────────────────────────

def ask_claude(prompt: str) -> str:
    result = subprocess.run(
        ["claude", "-p", prompt, "--output-format", "json", "--model", "sonnet"],
        capture_output=True, text=True, timeout=300,
    )
    if result.returncode != 0:
        return '{"entities":[],"relations":[]}'
    try:
        response = json.loads(result.stdout)
        return response.get("result", "")
    except json.JSONDecodeError:
        return result.stdout


def extract_json(text: str) -> dict:
    match = re.search(r"```(?:json)?\s*\n?(.*?)\n?\s*```", text, re.DOTALL)
    if match:
        text = match.group(1)
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"entities": [], "relations": []}


# ── Test Documents ───────────────────────────────────────────────

LEGAL_CONTRACT = """
SERVICES AGREEMENT

This Services Agreement ("Agreement") is entered into as of January 15, 2025,
by and between TechVentures Inc., a Delaware corporation with principal offices
at 100 Innovation Drive, San Jose, CA 95134 ("Client"), and CloudScale Solutions LLC,
a California limited liability company ("Provider").

1. SCOPE OF SERVICES
Provider shall deliver cloud infrastructure management services ("Services") to Client,
including but not limited to: (a) migration of Client's existing on-premise infrastructure
to Amazon Web Services ("AWS"); (b) implementation of a Kubernetes-based container
orchestration platform; (c) 24/7 monitoring and incident response with a guaranteed
response time of 15 minutes for Severity 1 incidents.

2. TERM AND TERMINATION
This Agreement shall commence on February 1, 2025 ("Effective Date") and continue
for an initial term of 36 months ("Initial Term"). Either party may terminate this
Agreement for cause upon 30 days written notice if the other party materially breaches
any provision and fails to cure within the notice period.

3. COMPENSATION
Client shall pay Provider a monthly fee of $125,000 ("Monthly Fee") for the Services.
Additionally, Client shall reimburse Provider for pre-approved expenses not to exceed
$15,000 per month. Payment terms are Net 30 from invoice date.

4. SERVICE LEVEL AGREEMENT
Provider guarantees 99.95% uptime for all production systems ("SLA"). If Provider
fails to meet the SLA in any calendar month, Client shall receive a credit equal to
10% of the Monthly Fee for each 0.1% below the SLA target, up to a maximum credit
of 30% of the Monthly Fee.

5. CONFIDENTIALITY
Each party agrees to maintain the confidentiality of all Confidential Information
received from the other party. "Confidential Information" includes all business,
technical, and financial information marked as confidential or that a reasonable
person would consider confidential.

6. INTELLECTUAL PROPERTY
All pre-existing intellectual property remains the property of the respective party.
Any custom tools, scripts, or configurations developed by Provider specifically for
Client under this Agreement ("Work Product") shall be owned by Client upon full
payment. Provider retains the right to use general knowledge and techniques gained.

7. LIABILITY
Provider's total liability under this Agreement shall not exceed the total fees paid
by Client in the 12 months preceding the claim. Neither party shall be liable for
indirect, incidental, or consequential damages.

Signed:
John Matthews, CEO, TechVentures Inc.
Lisa Park, Managing Partner, CloudScale Solutions LLC
"""

MEDICAL_REPORT = """
DISCHARGE SUMMARY

Patient: Robert J. Anderson, DOB: 03/15/1958, MRN: 4872-9301
Attending Physician: Dr. Sarah Mitchell, MD, Department of Cardiology
Admission Date: November 2, 2025 | Discharge Date: November 8, 2025

CHIEF COMPLAINT: Chest pain and shortness of breath on exertion.

HISTORY OF PRESENT ILLNESS:
Mr. Anderson is a 67-year-old male with a history of hypertension, type 2 diabetes
mellitus, and hyperlipidemia who presented to the emergency department with acute
onset substernal chest pain radiating to the left arm, associated with diaphoresis
and dyspnea. Symptoms began approximately 2 hours prior to arrival. ECG showed
ST-segment elevation in leads V1-V4, consistent with anterior STEMI.

HOSPITAL COURSE:
The patient was taken emergently to the cardiac catheterization lab where coronary
angiography revealed 95% stenosis of the left anterior descending (LAD) artery.
Percutaneous coronary intervention (PCI) was performed with placement of a
drug-eluting stent (DES). The procedure was performed by Dr. James Chen, interventional
cardiologist. Post-procedure, the patient's troponin I peaked at 45.2 ng/mL.

The patient was started on dual antiplatelet therapy (DAPT) with aspirin 81mg daily
and clopidogrel (Plavix) 75mg daily. Atorvastatin was increased to 80mg daily.
Metoprolol succinate 50mg daily was initiated for rate control and cardioprotection.
Lisinopril 10mg daily was continued for blood pressure management.

Echocardiogram on Day 3 showed left ventricular ejection fraction (LVEF) of 40%
with anterior wall hypokinesis. No significant valvular disease.

DISCHARGE MEDICATIONS:
1. Aspirin 81mg daily
2. Clopidogrel 75mg daily (continue for 12 months)
3. Atorvastatin 80mg daily
4. Metoprolol succinate 50mg daily
5. Lisinopril 10mg daily
6. Metformin 1000mg twice daily

FOLLOW-UP:
- Cardiology clinic with Dr. Mitchell in 2 weeks
- Cardiac rehabilitation referral submitted
- Repeat echocardiogram in 3 months
"""

RESEARCH_ABSTRACT = """
Title: Retrieval-Augmented Generation with Hierarchical Knowledge Graphs
for Multi-Document Reasoning

Authors: Wei Zhang, Priya Sharma, Marcus Johnson, Yuki Tanaka
Affiliation: Stanford NLP Group, Department of Computer Science, Stanford University
Published: Proceedings of ACL 2025, Vienna, Austria

Abstract:
We present HiKG-RAG, a novel framework that combines hierarchical knowledge graphs
with retrieval-augmented generation for complex multi-document reasoning tasks.
Unlike standard RAG approaches that rely on flat vector similarity search,
HiKG-RAG constructs a multi-level knowledge graph where entities are organized
by abstraction level, enabling both local detail retrieval and global theme
understanding.

Our framework consists of three components: (1) an automated knowledge graph
constructor that uses GPT-4 for entity and relation extraction with ontology-guided
prompting, (2) a hierarchical graph index that organizes entities across document,
section, and paragraph levels, and (3) a graph-aware retrieval module that traverses
the hierarchy to gather contextually relevant evidence before generation.

We evaluate HiKG-RAG on three benchmarks: MultiHop-QA (multi-hop question answering),
DocMerge (cross-document summarization), and FactCheck (multi-source fact verification).
On MultiHop-QA, HiKG-RAG achieves 78.3% F1, outperforming standard RAG (61.2%) and
GraphRAG (69.7%) by significant margins. On DocMerge, our approach achieves a ROUGE-L
score of 42.1 compared to 33.8 for standard RAG. On FactCheck, HiKG-RAG achieves
85.2% accuracy versus 71.4% for the best baseline.

Ablation studies show that the hierarchical organization contributes +8.4% F1 on
MultiHop-QA, while the ontology-guided extraction improves relation quality by 23%
measured by human evaluation. We release our code and data at github.com/stanfordnlp/hikg-rag.
"""

MEETING_NOTES = """
Product Team Weekly Sync - March 10, 2026
Attendees: Alex Rivera (PM), Jordan Chen (Engineering Lead), Sam Patel (Design),
          Maya Kim (Data Science), Chris Wu (QA)

## Status Updates

### Search Redesign (Jordan)
- Elasticsearch migration is 80% complete. Remaining work: synonym handling and
  fuzzy matching for product names
- Performance benchmarks show 3x improvement in query latency (from 450ms to 150ms p95)
- Blockers: need DevOps support from Tom's team to set up production Elasticsearch cluster
- Target: ship to 10% of users by March 24

### Recommendation Engine v2 (Maya)
- New collaborative filtering model trained on 6 months of clickstream data
- A/B test results: +12% CTR, +8% conversion rate vs current model
- Concern: cold start problem for new users (first 5 interactions show poor recommendations)
- Maya will implement a hybrid approach using content-based filtering for cold start users
- Dependencies: needs updated user preference API from Jordan's team

### Mobile App Redesign (Sam)
- Figma prototypes for new navigation shared with stakeholders
- User testing scheduled for March 17 with 15 participants
- Key change: bottom navigation bar replacing hamburger menu
- Alex raised concern about backward compatibility with existing deep links

## Action Items
- [ ] Jordan: coordinate with Tom on Elasticsearch production setup by March 14
- [ ] Maya: write RFC for hybrid recommendation approach by March 12
- [ ] Sam: prepare user testing protocol and share with QA by March 15
- [ ] Chris: set up automated regression suite for search migration
- [ ] Alex: schedule review with VP Product (Diana Torres) for March 20 decision on mobile nav
"""

RECIPE_PROCEDURE = """
# Sourdough Bread - Traditional Method

## Ingredients
- 500g bread flour (King Arthur preferred)
- 350g water (70% hydration)
- 100g active sourdough starter (fed 4-8 hours before use)
- 10g salt

## Equipment
- Dutch oven (Lodge 5-quart recommended)
- Banneton proofing basket
- Bench scraper
- Digital kitchen scale
- Lame or razor blade for scoring

## Day 1: Mix and Bulk Fermentation

### Step 1: Autolyse (9:00 AM)
Combine flour and water in a large bowl. Mix until no dry flour remains.
Cover and rest for 30-60 minutes. This allows the flour to fully hydrate
and begins gluten development without kneading.

### Step 2: Add Starter and Salt (10:00 AM)
Add the sourdough starter and salt to the autolysed dough. Mix by hand
using the Rubaud method: reach under the dough with wet hands, stretch it
up, and fold it over itself. Continue for 5 minutes until starter and salt
are fully incorporated. The dough should feel shaggy but cohesive.

### Step 3: Stretch and Fold (10:30 AM - 1:00 PM)
Perform 4 sets of stretch and folds at 30-minute intervals. For each set,
grab one side of the dough, stretch it up, and fold it over the center.
Rotate the bowl 90 degrees and repeat. Complete 4 folds per set (one from
each direction). The dough should become smoother and more elastic with each set.

### Step 4: Bulk Fermentation (1:00 PM - 5:00 PM)
Allow the dough to ferment at room temperature (75-78°F / 24-26°C) for
approximately 4 hours. The dough is ready when it has increased in volume
by 50-75%, feels airy and jiggly, and shows bubbles on the surface and sides.

### Step 5: Pre-shape (5:00 PM)
Turn the dough onto a lightly floured surface. Using a bench scraper,
shape into a loose round by tucking the edges underneath. Let rest uncovered
for 20 minutes (bench rest). This relaxes the gluten for final shaping.

### Step 6: Final Shape and Cold Retard (5:30 PM)
Flip the dough seam-side up. Fold the bottom third up, the top third down,
then roll tightly from top to bottom. Place seam-side up in a floured
banneton. Cover with plastic wrap and refrigerate for 12-16 hours.

## Day 2: Bake

### Step 7: Preheat (8:00 AM)
Place Dutch oven with lid in oven. Preheat to 500°F (260°C) for 45 minutes.

### Step 8: Score and Bake (8:45 AM)
Remove dough from refrigerator. Turn onto parchment paper. Score the top
with a lame at a 30-degree angle, making one swift, decisive cut about
1/2 inch deep. Carefully place dough in the preheated Dutch oven.
Bake covered at 500°F for 20 minutes (steam phase).

### Step 9: Finish (9:05 AM)
Remove lid. Reduce temperature to 450°F (230°C). Bake uncovered for
20-25 minutes until deep golden brown. Internal temperature should reach
205-210°F (96-99°C). Remove from Dutch oven and cool on a wire rack
for at least 1 hour before slicing.
"""

# ── Test Runner ──────────────────────────────────────────────────

DOCUMENTS = [
    ("Legal Contract", LEGAL_CONTRACT, "legal_contract.pdf",
     ["TechVentures", "CloudScale", "John Matthews", "Lisa Park", "AWS", "Kubernetes"],
     ["Party", "Person", "Organization"]),

    ("Medical Report", MEDICAL_REPORT, "discharge_summary.pdf",
     ["Robert Anderson", "Sarah Mitchell", "James Chen", "LAD", "aspirin", "stent"],
     ["Patient", "Person", "Physician", "Medication", "Procedure"]),

    ("Research Paper", RESEARCH_ABSTRACT, "hikg_rag_paper.pdf",
     ["HiKG-RAG", "Wei Zhang", "Stanford", "MultiHop-QA", "GPT-4"],
     ["Person", "Method", "Framework", "Benchmark"]),

    ("Meeting Notes", MEETING_NOTES, "weekly_sync.pdf",
     ["Alex Rivera", "Jordan Chen", "Elasticsearch", "recommendation engine"],
     ["Person", "Project", "Technology"]),

    ("Recipe/Procedure", RECIPE_PROCEDURE, "sourdough_recipe.pdf",
     ["sourdough starter", "autolyse", "Dutch oven", "banneton"],
     ["Ingredient", "Equipment", "Step", "Technique"]),
]


def test_document(doc_name, text, filename, expected_entities, expected_types):
    from autoclaw import PyKnowledgeGraph as KnowledgeGraph

    print(f"\n{'─' * 60}")
    print(f"  {doc_name}")
    print(f"{'─' * 60}")

    kg_path = f"/tmp/test_{filename.replace('.pdf', '')}.kg"
    if os.path.exists(kg_path):
        os.unlink(kg_path)
    kg = KnowledgeGraph(kg_path)

    start = time.time()

    # 1. Analyze ontology
    chunks = kg.chunk_text(text, 4000, 500)
    if not chunks:
        chunks = [text]

    ontology_prompt = kg.analyze_content(chunks[0])
    ontology_response = ask_claude(ontology_prompt)
    ontology_json = extract_json(ontology_response)
    kg.update_ontology(json.dumps(ontology_json))

    suggested_types = [t["name"] for t in ontology_json.get("suggested_entity_types", [])]

    # 2. Extract
    total_added = 0
    total_merged = 0
    total_edges = 0

    for i, chunk in enumerate(chunks):
        prompt = kg.prepare_extraction(chunk)
        response = ask_claude(prompt)
        result = extract_json(response)
        report = kg.ingest_document(json.dumps(result), filename, page=i+1)
        total_added += report["added"]
        total_merged += report["merged"]
        total_edges += report["edges_added"]

    # 3. Post-process
    kg.connect_orphans()
    kg.discover_connections()
    kg.save()

    elapsed = time.time() - start

    # 4. Quality analysis
    q = json.loads(kg.quality_metrics())
    stats = json.loads(kg.stats())

    print(f"  Time: {elapsed:.1f}s")
    print(f"  Entities: {q['total_nodes']}, Edges: {q['total_edges']}")
    print(f"  Orphan ratio: {q['orphan_ratio']:.1%}")
    print(f"  related_to ratio: {q['related_to_ratio']:.1%}")
    print(f"  Avg degree: {q['avg_degree']:.1f}")

    # Check expected entities
    print(f"\n  Entity Coverage:")
    found = 0
    for expected in expected_entities:
        result = kg.lookup(expected)
        if result:
            data = json.loads(result)
            print(f"    ✓ '{expected}' -> {data['name']} ({data['node_type']})")
            found += 1
        else:
            print(f"    ✗ '{expected}' NOT FOUND")
    coverage = found / len(expected_entities) * 100
    print(f"  Coverage: {found}/{len(expected_entities)} ({coverage:.0f}%)")

    # Check expected types in ontology
    print(f"\n  Type Coverage:")
    type_found = 0
    actual_types = list(stats["node_types"].keys())
    for expected_type in expected_types:
        matched = any(expected_type.lower() in t.lower() or t.lower() in expected_type.lower()
                      for t in actual_types)
        if matched:
            print(f"    ✓ '{expected_type}' present")
            type_found += 1
        else:
            print(f"    ✗ '{expected_type}' missing (have: {actual_types[:5]})")
    type_coverage = type_found / len(expected_types) * 100

    # Show node types
    print(f"\n  Node types: {stats['node_types']}")

    # Show edge types
    print(f"  Edge types: {stats['edge_types']}")

    # Sample relations
    data = json.loads(kg.export_json())
    id_to_name = {int(nid): n['name'] for nid, n in data['nodes'].items()}
    print(f"\n  Sample relations:")
    for edge in data['edges'][:5]:
        src = id_to_name.get(edge['from'], '?')
        tgt = id_to_name.get(edge['to'], '?')
        print(f"    {src} --[{edge['relation_type']}]--> {tgt}")

    # Score
    score = 0
    if coverage >= 80: score += 3
    elif coverage >= 60: score += 2
    elif coverage >= 40: score += 1

    if q['orphan_ratio'] <= 0.05: score += 2
    elif q['orphan_ratio'] <= 0.15: score += 1

    if q['related_to_ratio'] <= 0.10: score += 2
    elif q['related_to_ratio'] <= 0.25: score += 1

    if q['avg_degree'] >= 2.5: score += 2
    elif q['avg_degree'] >= 1.5: score += 1

    if type_coverage >= 60: score += 1

    grade = "A" if score >= 8 else "B" if score >= 6 else "C" if score >= 4 else "D"
    print(f"\n  GRADE: {grade} (score {score}/10)")
    print(f"    entity coverage={coverage:.0f}%, orphans={q['orphan_ratio']:.1%}, "
          f"related_to={q['related_to_ratio']:.1%}, degree={q['avg_degree']:.1f}, "
          f"type_coverage={type_coverage:.0f}%")

    return {
        "name": doc_name,
        "grade": grade,
        "score": score,
        "entities": q["total_nodes"],
        "edges": q["total_edges"],
        "entity_coverage": coverage,
        "orphan_ratio": q["orphan_ratio"],
        "related_to_ratio": q["related_to_ratio"],
        "avg_degree": q["avg_degree"],
        "time": elapsed,
    }


def main():
    print("=" * 60)
    print("  Isolated Document Type Tests")
    print("=" * 60)

    results = []
    for doc_name, text, filename, expected_ents, expected_types in DOCUMENTS:
        result = test_document(doc_name, text, filename, expected_ents, expected_types)
        results.append(result)

    # Summary
    print("\n" + "=" * 60)
    print("  SUMMARY")
    print("=" * 60)
    print(f"\n  {'Document':<20} {'Grade':>5} {'Score':>5} {'Entities':>8} {'Edges':>6} "
          f"{'Coverage':>8} {'Orphans':>8} {'Degree':>6} {'Time':>6}")
    print(f"  {'─'*20} {'─'*5} {'─'*5} {'─'*8} {'─'*6} {'─'*8} {'─'*8} {'─'*6} {'─'*6}")
    for r in results:
        print(f"  {r['name']:<20} {r['grade']:>5} {r['score']:>5} {r['entities']:>8} "
              f"{r['edges']:>6} {r['entity_coverage']:>7.0f}% {r['orphan_ratio']:>7.1%} "
              f"{r['avg_degree']:>6.1f} {r['time']:>5.0f}s")

    avg_score = sum(r["score"] for r in results) / len(results)
    avg_coverage = sum(r["entity_coverage"] for r in results) / len(results)
    print(f"\n  Average score: {avg_score:.1f}/10")
    print(f"  Average entity coverage: {avg_coverage:.0f}%")
    print(f"  Total time: {sum(r['time'] for r in results):.0f}s")


if __name__ == "__main__":
    main()
