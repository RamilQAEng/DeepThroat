---
phase: 01-python-pipeline
plan: "01"
subsystem: python-dependencies
tags: [dependencies, ragas, langchain, requirements]
dependency_graph:
  requires: []
  provides: [ragas-importable, langchain-openai-importable, langchain-core-importable]
  affects: [eval/eval_ragas_metrics.py]
tech_stack:
  added: [ragas>=0.2.0, langchain-openai>=0.1.0, langchain-core>=0.2.0]
  patterns: [pip requirements with range pinning for new deps, exact pinning for existing deps]
key_files:
  created: []
  modified: [requirements.txt]
decisions:
  - "Use >= range pinning for new packages to allow pip resolver to find compatible versions with existing openai==2.30.0 and pydantic==2.12.5"
  - "Add only langchain-openai and langchain-core, NOT the monolithic langchain package, per PITFALLS.md #1 and DEP-01"
metrics:
  duration: "5 minutes"
  completed: "2026-04-18"
  tasks_completed: 1
  tasks_total: 1
  files_modified: 1
---

# Phase 01 Plan 01: Add RAGAS Dependencies Summary

**One-liner:** Added ragas>=0.2.0, langchain-openai>=0.1.0, and langchain-core>=0.2.0 to requirements.txt with range pinning, preserving all existing locked versions.

## Objective

Add RAGAS evaluation framework and required LangChain sub-packages to requirements.txt so that Plan 03 (eval_ragas_metrics.py pipeline) can import `ragas`, `LangchainLLMWrapper`, and `ChatOpenAI` without conflicts.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add RAGAS + langchain dependencies to requirements.txt | fee46c6 | requirements.txt |

## Verification Results

All acceptance criteria passed:
- `grep -c "^ragas>=0.2.0$" requirements.txt` = 1
- `grep -c "^langchain-openai>=0.1.0$" requirements.txt` = 1
- `grep -c "^langchain-core>=0.2.0$" requirements.txt` = 1
- `grep -c "^deepeval==3.9.3$" requirements.txt` = 1 (preserved)
- `grep -c "^deepteam==1.0.6$" requirements.txt` = 1 (preserved)
- Monolithic `langchain` package count = 0 (not added)
- Total lines = 20 (was 17 + 3 new)
- `pip install --dry-run -r requirements.txt` resolves successfully, no conflicts

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None. Changes are confined to requirements.txt with no new network endpoints, auth paths, or schema changes.

## Self-Check: PASSED

- `requirements.txt` exists with 20 lines: FOUND
- Commit fee46c6 exists: FOUND
- All 3 new packages present, 0 deletions, dry-run clean
