import json
import os

DATASET_PATH = '/Users/deniskononov/RedTeaming-DeepThroath-v2/eval/datasets/20260422_deep_eval_quality_dataset.json'

def rehab():
    if not os.path.exists(DATASET_PATH):
        print(f"Dataset not found at {DATASET_PATH}!")
        return

    with open(DATASET_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)

    updated_ids = []

    for item in data:
        # TC-003: Лес чудес цены
        if item['id'] == 'TC-003':
            item['expected_output'] = (
                "Стоимость посещения «Леса чудес» зависит от возраста и этажа: "
                "1 этаж для детей 1-6 лет — 1200 руб/час, 7-14 лет — 1600 руб/час. "
                "Безлимит на день — 4300 руб (для гостей отеля 5* — 3300 руб)."
            )
            updated_ids.append(item['id'])
        
        # TC-006: Вегетарианское меню в Тенгри
        if item['id'] == 'TC-006':
            item['expected_output'] = (
                "В ресторане «Тенгри» есть вегетарианские блюда: Греческий салат (350 руб), "
                "салат из свежих овощей с сыром фета (650 руб) и лепешка с домашним сыром и помидорами (950 руб)."
            )
            updated_ids.append(item['id'])

        # TC-013: Тюбинг
        if item['id'] == 'TC-013':
            item['expected_output'] = "Да, тюбинг есть. Стоимость: 1 час — 800 руб, 30 минут — 500 руб. Утренний тариф (10:00-12:00) — 700 руб."
            updated_ids.append(item['id'])

        # TC-019: Премиум прокат (ИСПРАВЛЕНИЕ МАППИНГА)
        if item['id'] == 'TC-019':
            item['expected_output'] = (
                "Да, доступен прокат премиум-класса (Sport / Freeride). "
                "В наличии бренды Salomon, Atomic, Fischer, Head. "
                "Стоимость комплекта лыж или сноуборда — от 6650-6950 руб/день."
            )
            updated_ids.append(item['id'])

        # TC-025: Детский прокат
        if item['id'] == 'TC-025':
            item['expected_output'] = (
                "Да, есть детское снаряжение. Стоимость детского комплекта лыж/сноуборда "
                "составляет от 1250 до 3600 руб в зависимости от точки проката и категории."
            )
            updated_ids.append(item['id'])

    with open(DATASET_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"Dataset rehabilitated successfully! Updated IDs: {updated_ids}")

if __name__ == "__main__":
    rehab()
