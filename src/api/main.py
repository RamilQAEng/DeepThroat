"""
FastAPI микросервис для долгих LLM задач.
Заменяет child_process.spawn из Next.js API routes.
"""

import logging
import uuid

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .runner import run_eval_background, run_redteam_background
from .schemas import EvalRequest, JobResponse, JobStatus, RedTeamRequest


class _SuppressStatusPolling(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        return "/api/jobs/" not in record.getMessage()


logging.getLogger("uvicorn.access").addFilter(_SuppressStatusPolling())

app = FastAPI(title="DeepThroath API", version="1.0.0", description="API для Red Team и RAG Evaluation")

# CORS для Next.js на localhost:3000
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://your-vercel-domain.vercel.app",  # TODO: заменить на production домен
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory хранилище состояний задач (MVP)
# TODO: Заменить на SQLite в Фазе 2
jobs: dict[str, JobStatus] = {}


@app.post("/api/runner/redteam", response_model=JobResponse, tags=["Red Team"])
async def create_redteam_job(request: RedTeamRequest, background_tasks: BackgroundTasks):
    """
    Запустить Red Team сканирование в фоне.
    Возвращает job_id для отслеживания прогресса.
    """
    job_id = str(uuid.uuid4())
    jobs[job_id] = JobStatus(job_id=job_id, status="pending", progress=0)

    # Запуск в фоне (не блокирует HTTP response)
    background_tasks.add_task(run_redteam_background, job_id=job_id, config=request, jobs_dict=jobs)

    return JobResponse(job_id=job_id, status="pending")


@app.post("/api/runner/eval", response_model=JobResponse, tags=["RAG Evaluation"])
async def create_eval_job(request: EvalRequest, background_tasks: BackgroundTasks):
    """Запустить RAG Evaluation в фоне"""
    job_id = str(uuid.uuid4())
    jobs[job_id] = JobStatus(job_id=job_id, status="pending", progress=0)

    background_tasks.add_task(run_eval_background, job_id=job_id, config=request, jobs_dict=jobs)

    return JobResponse(job_id=job_id, status="pending")


@app.get("/api/jobs/{job_id}/status", response_model=JobStatus, tags=["Jobs"])
async def get_job_status(job_id: str):
    """
    Получить статус задачи по ID.
    Next.js опрашивает этот эндпоинт каждые 3 секунды (polling).
    """
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    return jobs[job_id]


@app.get("/api/jobs", tags=["Jobs"])
async def list_jobs():
    """Список всех задач (для истории прогонов)"""
    return list(jobs.values())


@app.get("/health")
async def health_check():
    """Health check для Docker/Kubernetes"""
    return {"status": "healthy", "service": "deepthroath-api"}
