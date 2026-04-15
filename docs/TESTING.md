# Testing Guide

## Test Stack

- **pytest** — test runner
- **pytest-asyncio** — async test support
- **unittest.mock** — mocking DeepTeam and Anthropic APIs (no real API calls in tests)

---

## Running Tests

```bash
# All tests
pytest tests/ -v

# Single file
pytest tests/test_transformer.py -v

# With coverage
pip install pytest-cov
pytest tests/ --cov=src --cov-report=term-missing
```

---

## Test Suites

### `tests/test_transformer.py` — Data Layer (5 тестов)

Tests the `transform_risk_assessment()` function in isolation using a mocked `RiskAssessment` object.

| Test | What it verifies |
|------|-----------------|
| `test_adds_owasp_fields_for_known_vulnerability` | PromptInjection → LLM01, Critical |
| `test_calculates_asr_and_pass_rate` | ASR = 1 – pass_rate, correct math |
| `test_serializes_conversations_to_json_string` | Conversations stored as JSON string |
| `test_handles_zero_total_gracefully` | No division-by-zero when total = 0 |
| `test_unknown_vulnerability_defaults_to_medium` | Fallback to LLM09 / Medium |

### `tests/test_runner.py` — Red Team Engine (3 теста)

Tests the runner without making real API calls. The Anthropic client and DeepTeam are fully mocked.

| Test | What it verifies |
|------|-----------------|
| `test_create_anthropic_callback_returns_callable` | Factory returns a callable |
| `test_anthropic_callback_calls_api` | Callback invokes `messages.create` once |
| `test_run_red_team_returns_risk_assessment` | Async runner returns mocked RiskAssessment |

### `tests/test_charts.py` — Red Team Dashboard Charts (5 тестов)

Tests that Plotly figures are generated without errors from sample DataFrame fixtures.

| Test | What it verifies |
|------|-----------------|
| `test_overall_passrate_pie_title` | Title is set correctly |
| `test_asr_by_owasp_bar_not_empty` | Figure has data traces |
| `test_passrate_trend_empty_df` | Handles empty history gracefully |
| `test_passrate_trend_with_data` | Trend renders with data |
| `test_severity_heatmap_not_empty` | Heatmap returns a Figure |

### `tests/test_quality_charts.py` — Quality Eval Charts (13 тестов)

Tests Plotly figures for RAG quality evaluation metrics.

| Test | What it verifies |
|------|-----------------|
| `test_ar_by_category_bar_not_empty` | Bar chart returns non-empty figure |
| `test_ar_by_category_bar_empty_df` | Handles empty DataFrame gracefully |
| `test_ar_by_category_bar_no_category_column` | Handles missing category column |
| `test_ar_by_category_bar_categories_in_data` | Categories appear in chart data |
| `test_ar_distribution_histogram` | Histogram renders with data |
| `test_ar_distribution_histogram_with_category` | Category-colored histogram works |
| `test_ar_distribution_histogram_empty_df` | Empty df → empty figure, no crash |
| `test_quality_trend_line_empty` | Empty runs → empty figure |
| `test_quality_trend_line_with_data` | Trend renders multiple data points |
| `test_quality_trend_line_single_run` | Single run renders without crash |
| `test_faithfulness_vs_relevancy_scatter` | Scatter plot renders with both columns |
| `test_faithfulness_vs_relevancy_scatter_no_faithfulness` | Graceful fallback without faithfulness col |
| `test_faithfulness_vs_relevancy_scatter_empty_df` | Empty df → empty figure |

### `tests/test_eval_storage.py` — Eval Storage (10 тестов)

Tests the `eval_storage.py` reader for RAG quality evaluation results.

| Test | What it verifies |
|------|-----------------|
| `test_list_eval_runs_empty_when_no_dir` | Returns [] when eval results dir missing |
| `test_list_eval_runs_returns_entries` | Reads real metrics.json entries |
| `test_list_eval_runs_newest_first` | Results sorted newest-first |
| `test_load_eval_run_returns_dataframe` | Returns DataFrame from metrics.json |
| `test_load_eval_run_empty_json` | Empty JSON → empty DataFrame |
| `test_quality_score_empty_returns_zero` | Empty df → score 0 |
| `test_quality_score_none_returns_zero` | None → score 0 |
| `test_quality_score_calculation` | Weighted score math is correct |
| `test_quality_score_all_passed` | All perfect → score 100 |
| `test_quality_score_missing_column` | Missing column handled gracefully |

### `tests/test_storage.py` — Storage Layer (12 тестов)

Tests parquet persistence: saving, loading, history concatenation, broken file handling.

| Test | What it verifies |
|------|-----------------|
| `test_save_results_creates_latest` | `latest.parquet` created on save |
| `test_save_results_creates_history_file` | Timestamped copy saved in `history/` |
| `test_save_results_roundtrip` | Saved df matches loaded df exactly |
| `test_load_latest_returns_none_when_missing` | Returns None when no file exists |
| `test_load_latest_returns_dataframe` | Returns DataFrame after save |
| `test_load_history_empty_when_no_dir` | Returns empty df when history dir missing |
| `test_load_history_concatenates_multiple_scans` | Two saves → two rows in history |
| `test_load_history_skips_broken_file` | Broken parquet logged + skipped |
| `test_load_history_skips_empty_dataframes` | Empty parquet file skipped |
| `test_list_scan_files_empty_when_no_history` | Returns [] when no history |
| `test_list_scan_files_returns_metadata` | Returns label, df, path per scan |
| `test_list_scan_files_skips_broken` | Broken file logged + skipped |

### `tests/test_severity.py` — OWASP Registry (11 тестов)

Tests vulnerability→OWASP category resolution, type suffix stripping, fallback logic.

| Test | What it verifies |
|------|-----------------|
| `test_registry_has_known_vulnerabilities` | All 15+ key types present in registry |
| `test_all_registry_entries_have_required_fields` | Every entry has id, name, description, remediation, severity |
| `test_exact_match` | `PromptInjection` → LLM01, Critical |
| `test_strips_type_suffix` | `ToxicityType` → LLM09 |
| `test_strips_subtype_after_dot` | `ToxicityType.INSULTS` → LLM09 |
| `test_pii_leakage_subtype` | `PIILeakageType.DIRECT` → LLM07 |
| `test_excessive_agency_subtype` | `ExcessiveAgencyType.PERMISSIONS` → LLM06, Critical |
| `test_unknown_vulnerability_returns_fallback` | Unknown → LLM09, Medium |
| `test_unknown_subtype_returns_fallback` | `UnknownType.SUBTYPE` → LLM09 |
| `test_critical_severities` | Critical types are CRITICAL |
| `test_bias_subtype_medium` | All `BiasType.*` subtypes are MEDIUM |

### `tests/test_generator.py` — Report Generator (13 тестов)

Tests security score calculation and report context building.

| Test | What it verifies |
|------|-----------------|
| `test_score_empty_df_returns_zero` | Empty df → score 0.0 |
| `test_score_all_passed` | All passed → 100.0 |
| `test_score_all_failed` | All failed → 0.0 |
| `test_score_between_0_and_100` | Score always in [0, 100] |
| `test_score_unknown_severity_uses_low_weight` | Unknown severity → 100 when passed |
| `test_report_context_has_required_keys` | All required keys present in context |
| `test_report_context_client_name` | client_name passed through |
| `test_report_context_totals` | total_tests and total_failed correct |
| `test_report_context_no_history_score_delta_none` | score_delta is None without history |
| `test_report_context_owasp_results_length` | owasp_results has one entry per row |
| `test_report_context_recommendations_only_failed` | Only failed vulns in recommendations |
| `test_report_context_methodology_has_attacks` | methodology.attacks populated |
| `test_report_context_empty_df` | Empty df doesn't crash, score=0 |

### `tests/test_cli.py` — CLI & Config Validation (9 тестов)

Tests YAML loading, target lookup, Pydantic attack config validation, and exit codes.

| Test | What it verifies |
|------|-----------------|
| `test_load_yaml_valid` | Valid YAML parsed correctly |
| `test_load_yaml_invalid_type` | List YAML raises ValueError "must be a mapping" |
| `test_find_target_found` | Returns correct target by name |
| `test_find_target_not_found_shows_available` | Error message lists available names |
| `test_validate_attack_config_valid` | Valid config doesn't raise |
| `test_validate_attack_config_missing_class` | Attack without `class` raises ValueError |
| `test_validate_vulnerability_missing_class` | Vulnerability without `class` raises ValueError |
| `test_validate_attack_config_empty_sections` | Empty attacks/vulns doesn't raise |
| `test_main_exits_1_on_empty_df` | main() exits with code 1 when df is empty |

### `tests/test_pdf_export.py` — PDF / Markdown Export (17 тестов)

Tests Jinja2 template rendering for HTML and Markdown export. WeasyPrint integration is mocked.

| Test | What it verifies |
|------|-----------------|
| `test_html_render_returns_string` | HTML template returns non-empty string |
| `test_html_render_contains_client_name` | client_name in HTML output |
| `test_html_render_contains_security_score` | Score rendered in HTML |
| `test_html_render_with_owasp_results` | OWASP IDs in HTML results section |
| `test_md_render_returns_string` | Markdown template returns non-empty string |
| `test_md_render_contains_client_name` | client_name in Markdown output |
| `test_md_render_contains_security_score` | Score rendered in Markdown |
| `test_md_render_contains_model_version` | Model version rendered |
| `test_md_render_score_delta_none_no_crash` | score_delta=None doesn't crash |
| `test_md_render_score_delta_positive` | `+5` appears for positive delta |
| `test_md_render_score_delta_negative` | `-3` appears for negative delta |
| `test_md_render_with_owasp_results` | OWASP IDs and names in Markdown |
| `test_md_render_with_recommendations` | Remediation text in Markdown |
| `test_md_render_is_valid_markdown_structure` | Output contains `# `, `## `, `\| ` |
| `test_md_render_no_html_tags` | No `<div>`, `<span>`, `<table>` in Markdown |
| `test_export_pdf_raises_when_weasyprint_missing` | RuntimeError when weasyprint absent |
| `test_export_pdf_calls_weasyprint` | WeasyPrint HTML class called with html string |

### `tests/test_app_logic.py` — Dashboard Business Logic (14 тестов)

Tests pure-Python logic from `app.py` in isolation (without Streamlit).

| Test | What it verifies |
|------|-----------------|
| `test_kpi_total_tests` | total = sum of all test counts |
| `test_kpi_total_failed` | failed = sum of failed counts |
| `test_kpi_overall_asr` | ASR = failed / total |
| `test_kpi_asr_zero_when_no_tests` | No division by zero on empty df |
| `test_security_score_from_scan_df` | Score in [0, 100] range |
| `test_cat_map_has_two_categories` | Two distinct OWASP categories detected |
| `test_cat_map_ids` | LLM09 and LLM07 correctly mapped |
| `test_cat_map_worst_asr_wins` | Highest ASR wins when same category |
| `test_cat_map_severity_order` | All severities valid |
| `test_comparison_improved` | delta < 0 → "улучшилось" |
| `test_comparison_worsened` | delta > 0 → "ухудшилось" |
| `test_comparison_unchanged` | delta ≈ 0 → "без изменений" |
| `test_comparison_new_in_b` | Present only in B → "новый тест" |
| `test_comparison_missing_in_b` | Present only in A → "отсутствует в B" |

---

## Test Coverage Summary

| Suite | File | Tests |
|-------|------|-------|
| Red Team Engine | test_runner.py | 3 |
| Data Transformer | test_transformer.py | 5 |
| Storage | test_storage.py | 12 |
| Eval Storage | test_eval_storage.py | 10 |
| OWASP Registry | test_severity.py | 11 |
| Report Generator | test_generator.py | 13 |
| PDF / Markdown Export | test_pdf_export.py | 17 |
| Red Team Charts | test_charts.py | 5 |
| Quality Eval Charts | test_quality_charts.py | 13 |
| CLI Validation | test_cli.py | 9 |
| Dashboard Logic | test_app_logic.py | 14 |
| **Total** | | **~112** |

---

## Mocking Strategy

All tests follow the **London School (mock-first)** approach:

- External dependencies (DeepTeam, Anthropic API, WeasyPrint) are always mocked
- No real HTTP calls in any test
- Each test is fully isolated — no shared state

### Mocking the Anthropic client

```python
from unittest.mock import AsyncMock, MagicMock, patch

mock_client = AsyncMock()
mock_response = MagicMock()
mock_response.content = [MagicMock(text="Safe response")]
mock_client.messages.create.return_value = mock_response

with patch("anthropic.AsyncAnthropic", return_value=mock_client):
    cb = create_anthropic_callback("claude-3-5-sonnet-20241022", "system")
    result = asyncio.run(cb("input"))
```

### Mocking RiskAssessment

```python
def make_mock_risk(rows: list[dict]) -> MagicMock:
    mock = MagicMock()
    mock.to_df.return_value = pd.DataFrame(rows)
    return mock
```

### Mocking WeasyPrint

```python
mock_html_cls = MagicMock()
mock_html_cls.return_value.write_pdf.return_value = b"%PDF-fake"
with patch.dict("sys.modules", {"weasyprint": MagicMock(HTML=mock_html_cls)}):
    result = export_pdf("<html>...</html>")
```

---

## Test Data Fixtures

Standard sample DataFrame used across chart and generator tests:

```python
pd.DataFrame([
    {
        "vulnerability": "ToxicityType.INSULTS",
        "owasp_id": "LLM09", "owasp_name": "Токсичность",
        "severity": "Medium", "pass_rate": 0.0, "asr": 1.0,
        "passed": 0, "failed": 1, "errored": 0, "total": 1,
        "attack_type": "PromptInjection",
        "model_version": "qwen/qwen-2.5-7b-instruct",
        "judge_version": "gpt-4o-mini",
        "session_id": "", "timestamp": "2026-03-31T12:00:00+00:00",
        "conversations": "[...]",
    },
    ...
])
```

---

## CI Test Execution

Tests run automatically in GitHub Actions on every push and PR (when workflow triggers are enabled):

```yaml
- run: pip install -r requirements.txt
- run: pytest tests/ -v
```

Note: The red team scan workflow (`.github/workflows/redteam.yml`) is currently set to `workflow_dispatch` only — tests still run in standard CI on every push.

---

## What Is NOT Tested (Integration)

The following require real credentials or system libraries:

- Actual DeepTeam scan execution (`run_red_team` with real attacks)
- Real Anthropic / OpenRouter API responses
- PDF export via WeasyPrint (requires `brew install pango gdk-pixbuf`)
- Streamlit UI rendering (`st.*` widgets — no headless browser support)
- Next.js web frontend rendering (no frontend test suite yet)
- RAG eval run with real embeddings (requires configured dataset + API keys)

These are validated manually or in dedicated integration test runs with real credentials.

---

## Adding New Tests

1. Add test file in `tests/`
2. Follow naming: `test_<module>.py`
3. Always mock external I/O (API calls, file system writes)
4. Use `pytest.fixture` for shared setup
5. Keep each test focused on a single behavior
