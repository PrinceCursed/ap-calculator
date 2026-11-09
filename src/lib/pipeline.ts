import type { FactionGroup } from '../config/types';
import { findFaction, GROUPS } from '../config';
import { runRules, type EngineResult } from './engine';
import { buildFactionResolver, parseLog, type LogLine } from './parser';

export interface InputFile {
  name: string;
  text: string;
}

export interface Loaded {
  lines: LogLine[];
  total: number;
  skipped: number;
  duplicates: number;
  /** До 5 примеров неразобранных строк. */
  unparsedExamples: string[];
}

/** Все названия фракций и алиасы — для терпимого разбора строк без разделителей. */
export function allFactionNames(groups: FactionGroup[] = GROUPS): string[] {
  return groups.flatMap((g) => g.factions.flatMap((f) => [f.name, ...f.aliases]));
}

/** Разбор нескольких файлов; одинаковые строки (повторно загруженный файл) считаются один раз. */
export function loadFiles(
  files: InputFile[],
  onProgress?: (done: number, total: number) => void,
  groups: FactionGroup[] = GROUPS,
): Loaded {
  const known = allFactionNames(groups);
  const totalRows = files.reduce((s, f) => s + f.text.split('\n').length, 0) || 1;
  let offset = 0;
  const seen = new Set<string>();
  const lines: LogLine[] = [];
  let total = 0;
  let skipped = 0;
  let duplicates = 0;
  const unparsedExamples: string[] = [];
  files.forEach((f, fi) => {
    const r = parseLog(f.text, {
      knownFactions: known,
      file: fi,
      onProgress: (done) => onProgress?.(offset + done, totalRows),
    });
    offset += f.text.split('\n').length;
    total += r.stats.total;
    skipped += r.stats.skipped;
    for (const ex of r.stats.examples) if (unparsedExamples.length < 5) unparsedExamples.push(ex);
    for (const l of r.lines) {
      const k = `${l.id}|${l.ts}|${l.nick}|${l.text}`;
      if (seen.has(k)) {
        duplicates++;
        continue;
      }
      seen.add(k);
      lines.push(l);
    }
  });
  return { lines, total, skipped, duplicates, unparsedExamples };
}

export interface DateCount {
  date: string;
  count: number;
}

export interface Analysis {
  factionId: string;
  date: string | null;
  dates: DateCount[];
  factionLines: number;
  dayLines: number;
  ignoredOtherFaction: number;
  ignoredOtherDate: number;
  result: EngineResult | null;
  /** AP (с учётом лимита, без ручных) каждой фракции группы за ту же дату — бейджи в списке. */
  badges: Record<string, number>;
  /** Покрытие выбранных суток файлом (по первой и последней строке фракции за дату). */
  coverage: Coverage | null;
  /** Фракции в файле (топ-10): id — если фракция известна. */
  fileFactions: { name: string; id: string | null; count: number }[];
  /** Даты в файле по всем фракциям (топ-5 по числу строк). */
  fileDates: DateCount[];
}

/** Пороги «неполного лога»: меньше 20 часов покрытия или меньше 500 строк за сутки. */
export const COVERAGE_MIN_HOURS = 20;
export const COVERAGE_MIN_LINES = 500;

export interface Coverage {
  /** ЧЧ:ММ первой и последней строки выбранной даты. */
  first: string;
  last: string;
  minutes: number;
  lines: number;
  partial: boolean;
  /** «Файл покрывает только 23:36–23:59 (24 мин, 38 строк)…» */
  message: string | null;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} мин`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}

const plural3 = (n: number, f: [string, string, string]) => {
  const a = n % 100, b = n % 10;
  return a > 10 && a < 20 ? f[2] : b > 1 && b < 5 ? f[1] : b === 1 ? f[0] : f[2];
};

export function coverageOf(dayLines: LogLine[]): Coverage | null {
  if (!dayLines.length) return null;
  let first = dayLines[0];
  let last = dayLines[0];
  for (const l of dayLines) {
    if (l.ts < first.ts) first = l;
    if (l.ts > last.ts) last = l;
  }
  // +1 минута: строки 23:36 и 23:59 покрывают 24 минуты.
  const minutes = Math.min(24 * 60, Math.floor((last.ts - first.ts) / 60_000) + 1);
  const partial = minutes < COVERAGE_MIN_HOURS * 60 || dayLines.length < COVERAGE_MIN_LINES;
  const n = dayLines.length;
  return {
    first: first.time.slice(0, 5),
    last: last.time.slice(0, 5),
    minutes,
    lines: n,
    partial,
    message: partial
      ? `Файл покрывает только ${first.time.slice(0, 5)}–${last.time.slice(0, 5)} (${formatDuration(minutes)}, ${n} ${plural3(n, ['строка', 'строки', 'строк'])}). Для расчёта за сутки нужен полный лог за выбранную дату`
      : null,
  };
}

/** Сводка по файлу: фракции (с привязкой к известным) и даты. */
export function fileSummary(loaded: Loaded, groups: FactionGroup[] = GROUPS) {
  const all = groups.flatMap((g) => g.factions);
  const resolve = buildFactionResolver(all);
  const fac = new Map<string, { name: string; id: string | null; count: number }>();
  const dates = new Map<string, number>();
  for (const l of loaded.lines) {
    const id = resolve(l.faction);
    const key = id ?? `?${l.faction}`;
    const cur = fac.get(key);
    if (cur) cur.count++;
    else fac.set(key, { name: id ? all.find((f) => f.id === id)!.name : l.faction, id, count: 1 });
    dates.set(l.date, (dates.get(l.date) ?? 0) + 1);
  }
  return {
    fileFactions: [...fac.values()].sort((a, b) => b.count - a.count).slice(0, 10),
    fileDates: [...dates.entries()].map(([date, count]) => ({ date, count })).sort((a, b) => b.count - a.count).slice(0, 5),
  };
}

export class GroupDisabledError extends Error {
  constructor(public groupId: string) {
    super(`Группа «${groupId}» заблокирована`);
  }
}

/**
 * Границы суток в «наивных» миллисекундах — той же шкале, что LogLine.ts.
 * Date.UTC здесь — просто арифметика над числами даты, часовой пояс браузера не участвует.
 */
function dayRange(date: string) {
  const [d, m, y] = date.split('.').map(Number);
  const start = Date.UTC(y, m - 1, d);
  return { start, end: start + 86_400_000 };
}

/** Фильтр по фракции и дате + расчёт правил. date = null → самая частая дата фракции. */
export function analyze(
  loaded: Loaded,
  factionId: string,
  date: string | null,
  groups: FactionGroup[] = GROUPS,
): Analysis {
  const found = findFaction(factionId, groups);
  if (!found) throw new Error(`Неизвестная фракция: ${factionId}`);
  if (!found.group.enabled) throw new GroupDisabledError(found.group.id);
  const group = found.group;
  const resolve = buildFactionResolver(group.factions);

  // Раскладываем строки по фракциям группы за один проход.
  const byFaction = new Map<string, LogLine[]>(group.factions.map((f) => [f.id, []]));
  for (const l of loaded.lines) {
    const id = resolve(l.faction);
    if (id) byFaction.get(id)!.push(l);
  }
  const mine = byFaction.get(factionId)!;
  const counts = new Map<string, number>();
  for (const l of mine) counts.set(l.date, (counts.get(l.date) ?? 0) + 1);
  const dates = [...counts.entries()]
    .map(([d, count]) => ({ date: d, count }))
    .sort((a, b) => {
      const [ad, am, ay] = a.date.split('.');
      const [bd, bm, by] = b.date.split('.');
      return `${ay}${am}${ad}` < `${by}${bm}${bd}` ? -1 : 1;
    });

  let chosen = date;
  if (!chosen || !counts.has(chosen)) {
    chosen = dates.length ? dates.reduce((best, d) => (d.count > best.count ? d : best)).date : date;
  }
  // Без строк выбранной фракции бейджи считаем за самую частую дату по всем фракциям группы.
  let badgeDate = chosen;
  if (!badgeDate) {
    const all = new Map<string, number>();
    for (const ls of byFaction.values()) for (const l of ls) all.set(l.date, (all.get(l.date) ?? 0) + 1);
    badgeDate = [...all.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }

  const badges: Record<string, number> = {};
  if (badgeDate) {
    const day = dayRange(badgeDate);
    for (const [id, ls] of byFaction) {
      if (!ls.some((l) => l.ts >= day.start && l.ts < day.end)) continue;
      badges[id] = Math.min(group.dailyCap, runRules(group.rules, ls, day).autoSum);
    }
  }

  const base = {
    factionId,
    dates,
    badges,
    ...fileSummary(loaded, groups),
    factionLines: mine.length,
    ignoredOtherFaction: loaded.lines.length - mine.length,
  };
  if (!chosen) return { ...base, date: null, dayLines: 0, ignoredOtherDate: 0, result: null, coverage: null };

  // День определяется по дате, записанной в строке (ДД.ММ.ГГГГ), без часовых поясов.
  const day = dayRange(chosen);
  const inDay = mine.filter((l) => l.date === chosen);
  const dayLines = inDay.length;
  const result = dayLines ? runRules(group.rules, mine, day) : null;
  return { ...base, date: chosen, dayLines, ignoredOtherDate: mine.length - dayLines, result, coverage: coverageOf(inDay) };
}
