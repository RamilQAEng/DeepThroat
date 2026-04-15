# DeepThroath — Marketing Strategy

## Positioning Statement

**DeepThroath** — это платформа непрерывного red teaming и оценки качества для LLM-продуктов, которая автоматически тестирует безопасность и качество модели при каждом деплое и генерирует отчёты по стандарту OWASP LLM Top 10.

**Для кого:** AI-команды в компаниях, которые встраивают LLM в продукты и отвечают за безопасность и качество перед клиентами или регуляторами.

**Отличие от конкурентов:** единственное open-source решение, которое объединяет автоматизированные атаки, оценку качества RAG, количественные метрики и клиентский отчёт в одном CI/CD-совместимом пайплайне.

---

## Core Value Propositions

### 1. "Prove it, don't promise it"
Корпоративные клиенты всё чаще требуют доказательств безопасности AI. DeepThroath заменяет устные заверения измеримым отчётом с конкретными тестами.

> *"Security Score 89/100. 150 атак. 0 пробитий Prompt Injection."*

### 2. "Security and quality that ship with the code"
Безопасность и качество встроены в CI/CD, а не проверяются раз в квартал вручную.

> *"If ASR > 20% — the PR doesn't merge. If Quality Score drops 10% — the team gets notified."*

### 3. "From audit to monitoring"
Разовый аудит — это снимок. DeepThroath — это непрерывный мониторинг с историей изменений и delta между версиями.

> *"See exactly how your security AND quality changed after the last prompt update."*

### 4. "One platform for security and quality"
Впервые в одном инструменте — red teaming и RAG quality evaluation. Нет нужды переключаться между Garak и Ragas.

> *"Security Score 87/100. Quality Score 82/100. Both in one dashboard."*

---

## Messaging по сегментам

### ML Engineering Teams
**Pain:** "Нам нужно тестировать безопасность и качество RAG, но у нас нет ресурсов."
**Message:** "10 строк конфига в CI/CD — и каждый PR автоматически проходит 150+ атак и оценку quality metrics. Никакого ручного труда."

### Security / Trust & Safety
**Pain:** "Мы не знаем, стала ли модель уязвимее после последнего обновления."
**Message:** "OWASP-классифицированные метрики после каждого деплоя. Точный delta по каждой категории угроз."

### Product Management
**Pain:** "Клиенты спрашивают про безопасность и качество, а мне нечего им показать."
**Message:** "Готовый PDF-отчёт с Security Score, Quality Score, доказательной базой и рекомендациями — в одно нажатие."

### Compliance / Legal
**Pain:** "EU AI Act и корпоративные аудиторы требуют документацию процесса обеспечения безопасности."
**Message:** "Полная хронология Security Score по всем версиям с привязкой к OWASP LLM Top 10 — основа для compliance-документации."

---

## Go-to-Market Channels

### Phase 1 — Community & Developer (месяцы 1–3)
- Open-source релиз на GitHub
- Пост на Hacker News: "We built an automated red teaming + RAG quality platform for LLMs"
- Статья на Towards Data Science / Medium: "How we automated LLM security testing and quality evaluation"
- Demo на AI Safety / LLM security Twitter/X communities
- ProductHunt launch

### Phase 2 — Content Marketing (месяцы 3–6)
- Серия статей: "OWASP LLM Top 10 — как тестировать каждую категорию"
- Case study: "Как мы обнаружили prompt injection в production AI assistant"
- YouTube: демо работы платформы (scan → quality eval → dashboard → report за 10 минут)
- Partnerships с AI security researchers для co-authored content

### Phase 3 — Enterprise Sales (месяцы 6+)
- Direct outreach в компании, активно продающие AI B2B
- Партнёрство с AI consultancies (они используют как инструмент для аудитов)
- Conference presence: AI Engineer Summit, DEF CON AI Village, RSA Conference
- Freemium → paid: бесплатно для open-source, платно для enterprise (team features, SLA, SSO)

---

## Key Messages для разных каналов

### GitHub README (developer-first)
```
Automated LLM red teaming + RAG quality evaluation in one platform.
- 6 OWASP vulnerability categories, 4 attack methods
- RAG quality metrics: Answer Relevancy, Faithfulness
- Streamlit unified dashboard + Next.js web UI
- PDF / Markdown client reports
- GitHub Actions ready
```

### LinkedIn (B2B, продукт-менеджеры и руководители)
> Ваша AI-команда обновила системный промпт. Вы знаете, стала ли модель безопаснее и качество ответов улучшилось?
> DeepThroath автоматически отвечает на оба вопроса после каждого деплоя.

### Twitter/X (tech community)
> We built DeepThroath — open source LLM red teaming + RAG quality evaluation.
> Security Score. Quality Score. OWASP mapping. Client PDF reports.
> All in one Streamlit dashboard + Next.js UI. 🔐

### Conference pitch (30 seconds)
> "У вас есть AI-ассистент в продакте. Вы можете сказать клиенту конкретный Security Score — число от 0 до 100 — с доказательной базой по OWASP LLM Top 10? И Quality Score для RAG-системы? DeepThroath делает это автоматически при каждом деплое."

---

## Competitive Differentiation

| Критерий | Garak | PromptFoo | Lakera | Ragas | DeepThroath |
|---------|-------|-----------|--------|-------|-------------|
| Автоматические атаки | ✅ | ⚠️ | ❌ | ❌ | ✅ |
| OWASP LLM классификация | ⚠️ | ❌ | ❌ | ❌ | ✅ |
| CI/CD интеграция | ⚠️ | ✅ | ❌ | ❌ | ✅ |
| Аналитический дашборд | ❌ | ⚠️ | ✅ | ❌ | ✅ |
| RAG Quality Evaluation | ❌ | ❌ | ❌ | ✅ | ✅ |
| Клиентский PDF отчёт | ❌ | ❌ | ❌ | ❌ | ✅ |
| Security Score | ❌ | ❌ | ❌ | ❌ | ✅ |
| Quality Score | ❌ | ❌ | ❌ | ⚠️ | ✅ |
| Версионный тренд | ❌ | ❌ | ❌ | ❌ | ✅ |
| Web UI (Next.js) | ❌ | ❌ | ✅ | ❌ | ✅ |
| Open-source | ✅ | ✅ | ❌ | ✅ | ✅ |

---

## Pricing Model (будущий)

| Tier | Цена | Возможности |
|------|------|-------------|
| **Open Source** | $0 | Всё ядро, self-hosted, community support |
| **Team** | $299/мес | До 5 пользователей, история 90 дней, брендированные отчёты |
| **Business** | $999/мес | До 20 пользователей, кастомные уязвимости, Slack алерты, SSO |
| **Enterprise** | Custom | Unlimited, SLA, on-premise, compliance пакет |

---

## Key Metrics to Track

- GitHub Stars / Forks (product-led growth индикатор)
- Weekly Active Scans (engagement)
- Quality Eval runs (RAG market penetration)
- PDF Reports generated (buyer intent сигнал)
- CI/CD integrations (stickiness)
- Leads from "Download Report" CTA
