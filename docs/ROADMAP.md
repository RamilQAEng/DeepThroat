# DeepThroath — Roadmap и рыночный анализ

> Обновлено: 2026-04-16. Анализ конкурентного рынка и приоритизированные улучшения.

---

## Что уже реализовано (v1.0)

| Компонент | Статус |
|-----------|--------|
| Red Team: DeepTeam 6 уязвимостей, 4 атаки | ✅ |
| Data Layer: Parquet storage + history | ✅ |
| Streamlit unified dashboard (Red Team + Quality) | ✅ |
| PDF / HTML / Markdown клиентский отчёт | ✅ |
| RAG Quality Evaluation (deepeval metrics) | ✅ |
| Next.js web frontend | ✅ |
| GitHub Actions workflow (manual-dispatch) | ✅ |
| CI/CD auto-triggers (push/PR/schedule) | 🔜 Backlog |

---

## Конкурентный ландшафт

### Где DeepThroath уже лучше всех (уникальные преимущества)

Ни один open-source инструмент не имеет всего этого одновременно:

| Преимущество | Конкуренты |
|-------------|-----------|
| **Security Score 0–100** с весовыми коэффициентами по критичности | Garak — pass/fail на каждый probe. PromptFoo — pass/fail на тест. PyRIT — надо писать агрегацию самому |
| **PDF/Markdown-отчёт** для передачи клиенту | Отсутствует у всех open-source инструментов |
| **OWASP LLM Top 10** — полный маппинг с описаниями, ремедиацией и severity | Garak — частичный. PromptFoo — нет. PyRIT — нет |
| **RAG Quality Score** + deepeval метрики в едином дашборде | Нет ни у кого из конкурентов |
| **История сканов** с трендом и сравнением версий | У конкурентов требует внешнего инструментария |
| **YAML-конфигурация** targets + attacks без кода | Garak — сложные CLI-флаги. PyRIT — чистый Python |
| **Streamlit-дашборд** из коробки | Нет ни у кого |
| **Web-интерфейс (Next.js)** для запуска и просмотра результатов | Нет ни у кого open-source |

### Ключевые конкуренты

| Инструмент | Компания | Сильные стороны | Слабые стороны |
|-----------|---------|-----------------|----------------|
| **Garak** | NVIDIA | 100+ probes, плагины, кодировки (Base64/ROT13), Ollama | Нет дашборда, нет Score, нет отчётов |
| **PyRIT** | Microsoft | TAP-оркестратор, DuckDB-память, Azure-native, multi-modal | Библиотека без UI, кривая обучения высокая |
| **PromptFoo** | Open Source | Multi-model batch, JUnit XML, кэш ответов, CI-native | Нет Score, нет PDF, нет OWASP-классификации |
| **Lakera Guard** | Lakera | Рантайм-защита <100ms, SOC2, Slack-алерты | Платный SaaS, не pre-deployment tool |
| **Mindgard** | Startup (UK) | Continuous monitoring, MLflow/W&B, EU AI Act отчёты | Закрытый, enterprise-only, дорого |

---

## Tier 1 — Максимальный эффект, минимальные усилия

### 1. GitHub Actions auto-triggers

**Статус:** 🔜 Backlog

**Проблема:** `.github/workflows/redteam.yml` существует и работает, но настроен только на `workflow_dispatch` (ручной запуск). Автоматический запуск на push/PR/schedule отключён.

**Что сделать:** Раскомментировать/добавить `on: push/pull_request/schedule` триггеры:
```yaml
on:
  push:
    paths: ['config/**', 'src/**']
  pull_request:
  schedule:
    - cron: '0 2 * * 1'  # каждый понедельник
```

После прогона — автоматический комментарий в PR: `Security Score: 87/100 (-3 от прошлого скана)`.

**Почему важно:** PromptFoo активно продвигает CI/CD как главный use case. Без авто-триггеров позиционирование "интегрируется в CI/CD" — маркетинг, а не продукт.

---

### 2. Мультимодельное тестирование (`--targets multiple`)

**Статус:** 🔜 Backlog

**Проблема:** Сейчас можно тестировать только одну модель за раз. Самый распространённый кейс у enterprise — "сравни GPT-4o, Claude Sonnet и наш fine-tuned Qwen".

**Что сделать:**
```bash
python scripts/run_redteam.py --config config/attack_config.yaml \
  --targets gpt4o claude-sonnet qwen-7b
```

Результат — единый DataFrame со столбцом `model_version`, новая вкладка "Сравнение моделей".

---

### 3. JUnit XML output для CI-систем

**Статус:** 🔜 Backlog

**Проблема:** GitHub Actions, GitLab CI, Jenkins умеют парсить JUnit XML нативно. Сейчас результат только в Parquet.

**Что сделать:** Флаг `--output-junit results/report.xml`.

---

### 4. Demo-данные для первого запуска

**Статус:** 🔜 Backlog

**Проблема:** Новый пользователь клонирует репо, запускает `streamlit run` — видит пустой дашборд.

**Что сделать:** Добавить `results/demo/latest.parquet` с реальными данными. При отсутствии `RESULTS_DIR` — автоматически показывать demo-данные с баннером "Демо-режим".

---

### 5. Аннотация регрессий на трендовом графике

**Статус:** 🔜 Backlog

**Что сделать:** Автоматически находить скан с наибольшим падением Security Score и добавлять аннотацию:
```
▼ -12 pts (скан от 2026-03-28) — Prompt Injection ASR вырос с 0% до 34%
```

---

## Tier 2 — Высокое влияние, умеренные усилия

### 6. Уведомления: Slack / Teams / Webhook

**Конфигурация в `attack_config.yaml`:**
```yaml
notifications:
  - type: slack
    url: "https://hooks.slack.com/..."
    only_on_regression: true
    message_template: "🔴 {model}: Score {score}/100, ASR {asr}%"
  - type: webhook
    url: "https://your-system.com/webhook"
```

---

### 7. EU AI Act — compliance-отчёт

**Контекст:** EU AI Act полностью вступил в силу для high-risk систем (август 2026). Статья 9 требует документированного adversarial testing. Статья 15 — quantified robustness metrics.

**Что сделать:** Новый шаблон `report_eu_ai_act.html` с секциями Art.9, Art.15 и маппингом на OWASP LLM Top 10.

---

### 8. Critical-уязвимости всегда наверху

**Статус:** 🔜 Backlog

Фиксированный блок в верхней части дашборда (до Score), который появляется только если есть Critical/High с ASR > 0.

---

### 9. Prometheus / JSON-экспорт метрик

Флаг `--output-metrics results/metrics.json` + `--output-prometheus results/metrics.txt`. Grafana scrapes → алёрты когда ASR > threshold.

---

### 10. "Быстрый фикс" в рекомендациях

К каждой рекомендации добавить готовый system-prompt патч для copy-paste исправления.

---

## Tier 3 — Стратегические дифференциаторы (roadmap)

### 11. Система плагинов для кастомных атак

```python
# plugins/medical_misinformation.py
class MedicalMisinformationAttack(AttackPlugin):
    vulnerability_type = "MedicalMisinformation"
    def generate_prompts(self, n: int) -> list[str]: ...
```

### 12. AgentCallback — тестирование AI-агентов с инструментами

Самый быстрорастущий паттерн 2025 — AI-агенты с доступом к инструментам. Текущий runner тестирует текст, но не tool calls. Атаки: `RecursiveHijacking`, `ExploitToolAgent`, `GoalTheft`.

### 13. RAG Security — атаки через документы (Indirect Prompt Injection)

Вектор атаки: внедрить вредоносные инструкции в документ, который будет проиндексирован и использован как контекст. Критично для production RAG-систем.

### 14. Scheduled monitoring — непрерывное тестирование

```yaml
# config/schedule.yaml
schedule:
  cron: "0 9 * * 1"  # каждый понедельник в 9:00
  config: config/attack_config.yaml
  target: default
  alert_on_regression: true
```

### 15. NIST AI RMF — шаблон для US-рынка

Аналог EU AI Act для США. Шаблон отчёта с маппингом на функции GOVERN / MAP / MEASURE / MANAGE.

---

## UX-инсайты от анализа конкурентов

**1. Traffic-light модель — везде**
Snyk, Semgrep, Lakera — все используют 3-цветовой статус. Score 87/100 скрывает критическую уязвимость — нужен отдельный "требует внимания" блок.

**2. Evidence dialog = инструмент доверия**
Не-security инженеры не доверяют автоматическим инструментам. Показать точный диалог: атака → ответ → вердикт.

**3. Prescriptive remediation > Generic advice**
"Добавьте в system prompt вот это:" — actionable. "Используйте валидацию входных данных" — бесполезно.

**4. Регрессия важнее абсолютного значения**
"Было 92, стало 87, потому что PR #142 изменил system prompt" — понятно всем.

**5. Первый запуск ломает большинство инструментов**
DeepThroath с demo-данными из коробки выигрывает у всех.

---

## Сводная таблица приоритетов

| # | Улучшение | Усилие | Влияние | Статус |
|---|-----------|--------|---------|--------|
| 1 | GitHub Actions auto-triggers | 0.5 дня | 🔥🔥🔥 | 🔜 |
| 2 | Мультимодельное тестирование | 3-5 дней | 🔥🔥🔥 | 🔜 |
| 3 | JUnit XML output | 1 день | 🔥🔥🔥 | 🔜 |
| 4 | Demo-данные (первый запуск) | 1 день | 🔥🔥🔥 | 🔜 |
| 5 | Аннотация регрессий на тренде | 1-2 дня | 🔥🔥 | 🔜 |
| 6 | Slack/Webhook уведомления | 3-4 дня | 🔥🔥🔥 | 🔜 |
| 7 | EU AI Act compliance-отчёт | 4-5 дней | 🔥🔥🔥 | 🔜 |
| 8 | Critical-блок поверх Score | 1-2 дня | 🔥🔥🔥 | 🔜 |
| 9 | Prometheus/JSON-экспорт | 2-3 дня | 🔥🔥 | 🔜 |
| 10 | "Быстрый фикс" в рекомендациях | 2-3 дня | 🔥🔥 | 🔜 |
| 11 | Plugin-система атак | 1-2 недели | 🔥🔥🔥 | 🔜 |
| 12 | AgentCallback (agentic testing) | 2-4 недели | 🔥🔥🔥 | 🔜 |
| 13 | RAG/document injection атаки | 1-2 недели | 🔥🔥🔥 | 🔜 |
| 14 | Scheduled monitoring | 1-2 недели | 🔥🔥 | 🔜 |
| 15 | NIST AI RMF отчёт | 3-5 дней | 🔥🔥 | 🔜 |
