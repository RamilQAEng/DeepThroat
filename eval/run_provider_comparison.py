"""
Run RAGAS evaluation against multiple judge providers in parallel and print a comparison table.

Usage:
    python eval/run_provider_comparison.py eval/datasets/dataset.json \
        --judges gpt4o-mini-or,qwen-72b-or,gemini-flash \
        --limit 5

    # Show available judges from targets.yaml:
    python eval/run_provider_comparison.py --list-judges
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import yaml

EVAL_DIR = Path(__file__).parent
TARGETS_PATH = EVAL_DIR / "config" / "targets.yaml"
RESULTS_DIR = EVAL_DIR / "results"

SCORE_KEYS = [
    "faithfulness_score",
    "answer_relevancy_score",
    "context_precision_score",
    "context_recall_score",
    "answer_correctness_score",
]


def list_judges() -> list[dict]:
    if not TARGETS_PATH.exists():
        return []
    with open(TARGETS_PATH, encoding="utf-8") as f:
        cfg = yaml.safe_load(f) or {}
    return cfg.get("targets", [])


def run_judge(dataset: Path, judge_alias: str, limit: int | None, python: str) -> tuple[str, str | None]:
    """Run eval for one judge in a thread. Returns (alias, run_dir_name | None)."""
    cmd = [python, str(EVAL_DIR / "eval_ragas_metrics.py"), str(dataset), f"--judge={judge_alias}"]
    if limit:
        cmd.append(f"--limit={limit}")

    print(f"[{judge_alias}] Starting…")
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd=str(EVAL_DIR),
            timeout=600,
        )
        if result.returncode != 0:
            print(f"[{judge_alias}] FAILED (exit {result.returncode})")
            if result.stderr:
                print(result.stderr[-500:])
            return judge_alias, None

        # Extract run_dir from stdout
        for line in result.stdout.splitlines():
            if "Папка прогона →" in line:
                run_dir = line.split("→")[-1].strip()
                print(f"[{judge_alias}] Done → {Path(run_dir).name}")
                return judge_alias, run_dir

        print(f"[{judge_alias}] Done (dir unknown)")
        return judge_alias, None
    except subprocess.TimeoutExpired:
        print(f"[{judge_alias}] TIMEOUT")
        return judge_alias, None
    except Exception as exc:
        print(f"[{judge_alias}] ERROR: {exc}")
        return judge_alias, None


def compute_averages(run_dir: Path) -> dict[str, float]:
    metrics_path = run_dir / "metrics.json"
    if not metrics_path.exists():
        return {}
    rows = json.loads(metrics_path.read_text(encoding="utf-8"))
    result: dict[str, float] = {}
    for key in SCORE_KEYS:
        values = [r[key] for r in rows if isinstance(r.get(key), (int, float))]
        if values:
            result[key] = sum(values) / len(values)
    return result


def print_comparison_table(results: dict[str, dict[str, float]]) -> None:
    judges = list(results.keys())
    metrics = [k for k in SCORE_KEYS if any(k in results[j] for j in judges)]

    col_w = max(24, max((len(j) for j in judges), default=0) + 2)
    metric_w = 28

    header = f"{'Metric':<{metric_w}}" + "".join(f"{j:^{col_w}}" for j in judges)
    print("\n" + "=" * len(header))
    print(header)
    print("=" * len(header))

    short = {
        "faithfulness_score": "Faithfulness",
        "answer_relevancy_score": "Answer Relevancy",
        "context_precision_score": "Ctx Precision",
        "context_recall_score": "Ctx Recall",
        "answer_correctness_score": "Answer Correctness",
    }

    for key in metrics:
        vals = {j: results[j].get(key) for j in judges}
        best = max((v for v in vals.values() if v is not None), default=None)
        row = f"{short.get(key, key):<{metric_w}}"
        for j in judges:
            v = vals[j]
            if v is None:
                cell = "—"
            else:
                pct = f"{v*100:.1f}%"
                cell = f"*{pct}*" if v == best else pct
            row += f"{cell:^{col_w}}"
        print(row)

    print("=" * len(header))
    print("* = best for this metric\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Run RAGAS with multiple judges and compare results")
    parser.add_argument("dataset", nargs="?", help="Path to dataset JSON or DeepEval results dir")
    parser.add_argument("--judges", default=None,
                        help="Comma-separated judge aliases from targets.yaml")
    parser.add_argument("--limit", type=int, default=None, help="Limit records per run")
    parser.add_argument("--list-judges", action="store_true", help="List available judges and exit")
    parser.add_argument("--python", default=None, help="Python binary (default: venv or python3)")
    args = parser.parse_args()

    if args.list_judges:
        judges = list_judges()
        print("Available judges (from targets.yaml):")
        for j in judges:
            print(f"  {j['name']:<20} {j.get('description', j['model'])}")
        sys.exit(0)

    if not args.dataset:
        parser.error("dataset argument is required")

    dataset = Path(args.dataset).expanduser().resolve()
    if not dataset.exists():
        print(f"ERROR: dataset not found: {dataset}", file=sys.stderr)
        sys.exit(1)

    # Resolve python binary
    venv_python = EVAL_DIR.parent / ".venv" / "bin" / "python3"
    python = args.python or (str(venv_python) if venv_python.exists() else "python3")

    # Resolve judges
    if args.judges:
        judge_aliases = [j.strip() for j in args.judges.split(",") if j.strip()]
    else:
        judge_aliases = [j["name"] for j in list_judges()][:3]  # default: first 3

    if not judge_aliases:
        print("ERROR: no judges configured", file=sys.stderr)
        sys.exit(1)

    print(f"Dataset : {dataset}")
    print(f"Judges  : {', '.join(judge_aliases)}")
    print(f"Limit   : {args.limit or 'all'}")
    print(f"Python  : {python}\n")

    # Run all judges in parallel
    results: dict[str, dict[str, float]] = {}
    with ThreadPoolExecutor(max_workers=len(judge_aliases)) as pool:
        futures = {
            pool.submit(run_judge, dataset, alias, args.limit, python): alias
            for alias in judge_aliases
        }
        for future in as_completed(futures):
            alias, run_dir_str = future.result()
            if run_dir_str:
                run_dir = Path(run_dir_str)
                if not run_dir.exists():
                    # Try relative to RESULTS_DIR
                    run_dir = RESULTS_DIR / run_dir_str
                results[alias] = compute_averages(run_dir) if run_dir.exists() else {}
            else:
                results[alias] = {}

    print_comparison_table(results)

    # Save combined JSON summary
    summary_path = RESULTS_DIR / f"provider_comparison_{dataset.stem}.json"
    summary_path.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Summary saved → {summary_path}")


if __name__ == "__main__":
    main()
