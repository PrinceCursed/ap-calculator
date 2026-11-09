import type { FactionGroup } from './types';

/**
 * Группа «Crime»: фракции и правила достижений.
 * Все числа (баллы, пороги, окна времени) и фразы можно править здесь — код парсера не трогать.
 */
export const crime: FactionGroup = {
  id: 'crime',
  title: 'Crime',
  enabled: true,
  dailyCap: 30,
  // id = слаг логотипа public/factions/<id>.webp. Алиасы сравниваются без учёта регистра, «ё» и лишних пробелов.
  factions: [
    { id: 'ballas', name: 'The Ballas Gang', aliases: ['East Side Ballas', 'Ballas', 'Ballas Gang', 'Баллас'] },
    { id: 'marabunta', name: 'Marabunta Grande', aliases: ['Marabunta', 'Марабунта'] },
    { id: 'vagos', name: 'Los Santos Vagos', aliases: ['LS Vagos', 'Vagos', 'Вагос'] },
    { id: 'families', name: 'The Families', aliases: ['Families', 'Фемили', 'Фэмилис'] },
    { id: 'bloods', name: 'Bloods', aliases: ['The Bloods', 'Bloods Gang', 'Бладс'] },
    { id: 'rm', name: 'Русская Мафия', aliases: ['Russian Mafia', 'РМ'] },
    { id: 'lcn', name: 'Итальянская Мафия', aliases: ['Italian Mafia', 'La Cosa Nostra', 'LCN'] },
    { id: 'am', name: 'Армянская Мафия', aliases: ['Armenian Mafia'] },
    { id: 'mm', name: 'Мексиканская Мафия', aliases: ['Mexican Mafia'] },
    { id: 'yak', name: 'Японская Мафия', aliases: ['Japanese Mafia', 'Yakuza', 'Якудза'] },
  ],
  rules: [
    // 1–2. ФЗ / NG: группы выгрузок из армейских грузовиков. Тип — по наличию ЭМИ-строки перед группой.
    {
      type: 'variantCluster',
      id: 'army',
      phrases: ['разгружает {n} материалов из армейского грузовика {key}'],
      gapMinutes: 10,
      minDistinct: 3,
      distinctBy: 'key',
      distinctLabel: 'грузовиков',
      distinctForms: ['грузовик', 'грузовика', 'грузовиков'],
      hint: 'Группа выгрузок (пауза ≤ 10 мин) минимум из 3 разных ArmyNN',
      variants: [
        {
          id: 'fz',
          title: 'ФЗ (Форт Занкудо)',
          points: 2,
          requiresPreceding: {
            phrases: ['применяет комплект для эми на форте занкудо'],
            lookbackMinutes: 60,
            label: 'ЭМИ на Форте Занкудо',
          },
        },
        { id: 'ng', title: 'NG (нападение на грузовики)', points: 2 },
      ],
    },
    // 3. ФТ: побег из тюрьмы, 3 разных освобождённых.
    {
      type: 'cluster',
      id: 'ft',
      title: 'ФТ (побег из тюрьмы)',
      points: 2,
      phrases: ['помогает {*}[{key}] сбежать из тюрьмы'],
      gapMinutes: 60,
      minDistinct: 3,
      distinctBy: 'key',
      distinctLabel: 'освобождённых',
      hint: 'Минимум 3 разных освобождённых (по статику), пауза ≤ 60 мин',
    },
    // 4. EMS: выгрузка аптек из EMS-машин.
    {
      type: 'cluster',
      id: 'ems',
      title: 'EMS (нападение на аптеки)',
      points: 2,
      phrases: ['разгружает {n} аптек из {key}'],
      gapMinutes: 10,
      minDistinct: 2,
      distinctBy: 'key',
      distinctLabel: 'разных EMS',
      hint: 'Минимум 2 разных EMSnn, пауза ≤ 10 мин',
    },
    // 5. Поезд.
    {
      type: 'sequence',
      id: 'train',
      title: 'Поезд',
      points: 3,
      step1: {
        phrases: ['участвует в нападении на поезд с военным грузом'],
        minDistinct: 10,
        windowMinutes: 90,
        label: 'участников',
        actor: 'player',
      },
      final: {
        phrases: ['доставляет грузовик с украденным из поезда грузом ({n} ящ'],
        minNumber: 125,
        numberUnit: 'ящ.',
        label: 'доставка',
      },
      hint: '≥ 10 участников за 90 мин до доставки, доставка ≥ 125 ящ.',
    },
    // 6. Граффити-вары.
    {
      type: 'perCount',
      id: 'graffiti',
      title: 'Граффити-вары',
      points: 2,
      per: 3,
      unitLabel: 'побед',
      phrases: ['за победу в graffiti war'],
      hint: 'Каждые 3 победы = 2 AP',
    },
    // 7–8. Ганшоп: тиры по числу материалов.
    {
      type: 'perLine',
      id: 'gunshop',
      title: 'Ганшоп',
      points: 0,
      phrases: ['разгружает {n} материалов из оружейного магазина'],
      excludePhrases: ['спас украденную машину'],
      tiers: [
        { id: 'gunshop_success', title: 'Ганшоп успешный', min: 4000, points: 3 },
        { id: 'gunshop_attack', title: 'Нападение на ганшоп', min: 1000, max: 3999, points: 2 },
      ],
      hint: '≥ 4000 материалов — 3 AP, 1000–3999 — 2 AP',
    },
    // 9. Рэкет.
    {
      type: 'perCount',
      id: 'racket',
      title: 'Рэкет',
      points: 2,
      per: 10,
      unitLabel: 'нападений',
      phrases: [
        'нападает на магазин 24/7',
        'нападает на тату салон',
        'нападает на магазин спортивной одежды',
      ],
      hint: 'Каждые 10 нападений на бизнесы = 2 AP',
    },
    // 10. PvP. ДОПУЩЕНИЕ (см. README): группа вывозов хаммера = одно мероприятие,
    // каждое «занимает 1 место» — отдельное мероприятие.
    {
      type: 'cluster',
      id: 'pvp',
      title: 'PvP',
      points: 2,
      phrases: ['вывозит хаммер с территории и получает'],
      soloPhrases: ['занимает 1 место и получает'],
      gapMinutes: 60,
      minDistinct: 1,
      distinctBy: 'static',
      distinctLabel: 'участников',
      hint: 'Группа вывозов хаммера (пауза ≤ 60 мин) или 1 место = одно мероприятие',
    },
    // 11. Флаг / вагонетка.
    {
      type: 'perLine',
      id: 'flag',
      title: 'Флаг / вагонетка',
      points: 2,
      phrases: [
        'побеждает в бою против {*} в режиме захват флага',
        'побеждает в бою против {*} в режиме сопровождение',
      ],
      hint: 'Каждая победа в режиме «Захват флага» или «Сопровождение»',
    },
    // 12. Аирдроп.
    {
      type: 'sequence',
      id: 'airdrop',
      title: 'Аирдроп',
      points: 4,
      step1: {
        phrases: ['участвует в захвате выпавшего армейского воздушного груза'],
        minDistinct: 10,
        windowMinutes: 30,
        label: 'участников',
        actor: 'player',
      },
      final: {
        phrases: ['получает припасы из выпавшего армейского груза'],
        actor: 'system',
        label: 'припасы получены',
      },
      hint: '≥ 10 участников за 30 мин до SYSTEM-строки о припасах',
    },
    // 13. Ограбление домов.
    {
      type: 'perCount',
      id: 'houses',
      title: 'Ограбление домов',
      points: 2,
      per: 30,
      unitLabel: 'домов',
      phrases: ['взламывает дом'],
      hint: 'Каждые 30 домов = 2 AP',
    },
    // 14. Угонки.
    {
      type: 'perCount',
      id: 'cars',
      title: 'Угонки',
      points: 2,
      per: 30,
      unitLabel: 'машин',
      phrases: ['привозит угнанный автомобиль'],
      hint: 'Каждые 30 машин = 2 AP',
    },
    // 15. Ограбление игроков.
    {
      type: 'perCount',
      id: 'robbery',
      title: 'Ограбление игроков',
      points: 3,
      per: 20,
      unitLabel: 'ограблений',
      phrases: ['грабит человека'],
      hint: 'Каждые 20 ограблений = 3 AP',
    },
    // 16. Чёрный рынок.
    {
      type: 'cluster',
      id: 'blackmarket',
      title: 'Чёрный рынок',
      points: 4,
      phrases: ['участвует в захвате черного рынка'],
      gapMinutes: 30,
      minDistinct: 10,
      distinctBy: 'static',
      distinctLabel: 'участников',
      actor: 'player',
      hint: '≥ 10 уникальных участников, пауза ≤ 30 мин',
    },

    // Ручные достижения (баллы за единицу).
    { type: 'manual', id: 'm_raid_defense', title: 'Успешное отбитие рейда на свою фракцию', points: 10 },
    { type: 'manual', id: 'm_kidnap', title: 'Проведение 2-х полноценных похищений', points: 3 },
    { type: 'manual', id: 'm_gov_capture', title: 'Захват гос. структуры', points: 15 },
    { type: 'manual', id: 'm_bank', title: 'Захват банка', points: 5 },
    { type: 'manual', id: 'm_rp_strela', title: 'Победа в 1 РП стреле', points: 3 },
    { type: 'manual', id: 'm_driveby', title: 'Проведение 1 проезда мимо', points: 2 },
    { type: 'manual', id: 'm_gov_help', title: 'Помощь в захвате гос. структуры', points: 5 },
    { type: 'manual', id: 'm_wn', title: 'Осветить РП деятельность через WN', points: 5 },
  ],
};
