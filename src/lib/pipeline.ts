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
  files.forEach((f, fi) => {
    const r = parseLog(f.text, {
      knownFactions: known,
      file: fi,
      onProgress: (done) => onProgress?.(offset + done, totalRows),
    });
    offset += f.text.split('\n').length;
    total += r.stats.total;
    skipped += r.stats.skipped;
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
  return { lines, total, skipped, duplicates };
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
}

export class GroupDisabledError extends Error {
  constructor(public groupId: string) {
    super(`Группа «${groupId}» заблокирована`);
  }
}

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
    factionLines: mine.length,
    ignoredOtherFaction: loaded.lines.length - mine.length,
  };
  if (!chosen) return { ...base, date: null, dayLines: 0, ignoredOtherDate: 0, result: null };

  const day = dayRange(chosen);
  const dayLines = counts.get(chosen) ?? 0;
  const result = dayLines ? runRules(group.rules, mine, day) : null;
  return { ...base, date: chosen, dayLines, ignoredOtherDate: mine.length - dayLines, result };
}
