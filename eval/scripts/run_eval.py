#!/usr/bin/env python3
"""CLI entry point for eval pipeline.

Offline (батч из файла, только AR если нет retrieval_context):
  python eval/scripts/run_eval.py --input eval/top_k/file.json

Онлайн (вызывает живой API, получает ответы + чанки, считает все 4 метрики):
  python eval/scripts/run_eval.py --input eval/datasets/file.json --online
  python eval/scripts/run_eval.py --input eval/datasets/file.json --online --api-url https://assist.dev.mglk.ru

Дополнительные опции:
  --judge qwen-235b-or    Выбрать судью
  --workers 3             Уменьшить параллелизм
"""

import argparse
import sys
from pathlib import Path
from typing import Callable

# Ensure project root is on the path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import yaml
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")


def _load_yaml(path: Path) -> dict:
    with open(path, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    if not isinstance(data, dict):
        raise ValueError(f"Invalid YAML: {path} must be a mapping, got {type(data).__name__}")
    return data


def _find_target(targets_path: Path, name: str) -> dict:
    data = _load_yaml(targets_path)
    targets = data.get("targets", [])
    for t in targets:
        if t["name"] == name:
            return t
    available = [t["name"] for t in targets]
    raise ValueError(f"Target '{name}' not found in {targets_path}\n  Available judges: {', '.join(available)}")


def run_eval_scan(
    dataset: str,
    model: str,
    metrics: list[str] | None = None,
    n_samples: int = 50,
    api_contract: dict | None = None,
    progress_callback: Callable | None = None,
    workers: int | None = None,
    thresholds: dict | None = None,
) -> Path:
    """
    Запуск RAG Evaluation (callable from FastAPI).

    Args:
        dataset: Имя датасета из eval/datasets/ (без расширения .json)
        model: Модель судьи (gpt4o-mini-or, gemini-flash, etc.)
        metrics: Метрики DeepEval (пока не используется, берем все)
        n_samples: Количество примеров для оценки
        api_contract: API контракт для online режима (URL, headers, body template, extractors)
        progress_callback: Callback для отправки прогресса (processed, total, current_id)

    Returns:
        Path к директории с результатами (eval/results/{timestamp}_{dataset})
    """
    eval_dir = Path(__file__).parent.parent
    default_config = eval_dir / "config" / "eval_config.yaml"
    default_targets = eval_dir / "config" / "targets.yaml"

    # Найти файл датасета
    dataset_str = str(dataset)
    if not dataset_str.endswith(".json"):
        dataset_str += ".json"

    dataset_path = Path(dataset_str)
    if not dataset_path.is_absolute():
        project_root = eval_dir.parent
        # Сначала проверим относительный путь от корня проекта
        if (project_root / dataset_path).exists():
            dataset_path = project_root / dataset_path
        else:
            # Иначе предполагаем, что передали только имя файла
            dataset_path = eval_dir / "datasets" / dataset_path.name

    if not dataset_path.exists():
        raise FileNotFoundError(f"Dataset not found: {dataset_path}")

    cfg = _load_yaml(default_config)
    max_workers = cfg.get("max_workers", 10)

    try:
        target = _find_target(default_targets, model)
    except ValueError as e:
        raise ValueError(f"Judge model not found: {e}") from e

    threshold = target.get("threshold", 0.7)

    # Import and run eval pipeline
    sys.path.insert(0, str(eval_dir))
    from eval_rag_metrics import run_eval

    results_dir = run_eval(
        input_path=str(dataset_path),
        judge_config=target["name"],
        api_contract=api_contract,
        metrics=metrics,
        limit=n_samples,
        progress_callback=progress_callback,
        workers=workers or max_workers,
        thresholds=thresholds or {"AR": threshold, "FA": threshold, "CP": threshold, "CR": threshold},
    )

    return results_dir


def main() -> None:
    eval_dir = Path(__file__).parent.parent
    default_config = eval_dir / "config" / "eval_config.yaml"
    default_targets = eval_dir / "config" / "targets.yaml"

    parser = argparse.ArgumentParser(description="Run RAG eval pipeline")
    parser.add_argument("--input", required=True, help="Path to input JSON file")
    parser.add_argument(
        "--judge",
        default=None,
        help="Judge target name from targets.yaml (e.g. gpt4o-mini-or, gemini-flash)",
    )
    parser.add_argument("--workers", type=int, default=None, help="Override max_workers")
    parser.add_argument("--config", default=str(default_config), help="Path to eval_config.yaml")
    parser.add_argument("--targets", default=str(default_targets), help="Path to targets.yaml")
    parser.add_argument(
        "--online",
        action="store_true",
        help="Онлайн-режим: вызывать живой API для получения ответов и чанков",
    )
    parser.add_argument(
        "--dynamic-api-config",
        default=None,
        help="Путь к JSON-файлу с настройками динамического API-контракта",
    )
    parser.add_argument(
        "--api-url",
        default=None,
        help="URL живого RAG API (по умолчанию RAG_API_BASE_URL из env или https://assist.dev.mglk.ru)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Обработать только первые N записей (для быстрой проверки)",
    )
    args = parser.parse_args()

    cfg = _load_yaml(Path(args.config))
    max_workers = args.workers or cfg.get("max_workers", 10)
    default_judge_name = cfg.get("default_judge", "gpt4o-mini-or")
    judge_name = args.judge or default_judge_name

    try:
        target = _find_target(Path(args.targets), judge_name)
    except ValueError as e:
        print(f"[!] {e}")
        sys.exit(1)

    threshold = target.get("threshold", 0.7)
    provider = target["provider"]
    model = target["model"]

    import json
    import os as _os

    api_url = None
    api_config_dict = None

    if args.dynamic_api_config:
        with open(args.dynamic_api_config, "r", encoding="utf-8") as f:
            api_config_dict = json.load(f)
        mode = "динамический API"
    elif args.online:
        api_url = args.api_url or _os.getenv("RAG_API_BASE_URL") or "https://assist.dev.mglk.ru"
        mode = f"онлайн ({api_url})"
    else:
        mode = "офлайн"
    print(f"[+] Input     : {args.input}")
    print(f"[+] Режим     : {mode}")
    print(f"[+] Judge     : {target['name']} ({provider} / {model})")
    print(f"[+] Threshold : {threshold}")
    print(f"[+] Workers   : {max_workers}")

    # Build api_contract: for online mode embed the URL, for dynamic mode use the loaded dict
    if api_config_dict:
        api_contract = api_config_dict
    elif api_url:
        api_contract = {
            "url": api_url.rstrip("/") + "/api/v1/eval/rag",
            "method": "POST",
            "headers": {},
            "body": {"question": "{{user_query}}", "category": "{{category}}"},
            "extractors": {"answer": "answer", "chunks": "retrieved_chunks"},
        }
    else:
        api_contract = None

    # Import and run eval pipeline
    sys.path.insert(0, str(eval_dir))
    from eval_rag_metrics import run_eval

    run_eval(
        input_path=args.input,
        judge_config=target["name"],
        api_contract=api_contract,
        workers=max_workers,
        thresholds={"AR": threshold, "FA": threshold, "CP": threshold, "CR": threshold},
        limit=args.limit,
    )


if __name__ == "__main__":
    main()
