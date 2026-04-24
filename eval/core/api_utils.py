import re
import threading
from typing import Any, Dict, List, Optional

try:
    import httpx

    _HAS_HTTPX = True
except ImportError:
    _HAS_HTTPX = False


def get_value_by_path(data: Any, path: str, default: Any = None) -> Any:
    """Извлекает значение из словаря/списка по строковому пути (json path style)."""
    if not path:
        return default
    keys = path.split(".")
    val = data
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


def resolve_template(template: Any, rec: Dict[str, Any]) -> Any:
    """Заменяет переменные {{key}} в шаблоне (строка, словарь или список)."""
    if isinstance(template, str):
        res = template
        for k, v in rec.items():
            if isinstance(v, str):
                res = res.replace(f"{{{{{k}}}}}", v)
        return res
    elif isinstance(template, dict):
        return {k: resolve_template(v, rec) for k, v in template.items()}
    elif isinstance(template, list):
        return [resolve_template(v, rec) for v in template]
    return template


def strip_cta(text: str) -> str:
    """Убирает стандартные вежливые фразы бота в конце сообщения."""
    if not text:
        return ""
    
    # Список паттернов для удаления (регистронезависимо)
    patterns = [
        r"Чем я еще могу помочь\??",
        r"Чем я ещё могу помочь\??",
        r"Хотите узнать подробнее о каком-нибудь заведении\??",
        r"Хотите узнать больше о какой-то конкретной процедуре\??",
        r"Хотите узнать больше о конкретных ресторанах или кафе\??",
        r"Хотите узнать что-то еще\??",
        r"Буду рад помочь с другими вопросами\.",
        r"Если у вас есть еще вопросы, обращайтесь\.",
    ]
    
    cleaned = text
    for pattern in patterns:
        cleaned = re.sub(pattern, "", cleaned, flags=re.IGNORECASE)
    
    return cleaned.strip()


def fetch_from_api(
    rec: Dict[str, Any],
    api_config: Optional[Dict[str, Any]],
    api_url: Optional[str] = None,
    api_log: Optional[List[Dict[str, Any]]] = None,
    log_lock: Optional[threading.Lock] = None,
) -> Dict[str, Any]:
    """Вызывает динамический RAG API согласно конфигурации."""
    if not _HAS_HTTPX:
        raise RuntimeError("httpx не установлен: pip install httpx")

    if api_config:
        config = api_config
    elif api_url:
        config = {
            "url": api_url.rstrip("/") + "/api/v1/eval/rag",
            "method": "POST",
            "headers": {},
            "body": {"question": "{{user_query}}", "category": "{{category}}"},
            "extractors": {"answer": "answer", "chunks": "retrieved_chunks"},
        }
    else:
        raise RuntimeError("API_URL или API_CONFIG не задан")

    question = rec.get("question") or rec.get("user_query", "")
    category = rec.get("category") or rec.get("intent", "")

    template_vars = dict(rec)
    template_vars["user_query"] = question
    template_vars["category"] = category

    url = config["url"]
    method = config.get("method", "POST").upper()
    headers = config.get("headers", {})
    body_template = config.get("body", {})

    payload = resolve_template(body_template, template_vars)

    with httpx.Client(timeout=120.0, verify=False) as client:
        if method == "POST":
            resp = client.post(url, headers=headers, json=payload)
        elif method == "GET":
            resp = client.get(url, headers=headers, params=payload)
        else:
            raise ValueError(f"Unsupported method: {method}")

    if resp.status_code != 200:
        raise RuntimeError(f"API {resp.status_code} at {url}: {resp.text[:200]}")

    try:
        data = resp.json()
    except Exception as e:
        raise RuntimeError(f"API returned invalid JSON: {resp.text[:200]}") from e

    extractors = config.get("extractors", {})
    ex_answer = extractors.get("answer", "answer")
    ex_chunks = extractors.get("chunks", "retrieved_chunks")

    answer = get_value_by_path(data, ex_answer, "")
    # Очищаем ответ от CTA перед оценкой
    answer = strip_cta(answer)
    
    chunks_raw = get_value_by_path(data, ex_chunks, [])

    chunks_text = []
    if isinstance(chunks_raw, list):
        for c in chunks_raw:
            if isinstance(c, str):
                chunks_text.append(c)
            elif isinstance(c, dict):
                if "content" in c:
                    chunks_text.append(c["content"])
                elif "text" in c:
                    chunks_text.append(c["text"])
                else:
                    chunks_text.append(str(c))
    else:
        chunks_text = [str(chunks_raw)]

    enriched = dict(rec)
    enriched["user_query"] = question
    enriched["actual_output"] = answer
    enriched["retrieval_context"] = chunks_text

    if api_log is not None and log_lock is not None:
        log_entry = dict(enriched)
        log_entry["api_url"] = url
        log_entry["chunks_count"] = len(chunks_text)
        with log_lock:
            api_log.append(log_entry)

    return enriched
