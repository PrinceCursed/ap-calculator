import type { Faction } from '../config/types';

export interface LogLine {
  /** Номер строки в загруженном тексте (с 1). */
  lineNo: number;
  /** ID строки из лога (первая колонка). */
  id: string;
  nick: string;
  /** Статик-ID игрока; null для SYSTEM. */
  staticId: string | null;
  isSystem: boolean;
  /** Фракция как в логе. */
  faction: string;
  /** Текст события (очищенный, пробелы схлопнуты). */
  text: string;
  /** Текст для сравнения: нижний регистр, ё→е. Той же длины, что text. */
  norm: string;
  /** ДД.ММ.ГГГГ */
  date: string;
  /** ЧЧ:ММ:СС */
  time: string;
  /** Метка времени (мс, «наивное» время лога без часового пояса). */
  ts: number;
  /** Индекс файла, если загружено несколько. */
  file: number;
}

const INVISIBLE = /[​‌‍⁠﻿­‎‏]/g;
const NBSP = /[    　]/g;

/** Вычищает невидимые символы, неразрывные пробелы заменяет обычными. */
export function cleanLine(s: string): string {
  return s.replace(INVISIBLE, '').replace(NBSP, ' ').replace(/\r/g, '');
}

/** Нормализация для сравнения: нижний регистр, ё→е (длина строки сохраняется). */
export function normText(s: string): string {
  return s.toLowerCase().replace(/ё/g, 'е');
}

/** Нормализация названия фракции: регистр, ё, кавычки, лишние пробелы. */
export function normFaction(s: string): string {
  return normText(s)
    .replace(/["«»“”'`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const DATE_TAIL = /(\d{1,2})\.(\d{1,2})\.(\d{4}),?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*$/;
const ID_HEAD = /^\s*(\d+)(?:\t+|\s+)/;
const NICK = /^(.*?)\s*\[(\d+)\](\s+)/;
const SPLIT = /\t+|\s{2,}/;
export const ROW_SEPARATOR = /\r\n?|\n/;

const pad = (n: string | number) => String(n).padStart(2, '0');

export interface ParseOutcome {
  line?: LogLine;
  /** Причина пропуска (для отладки). */
  skip?: string;
}

/**
 * Разбирает одну строку. Формат:
 * ID <TAB> Ник [статик] <TAB> Фракция <TAB> Текст <TAB> ДД.ММ.ГГГГ, ЧЧ:ММ:СС
 * Табы могут быть заменены на 2+ пробела. Если разделители потерялись совсем (одиночные пробелы),
 * пробуем выделить ник по «[статик]» и фракцию по известным названиям (knownFactions).
 */
export function parseLine(
  rawInput: string,
  lineNo: number,
  knownFactions: string[] = [],
  file = 0,
): ParseOutcome {
  const raw = cleanLine(rawInput);
  if (!raw.trim()) return { skip: 'empty' };

  const dm = DATE_TAIL.exec(raw);
  if (!dm) return { skip: 'no-date' };
  const im = ID_HEAD.exec(raw);
  if (!im) return { skip: 'no-id' };

  const middle = raw.slice(im[0].length, dm.index).trim();
  if (!middle) return { skip: 'empty-middle' };

  const nk = NICK.exec(middle);
  if (!nk) return { skip: 'no-static' };
  const rest = middle.slice(nk[0].length);
  const firstSeparator = SPLIT.exec(rest);
  const tabs = nk[3].includes('\t') ? /\t+/.exec(rest) : null;
  const spaceFaction = firstSeparator && normFaction(rest.slice(0, firstSeparator.index));
  const mixed = tabs && firstSeparator && firstSeparator.index < tabs.index &&
    knownFactions.some((f) => normFaction(f) === spaceFaction);
  const separator = tabs && !mixed ? tabs : firstSeparator;
  let faction = separator ? rest.slice(0, separator.index).trim() : '';
  let text = separator ? rest.slice(separator.index + separator[0].length) : '';

  if ((!tabs || mixed) && knownFactions.length) {
    // В копии с пробелами разделитель может остаться внутри текста, а между полями исчезнуть.
    const restNorm = normFaction(rest);
    let best = '';
    for (const f of knownFactions) {
      const fn = normFaction(f);
      if (fn.length > best.length && (restNorm === fn || restNorm.startsWith(fn + ' '))) best = fn;
    }
    if (best && normFaction(faction) !== best) {
      const words = rest.split(/\s+/);
      const fw = best.split(' ').length;
      faction = words.slice(0, fw).join(' ');
      text = words.slice(fw).join(' ');
    }
  }

  if (!faction) return { skip: 'no-faction' };
  const isSystem = nk[1].trim().toUpperCase() === 'SYSTEM';
  text = text.replace(/\s+/g, ' ').trim();
  if (!text) return { skip: 'no-text' };

  const [, d, mo, y, h, mi, s] = dm;
  const ts = Date.UTC(+y, +mo - 1, +d, +h, +mi, s ? +s : 0);
  if (+h > 23 || +mi > 59 || +(s ?? 0) > 59 || new Date(ts).getUTCMonth() !== +mo - 1) return { skip: 'bad-date' };

  return {
    line: {
      lineNo,
      id: im[1],
      nick: nk[1].trim(),
      staticId: isSystem ? null : nk[2],
      isSystem,
      faction,
      text,
      norm: normText(text),
      date: `${pad(d)}.${pad(mo)}.${y}`,
      time: `${pad(h)}:${mi}:${s ? s : '00'}`,
      ts,
      file,
    },
  };
}

export interface ParseStats {
  total: number;
  parsed: number;
  skipped: number;
  /** До 5 примеров неразобранных строк (обрезаны до 200 символов). */
  examples: string[];
}

/**
 * Разбирает весь текст. onProgress вызывается каждые `chunk` строк — для индикатора в воркере.
 */
export function parseLog(
  text: string,
  opts: { knownFactions?: string[]; file?: number; onProgress?: (done: number, total: number) => void; chunk?: number } = {},
): { lines: LogLine[]; stats: ParseStats } {
  const rows = text.split(ROW_SEPARATOR);
  const lines: LogLine[] = [];
  const examples: string[] = [];
  let skipped = 0;
  let total = 0;
  const chunk = opts.chunk ?? 2000;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.trim()) {
      total++;
      const out = parseLine(r, i + 1, opts.knownFactions, opts.file ?? 0);
      if (out.line) lines.push(out.line);
      else {
        skipped++;
        if (examples.length < 5) examples.push(cleanLine(r).trim().slice(0, 200));
      }
    }
    if (opts.onProgress && (i + 1) % chunk === 0) opts.onProgress(i + 1, rows.length);
  }
  opts.onProgress?.(rows.length, rows.length);
  return { lines, stats: { total, parsed: lines.length, skipped, examples } };
}

/** Строит функцию «строка лога → id фракции» по алиасам. */
export function buildFactionResolver(factions: Faction[]): (logFaction: string) => string | null {
  const map = new Map<string, string>();
  for (const f of factions) {
    map.set(normFaction(f.name), f.id);
    for (const a of f.aliases) map.set(normFaction(a), f.id);
  }
  const cache = new Map<string, string | null>();
  return (logFaction: string) => {
    let v = cache.get(logFaction);
    if (v === undefined) {
      v = map.get(normFaction(logFaction)) ?? null;
      cache.set(logFaction, v);
    }
    return v;
  };
}

/** Сравнение порядка строк: время, затем ID строки лога (числовой), затем номер строки. */
export function compareLines(a: LogLine, b: LogLine): number {
  if (a.ts !== b.ts) return a.ts - b.ts;
  if (a.id.length !== b.id.length) return a.id.length - b.id.length;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  if (a.file !== b.file) return a.file - b.file;
  return a.lineNo - b.lineNo;
}
