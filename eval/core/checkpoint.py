import json
import threading
from pathlib import Path
from typing import Dict, Any

def checkpoint_path(run_dir: Path) -> Path:
    """Возвращает путь к файлу чекпоинта."""
    return run_dir / "checkpoint.json"

def load_checkpoint(run_dir: Path) -> Dict[str, Any]:
    """Возвращает уже обработанные записи {session_id: result} из файла чекпоинта."""
    path = checkpoint_path(run_dir)
    if path.exists():
        try:
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
            print(f"Найден чекпоинт: {len(data)} уже обработанных записей → пропускаем.")
            return data
        except Exception as e:
            print(f"[WARNING] Ошибка загрузки чекпоинта: {e}. Начинаем с нуля.")
            return {}
    return {}

def save_checkpoint(run_dir: Path, done: Dict[str, Any], lock: threading.Lock):
    """Безопасно сохраняет чекпоинт (thread-safe)."""
    with lock:
        try:
            with open(checkpoint_path(run_dir), "w", encoding="utf-8") as f:
                json.dump(done, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"[ERROR] Не удалось сохранить чекпоинт: {e}")

def clear_checkpoint(run_dir: Path):
    """Удаляет файл чекпоинта."""
    p = checkpoint_path(run_dir)
    if p.exists():
        p.unlink()
