import type {
  ClusterRule,
  PerCountRule,
  PerLineRule,
  Rule,
  SequenceRule,
  VariantClusterRule,
} from '../config/types';
import { compileMatcher, type Match } from './matcher';
import { compareLines, type LogLine } from './parser';

// ───────────────────────── Результаты ─────────────────────────

export interface EvLine {
  lineNo: number;
  id: string;
  date: string;
  time: string;
  nick: string;
  staticId: string | null;
  text: string;
  /** Подсветка ключевой фразы [start, end) в text. */
  hl?: [number, number];
}

export interface EvStep {
  label: string;
  lines: EvLine[];
}

export interface Occurrence {
  label: string;
  steps: EvStep[];
}

export interface AchievementResult {
  /** id строки таблицы (правило, вариант или тир). */
  id: string;
  ruleId: string;
  title: string;
  hint?: string;
  unitPoints: number;
  count: number;
  total: number;
  occurrences: Occurrence[];
  /** Сколько событий отброшено из-за oncePerDay. */
  droppedByOncePerDay?: number;
}

export interface DisputedCase {
  id: string;
  ruleId: string;
  title: string;
  reason: string;
  steps: EvStep[];
}

export interface EngineResult {
  achievements: AchievementResult[];
  disputed: DisputedCase[];
  autoSum: number;
}

export interface DayRange {
  start: number; // включительно
  end: number; // не включительно
}

// ───────────────────────── Хелперы ─────────────────────────

type Hit = { line: LogLine; m: Match };

const MIN = 60_000;

function ev(h: Hit): EvLine {
  const { line, m } = h;
  return {
    lineNo: line.lineNo,
    id: line.id,
    date: line.date,
    time: line.time,
    nick: line.isSystem ? 'SYSTEM' : line.nick,
    staticId: line.staticId,
    text: line.text,
    hl: [m.start, m.end],
  };
}

function hits(lines: LogLine[], matcher: { test(l: LogLine): Match | null }): Hit[] {
  const out: Hit[] = [];
  for (const line of lines) {
    const m = matcher.test(line);
    if (m) out.push({ line, m });
  }
  return out;
}

const inDay = (day: DayRange, l: LogLine) => l.ts >= day.start && l.ts < day.end;

function groupByGap(list: Hit[], gapMinutes: number): Hit[][] {
  const groups: Hit[][] = [];
  let cur: Hit[] = [];
  for (const h of list) {
    if (cur.length && h.line.ts - cur[cur.length - 1].line.ts > gapMinutes * MIN) {
      groups.push(cur);
      cur = [];
    }
    cur.push(h);
  }
  if (cur.length) groups.push(cur);
  return groups;
}

function distinctValues(group: Hit[], by: 'static' | 'key'): Set<string> {
  const s = new Set<string>();
  for (const h of group) {
    const v = by === 'static' ? h.line.staticId : h.m.key?.toLowerCase();
    if (v) s.add(v);
  }
  return s;
}

/** Русское склонение: 1 грузовик, 2 грузовика, 5 грузовиков. */
export function plural(n: number, forms: [string, string, string]): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}

/** «8 из 10 участников» или, если заданы формы, «2 грузовика из 3». */
function shortOf(d: number, min: number, label: string, forms?: [string, string, string]): string {
  return forms ? `${d} ${plural(d, forms)} из ${min}` : `${d} из ${min} ${label}`;
}

const span = (g: Hit[]) =>
  g.length === 1 ? g[0].line.time : `${g[0].line.time}–${g[g.length - 1].line.time}`;

function makeResult(
  id: string,
  ruleId: string,
  title: string,
  unitPoints: number,
  occurrences: Occurrence[],
  oncePerDay: boolean | undefined,
  hint?: string,
): AchievementResult {
  let occ = occurrences;
  let dropped: number | undefined;
  if (oncePerDay && occ.length > 1) {
    dropped = occ.length - 1;
    occ = occ.slice(0, 1);
  }
  return { id, ruleId, title, hint, unitPoints, count: occ.length, total: occ.length * unitPoints, occurrences: occ, droppedByOncePerDay: dropped };
}

let disputedSeq = 0;
const dispute = (ruleId: string, title: string, reason: string, steps: EvStep[]): DisputedCase => ({
  id: `${ruleId}#${++disputedSeq}`,
  ruleId,
  title,
  reason,
  steps,
});

// ───────────────────────── Типы правил ─────────────────────────

function runPerLine(rule: PerLineRule, lines: LogLine[], day: DayRange, out: EngineResult) {
  const list = hits(lines.filter((l) => inDay(day, l)), compileMatcher(rule));
  if (!rule.tiers?.length) {
    const occ = list.map((h) => ({ label: `${h.line.time} — ${ev(h).nick}`, steps: [{ label: 'Строка лога', lines: [ev(h)] }] }));
    out.achievements.push(makeResult(rule.id, rule.id, rule.title, rule.points, occ, rule.oncePerDay, rule.hint));
    return;
  }
  const tiers = [...rule.tiers].sort((a, b) => b.min - a.min);
  const byTier = new Map<string, Occurrence[]>(tiers.map((t) => [t.id, []]));
  const lowest = Math.min(...tiers.map((t) => t.min));
  for (const h of list) {
    const n = h.m.n;
    const tier = n === undefined ? undefined : tiers.find((t) => n >= t.min && (t.max === undefined || n <= t.max));
    if (tier) {
      byTier.get(tier.id)!.push({ label: `${h.line.time} — ${n}`, steps: [{ label: `${n} (тир «${tier.title}»)`, lines: [ev(h)] }] });
    } else {
      out.disputed.push(
        dispute(rule.id, rule.title, n === undefined ? 'не удалось прочитать число' : `${n} — меньше порога ${lowest}`, [
          { label: 'Строка лога', lines: [ev(h)] },
        ]),
      );
    }
  }
  // Порядок строк таблицы — как в конфиге.
  for (const t of rule.tiers) {
    out.achievements.push(makeResult(t.id, rule.id, t.title, t.points, byTier.get(t.id)!, rule.oncePerDay, `${rule.hint ?? ''}`.trim() || undefined));
  }
}

function runPerCount(rule: PerCountRule, lines: LogLine[], day: DayRange, out: EngineResult) {
  const list = hits(lines.filter((l) => inDay(day, l)), compileMatcher(rule));
  const full = Math.floor(list.length / rule.per);
  const occ: Occurrence[] = [];
  for (let i = 0; i < full; i++) {
    const chunk = list.slice(i * rule.per, (i + 1) * rule.per);
    occ.push({ label: `Раз ${i + 1}: ${chunk.length} ${rule.unitLabel} (${span(chunk)})`, steps: [{ label: `${chunk.length} ${rule.unitLabel}`, lines: chunk.map(ev) }] });
  }
  out.achievements.push(makeResult(rule.id, rule.id, rule.title, rule.points, occ, rule.oncePerDay, rule.hint));
  const rest = list.length % rule.per;
  if (rest > 0) {
    const chunk = list.slice(full * rule.per);
    out.disputed.push(
      dispute(rule.id, rule.title, `${rest} из ${rule.per} ${rule.unitLabel}`, [{ label: `Остаток: ${rest} ${rule.unitLabel}`, lines: chunk.map(ev) }]),
    );
  }
}

function runCluster(rule: ClusterRule, lines: LogLine[], day: DayRange, out: EngineResult) {
  const list = hits(lines, compileMatcher(rule));
  const occ: Occurrence[] = [];
  for (const g of groupByGap(list, rule.gapMinutes)) {
    if (!inDay(day, g[0].line)) continue; // группа относится к дню своей первой строки
    const d = distinctValues(g, rule.distinctBy).size;
    const step = { label: `${d} ${rule.distinctLabel}, ${g.length} строк`, lines: g.map(ev) };
    if (d >= rule.minDistinct) occ.push({ label: `${span(g)} — ${d} ${rule.distinctLabel}`, steps: [step] });
    else out.disputed.push(dispute(rule.id, rule.title, shortOf(d, rule.minDistinct, rule.distinctLabel, rule.distinctForms), [step]));
  }
  if (rule.soloPhrases?.length) {
    const solo = hits(lines.filter((l) => inDay(day, l)), compileMatcher({ phrases: rule.soloPhrases, actor: rule.actor }));
    for (const h of solo) occ.push({ label: `${h.line.time} — ${ev(h).nick}`, steps: [{ label: 'Строка лога', lines: [ev(h)] }] });
    occ.sort((a, b) => (a.steps[0].lines[0].time < b.steps[0].lines[0].time ? -1 : 1));
  }
  out.achievements.push(makeResult(rule.id, rule.id, rule.title, rule.points, occ, rule.oncePerDay, rule.hint));
}

function runVariantCluster(rule: VariantClusterRule, lines: LogLine[], day: DayRange, out: EngineResult) {
  const list = hits(lines, compileMatcher(rule));
  const pre = rule.variants.map((v) => (v.requiresPreceding ? hits(lines, compileMatcher(v.requiresPreceding)) : null));
  const used = new Set<LogLine>();
  const occ = new Map<string, Occurrence[]>(rule.variants.map((v) => [v.id, []]));

  for (const g of groupByGap(list, rule.gapMinutes)) {
    const first = g[0].line;
    if (!inDay(day, first)) continue;
    // определяем вариант
    let variantIdx = rule.variants.length - 1;
    let preHit: Hit | undefined;
    for (let i = 0; i < rule.variants.length; i++) {
      const req = rule.variants[i].requiresPreceding;
      if (!req) {
        variantIdx = i;
        break;
      }
      const cand = pre[i]!.filter(
        (h) => !used.has(h.line) && compareLines(h.line, first) < 0 && h.line.ts >= first.ts - req.lookbackMinutes * MIN,
      );
      if (cand.length) {
        preHit = cand[cand.length - 1]; // ближайшая к группе
        variantIdx = i;
        break;
      }
    }
    const v = rule.variants[variantIdx];
    const d = distinctValues(g, rule.distinctBy).size;
    const steps: EvStep[] = [];
    if (preHit) steps.push({ label: `Шаг 1: ${v.requiresPreceding!.label}`, lines: [ev(preHit)] });
    steps.push({ label: `${preHit ? 'Шаг 2: ' : ''}выгрузки — ${d} ${rule.distinctLabel}, ${g.length} строк`, lines: g.map(ev) });
    if (d >= rule.minDistinct) {
      if (preHit) used.add(preHit.line);
      occ.get(v.id)!.push({ label: `${span(g)} — ${d} ${rule.distinctLabel}`, steps });
    } else {
      out.disputed.push(dispute(rule.id, v.title, shortOf(d, rule.minDistinct, rule.distinctLabel, rule.distinctForms), steps));
    }
  }
  for (const v of rule.variants) {
    out.achievements.push(makeResult(v.id, rule.id, v.title, v.points, occ.get(v.id)!, rule.oncePerDay, rule.hint));
  }
}

function runSequence(rule: SequenceRule, lines: LogLine[], day: DayRange, out: EngineResult) {
  const s1 = hits(lines, compileMatcher(rule.step1));
  const finals = hits(lines.filter((l) => inDay(day, l)), compileMatcher(rule.final));
  const used = new Set<LogLine>();
  const seen = new Set<LogLine>();
  const occ: Occurrence[] = [];
  const { minDistinct, windowMinutes, label } = rule.step1;

  for (const f of finals) {
    const cand = s1.filter(
      (h) => !used.has(h.line) && compareLines(h.line, f.line) < 0 && h.line.ts >= f.line.ts - windowMinutes * MIN,
    );
    const d = distinctValues(cand, 'static').size;
    const n = f.m.n;
    const numOk = rule.final.minNumber === undefined || (n !== undefined && n >= rule.final.minNumber);
    const numText = n !== undefined ? `, ${n} ${rule.final.numberUnit ?? ''}`.trimEnd() : '';
    const steps: EvStep[] = [
      { label: `Шаг 1: ${d} ${label}`, lines: cand.map(ev) },
      { label: `Шаг 2: ${rule.final.label}${numText}`, lines: [ev(f)] },
    ];
    if (d >= minDistinct && numOk) {
      cand.forEach((h) => used.add(h.line));
      occ.push({ label: `${f.line.time} — ${d} ${label}${numText}`, steps });
    } else {
      cand.forEach((h) => seen.add(h.line));
      const reasons: string[] = [];
      if (d < minDistinct) reasons.push(`${d} из ${minDistinct} ${label}`);
      if (!numOk)
        reasons.push(
          n === undefined
            ? 'не удалось прочитать число'
            : `${n} ${rule.final.numberUnit ?? ''} — нужно ≥ ${rule.final.minNumber}`.replace(/\s+—/, ' —'),
        );
      out.disputed.push(dispute(rule.id, rule.title, reasons.join('; '), steps));
    }
  }

  // Участники без финальной строки.
  const orphans = s1.filter((h) => inDay(day, h.line) && !used.has(h.line) && !seen.has(h.line));
  for (const g of groupByGap(orphans, windowMinutes)) {
    const d = distinctValues(g, 'static').size;
    out.disputed.push(
      dispute(rule.id, rule.title, `${d} ${label}, но нет строки «${rule.final.label}»`, [{ label: `Шаг 1: ${d} ${label}`, lines: g.map(ev) }]),
    );
  }

  out.achievements.push(makeResult(rule.id, rule.id, rule.title, rule.points, occ, rule.oncePerDay, rule.hint));
}

// ───────────────────────── Вход ─────────────────────────

/**
 * Считает автоматические достижения.
 * @param lines строки ОДНОЙ фракции за все даты (нужны для окон «до» через полночь), любой порядок
 * @param day   выбранные календарные сутки
 */
export function runRules(rules: Rule[], lines: LogLine[], day: DayRange): EngineResult {
  const sorted = [...lines].sort(compareLines);
  const out: EngineResult = { achievements: [], disputed: [], autoSum: 0 };
  disputedSeq = 0;
  for (const rule of rules) {
    switch (rule.type) {
      case 'perLine':
        runPerLine(rule, sorted, day, out);
        break;
      case 'perCount':
        runPerCount(rule, sorted, day, out);
        break;
      case 'cluster':
        runCluster(rule, sorted, day, out);
        break;
      case 'variantCluster':
        runVariantCluster(rule, sorted, day, out);
        break;
      case 'sequence':
        runSequence(rule, sorted, day, out);
        break;
      case 'manual':
        break;
    }
  }
  out.autoSum = out.achievements.reduce((s, a) => s + a.total, 0);
  return out;
}

/** Итог с дневным лимитом. */
export function applyCap(sum: number, cap: number) {
  const total = Math.max(0, Math.min(sum, cap));
  return { sum, total, cut: Math.max(0, sum - cap), capped: sum > cap };
}
