"""
Custom Judge implementations for DeepEval.
Supports OpenRouter and GigaChat LLM providers.
"""
import os
import asyncio
from deepeval.models.base_model import DeepEvalBaseLLM


class OpenRouterJudge(DeepEvalBaseLLM):
    """Судья на базе OpenRouter (OpenAI-совместимый API)."""

    def __init__(self, model: str, no_reasoning: bool = False):
        self.model = model
        self.no_reasoning = no_reasoning
        from openai import OpenAI

        api_key = os.environ.get("OPENROUTER_API_KEY")
        if not api_key:
            raise ValueError("OPENROUTER_API_KEY environment variable is not set")

        print(f"[OpenRouterJudge] Initializing with model: {model}, API key: {api_key[:10]}...")

        self.client = OpenAI(
            api_key=api_key,
            base_url="https://openrouter.ai/api/v1",
        )

    def get_model_name(self) -> str:
        return self.model

    def load_model(self):
        return self.client

    def _clean_json(self, text: str) -> str:
        import re
        match = re.search(r'(\{.*\}|\[.*\])', text, re.DOTALL)
        if match:
            return match.group(0)
        return text.strip()

    def generate(self, prompt: str) -> str:
        extra = {"reasoning": {"exclude": True}} if self.no_reasoning else {}
        system_prompt = (
            "You are an evaluation assistant. "
            "CRITICAL: The 'reason' field in your JSON MUST be written strictly in Russian (НА РУССКОМ ЯЗЫКЕ). "
            "Keep all other JSON fields and structure exactly as required. "
            "IMPORTANT: You MUST return ONLY valid JSON. "
            "Do not include any intro text, markdown formatting (like ```json), or conversational fillers. "
            "Your response must start with { and end with }."
        )

        # Усиливаем user prompt в самом конце
        prompt_suffix = "\n\n[CRITICAL FINAL INSTRUCTION]\nThe value of the 'reason' field MUST be written in fluent Russian language (по-русски)."
        prompt += prompt_suffix

        response = self.client.chat.completions.create(
            model=self.model,
            extra_body=extra,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
        )
        return self._clean_json(response.choices[0].message.content)

    async def a_generate(self, prompt: str) -> str:
        return await asyncio.get_event_loop().run_in_executor(
            None, self.generate, prompt
        )


class GigaChatJudge(DeepEvalBaseLLM):
    """Судья на базе GigaChat (Sber)."""

    def __init__(self, model: str):
        self.model = model

    def get_model_name(self) -> str:
        return self.model

    def load_model(self):
        from gigachat import GigaChat
        return GigaChat

    def _clean_json(self, text: str) -> str:
        import re
        match = re.search(r'(\{.*\}|\[.*\])', text, re.DOTALL)
        if match:
            return match.group(0)
        return text.strip()

    def generate(self, prompt: str) -> str:
        from gigachat import GigaChat
        from gigachat.models import Chat, Messages, MessagesRole

        system_prompt = (
            "You are an evaluation assistant. "
            "CRITICAL: The 'reason' field in your JSON MUST be written strictly in Russian (НА РУССКОМ ЯЗЫКЕ). "
            "Keep all other JSON fields and structure exactly as required. "
            "IMPORTANT: You MUST return ONLY valid JSON. "
            "Do not include any intro text, markdown formatting (like ```json), or conversational fillers. "
            "Your response must start with { and end with }."
        )

        prompt_suffix = "\n\n[CRITICAL FINAL INSTRUCTION]\nThe value of the 'reason' field MUST be written in fluent Russian language (по-русски)."
        prompt += prompt_suffix

        with GigaChat(credentials=os.environ["GIGACHAT_CREDENTIALS"],
                      verify_ssl_certs=False) as client:
            response = client.chat(Chat(
                model=self.model,
                messages=[
                    Messages(role=MessagesRole.SYSTEM, content=system_prompt),
                    Messages(role=MessagesRole.USER, content=prompt),
                ],
            ))
        return self._clean_json(response.choices[0].message.content)

    async def a_generate(self, prompt: str) -> str:
        return await asyncio.get_event_loop().run_in_executor(
            None, self.generate, prompt
        )


def build_judge(provider: str, model_name: str, no_reasoning: bool = False, verbose: bool = False):
    """Создаёт экземпляр судьи по provider."""
    if provider == "openrouter":
        if verbose:
            print(f"Судья : OpenRouter / {model_name}")
        return OpenRouterJudge(model=model_name, no_reasoning=no_reasoning)
    elif provider == "gigachat":
        if verbose:
            print(f"Судья : GigaChat / {model_name}")
        return GigaChatJudge(model=model_name)
    else:
        if verbose:
            print(f"Судья : OpenAI / {model_name}")
        # OpenAI — передаём строку напрямую, DeepEval использует openai-клиент
        return model_name
