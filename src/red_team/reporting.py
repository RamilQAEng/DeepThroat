"""Generate eval-style report directory from red team run DataFrames."""

import csv
import json
from datetime import datetime
from pathlib import Path

import pandas as pd

SEVERITY_EMOJI = {"Critical": "🔴", "High": "🟠", "Medium": "🟡", "Low": "🟢"}


def _extract_category(model_version: str) -> str:
    parts = model_version.split("/")
    return parts[-1] if len(parts) > 1 else model_version


def _short_vuln(vulnerability: str) -> str:
    if "." in vulnerability:
        cls, sub = vulnerability.split(".", 1)
        return f"{cls.replace('Type', '')} / {sub}"
    return vulnerability


def _is_passed(score) -> bool:
    return score == "1" or score is True or score == 1


def _iter_conversations(df: pd.DataFrame):
    """Yield (row, conv_dict) for every conversation across all rows."""
    for _, row in df.iterrows():
        raw = row["conversations"]
        convs = json.loads(raw) if isinstance(raw, str) else (raw or [])
        for conv in convs:
            yield row, conv


def generate_report(
    dfs: list[pd.DataFrame],
    output_dir: Path,
    *,
    base_url: str,
    judge: str | None,
    attacks_per_type: int,
    category_purposes: dict[str, str],
    failed_categories: list[str],
) -> Path:
    """
    Write attacks.json, attacks.csv, summary.json, report.md into output_dir.
    Returns output_dir.
    """
    output_dir.mkdir(parents=True, exist_ok=True)

    if not dfs:
        return output_dir

    combined = pd.concat(dfs, ignore_index=True)

    _write_attacks_json(combined, output_dir / "attacks.json")
    _write_attacks_csv(combined, output_dir / "attacks.csv")
    _write_summary_json(
        combined,
        output_dir / "summary.json",
        base_url=base_url,
        judge=judge,
        attacks_per_type=attacks_per_type,
        category_purposes=category_purposes,
        failed_categories=failed_categories,
    )
    _write_report_md(
        combined,
        output_dir / "report.md",
        base_url=base_url,
        judge=judge,
        attacks_per_type=attacks_per_type,
        failed_categories=failed_categories,
    )

    return output_dir


def _write_attacks_json(df: pd.DataFrame, path: Path) -> None:
    rows = []
    for row, conv in _iter_conversations(df):
        rows.append({
            "category": _extract_category(row["model_version"]),
            "vulnerability": row["vulnerability"],
            "owasp_id": row["owasp_id"],
            "owasp_name": row["owasp_name"],
            "severity": row["severity"],
            "attack_type": row["attack_type"],
            "input": conv.get("input", ""),
            "output": conv.get("output", ""),
            "passed": _is_passed(conv.get("score")),
            "score": conv.get("score"),
            "reason": conv.get("reason", ""),
            "error": conv.get("error", ""),
        })
    path.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")


def _write_attacks_csv(df: pd.DataFrame, path: Path) -> None:
    rows = []
    for row, conv in _iter_conversations(df):
        rows.append({
            "category": _extract_category(row["model_version"]),
            "vulnerability": row["vulnerability"],
            "severity": row["severity"],
            "attack_type": row["attack_type"],
            "passed": "1" if _is_passed(conv.get("score")) else "0",
            "input": conv.get("input", "").replace("\n", " "),
            "output": conv.get("output", "")[:300].replace("\n", " "),
            "reason": conv.get("reason", "")[:300].replace("\n", " "),
        })
    if not rows:
        return
    with open(path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def _write_summary_json(
    df: pd.DataFrame,
    path: Path,
    *,
    base_url: str,
    judge: str | None,
    attacks_per_type: int,
    category_purposes: dict[str, str],
    failed_categories: list[str],
) -> None:
    categories: dict[str, dict] = {}
    for cat in df["model_version"].str.split("/").str[-1].unique():
        cat_df = df[df["model_version"].str.endswith(f"/{cat}")]
        categories[cat] = {
            "asr": round(float(cat_df["asr"].mean()), 4),
            "total_attacks": int(cat_df["total"].sum()),
            "passed": int(cat_df["passed"].sum()),
            "failed": int(cat_df["failed"].sum()),
            "by_vulnerability": [
                {
                    "vulnerability": r["vulnerability"],
                    "owasp_id": r["owasp_id"],
                    "severity": r["severity"],
                    "attack_type": r["attack_type"],
                    "asr": round(float(r["asr"]), 4),
                    "pass_rate": round(float(r["pass_rate"]), 4),
                }
                for _, r in cat_df.iterrows()
            ],
        }

    summary = {
        "timestamp": datetime.now().isoformat(),
        "base_url": base_url,
        "judge": judge,
        "attacks_per_type": attacks_per_type,
        "category_purposes": category_purposes,
        "overall_asr": round(float(df["asr"].mean()), 4),
        "total_attacks": int(df["total"].sum()),
        "categories_failed": failed_categories,
        "categories": categories,
    }
    path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")


def _write_report_md(
    df: pd.DataFrame,
    path: Path,
    *,
    base_url: str,
    judge: str | None,
    attacks_per_type: int,
    failed_categories: list[str],
) -> None:
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    overall_asr = float(df["asr"].mean())
    total = int(df["total"].sum())
    categories = df["model_version"].str.split("/").str[-1].unique()

    lines: list[str] = [
        "# Red Team Report — Манжерок бот",
        "",
        f"**Дата:** {now}  ",
        f"**URL:** {base_url}  ",
        f"**Judge:** {judge or 'deepeval default'}  ",
        f"**Атак на тип уязвимости:** {attacks_per_type}  ",
        f"**Всего атак:** {total}  ",
        f"**Общий ASR:** {overall_asr:.1%}",
        "",
        "## Результаты по категориям",
        "",
        "| Категория | Атак | Прошло | Не прошло | ASR |",
        "|-----------|------|--------|-----------|-----|",
    ]

    for cat in categories:
        cat_df = df[df["model_version"].str.endswith(f"/{cat}")]
        asr = float(cat_df["asr"].mean())
        flag = " 🔴" if asr > 0.15 else ""
        lines.append(
            f"| {cat} | {int(cat_df['total'].sum())} "
            f"| {int(cat_df['passed'].sum())} "
            f"| {int(cat_df['failed'].sum())} "
            f"| **{asr:.1%}**{flag} |"
        )

    if failed_categories:
        lines += ["", f"> ⚠️ Не удалось запустить: {', '.join(failed_categories)}"]

    lines += [
        "",
        "## Результаты по уязвимостям",
        "",
        "| Severity | Уязвимость | Тип атаки | Категория | ASR | Статус |",
        "|----------|------------|-----------|-----------|-----|--------|",
    ]

    for _, row in df.sort_values("asr", ascending=False).iterrows():
        cat = _extract_category(row["model_version"])
        emoji = SEVERITY_EMOJI.get(row["severity"], "⚪")
        status = "❌ FAIL" if row["asr"] > 0 else "✅ PASS"
        lines.append(
            f"| {emoji} {row['severity']} "
            f"| {_short_vuln(row['vulnerability'])} "
            f"| {row['attack_type']} "
            f"| {cat} "
            f"| {row['asr']:.0%} "
            f"| {status} |"
        )

    lines += ["", "## Детали атак", ""]

    for row, conv in _iter_conversations(df):
        cat = _extract_category(row["model_version"])
        passed = _is_passed(conv.get("score"))
        status = "✅ PASS" if passed else "❌ FAIL"
        short = _short_vuln(row["vulnerability"])
        attack_input = conv.get("input", "").replace("\n", " ")[:500]
        attack_output = conv.get("output", "").replace("\n", " ")[:500]
        reason = conv.get("reason", "")
        error = conv.get("error", "")

        lines += [
            f"### {status} {cat} / {row['attack_type']} / {short}",
            "",
            f"**Атака:** {attack_input}",
            "",
            f"**Ответ бота:** {attack_output}",
            "",
        ]
        if reason and reason not in ("None", ""):
            lines += [f"**Вердикт:** {reason[:400]}", ""]
        if error and error not in ("None", ""):
            lines += [f"**Ошибка:** {error}", ""]
        lines.append("---")
        lines.append("")

    path.write_text("\n".join(lines), encoding="utf-8")
