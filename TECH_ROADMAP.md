# DeepThroath: Technical Roadmap for Production Deployment

**Статус:** FastAPI Migration (Phase 1) — 80% завершено
**Цель:** Production-ready deployment на Railway/Render
**Дата:** 2026-04-21

---

## Текущее состояние

### ✅ Завершено (Phase 1.1-1.4)

- [x] FastAPI микросервис (`src/api/main.py`, `schemas.py`, `runner.py`)
- [x] Callable функции для Python скриптов (`run_redteam_scan`, `run_eval_scan`)
- [x] Next.js API routes без `child_process.spawn`
- [x] Polling endpoint для статуса задач (`/api/jobs/{jobId}/status`)
- [x] Health check endpoint (`/health`)
- [x] Dropdown для выбора judge моделей из YAML
- [x] Удаление Streamlit дашбордов (2689 строк)
- [x] FASTAPI_QUICKSTART.md документация

### ⚠️ Текущие проблемы

1. **In-memory job storage** — теряются данные при рестарте
2. **Нет polling на фронтенде** — пользователь не видит прогресс
3. **Отсутствие линтеров** — нет проверки качества кода
4. **Нет Docker контейнеров** — невозможно задеплоить
5. **Нет CI/CD** — ручной деплой
6. **Секреты в .env** — не подходит для production

---

## Критичные задачи (P0) — Блокеры деплоя

### 1. Polling на фронтенде ⏱️ 2-3 часа

**Файлы:** `web/src/app/runner/page.tsx`

**Задача:**
После успешного создания job (`POST /api/runner`), начать polling статуса каждые 3 секунды до завершения задачи.

**Требования:**
```typescript
// После handleRun возвращает job_id
const [jobId, setJobId] = useState<string | null>(null);
const [jobStatus, setJobStatus] = useState<'idle' | 'pending' | 'running' | 'completed' | 'failed'>('idle');
const [jobProgress, setJobProgress] = useState<number>(0);

useEffect(() => {
  if (!jobId || jobStatus === 'completed' || jobStatus === 'failed') return;

  const interval = setInterval(async () => {
    const res = await fetch(`/api/jobs/${jobId}/status`);
    const data = await res.json();
    setJobStatus(data.status);
    setJobProgress(data.progress || 0);

    if (data.status === 'completed') {
      clearInterval(interval);
      // Опционально: редирект на страницу результатов
      // router.push(`/results/${jobId}`);
    }
  }, 3000);

  return () => clearInterval(interval);
}, [jobId, jobStatus]);
```

**UI элементы:**
- Progress bar с процентом выполнения
- Лог-стрим в реальном времени (если FastAPI будет писать в jobs[job_id].logs)
- Кнопка "Cancel" для отмены задачи

**Acceptance Criteria:**
- [ ] Polling стартует после успешного запуска задачи
- [ ] UI показывает статус (pending → running → completed)
- [ ] Polling останавливается при completed/failed
- [ ] Показывается сообщение об ошибке при failed

---

### 2. Миграция на uv ⏱️ 1-2 часа

**Почему:** uv в 10-100 раз быстрее pip, лучше для CI/CD и Docker.

**Шаги:**

1. **Установить uv**
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

2. **Создать pyproject.toml**
```toml
[project]
name = "deepthroath"
version = "1.0.0"
requires-python = ">=3.11"
dependencies = [
    "deepteam==1.0.6",
    "deepeval==3.9.3",
    "anthropic==0.86.0",
    "openai==2.30.0",
    "pandas==2.3.3",
    "pyarrow==23.0.1",
    "pydantic==2.12.5",
    "fastapi==0.115.6",
    "uvicorn[standard]==0.34.0",
    "pyyaml>=6.0",
    "python-dotenv==1.2.2",
    "jinja2>=3.1.0",
    "weasyprint>=62.0",
    "gigachat",
    "httpx>=0.28.0",
    "croniter>=2.0.0",
    "ragas>=0.2.0",
    "langchain-openai>=0.1.0",
    "langchain-core>=0.2.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.23.0",
    "ruff>=0.8.0",
    "mypy>=1.13.0",
]

[tool.ruff]
line-length = 120
target-version = "py311"

[tool.ruff.lint]
select = ["E", "F", "I", "N", "W", "UP"]
ignore = ["E501"]

[tool.mypy]
python_version = "3.11"
strict = true
warn_return_any = true
warn_unused_configs = true
```

3. **Установить зависимости**
```bash
uv venv
source .venv/bin/activate  # или .venv\Scripts\activate на Windows
uv pip install -e ".[dev]"
```

4. **Обновить README.md**
```markdown
## Установка

### Используя uv (рекомендуется)
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
uv venv
source .venv/bin/activate
uv pip install -e ".[dev]"
```

### Используя pip (legacy)
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```
```

**Acceptance Criteria:**
- [ ] `uv pip install` работает
- [ ] `requirements.txt` сохранен для совместимости (через `uv pip compile`)
- [ ] Документация обновлена

---

### 3. Docker контейнеризация ⏱️ 3-4 часа

#### 3.1 Dockerfile для FastAPI

**Файл:** `Dockerfile`

```dockerfile
# syntax=docker/dockerfile:1
FROM python:3.11-slim AS builder

# Установить uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Копировать только файлы зависимостей для кэширования слоев
COPY pyproject.toml ./
RUN uv venv && \
    . .venv/bin/activate && \
    uv pip install --no-cache .

# Финальный образ
FROM python:3.11-slim

WORKDIR /app

# Копировать виртуальное окружение из builder
COPY --from=builder /app/.venv /app/.venv

# Копировать исходный код
COPY src/ ./src/
COPY eval/ ./eval/
COPY scripts/ ./scripts/
COPY config/ ./config/

# Установить переменные окружения
ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONUNBUFFERED=1

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

# Запуск FastAPI
CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Размер образа:** ~500MB (вместо 1.5GB с pip)

#### 3.2 Dockerfile для Next.js

**Файл:** `web/Dockerfile`

```dockerfile
# syntax=docker/dockerfile:1
FROM node:20-alpine AS base

# Зависимости
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Сборка
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production образ
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Копировать только необходимое для production
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

**Требование:** В `next.config.js` добавить:
```javascript
module.exports = {
  output: 'standalone',
}
```

**Размер образа:** ~150MB

#### 3.3 docker-compose.yml

**Файл:** `docker-compose.yml`

```yaml
version: '3.8'

services:
  fastapi:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - REDIS_URL=redis://redis:6379
    volumes:
      - ./eval:/app/eval
      - ./results:/app/results
    depends_on:
      - redis
    restart: unless-stopped

  nextjs:
    build:
      context: ./web
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://fastapi:8000
    depends_on:
      - fastapi
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  redis_data:
```

**Команды:**
```bash
# Запуск
docker-compose up -d

# Логи
docker-compose logs -f fastapi

# Остановка
docker-compose down
```

**Acceptance Criteria:**
- [ ] `docker-compose up` запускает все сервисы
- [ ] Next.js доступен на `http://localhost:3000`
- [ ] FastAPI доступен на `http://localhost:8000`
- [ ] Next.js может обращаться к FastAPI через docker network

---

### 4. Environment Variables ⏱️ 1 час

**Файл:** `.env.example`

```bash
# === API Keys (обязательно) ===
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# === FastAPI Configuration ===
FASTAPI_ENV=production  # development | production
FASTAPI_HOST=0.0.0.0
FASTAPI_PORT=8000
ALLOWED_ORIGINS=https://deepthroath.com,https://app.deepthroath.com

# === Redis (для production) ===
REDIS_URL=redis://localhost:6379

# === Next.js Configuration ===
NEXT_PUBLIC_API_URL=http://localhost:8000

# === Optional: LLM Providers ===
GIGACHAT_API_KEY=...
GOOGLE_API_KEY=...  # для Gemini

# === Logging ===
LOG_LEVEL=INFO  # DEBUG | INFO | WARNING | ERROR
```

**Валидация через Pydantic:**

**Файл:** `src/api/config.py`

```python
from pydantic_settings import BaseSettings
from typing import Literal

class Settings(BaseSettings):
    # API Keys
    openai_api_key: str
    anthropic_api_key: str
    gigachat_api_key: str | None = None

    # FastAPI
    fastapi_env: Literal["development", "production"] = "development"
    fastapi_host: str = "0.0.0.0"
    fastapi_port: int = 8000
    allowed_origins: list[str] = ["http://localhost:3000"]

    # Redis
    redis_url: str = "redis://localhost:6379"

    # Logging
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    class Config:
        env_file = ".env"
        case_sensitive = False

settings = Settings()
```

**Использование в main.py:**
```python
from src.api.config import settings

app = FastAPI(debug=settings.fastapi_env == "development")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Acceptance Criteria:**
- [ ] `.env.example` создан с документацией
- [ ] Pydantic Settings валидирует переменные при старте
- [ ] Приложение падает с ясной ошибкой, если обязательные переменные отсутствуют

---

## Важные задачи (P1) — Желательно для production

### 5. Линтеры и форматирование ⏱️ 2 часа

#### 5.1 Python: Ruff

**Файл:** `pyproject.toml` (уже добавлено выше)

**Команды:**
```bash
# Проверка
ruff check .

# Автофикс
ruff check --fix .

# Форматирование
ruff format .
```

**pre-commit hook:**

**Файл:** `.pre-commit-config.yaml`

```yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.8.4
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format

  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.13.0
    hooks:
      - id: mypy
        additional_dependencies: [types-all]
```

**Установка:**
```bash
uv pip install pre-commit
pre-commit install
```

#### 5.2 TypeScript: ESLint + Prettier

**Файл:** `web/.eslintrc.json`

```json
{
  "extends": [
    "next/core-web-vitals",
    "prettier"
  ],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": "error"
  }
}
```

**Файл:** `web/.prettierrc`

```json
{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "es5"
}
```

**Команды:**
```bash
cd web
npm run lint
npm run format
```

**Husky для pre-commit:**

```bash
cd web
npm install --save-dev husky lint-staged
npx husky init
```

**Файл:** `web/.husky/pre-commit`

```bash
#!/bin/sh
cd web
npx lint-staged
```

**Файл:** `web/package.json`

```json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ]
  }
}
```

**Acceptance Criteria:**
- [ ] `ruff check` проходит без ошибок
- [ ] `npm run lint` проходит без ошибок
- [ ] Pre-commit hooks работают локально
- [ ] Коммит блокируется при наличии ошибок линтера

---

### 6. CI/CD Pipeline (GitHub Actions) ⏱️ 2-3 часа

**Файл:** `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main, feat/*]
  pull_request:
    branches: [main]

jobs:
  lint-python:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install uv
        uses: astral-sh/setup-uv@v4

      - name: Set up Python
        run: uv python install 3.11

      - name: Install dependencies
        run: uv pip install -e ".[dev]"

      - name: Lint with ruff
        run: ruff check .

      - name: Type check with mypy
        run: mypy src/ eval/ scripts/

  lint-typescript:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ./web
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
          cache-dependency-path: web/package-lock.json

      - run: npm ci
      - run: npm run lint
      - run: npm run build

  test-python:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install uv
        uses: astral-sh/setup-uv@v4

      - name: Set up Python
        run: uv python install 3.11

      - name: Install dependencies
        run: uv pip install -e ".[dev]"

      - name: Run tests
        run: pytest -v

  build-docker:
    runs-on: ubuntu-latest
    needs: [lint-python, lint-typescript]
    steps:
      - uses: actions/checkout@v4

      - name: Build FastAPI
        run: docker build -t deepthroath-api .

      - name: Build Next.js
        run: docker build -t deepthroath-web ./web
```

**Acceptance Criteria:**
- [ ] CI запускается на каждый push/PR
- [ ] Pull request блокируется при падении линтеров
- [ ] Docker образы собираются успешно

---

### 7. Redis для job storage ⏱️ 3-4 часа

**Зачем:** In-memory `jobs: dict` теряет данные при рестарте FastAPI.

**Установка Redis:**
```bash
# Локально (macOS)
brew install redis
brew services start redis

# Docker
docker run -d -p 6379:6379 redis:7-alpine
```

**Зависимость:**
```bash
uv pip install redis
```

**Файл:** `src/api/storage.py`

```python
import redis
import json
from typing import Any
from src.api.schemas import JobStatus
from src.api.config import settings

redis_client = redis.from_url(settings.redis_url, decode_responses=True)

def save_job(job_id: str, job: JobStatus) -> None:
    """Сохранить статус задачи в Redis"""
    redis_client.set(f"job:{job_id}", job.model_dump_json(), ex=86400)  # 24h TTL

def get_job(job_id: str) -> JobStatus | None:
    """Получить статус задачи из Redis"""
    data = redis_client.get(f"job:{job_id}")
    if not data:
        return None
    return JobStatus.model_validate_json(data)

def update_job_status(job_id: str, status: str, **kwargs: Any) -> None:
    """Обновить статус задачи"""
    job = get_job(job_id)
    if not job:
        return

    job.status = status
    for key, value in kwargs.items():
        setattr(job, key, value)

    save_job(job_id, job)

def list_jobs() -> list[JobStatus]:
    """Получить все задачи"""
    keys = redis_client.keys("job:*")
    return [JobStatus.model_validate_json(redis_client.get(k)) for k in keys]
```

**Обновить `src/api/main.py`:**

```python
from src.api.storage import save_job, get_job, update_job_status, list_jobs

@app.post("/api/runner/eval")
async def create_eval_job(request: EvalRequest, background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())
    job = JobStatus(job_id=job_id, status="pending", progress=0)
    save_job(job_id, job)  # Вместо jobs[job_id] = job

    background_tasks.add_task(run_eval_background, job_id=job_id, config=request)
    return JobResponse(job_id=job_id, status="pending")

@app.get("/api/jobs/{job_id}/status")
async def get_job_status(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job
```

**Обновить background tasks:**

```python
async def run_eval_background(job_id: str, config: EvalRequest):
    try:
        update_job_status(job_id, "running", progress=10)

        result_path = await asyncio.to_thread(
            run_eval_scan,
            dataset=config.dataset,
            model=config.model,
            n_samples=config.n_samples
        )

        update_job_status(job_id, "completed", progress=100, results_path=str(result_path))
    except Exception as e:
        update_job_status(job_id, "failed", error=str(e))
```

**Acceptance Criteria:**
- [ ] Redis хранит job статусы
- [ ] Задачи не теряются при рестарте FastAPI
- [ ] TTL = 24 часа для автоматической очистки старых jobs

---

### 8. CORS для production ⏱️ 30 минут

**Файл:** `src/api/main.py`

```python
from src.api.config import settings

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,  # Из .env
    allow_credentials=True,
    allow_methods=["GET", "POST"],  # Только нужные методы
    allow_headers=["Content-Type", "Authorization"],
    max_age=3600,  # Кэшировать preflight на 1 час
)
```

**Настройки для production:**

```bash
# .env для Railway
ALLOWED_ORIGINS=https://deepthroath.com,https://app.deepthroath.com
```

**Acceptance Criteria:**
- [ ] CORS работает для production доменов
- [ ] Локально работает с `http://localhost:3000`
- [ ] Preflight запросы кэшируются

---

### 9. Rate Limiting ⏱️ 1 час

**Зависимость:**
```bash
uv pip install slowapi
```

**Файл:** `src/api/main.py`

```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.post("/api/runner/eval")
@limiter.limit("10/minute")  # Максимум 10 запросов в минуту с одного IP
async def create_eval_job(request: Request, eval_request: EvalRequest, ...):
    ...

@app.post("/api/runner/redteam")
@limiter.limit("5/minute")  # Red Team более дорогой
async def create_redteam_job(request: Request, redteam_request: RedTeamRequest, ...):
    ...
```

**Acceptance Criteria:**
- [ ] API возвращает 429 при превышении лимита
- [ ] Лимит работает per-IP
- [ ] Response headers содержат `X-RateLimit-Limit`, `X-RateLimit-Remaining`

---

## Дополнительные задачи (P2) — Nice to have

### 10. Structured Logging ⏱️ 2 часа

**Зависимость:**
```bash
uv pip install structlog
```

**Файл:** `src/api/logging_config.py`

```python
import structlog
import logging
from src.api.config import settings

def setup_logging():
    logging.basicConfig(
        format="%(message)s",
        level=getattr(logging, settings.log_level),
    )

    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer()
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

logger = structlog.get_logger()
```

**Использование:**

```python
from src.api.logging_config import logger

@app.post("/api/runner/eval")
async def create_eval_job(request: EvalRequest, ...):
    logger.info(
        "eval_job_created",
        job_id=job_id,
        dataset=request.dataset,
        model=request.model,
        n_samples=request.n_samples
    )

    # Вместо print() в background task:
    logger.info("eval_started", job_id=job_id)
    logger.info("eval_completed", job_id=job_id, results_path=str(result_path))
```

**Вывод:**
```json
{
  "event": "eval_job_created",
  "job_id": "abc-123",
  "dataset": "mglk_rag",
  "model": "gpt4o-mini-or",
  "n_samples": 50,
  "timestamp": "2026-04-21T15:30:00.123Z",
  "level": "info"
}
```

---

### 11. Monitoring & Metrics ⏱️ 4-6 часов

**Зависимость:**
```bash
uv pip install prometheus-fastapi-instrumentator
```

**Файл:** `src/api/main.py`

```python
from prometheus_fastapi_instrumentator import Instrumentator

app = FastAPI()

Instrumentator().instrument(app).expose(app, endpoint="/metrics")
```

**Метрики:**
- `http_requests_total` — количество запросов
- `http_request_duration_seconds` — latency
- `http_requests_inprogress` — активные запросы

**Grafana Dashboard:**
- Импортировать dashboard ID: 14276 (FastAPI Observability)

**Acceptance Criteria:**
- [ ] `/metrics` endpoint доступен
- [ ] Prometheus собирает метрики
- [ ] Grafana показывает дашборд

---

### 12. Тестирование ⏱️ 6-8 часов

#### 12.1 pytest для FastAPI

**Файл:** `tests/test_api.py`

```python
import pytest
from fastapi.testclient import TestClient
from src.api.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_create_eval_job():
    response = client.post("/api/runner/eval", json={
        "dataset": "mglk_rag",
        "model": "gpt4o-mini-or",
        "n_samples": 10
    })
    assert response.status_code == 200
    data = response.json()
    assert "job_id" in data
    assert data["status"] == "pending"

@pytest.mark.asyncio
async def test_job_status():
    # Создать job
    response = client.post("/api/runner/eval", json={
        "dataset": "mglk_rag",
        "model": "gpt4o-mini-or",
        "n_samples": 1
    })
    job_id = response.json()["job_id"]

    # Проверить статус
    status_response = client.get(f"/api/jobs/{job_id}/status")
    assert status_response.status_code == 200
    assert status_response.json()["status"] in ["pending", "running"]
```

**Запуск:**
```bash
pytest -v --cov=src/api --cov-report=html
```

#### 12.2 Jest для Next.js

**Файл:** `web/__tests__/runner.test.tsx`

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RunnerPage from '@/app/runner/page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

global.fetch = jest.fn();

test('loads judge models on mount', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      judges: [
        { name: 'gpt4o-mini-or', provider: 'openai', model: 'gpt-4o-mini' },
      ],
    }),
  });

  render(<RunnerPage />);

  await waitFor(() => {
    expect(screen.getByText(/gpt4o-mini-or/i)).toBeInTheDocument();
  });
});

test('submits eval job', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ job_id: 'test-123', status: 'pending' }),
  });

  render(<RunnerPage />);

  const button = screen.getByText(/Запустить Evaluation/i);
  fireEvent.click(button);

  await waitFor(() => {
    expect(fetch).toHaveBeenCalledWith('/api/runner', expect.anything());
  });
});
```

**Acceptance Criteria:**
- [ ] pytest coverage >= 80%
- [ ] Jest тесты для ключевых компонентов
- [ ] CI запускает тесты автоматически

---

### 13. Graceful Shutdown ⏱️ 1 час

**Файл:** `src/api/main.py`

```python
import signal
import asyncio

shutdown_event = asyncio.Event()

@app.on_event("startup")
async def startup():
    def handle_signal(sig, frame):
        print(f"Received signal {sig}, shutting down gracefully...")
        shutdown_event.set()

    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)

@app.on_event("shutdown")
async def shutdown():
    # Подождать завершения всех background tasks (макс 30 сек)
    print("Waiting for background tasks to complete...")
    await asyncio.sleep(5)  # Grace period для завершения jobs
    print("Shutdown complete")
```

**Acceptance Criteria:**
- [ ] SIGTERM/SIGINT обрабатываются корректно
- [ ] Background tasks успевают завершиться
- [ ] Логи записываются перед остановкой

---

### 14. Deployment на Railway ⏱️ 2-3 часа

#### 14.1 Railway CLI

```bash
# Установка
npm install -g @railway/cli

# Логин
railway login

# Инициализация проекта
railway init
```

#### 14.2 railway.json

**Файл:** `railway.json`

```json
{
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "startCommand": "uvicorn src.api.main:app --host 0.0.0.0 --port $PORT",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

#### 14.3 Переменные окружения в Railway

```bash
railway variables set OPENAI_API_KEY=sk-...
railway variables set ANTHROPIC_API_KEY=sk-ant-...
railway variables set REDIS_URL=${{Redis.REDIS_URL}}  # Из Railway Redis plugin
railway variables set ALLOWED_ORIGINS=https://app.deepthroath.com
```

#### 14.4 Деплой

```bash
# Создать Redis сервис
railway add

# Задеплоить FastAPI
railway up

# Получить URL
railway domain
```

**Для Next.js:**
- Использовать **Vercel** (интеграция из коробки)
- Или Railway с отдельным сервисом

**Acceptance Criteria:**
- [ ] FastAPI работает на Railway
- [ ] Next.js работает на Vercel
- [ ] Redis подключен через Railway plugin
- [ ] HTTPS работает с custom domain

---

## Чек-лист перед деплоем

### Code Quality
- [ ] Все линтеры проходят (ruff, eslint)
- [ ] Type checking проходит (mypy, tsc --noEmit)
- [ ] Тесты проходят (pytest, jest)
- [ ] Coverage >= 80%
- [ ] Нет TODO/FIXME в production коде

### Security
- [ ] Секреты не в Git (используется .env)
- [ ] CORS настроен для production доменов
- [ ] Rate limiting включен
- [ ] HTTPS enforced
- [ ] API keys валидируются через Pydantic Settings

### Reliability
- [ ] Redis для persistent job storage
- [ ] Health checks работают
- [ ] Graceful shutdown реализован
- [ ] Логирование структурированное (JSON)
- [ ] Monitoring настроен (Prometheus)

### Performance
- [ ] Docker образы оптимизированы (multi-stage)
- [ ] Кэширование зависимостей в CI/CD
- [ ] CDN для статики Next.js (Vercel auto)
- [ ] Redis connection pooling

### Documentation
- [ ] README.md обновлен
- [ ] .env.example актуален
- [ ] API документация доступна (FastAPI /docs)
- [ ] CHANGELOG.md ведется

---

## Приоритетный порядок выполнения

### Неделя 1: Минимальный деплой
1. ✅ Polling на фронтенде (P0)
2. ✅ Docker контейнеры (P0)
3. ✅ Environment variables (P0)
4. ✅ Миграция на uv (P0)
5. ✅ Деплой на Railway (P0)

### Неделя 2: Production-ready
6. ✅ Redis для job storage (P1)
7. ✅ Линтеры + pre-commit (P1)
8. ✅ CI/CD pipeline (P1)
9. ✅ CORS + Rate limiting (P1)

### Неделя 3: Оптимизация
10. ✅ Structured logging (P2)
11. ✅ Тесты (pytest, jest) (P2)
12. ✅ Monitoring (Prometheus/Grafana) (P2)

---

## Технический долг (отложить на Phase 2)

- [ ] Миграция с Streamlit на Next.js для всех дашбордов
- [ ] PostgreSQL для хранения истории evaluations
- [ ] WebSocket для real-time логов вместо polling
- [ ] Celery для distributed task queue
- [ ] Multi-region deployment
- [ ] Автоматическая генерация OpenAPI клиентов для TypeScript

---

**Последнее обновление:** 2026-04-21
**Автор:** Claude Sonnet 4.5
**Статус:** Phase 1 FastAPI Migration — 80% завершено
