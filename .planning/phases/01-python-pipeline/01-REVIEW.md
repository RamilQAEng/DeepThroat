---
phase: 01-python-pipeline
reviewed: 2026-04-18T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - requirements.txt
  - eval/custom_metrics/__init__.py
  - eval/custom_metrics/example_metric.py
  - eval/eval_ragas_metrics.py
findings:
  critical: 1
  warning: 5
  info: 4
  total: 10
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-04-18
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

This phase introduces the RAGAS evaluation pipeline (`eval/eval_ragas_metrics.py`) and a custom-metric autodiscovery package (`eval/custom_metrics/`). The code is generally well-structured and follows existing project patterns. However, one critical security issue was found (TLS verification disabled globally), five warnings cover crash-risk edge cases and logic gaps, and four informational items flag style / maintainability items.

---

## Critical Issues

### CR-01: TLS verification disabled — silent MITM exposure

**File:** `eval/eval_ragas_metrics.py:205`
**Issue:** `httpx.Client(timeout=120.0, verify=False)` disables TLS certificate verification for every RAG API call. This allows a man-in-the-middle attacker to intercept or tamper with both the request payload (user queries, category) and the API response (retrieved chunks, actual answer). Evaluation results could be silently poisoned. The project security rules explicitly require HTTPS to be validated.
**Fix:**
```python
# Remove verify=False. If a self-signed cert is required in dev, load the CA bundle:
with _httpx.Client(timeout=120.0, verify=os.getenv("API_CA_BUNDLE", True)) as client:
    ...
```
Add `API_CA_BUNDLE=/path/to/ca.pem` to `.env.example` with an explanation. Never default to `False` in production code.

---

## Warnings

### WR-01: KeyError crash when required env vars are absent

**File:** `eval/eval_ragas_metrics.py:103, 107, 121, 123`
**Issue:** `os.environ["OPENROUTER_API_KEY"]`, `os.environ["OPENAI_API_KEY"]` (in both `build_judge` and `build_embeddings`) raise bare `KeyError` when the variable is missing. The traceback exposes the variable name but gives the operator no actionable guidance. `build_embeddings` always tries `os.environ["OPENAI_API_KEY"]` even when `JUDGE_PROVIDER=openrouter`, forcing users to set an OpenAI key they may not have.
**Fix:**
```python
def _require_env(name: str) -> str:
    val = os.getenv(name)
    if not val:
        raise RuntimeError(
            f"Переменная окружения {name} не установлена. "
            "Добавьте её в .env (см. .env.example)."
        )
    return val

# In build_judge / build_embeddings replace os.environ[...] with _require_env(...)
```
Also consider making `build_embeddings` accept an optional `api_key` parameter so it can reuse the already-resolved key.

### WR-02: `records` and `filtered_records` can desync silently

**File:** `eval/eval_ragas_metrics.py:481-485`
**Issue:** `build_dataset` applies the same filter predicate (`user_query` and `actual_answer` non-empty) that is re-applied manually to produce `filtered_records` at line 481. If the predicate ever diverges between the two locations, `zip(filtered_records, scores_list)` will silently produce misaligned rows — scores will be written to the wrong session_id without any error.
**Fix:** Apply the filter once and pass the result to both `build_dataset` and `save_results`:
```python
valid_records = [
    r for r in records
    if (r.get("user_query") or "").strip() and (r.get("actual_answer") or "").strip()
]
dataset = build_dataset_from_valid(valid_records)   # no internal filter needed
...
out_path = save_results(valid_records, result, run_dir)
```

### WR-03: `save_results` silently drops rows when `records` is longer than `scores_list`

**File:** `eval/eval_ragas_metrics.py:385`
**Issue:** `zip(records, scores_list)` truncates silently when the two sequences differ in length. If RAGAS returns fewer rows than expected (e.g. due to `raise_exceptions=False` dropping samples internally), rows are lost without warning.
**Fix:**
```python
if len(records) != len(scores_list):
    warnings.warn(
        f"Несоответствие: {len(records)} записей, {len(scores_list)} строк от RAGAS. "
        "Результаты могут быть неполными.",
        UserWarning,
    )
for rec, scores in zip(records, scores_list):
    ...
```

### WR-04: Custom metric autodiscovery instantiates classes with no required arguments — fragile

**File:** `eval/eval_ragas_metrics.py:326`
**Issue:** `found.append(cls())` assumes every discovered class can be instantiated with zero arguments. If a user-defined metric adds a required `__init__` parameter (common when wrapping an external scorer), this raises `TypeError` and the metric is silently skipped (the `except Exception` swallows it). The user gets no hint that their metric was ignored.
**Fix:** Keep the `except Exception` guard but log the full traceback so the author can debug:
```python
except Exception as e:
    import traceback
    print(f"[WARN] Не удалось инстанцировать {cls.__name__}: {e}")
    traceback.print_exc()
```
Optionally, document in `example_metric.py` that no-arg construction is a hard requirement.

### WR-05: `load_and_enrich_records` silently succeeds with zero enriched records

**File:** `eval/eval_ragas_metrics.py:249-260`
**Issue:** Every API error is caught and printed but execution continues. If every single record fails (e.g. wrong API URL), `enriched` is empty and the caller at line 444 correctly exits — but the exit message `"Ни одной записи не обогащено"` does not distinguish between "API unreachable" and "dataset file was empty". More importantly, partial failures (some records enriched, some not) produce a metrics file where those records are silently missing, with no count printed.
**Fix:** After the loop, print a summary:
```python
print(f"Обогащено {len(enriched)}/{len(records)} записей.")
if len(enriched) < len(records):
    warnings.warn(
        f"{len(records) - len(enriched)} записей не обогащено — проверьте API.",
        UserWarning,
    )
```

---

## Info

### IN-01: `get_value_by_path` and `resolve_template` are duplicated from `eval_rag_metrics.py`

**File:** `eval/eval_ragas_metrics.py:129-159`
**Issue:** Comments explicitly note these are copies (`# копия из eval_rag_metrics.py:338-352`). Any bug fix in one copy must be manually applied to the other, creating maintenance drift.
**Fix:** Extract both functions into a shared utility module, e.g. `eval/utils/template.py`, and import from both scripts. This is consistent with the project's DRY principle.

### IN-02: Magic constants at module level with no config override

**File:** `eval/eval_ragas_metrics.py:63-64`
**Issue:** `MAX_WORKERS = 3` and `MAX_WAIT = 120` are hard-coded. The existing `eval_config.yaml` already has a `max_workers` field (mentioned in `load_eval_config` docstring) but the pipeline never reads it — `run_config` is constructed from the module-level constants, ignoring `config.get("max_workers")`.
**Fix:**
```python
run_config = RunConfig(
    max_workers=config.get("max_workers", MAX_WORKERS),
    max_wait=config.get("max_wait", MAX_WAIT),
)
```

### IN-03: `CompletenessPrompt` uses `input_model = dict` — untyped prompt input

**File:** `eval/custom_metrics/example_metric.py:51`
**Issue:** `input_model = dict` loses type safety. If `PydanticPrompt` validates its input model, a bare `dict` will bypass any schema check. It also makes it harder for users copying this template to understand what keys are expected.
**Fix:** Define a typed input model:
```python
class CompletenessInput(BaseModel):
    question: str
    answer: str

class CompletenessPrompt(PydanticPrompt[CompletenessInput, CompletenessOutput]):
    input_model = CompletenessInput
    output_model = CompletenessOutput
```
And update the `generate` call accordingly.

### IN-04: `requirements.txt` pins some packages tightly and leaves `gigachat` unpinned

**File:** `requirements.txt:16`
**Issue:** `gigachat` has no version constraint, which can cause non-reproducible installs if a breaking release ships. All other packages are either pinned exactly or use `>=`. Additionally, `pyarrow==23.0.1` is extremely new (April 2025 release) and may conflict with older numpy transitively pulled by other packages; pinning it this tightly with an `==` risks resolution failures.
**Fix:** Pin `gigachat` to the version currently used in the environment:
```
gigachat==0.1.x
```
Consider relaxing `pyarrow` to `>=16.0` unless the exact version is specifically required.

---

_Reviewed: 2026-04-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
