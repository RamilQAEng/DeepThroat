import datetime
import json
import os
from pathlib import Path

import httpx
import pytest
from core.judges import build_judge
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent.parent / "eval" / ".env")

BASE_URL = os.getenv("RAG_API_BASE_URL", "http://localhost:8000")

DEFAULT_DATASET = (
    Path(__file__).parent.parent.parent / "eval" / "datasets" / "20260329_173829_exp_top_k_10_dataset.json"
)


def pytest_addoption(parser):
    parser.addoption("--dataset", default=str(DEFAULT_DATASET))
    parser.addoption("--api-url", default=BASE_URL)


def _load_dataset(config) -> list[dict]:
    path = Path(config.getoption("--dataset"))
    data = json.loads(path.read_text(encoding="utf-8"))
    return [d for d in data if d.get("expected_output")]


def pytest_generate_tests(metafunc):
    if "case" in metafunc.fixturenames:
        dataset = _load_dataset(metafunc.config)
        metafunc.parametrize("case", dataset, ids=[d["id"] for d in dataset])


@pytest.fixture(scope="session")
def http_client(request) -> httpx.Client:
    url = request.config.getoption("--api-url")
    return httpx.Client(base_url=url, timeout=120.0)


@pytest.fixture(scope="session")
def judge():
    """Судья из .env — тот же что использует eval_rag_metrics.py."""
    import sys

    sys.path.insert(0, str(Path(__file__).parent.parent.parent / "eval"))
    return build_judge(provider="openrouter", model="deepseek/deepseek-v3.2")


@pytest.fixture(scope="session")
def _response_cache() -> dict:
    """Кеш: {case_id: dict} — API вызывается ровно один раз на вопрос."""
    return {}


@pytest.fixture(scope="session")
def _api_log_store() -> dict:
    """Хранилище для финального лога."""
    return {}


@pytest.fixture(scope="session", autouse=True)
def _save_api_log(_api_log_store):
    """После окончания сессии сохраняет лог в tests/logs/."""
    yield

    if not _api_log_store:
        return

    log_dir = Path(__file__).parent.parent / "logs"
    log_dir.mkdir(exist_ok=True)
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    log_path = log_dir / f"{ts}_api_responses.json"
    log_path.write_text(
        json.dumps(_api_log_store, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"\n[log] API-ответы сохранены → {log_path}")


@pytest.fixture
def api_response(case, http_client, _response_cache, _api_log_store) -> dict:
    """
    Возвращает ответ API для данного кейса.
    """
    case_id = case["id"]

    if case_id not in _response_cache:
        response = http_client.post(
            "/api/v1/eval/rag",
            json={"question": case["question"], "category": case["category"]},
        )
        assert (
            response.status_code == 200
        ), f'[{case["category"]}] "{case["question"]}" → HTTP {response.status_code}: {response.text[:300]}'
        data = response.json()
        _response_cache[case_id] = data

        _api_log_store[case_id] = {
            "question": case["question"],
            "category": case["category"],
            "answer": data.get("answer", ""),
            "chunks_count": data.get("chunks_count", len(data.get("retrieved_chunks", []))),
            "retrieved_chunks": [
                {"content": c.get("content", ""), "score": c.get("score")} for c in data.get("retrieved_chunks", [])
            ],
            "raw": data,
        }

    return _response_cache[case_id]
