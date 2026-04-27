#!/usr/bin/env python3
"""
Run DeepTeam red-teaming against the live Manjerok bot API.

For each category present in the dataset the script builds a fresh HTTP callback
(category is baked into the request body) and runs deepteam red_team().
Results are saved per-category and aggregated into a single parquet/JSON file.

Usage:
    python scripts/manjerok_deepteam_run.py
    python scripts/manjerok_deepteam_run.py --categories spa ski_zones
    python scripts/manjerok_deepteam_run.py --attacks 3 --judge gpt-4o-mini-or
    python scripts/manjerok_deepteam_run.py --category spa --attacks 5
"""
import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv

load_dotenv()

from src.data.storage import save_results
from src.data.transformer import transform_risk_assessment
from src.red_team.attacks import AttackConfig, VulnerabilityConfig, build_attacks, build_vulnerabilities
from src.red_team.judges import build_judge_from_preset, register_custom_presets
from src.red_team.runner import create_http_callback, run_red_team

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BASE_URL = "https://assist.dev.mglk.ru/api/v1/eval/rag"

# All valid categories from offline_ready_full.json
ALL_CATEGORIES = ["dining", "kids_complex", "ski_zones", "spa", "transfers"]

DEFAULT_CONFIG = "config/attack_config.yaml"

# ---------------------------------------------------------------------------
# Category → target_purpose mapping
#
# DeepTeam's simulator uses this description to generate contextually relevant
# attack prompts. Without it the simulator falls back to "general assistant"
# and generates generic attacks that are poorly targeted at a domain-specific bot.
# ---------------------------------------------------------------------------

CATEGORY_PURPOSE: dict[str, str] = {
    "dining": (
        "hotel resort restaurant assistant helping guests with menus, reservations, "
        "prices and dining options at Manjerok ski resort in Altai, Russia"
    ),
    "kids_complex": (
        "children's activity center assistant for families at Manjerok resort, "
        "covering Les Chudes entertainment center and Dreamwood adventure park — "
        "answering questions about zones, prices, schedules and activities for kids"
    ),
    "ski_zones": (
        "ski resort assistant helping guests with slopes difficulty levels, ski passes, "
        "equipment rental, lift schedules and mountain activities at Manjerok resort"
    ),
    "spa": (
        "hotel spa and wellness booking assistant helping guests with spa treatments, "
        "bath complex, massage and procedure prices and appointments at Manjerok resort"
    ),
    "transfers": (
        "hotel transfer and transportation assistant helping guests with shuttle routes, "
        "taxi services, transfer booking and transport logistics at Manjerok resort"
    ),
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _load_yaml(path: str) -> dict:
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f)


def _build_api_config(category: str) -> dict:
    """
    Build the HTTP api_config for create_http_callback.
    Category is baked into the body so deepteam attack prompts
    are routed to the right knowledge base partition in the bot.
    """
    return {
        "url": BASE_URL,
        "method": "POST",
        "headers": {},
        "body": {
            "question": "{{user_query}}",
            "category": category,
        },
        "extractors": {
            "answer": "answer",
        },
    }


def _parse_configs(cfg: dict) -> tuple[list[AttackConfig] | None, list[VulnerabilityConfig] | None]:
    attack_configs = [
        AttackConfig(name=a["name"], attack_class=a["class"], enabled=a.get("enabled", True))
        for a in cfg.get("attacks", [])
        if a.get("enabled", True)
    ] or None

    vuln_configs = [
        VulnerabilityConfig(name=v["name"], vulnerability_class=v["class"], enabled=v.get("enabled", True))
        for v in cfg.get("vulnerabilities", [])
        if v.get("enabled", True)
    ] or None

    return attack_configs, vuln_configs


# ---------------------------------------------------------------------------
# Per-category run
# ---------------------------------------------------------------------------

def run_for_category(
    category: str,
    attack_configs: list[AttackConfig] | None,
    vuln_configs: list[VulnerabilityConfig] | None,
    attacks_per_type: int,
    judge_preset: str | None,
) -> dict | None:
    """
    Run deepteam against one category and return a summary dict.
    Returns None if all tests errored.
    """
    purpose = CATEGORY_PURPOSE.get(category)

    print(f"\n{'='*60}")
    print(f"[*] Category: {category.upper()}")
    print(f"    URL:      {BASE_URL}")
    print(f"    Purpose:  {purpose or 'general assistant (fallback)'}")
    print(f"    Attacks per vuln type: {attacks_per_type}")
    print(f"    Judge: {judge_preset or 'deepeval default'}")
    print(f"{'='*60}")

    api_config = _build_api_config(category)
    callback = create_http_callback(api_config)
    judge = build_judge_from_preset(judge_preset) if judge_preset else None

    try:
        risk_assessment = run_red_team(
            model_callback=callback,
            attack_configs=attack_configs,
            vulnerability_configs=vuln_configs,
            attacks_per_vulnerability_type=attacks_per_type,
            evaluation_model=judge,
            target_purpose=purpose,
        )
    except Exception as e:
        print(f"[ERROR] deepteam run failed for '{category}': {e}")
        return None

    df = transform_risk_assessment(
        risk_assessment,
        model_version=f"manjerok-bot/{category}",
        judge_version=judge_preset or "deepeval-default",
        session_id=f"{category}-{datetime.now().strftime('%Y%m%d_%H%M%S')}",
    )

    if df.empty:
        print(f"[!] No results for category '{category}' — all tests errored.")
        return None

    overall_asr = float(df["asr"].mean())
    print(f"\n[+] Category '{category}' — ASR: {overall_asr:.1%}")
    print(df[["vulnerability", "severity", "pass_rate", "asr"]].to_string(index=False))

    return {
        "category": category,
        "asr": overall_asr,
        "df": df,
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run DeepTeam red-teaming against the Manjerok bot for each category."
    )
    parser.add_argument(
        "--categories",
        nargs="+",
        default=ALL_CATEGORIES,
        choices=ALL_CATEGORIES,
        metavar="CATEGORY",
        help=f"Categories to test (default: all). Choices: {', '.join(ALL_CATEGORIES)}",
    )
    parser.add_argument(
        "--attacks",
        type=int,
        default=1,
        dest="attacks_per_type",
        help="Attacks per vulnerability type (default: 1)",
    )
    parser.add_argument(
        "--judge",
        default=None,
        help="Judge preset (e.g. gpt-4o-mini-or, haiku). Reads from attack_config.yaml if not set.",
    )
    parser.add_argument(
        "--config",
        default=DEFAULT_CONFIG,
        help=f"Attack config YAML (default: {DEFAULT_CONFIG})",
    )
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    parser.add_argument(
        "--output",
        default=f"results/manjerok_deepteam_{timestamp}.json",
        help="Summary JSON output path",
    )
    args = parser.parse_args()

    # Load attack/vuln config
    cfg = _load_yaml(args.config)

    # Register custom judge presets if any
    custom_presets = cfg.get("judge_custom_presets", {})
    if custom_presets:
        register_custom_presets(custom_presets)

    judge_preset = args.judge or cfg.get("judge_preset") or None
    attack_configs, vuln_configs = _parse_configs(cfg)

    print(f"[+] Categories: {args.categories}")
    print(f"[+] Attack types: {[a.name for a in attack_configs] if attack_configs else 'default'}")
    print(f"[+] Vulnerabilities: {[v.name for v in vuln_configs] if vuln_configs else 'default'}")

    # Run deepteam for each category
    category_results = []
    failed_categories = []

    for category in args.categories:
        result = run_for_category(
            category=category,
            attack_configs=attack_configs,
            vuln_configs=vuln_configs,
            attacks_per_type=args.attacks_per_type,
            judge_preset=judge_preset,
        )
        if result is None:
            failed_categories.append(category)
            continue

        # Save per-category parquet via existing storage
        try:
            path = save_results(result["df"])
            print(f"[+] Saved: {path}")
            result["saved_path"] = str(path)
        except Exception as e:
            print(f"[!] Could not save parquet for '{category}': {e}")
            result["saved_path"] = None

        category_results.append({
            "category": result["category"],
            "asr": result["asr"],
            "saved_path": result.get("saved_path"),
        })

    # Overall summary
    print(f"\n{'='*60}")
    print("[+] OVERALL SUMMARY")
    print(f"{'='*60}")
    for r in category_results:
        print(f"  {r['category']:<15} ASR: {r['asr']:.1%}")
    if failed_categories:
        print(f"\n[!] Failed categories: {failed_categories}")

    if category_results:
        overall_asr = sum(r["asr"] for r in category_results) / len(category_results)
        print(f"\n  Overall mean ASR: {overall_asr:.1%}")

        summary = {
            "timestamp": datetime.now().isoformat(),
            "base_url": BASE_URL,
            "judge": judge_preset,
            "attacks_per_type": args.attacks_per_type,
            "category_purposes": {c: CATEGORY_PURPOSE.get(c) for c in args.categories},
            "categories_run": [r["category"] for r in category_results],
            "categories_failed": failed_categories,
            "overall_asr": round(overall_asr, 4),
            "results": category_results,
        }

        Path(args.output).parent.mkdir(parents=True, exist_ok=True)
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)
        print(f"\n[+] Summary saved → {args.output}")
    else:
        print("\n[!] No results collected — all categories failed.")
        sys.exit(1)


if __name__ == "__main__":
    main()
