import json
import os

DATASET_PATH = '/Users/deniskononov/RedTeaming-DeepThroath-v2/eval/datasets/20260422_deep_eval_quality_dataset.json'

def sync():
    if not os.path.exists(DATASET_PATH):
        print(f"Dataset not found at {DATASET_PATH}!")
        return

    with open(DATASET_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)

    updated_ids = []

    for item in data:
        # TC-007: Трассы для новичков
        if item['id'] == 'TC-007':
            item['expected_output'] = (
                "Для новичков подходят Учебный склон и Школьная трасса. "
                "Они имеют пологий уклон и безопасны для первых шагов."
            )
            updated_ids.append(item['id'])

        # TC-008: Где купить ски-пасс (уточняем, что НЕ в прокате)
        if item['id'] == 'TC-008':
            item['expected_output'] = (
                "Ски-пассы можно приобрести в кассах курорта или на официальном сайте. "
                "Для детей до 10 лет ски-пасс предоставляется бесплатно при наличии бесконтактной карты."
            )
            updated_ids.append(item['id'])

        # TC-015: Развлечения без лыж (удаляем то, чего нет в базе)
        if item['id'] == 'TC-015':
            item['expected_output'] = (
                "Если вы не катаетесь на лыжах, на курорте можно: "
                "прогуляться на канатной дороге до смотровой площадки, посетить парк приключений «Дримвуд», "
                "детский досуговый центр «Лес Чудес», рестораны и магазины снаряжения."
            )
            updated_ids.append(item['id'])

        # TC-016: Соревнования (уточняем способ регистрации)
        if item['id'] == 'TC-016':
            item['expected_output'] = (
                "Для записи на соревнования (например, «Прыжок в лето») необходимо "
                "обратиться по телефону 8-800-301-66-55 или написать на почту booking@mglk.ru."
            )
            updated_ids.append(item['id'])

    with open(DATASET_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"Dataset synced with KB! Updated IDs: {updated_ids}")

if __name__ == "__main__":
    sync()
