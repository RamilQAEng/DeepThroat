import os
import re
from typing import Any, Optional

import httpx
from anthropic import AsyncAnthropic
from deepteam import red_team
from deepteam.test_case import RTTurn
from openai import AsyncOpenAI

from src.red_team.attacks import (
    DEFAULT_ATTACKS,
    DEFAULT_VULNERABILITIES,
    AttackConfig,
    VulnerabilityConfig,
    build_attacks,
    build_vulnerabilities,
)
from src.red_team.judges import build_judge_from_preset

OPENROUTER_BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")


API_TIMEOUT = 60  # seconds


def _require_env(key: str) -> str:
    value = os.environ.get(key)
    if not value:
        raise EnvironmentError(
            f"[runner] Missing required environment variable: {key}\n  → Add it to your .env file: {key}=your_key_here"
        )
    return value


def create_anthropic_callback(
    model: str,
    system_prompt: str,
    api_key: str | None = None,
):
    """Return a sync callback wrapping a Claude model via Anthropic API."""
    client = AsyncAnthropic(api_key=api_key or _require_env("ANTHROPIC_API_KEY"))

    async def model_callback(input_text: str, messages: Optional[list[RTTurn]] = None) -> RTTurn:
        history = []
        if messages:
            for turn in messages:
                history.append({"role": turn.role, "content": turn.content})
        history.append({"role": "user", "content": input_text})

        try:
            response = await client.messages.create(
                model=model,
                max_tokens=1024,
                system=system_prompt,
                messages=history,
                timeout=API_TIMEOUT,
            )
            return RTTurn(role="assistant", content=response.content[0].text)
        except Exception as e:
            return RTTurn(role="assistant", content=f"[ERROR: {type(e).__name__}: {e}]")

    return model_callback


def create_openrouter_callback(
    model: str,
    system_prompt: str,
    api_key: str | None = None,
    site_url: str | None = None,
    site_name: str | None = None,
):
    """Return a sync callback wrapping any model via OpenRouter."""
    key = api_key or _require_env("OPENROUTER_API_KEY")
    extra_headers: dict[str, str] = {}
    if site_url:
        extra_headers["HTTP-Referer"] = site_url
    if site_name:
        extra_headers["X-Title"] = site_name

    client = AsyncOpenAI(
        api_key=key,
        base_url=OPENROUTER_BASE_URL,
        default_headers=extra_headers,
        timeout=API_TIMEOUT,
    )

    async def model_callback(input_text: str, messages: Optional[list[RTTurn]] = None) -> RTTurn:
        history = [{"role": "system", "content": system_prompt}]
        if messages:
            for turn in messages:
                history.append({"role": turn.role, "content": turn.content})
        history.append({"role": "user", "content": input_text})

        try:
            response = await client.chat.completions.create(
                model=model,
                max_tokens=1024,
                messages=history,
            )
            return RTTurn(role="assistant", content=response.choices[0].message.content or "")
        except Exception as e:
            return RTTurn(role="assistant", content=f"[ERROR: {type(e).__name__}: {e}]")

    return model_callback


def run_red_team(
    model_callback,
    attack_configs: list[AttackConfig] | None = None,
    vulnerability_configs: list[VulnerabilityConfig] | None = None,
    attacks_per_vulnerability_type: int = 1,
    evaluation_model: Any = None,
    target_purpose: str | None = None,
) -> Any:
    """Run DeepTeam evaluation and return RiskAssessment.

    Args:
        target_purpose: Natural-language description of what the target model does.
            DeepTeam's simulator uses this to generate contextually relevant attacks.
            Example: "hotel spa booking assistant at Manjerok resort".
            When None, the simulator falls back to "general assistant" — attacks will
            be generic and less effective against domain-specific bots.
    """

    attacks = build_attacks(attack_configs or DEFAULT_ATTACKS)
    vulnerabilities = build_vulnerabilities(vulnerability_configs or DEFAULT_VULNERABILITIES)

    kwargs: dict[str, Any] = {
        "model_callback": model_callback,
        "vulnerabilities": vulnerabilities,
        "attacks": attacks,
        "attacks_per_vulnerability_type": attacks_per_vulnerability_type,
        "ignore_errors": True,
    }
    if evaluation_model is not None:
        kwargs["evaluation_model"] = evaluation_model
        kwargs["simulator_model"] = evaluation_model  # use same model for attack generation
    if target_purpose:
        kwargs["target_purpose"] = target_purpose

    return red_team(**kwargs)


def get_value_by_path(obj: dict, path: str, default=None):
    if not path:
        return obj
    keys = path.split(".")
    val = obj
    try:
        for k in keys:
            if isinstance(val, dict):
                val = val.get(k)
            elif isinstance(val, list) and k.isdigit():
                val = val[int(k)]
            else:
                return default
            if val is None:
                return default
        return val
    except Exception:
        return default


def resolve_template_text(text: str, variables: dict) -> str:
    def replacer(match):
        var_name = match.group(1).strip()
        return str(variables.get(var_name, match.group(0)))

    return re.sub(r"\{\{([^}]+)\}\}", replacer, text)


def resolve_template_recursive(template, variables: dict):
    if isinstance(template, str):
        return resolve_template_text(template, variables)
    elif isinstance(template, dict):
        return {k: resolve_template_recursive(v, variables) for k, v in template.items()}
    elif isinstance(template, list):
        return [resolve_template_recursive(item, variables) for item in template]
    return template


def create_http_callback(api_config: dict):
    """Return an async callback that sends the attack payload to a custom HTTP API."""

    async def model_callback(input_text: str, messages: Optional[list[RTTurn]] = None) -> RTTurn:
        url = api_config.get("url")
        method = api_config.get("method", "POST").upper()
        headers = api_config.get("headers", {})
        body_template = api_config.get("body", {})

        # We treat input_text as the 'user_query' since Red Teaming attacks the prompt
        variables = {"user_query": input_text, "category": "red_teaming_attack"}
        payload = resolve_template_recursive(body_template, variables)

        try:
            async with httpx.AsyncClient(timeout=120.0, verify=False) as client:
                if method == "POST":
                    resp = await client.post(url, headers=headers, json=payload)
                elif method == "GET":
                    resp = await client.get(url, headers=headers, params=payload)
                else:
                    return RTTurn(role="assistant", content=f"[ERROR: Unsupported HTTP method: {method}]")

            if resp.status_code != 200:
                return RTTurn(role="assistant", content=f"[ERROR: API {resp.status_code} at {url}]")

            data = resp.json()
            ex_answer = api_config.get("extractors", {}).get("answer", "answer")
            answer = get_value_by_path(data, ex_answer, None)

            if answer is None:
                answer = f"[ERROR: Extractor path '{ex_answer}' failed to find answer in {resp.text[:100]}]"

            return RTTurn(role="assistant", content=str(answer))

        except Exception as e:
            return RTTurn(role="assistant", content=f"[ERROR: HTTP Call failed: type={type(e).__name__} msg={e}]")

    return model_callback


def run(
    model: str = "",
    system_prompt: str = "",
    attacks_per_vulnerability_type: int = 1,
    provider: str = "anthropic",
    api_key: str | None = None,
    judge_preset: str | None = None,
    attack_configs: list[AttackConfig] | None = None,
    vuln_configs: list[VulnerabilityConfig] | None = None,
    api_config: dict | None = None,
    target_purpose: str | None = None,
) -> Any:
    """Entry point for script/CLI usage."""

    if api_config:
        callback = create_http_callback(api_config)
    elif provider == "openrouter":
        callback = create_openrouter_callback(model, system_prompt, api_key)
    else:
        callback = create_anthropic_callback(model, system_prompt, api_key)

    judge = build_judge_from_preset(judge_preset) if judge_preset else None

    return run_red_team(
        callback,
        attack_configs=attack_configs,
        vulnerability_configs=vuln_configs,
        attacks_per_vulnerability_type=attacks_per_vulnerability_type,
        evaluation_model=judge,
        target_purpose=target_purpose,
    )
