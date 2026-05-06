# DeepThroat Agent Guide

This file is kept as a compatibility entry point for tools that still look for
Claude-style project instructions. The canonical lightweight instructions for
Codex are in `AGENTS.md`.

## Use The Codex Workflow

- Read `AGENTS.md` first.
- Use `jcodemunch` for code discovery before broad file reads.
- Use `context7` only for current documentation on a concrete library/API.
- Use Playwright/browser automation only for UI and browser-flow checks.
- Avoid loading generated results, caches, local secrets, `.claude/`,
  `.claude-flow/`, `.swarm/`, and virtualenv files.

## Project Anchors

- Backend/API: `src/api/`
- Red-team core: `src/red_team/`
- Evaluation/reporting: `eval/`, `src/reports/`, `src/data/`
- Frontend: `web/`
- Tests: `tests/`

## Verification

- Python: `python -m pytest`
- Frontend from `web/`: `npm run lint`, `npx tsc --noEmit`

Keep changes focused, typed, and covered by the smallest useful verification.
