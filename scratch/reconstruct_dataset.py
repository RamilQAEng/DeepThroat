import json
import os
import re

# Пути
SOURCE_DATASET = '/Users/deniskononov/RedTeaming-DeepThroath-v2/eval/datasets/20260422_deep_eval_quality_dataset.json'
LAST_RUN_RESPONSES = '/Users/deniskononov/RedTeaming-DeepThroath-v2/eval/results/20260422_220723_20260422_deep_eval_quality_dataset/api_responses.json'
OUTPUT_PATH = '/Users/deniskononov/RedTeaming-DeepThroath-v2/eval/datasets/offline_ready_full.json'

def strip_cta(text):
    if not text: return ""
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

def reconstruct():
    if not os.path.exists(SOURCE_DATASET) or not os.path.exists(LAST_RUN_RESPONSES):
        print("Error: Source files not found!")
        return

    # Загружаем оригинал
    with open(SOURCE_DATASET, 'r', encoding='utf-8') as f:
        source_data = {item['id']: item for item in json.load(f)}

    # Загружаем результаты прогона
    with open(LAST_RUN_RESPONSES, 'r', encoding='utf-8') as f:
        responses = json.load(f)

    final_data = []
    for resp in responses:
        item_id = resp.get('id')
        if item_id in source_data:
            # Берем оригинал как базу
            record = dict(source_data[item_id])
            
            # Добавляем данные из прогона с очисткой
            record['actual_output'] = strip_cta(resp.get('answer', ''))
            
            # Превращаем чанки-объекты в чанки-строки
            chunks = resp.get('retrieved_chunks', [])
            record['retrieval_context'] = [c['content'] if isinstance(c, dict) else str(c) for c in chunks]
            
            final_data.append(record)

    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(final_data, f, ensure_ascii=False, indent=2)
    
    print(f"Success! Reconstructed dataset saved to: {OUTPUT_PATH}")
    print(f"Merged {len(final_data)} records with all original columns.")

if __name__ == "__main__":
    reconstruct()
