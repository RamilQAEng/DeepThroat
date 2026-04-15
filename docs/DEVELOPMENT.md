# Development Guide

## Prerequisites

- Python 3.11+
- Node.js 18+ (for web frontend)
- pip
- Git

## Local Setup

```bash
# 1. Enter the project
cd "RedTeaming DeepThroath v2"

# 2. Create virtual environment
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# 3. Install Python dependencies
pip install -r requirements.txt

# 4. Configure environment
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY / OPENROUTER_API_KEY
```

### Web Frontend (optional)

```bash
cd web
npm install
npm run dev   # http://localhost:3000
```

---

## Running the Stack

### Single scan (manual)
```bash
# Run with a named target and judge preset
python scripts/run_redteam.py --target qwen-7b --judge gemini-flash
```

Options:
```
--config   Path to attack config YAML   (default: config/attack_config.yaml)
--targets  Path to targets YAML         (default: config/targets.yaml)
--target   Target profile name          (default: default)
--model    Override target model
--judge    Judge preset name            (e.g. gemini-flash, gpt-4o-mini, haiku)
--output   Override results directory
```

### Unified Dashboard (Red Team + Quality Eval)
```bash
streamlit run src/dashboard/unified_app.py
```
Opens at http://localhost:8501

Contains two main tabs:
- **Безопасность** — red team results (OWASP heatmap, ASR charts, PDF export)
- **Качество** — RAG evaluation metrics (answer relevancy, faithfulness, quality trend)

### Red Team-only Dashboard
```bash
streamlit run src/dashboard/app.py
```

### RAG Quality Evaluation
```bash
cd eval
python scripts/run_eval.py
```

### Tests
```bash
pytest tests/ -v
```

---

## Project Layout

```
src/
├── red_team/       # Attack execution engine
│   ├── severity.py     OWASP registry + Severity enum + SEVERITY_ORDER
│   ├── attacks.py      Attack/Vulnerability config + class loader
│   ├── judges.py       LLM-as-a-Judge: OpenRouter, Ollama, OpenAI, Anthropic
│   └── runner.py       model_callback + async red team runner
├── data/           # Data persistence layer
│   ├── transformer.py  RiskAssessment → typed DataFrame
│   ├── storage.py      Parquet read/write + history + list_scan_files()
│   └── eval_storage.py Eval results reader (eval/results/ JSON → DataFrame)
├── dashboard/      # Streamlit frontend
│   ├── unified_app.py  Main app (Red Team + Quality Eval tabs) ← use this
│   ├── app.py          Red-team-only standalone dashboard
│   ├── charts.py       Plotly figures (red team)
│   ├── quality_charts.py Plotly figures (RAG quality eval)
│   └── logs_table.py   Filterable dialog viewer
└── reports/        # Client report generation
    ├── generator.py    Report context builder + Security Score
    ├── pdf_export.py   Jinja2 render + WeasyPrint PDF + Markdown export
    └── templates/      report.html + report.css + report.md

config/             # YAML configuration (red team)
scripts/            # CLI entrypoints (red team)
eval/               # RAG quality evaluation sub-system
│   ├── eval_rag_metrics.py   deepeval-based quality runner
│   ├── scripts/run_eval.py   CLI entrypoint
│   ├── config/               eval_config.yaml + targets.yaml
│   ├── datasets/             evaluation datasets
│   └── results/              timestamped eval results (JSON + Markdown)
web/                # Next.js web frontend
│   ├── src/app/              pages: / + /redteam + /runner + /eval
│   ├── src/app/api/          REST endpoints proxying Python scripts
│   └── src/components/       React components
tests/              # pytest test suites
docs/               # All documentation
results/            # Generated data (gitignored)
.github/workflows/  # GitHub Actions (redteam.yml — currently manual-dispatch only)
```

---

## Adding a New Vulnerability

1. Add it to `OWASP_REGISTRY` in [src/red_team/severity.py](../src/red_team/severity.py):

```python
"MyVulnerability": OWASPCategory(
    id="LLM01",
    name="My Vulnerability",
    severity=Severity.HIGH,
    remediation="How to fix it.",
),
```

2. Add it to `config/attack_config.yaml`:

```yaml
vulnerabilities:
  - name: MyVulnerability
    class: deepteam.vulnerabilities.MyVulnerability
    enabled: true
```

3. `transform_risk_assessment()` will automatically pick up the OWASP mapping.

---

## Adding a New Attack

1. Add to `config/attack_config.yaml`:

```yaml
attacks:
  - name: MyNewAttack
    class: deepteam.attacks.single_turn.MyNewAttack
    enabled: true
    params:
      some_param: value
```

2. The `attacks.py` loader handles class instantiation dynamically — no code changes needed unless the attack has special constructor requirements.

---

## Changing the Target Model

Edit `config/targets.yaml` or pass `--model` at runtime:

```bash
python scripts/run_redteam.py --model claude-3-7-sonnet-20250219
```

Or add a new profile:

```yaml
targets:
  - name: new-model
    model: claude-3-7-sonnet-20250219
    system_prompt: |
      Your custom system prompt here.
```

---

## Results Storage

Red team results are stored in `results/`:

```
results/
├── latest.parquet          ← always the most recent scan
└── history/
    ├── 20260327T120000Z.parquet
    └── 20260401T090000Z.parquet
```

Quality eval results are stored in `eval/results/`:

```
eval/results/
└── {timestamp}_{dataset_name}/
    ├── metrics.json        ← per-question scores
    └── report.md           ← human-readable summary
```

---

## Code Style

- Type hints on all public functions
- No hardcoded secrets — all credentials via env vars or `.env`
- Files under 500 lines (⚠️ `unified_app.py` currently 666 lines — refactor tracked)
- No `print()` in library code — use return values
- Input validation at system boundaries (`scripts/`, config loaders)

---

## Selecting a Judge Model

The `--judge` flag sets both the **simulator** (generates attack prompts) and the **evaluator** (scores responses). If omitted, deepteam defaults to `gpt-4o-mini` via `OPENAI_API_KEY`.

```bash
# Cheap OpenRouter judge (recommended)
python scripts/run_redteam.py --target qwen-7b --judge gemini-flash

# Local free judge (requires Ollama)
ollama pull llama3.2 && ollama serve
python scripts/run_redteam.py --target qwen-7b --judge ollama-llama
```

Available presets: `gpt-4o-mini-or` *(recommended)*, `haiku-or`, `gemini-flash`, `gpt-4o-mini`, `gpt-4o`, `llama3-70b`, `qwen-2.5-72b`, `haiku`, `ollama-llama`, `ollama-mistral`, `ollama-phi`

Custom presets can be added in `config/attack_config.yaml` without editing code:
```yaml
judge_custom_presets:
  my-judge:
    provider: openrouter
    model: mistralai/mistral-small-3.1-24b-instruct
```

---

## Environment Variables Reference

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Required for Anthropic targets (Claude) |
| `OPENROUTER_API_KEY` | Required for OpenRouter targets (Qwen, Gemini, Llama) and judge |
| `OPENAI_API_KEY` | Optional. For OpenAI judge (`gpt-4o-mini`) |
| `RESULTS_DIR` | Override results directory (default: `./results`) |
| `EVAL_RESULTS_DIR` | Override eval results directory (default: `./eval/results`) |
| `OPENROUTER_BASE_URL` | Override OpenRouter API base URL (default: `https://openrouter.ai/api/v1`) |

---

## Known Issues & Gotchas

1. **DeepTeam Async Callbacks**: When using `async_mode=True` in `DeepTeam`, your `model_callback` MUST be explicitly defined as `async def` and MUST use asynchronous HTTP clients (`AsyncAnthropic`, `AsyncOpenAI`). If a synchronous function is used, DeepTeam fails with `TypeError: object RTTurn can't be used in 'await' expression`.
2. **Transformer DataFrame Mapping**: The current version of DeepTeam's `RiskAssessment` object does not have a `to_df()` method. You must manually iterate through `risk_assessment.overview.vulnerability_type_results` and `risk_assessment.test_cases` to build the Pandas DataFrame (as implemented in `src/data/transformer.py`).
3. **ModelRefusalError**: Safety-aligned models used as the attacker may refuse to generate harmful prompts. Pass `ignore_errors=True` to `red_team(...)` so the framework skips refused attacks instead of failing completely.
4. **unified_app.py size**: At 666 lines, this file exceeds the 500-line CLAUDE.md limit. Planned refactor: extract tab render functions into `src/dashboard/tabs/`.
5. **GitHub Actions disabled**: `.github/workflows/redteam.yml` exists but is set to `workflow_dispatch` only (auto-triggers disabled). To re-enable push/PR triggers, restore the `on: push/pull_request` section.

## Project Limits & Constants

- **File Size**: All source files (`.py`) MUST be kept under **500 lines** (as per `CLAUDE.md`).
- **Simulation Depth**: Controlled via `attacks_per_vulnerability_type` in `config/attack_config.yaml`.
- **Result Storage**: Parquet history files grow linearly with each scan.
- **Secrets**: API keys MUST NOT be committed. Use `.env` or system environment variables.

---

## Troubleshooting

**`ModuleNotFoundError: No module named 'deepteam'`**
```bash
pip install deepteam
```

**`weasyprint` PDF export fails on macOS**
```bash
brew install pango gdk-pixbuf libffi
pip install weasyprint
```

**Streamlit can't find results**
The dashboard expects `results/latest.parquet` to exist. Run a scan first:
```bash
python scripts/run_redteam.py
```

**Quality Eval tab shows no data**
The eval tab reads from `eval/results/`. Run a quality eval first:
```bash
cd eval && python scripts/run_eval.py
```

**Tests fail with `ANTHROPIC_API_KEY not set`**
Tests mock the API client — make sure you're running tests via `pytest`, not directly:
```bash
pytest tests/ -v
```
