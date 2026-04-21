"""
Pydantic схемы для валидации запросов и ответов.
Заменяют отсутствующую валидацию в Next.js API routes.
"""
from pydantic import BaseModel, Field, field_validator
from typing import Literal


class RedTeamRequest(BaseModel):
    """Запрос на запуск Red Team сканирования"""
    target: str = Field(
        ...,
        description="Провайдер модели: openai:gpt-4o, anthropic:claude-sonnet-4, etc.",
        examples=["openai:gpt-4o"]
    )
    num_attacks: int = Field(
        10,
        ge=1,
        le=1000,
        description="Количество атак для генерации"
    )
    attack_types: list[str] = Field(
        default_factory=list,
        description="Типы атак: jailbreak, prompt_injection, pii_leak, etc."
    )
    system_prompt: str | None = Field(
        None,
        description="Кастомный system prompt для модели"
    )

    @field_validator('target')
    @classmethod
    def validate_target(cls, v: str) -> str:
        valid_providers = ['openai', 'anthropic', 'deepseek', 'gemini']
        provider = v.split(':')[0]
        if provider not in valid_providers:
            raise ValueError(f"Неизвестный провайдер: {provider}")
        return v


class EvalRequest(BaseModel):
    """Запрос на запуск RAG Evaluation"""
    dataset: str = Field(..., description="Имя датасета из eval/datasets/")
    model: str = Field(..., description="Модель для генерации ответов")
    metrics: list[str] = Field(
        default_factory=lambda: ["answer_relevancy", "faithfulness", "contextual_precision"],
        description="DeepEval метрики для оценки"
    )
    n_samples: int = Field(50, ge=1, le=500, description="Количество примеров")
    api_contract: dict | None = Field(None, description="API контракт для online режима")


class JobResponse(BaseModel):
    """Ответ при создании задачи"""
    job_id: str
    status: Literal["pending", "running", "completed", "failed"] = "pending"
    message: str = "Job created successfully"


class JobStatus(BaseModel):
    """Статус выполнения задачи"""
    job_id: str
    status: Literal["pending", "running", "completed", "failed"]
    progress: int = Field(0, ge=0, le=100, description="Прогресс в процентах")
    results_path: str | None = Field(None, description="Путь к результатам при завершении")
    error: str | None = Field(None, description="Сообщение об ошибке при провале")
    created_at: str | None = None
    completed_at: str | None = None
