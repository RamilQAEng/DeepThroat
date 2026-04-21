"""
Обертки для запуска долгих Python скриптов в фоне.
Адаптирует существующие scripts/run_redteam.py под async.
"""
import asyncio
from datetime import datetime
from .schemas import RedTeamRequest, EvalRequest, JobStatus
import traceback


async def run_redteam_background(
    job_id: str,
    config: RedTeamRequest,
    jobs_dict: dict[str, JobStatus]
):
    """
    Фоновый запуск Red Team сканирования.
    Обновляет jobs_dict по мере выполнения.
    """
    try:
        # Обновляем статус
        jobs_dict[job_id].status = "running"
        jobs_dict[job_id].created_at = datetime.now().isoformat()

        # Импортируем callable функцию
        from scripts.run_redteam import run_redteam_scan

        # Запускаем в thread pool (блокирующий код)
        results_path = await asyncio.to_thread(
            run_redteam_scan,
            target=config.target,
            num_attacks=config.num_attacks,
            system_prompt=config.system_prompt
        )

        # Успех
        jobs_dict[job_id].status = "completed"
        jobs_dict[job_id].progress = 100
        jobs_dict[job_id].results_path = str(results_path)
        jobs_dict[job_id].completed_at = datetime.now().isoformat()

    except Exception as e:
        # Ошибка
        jobs_dict[job_id].status = "failed"
        jobs_dict[job_id].error = f"{type(e).__name__}: {str(e)}"
        jobs_dict[job_id].completed_at = datetime.now().isoformat()

        # Логируем полный traceback
        print(f"[ERROR] Job {job_id} failed:")
        traceback.print_exc()


async def run_eval_background(
    job_id: str,
    config: EvalRequest,
    jobs_dict: dict[str, JobStatus]
):
    """Фоновый запуск RAG Evaluation"""
    try:
        jobs_dict[job_id].status = "running"
        jobs_dict[job_id].created_at = datetime.now().isoformat()

        from eval.scripts.run_eval import run_eval_scan

        results_dir = await asyncio.to_thread(
            run_eval_scan,
            dataset=config.dataset,
            model=config.model,
            metrics=config.metrics,
            n_samples=config.n_samples,
            api_contract=config.api_contract
        )

        jobs_dict[job_id].status = "completed"
        jobs_dict[job_id].progress = 100
        jobs_dict[job_id].results_path = str(results_dir)
        jobs_dict[job_id].completed_at = datetime.now().isoformat()

    except Exception as e:
        jobs_dict[job_id].status = "failed"
        jobs_dict[job_id].error = f"{type(e).__name__}: {str(e)}"
        jobs_dict[job_id].completed_at = datetime.now().isoformat()
        traceback.print_exc()
