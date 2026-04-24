import json
from pathlib import Path

# Пути к файлам
project_root = Path("/Users/deniskononov/RedTeaming-DeepThroath-v2")
original_ds = project_root / "eval/datasets/20260329_173829_exp_top_k_10_dataset.json"
broken_api_res = project_root / "eval/results/20260421_135241_20260329_173829_exp_top_k_10_dataset/api_responses.json"

if not original_ds.exists():
    print(f"Error: Original dataset not found at {original_ds}")
    exit(1)

if not broken_api_res.exists():
    print(f"Error: Broken api_responses not found at {broken_api_res}")
    exit(1)

with open(original_ds, encoding="utf-8") as f:
    orig_data = json.load(f)
    orig_map = {item['id']: (item.get('expected_output') or item.get('expected_answer', '')) for item in orig_data}

with open(broken_api_res, encoding="utf-8") as f:
    res = json.load(f)

# Восстанавливаем поле
restored_count = 0
for item in res:
    item_id = item.get('id')
    if item_id in orig_map:
        item['expected_output'] = orig_map[item_id]
        restored_count += 1

with open(broken_api_res, 'w', encoding="utf-8") as f:
    json.dump(res, f, ensure_ascii=False, indent=2)

print(f"Successfully restored 'expected_output' for {restored_count} records in api_responses.json.")
