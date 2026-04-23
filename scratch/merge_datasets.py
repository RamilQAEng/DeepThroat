import json
import csv
import re

original_file = '/Users/deniskononov/RedTeaming-DeepThroath-v2/eval/datasets/20260329_173829_exp_top_k_10_dataset.json'
csv_file = '/Users/deniskononov/RedTeaming-DeepThroath-v2/eval/datasets/client-test-scenarios-telegram.csv'
md_file = '/Users/deniskononov/RedTeaming-DeepThroath-v2/eval/datasets/mvp-beta-tests-manjerok-confluence.md'
output_file = '/Users/deniskononov/RedTeaming-DeepThroath-v2/eval/datasets/20260422_deep_eval_quality_dataset.json'

# Load original
with open(original_file, 'r', encoding='utf-8') as f:
    dataset = json.load(f)

existing_questions = {item['question'].strip().lower() for item in dataset}
next_id_num = 57 # TC-056 was last

category_map = {
    'Питание': 'dining',
    'СПА': 'spa',
    'Детский комплекс': 'kids_complex',
    'Лыжные зоны': 'ski_zones',
    'Трансферы': 'transfers',
    'Бронирование': 'booking'
}

# Parse CSV
with open(csv_file, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        cat_ru = row['Раздел']
        if cat_ru not in category_map:
            continue
        
        # Extract question from steps. Usually "Напиши боту: «...»"
        steps = row['Шаги']
        match = re.search(r'«([^»]+)»', steps)
        if match:
            q = match.group(1).strip()
        else:
            # Fallback to name or just skip if no clear question
            continue
            
        if q.lower() in existing_questions:
            continue
            
        expected = row['Ожидаемый результат']
        if "Бот должен" in expected or "Отображаются кнопки" in expected:
            # This is a UI test, skip or refine
            if "Бот перечисляет" in expected or "Бот называет" in expected or "Бот описывает" in expected:
                pass # Keep these
            else:
                continue

        item = {
            "id": f"TC-{next_id_num:03d}",
            "category": category_map[cat_ru],
            "question": q,
            "expected_output": expected,
            "actual_output": "",
            "_source_session": float(next_id_num),
            "_source_category": cat_ru
        }
        dataset.append(item)
        existing_questions.add(q.lower())
        next_id_num += 1

# Save
with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(dataset, f, ensure_ascii=False, indent=2)

print(f"Total items: {len(dataset)}")
