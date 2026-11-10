/**
 * Типы конфигурации правил достижений.
 *
 * ФРАЗЫ (phrases) — шаблоны, сравнение регистронезависимое, «ё» = «е».
 * Достаточно совпадения ЛЮБОЙ фразы из списка. Шаблон ищется как подстрока текста события.
 * Плейсхолдеры в шаблонах:
 *   {n}    — число (используется для тиров и числовых условий: «4000 материалов», «239 ящ.»)
 *   {key}  — значение без пробелов (номер машины Army28 / EMS12, статик в скобках и т.п.)
 *   {*}    — любой текст (в т.ч. пустой)
 * Если нужна полноценная регулярка — начните фразу с "re:" (флаги i и u ставятся автоматически,
 * именованные группы (?<n>…) и (?<key>…) работают так же, как плейсхолдеры).
 */

/** Чьи строки учитывать: игроков, системные (SYSTEM [1]) или любые. По умолчанию — любые. */
export type Actor = 'player' | 'system' | 'any';

export interface BaseRule {
  /** Уникальный id правила (латиница). */
  id: string;
  /** Название в таблице. */
  title: string;
  /** Баллы за одно засчитанное событие. */
  points: number;
  /** Засчитывать не больше одного раза в сутки. По умолчанию false. */
  oncePerDay?: boolean;
  /** Краткое пояснение условия (показывается подсказкой). */
  hint?: string;
}

export interface PhraseMatcher {
  phrases: string[];
  /** Строки с этими фразами исключаются, даже если подходят под phrases. */
  excludePhrases?: string[];
  actor?: Actor;
}

export interface Tier {
  /** Минимальное число {n} в строке (включительно). */
  min: number;
  /** Максимальное число {n} (включительно). Не задано — без верхней границы. */
  max?: number;
  points: number;
  /** Отдельная строка в таблице для этого тира (например «Ганшоп успешный»). */
  id: string;
  title: string;
}

/** Каждая подходящая строка — одно событие. С tiers — баллы по числу {n}, берётся высший тир. */
export interface PerLineRule extends BaseRule, PhraseMatcher {
  type: 'perLine';
  /** Подпись единиц в прогрессе: «0 из 1 побед». По умолчанию «строк». */
  unitLabel?: string;
  tiers?: Tier[];
}

/** За каждые `per` подходящих строк — `points`. Недобор — «спорный случай». */
export interface PerCountRule extends BaseRule, PhraseMatcher {
  type: 'perCount';
  per: number;
  /** Подпись единиц в спорных случаях: «27 из 30 домов». */
  unitLabel: string;
}

/** Группировка строк по времени; группа с ≥ minDistinct уникальных значений = одно событие. */
export interface ClusterRule extends BaseRule, PhraseMatcher {
  type: 'cluster';
  /** Новая группа, если пауза между соседними строками больше gapMinutes. */
  gapMinutes: number;
  minDistinct: number;
  /** Что считать уникальным: статик-ID игрока или {key} из фразы. */
  distinctBy: 'static' | 'key';
  /** Подпись: «8 из 10 участников». */
  distinctLabel: string;
  /** Необязательно: формы слова [1, 2–4, 5+] — тогда «2 грузовика из 3». */
  distinctForms?: [string, string, string];
  /** Фразы, каждая строка которых — самостоятельное событие (без группировки). */
  soloPhrases?: string[];
}

export interface SequenceRule extends BaseRule {
  type: 'sequence';
  step1: PhraseMatcher & {
    /** Минимум уникальных статик-ID среди строк шага 1. */
    minDistinct: number;
    /** Шаг 1 учитывается не раньше чем за windowMinutes до финальной строки. */
    windowMinutes: number;
    label: string; // «участников»
  };
  final: PhraseMatcher & {
    /** Числовое условие на {n} финальной строки (например ≥ 125 ящ.). */
    minNumber?: number;
    numberUnit?: string; // «ящ.»
    label: string; // «доставка»
  };
}

export interface Variant {
  id: string;
  title: string;
  points: number;
  /** Вариант выбирается, если не позже lookbackMinutes до первой строки группы есть такая строка. */
  requiresPreceding?: PhraseMatcher & { lookbackMinutes: number; label: string };
}

/** Как cluster, но тип события зависит от предшествующей строки (ФЗ против NG). */
export interface VariantClusterRule extends PhraseMatcher {
  type: 'variantCluster';
  id: string;
  gapMinutes: number;
  minDistinct: number;
  distinctBy: 'static' | 'key';
  distinctLabel: string;
  distinctForms?: [string, string, string];
  /** Проверяются по порядку, берётся первый подошедший. Последний обычно без условия. */
  variants: Variant[];
  oncePerDay?: boolean;
  hint?: string;
}

export interface ManualRule extends BaseRule {
  type: 'manual';
}

export type Rule =
  | PerLineRule
  | PerCountRule
  | ClusterRule
  | SequenceRule
  | VariantClusterRule
  | ManualRule;

export interface Faction {
  /** Ключ фракции; по умолчанию это и слаг логотипа public/factions/<id>.webp. */
  id: string;
  /** Необязательно: другой слаг логотипа. Нет файла — показывается монограмма. */
  logo?: string;
  /** Полное название (заголовок результата). */
  name: string;
  /** Короткое название для списка фракций (как в макете). По умолчанию name. */
  short?: string;
  /** Варианты написания в логах (регистр, «ё», лишние пробелы, кавычки не важны). */
  aliases: string[];
}

export interface FactionGroup {
  id: string;
  /** Название раздела («Банды», «Мафии», «Гос. структуры») — мелкий заголовок над списком фракций. */
  title: string;
  /** Вкладка сайдбара, в которой показывается раздел: 'crime' или 'gov' (см. TABS в config/index.ts). */
  tab: string;
  /** false — вкладка и фракции видны, но недоступны (замок, «Скоро»). */
  enabled: boolean;
  /** Подсказка для заблокированной группы. */
  disabledHint?: string;
  /** Максимум AP на фракцию в день. */
  dailyCap: number;
  factions: Faction[];
  rules: Rule[];
}
