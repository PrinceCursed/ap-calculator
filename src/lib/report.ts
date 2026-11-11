import type { FactionGroup, ManualRule } from '../config/types';
import type { AchievementResult } from './engine';
import type { Spend } from './spend';
import { dayTotal, spentTotal } from './spend';

/** Строка картинки-отчёта. */
export interface ReportRow {
  kind: 'spend' | 'earn' | 'cap';
  title: string;
  /** AP строки (для earn может быть < 0 — ручная корректировка). */
  ap: number;
}

export interface ReportModel {
  factionName: string;
  date: string;
  cap: number;
  /** Набрано до лимита. */
  earnedRaw: number;
  /** Начислено с учётом лимита. */
  earned: number;
  spent: number;
  net: number;
  capped: boolean;
  cut: number;
  rows: ReportRow[];
  empty: boolean;
}

/** id строки таблицы (правило / тир / вариант) → название для отчёта. */
export function reportTitles(group: FactionGroup): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of group.rules) {
    if ('title' in r && r.reportTitle) m.set(r.id, r.reportTitle);
    if (r.type === 'perLine') for (const t of r.tiers ?? []) if (t.reportTitle) m.set(t.id, t.reportTitle);
    if (r.type === 'variantCluster') for (const v of r.variants) if (v.reportTitle) m.set(v.id, v.reportTitle);
  }
  return m;
}

/**
 * Данные для картинки (без рендера). Сначала траты, затем начисления: каждое засчитанное выполнение —
 * отдельная строка (2 × EMS = 2 строки, 60 домов = 2 строки «Ограбление 30 домов · 2»).
 */
export function buildReport(input: {
  group: FactionGroup;
  factionName: string;
  date: string;
  achievements: AchievementResult[];
  manualCounts: Record<string, number>;
  adjust: number;
  spends: Spend[];
}): ReportModel {
  const { group } = input;
  const titles = reportTitles(group);
  const rows: ReportRow[] = [];
  for (const s of input.spends) rows.push({ kind: 'spend', title: s.title, ap: s.ap });

  let earnedRaw = 0;
  for (const a of input.achievements) {
    if (a.count <= 0 || a.unitPoints <= 0) continue;
    const title = titles.get(a.id) ?? a.title;
    for (let i = 0; i < a.count; i++) rows.push({ kind: 'earn', title, ap: a.unitPoints });
    earnedRaw += a.total;
  }
  const manual = group.rules.filter((r): r is ManualRule => r.type === 'manual');
  for (const r of manual) {
    const n = input.manualCounts[r.id] ?? 0;
    for (let i = 0; i < n; i++) rows.push({ kind: 'earn', title: r.reportTitle ?? r.title, ap: r.points });
    earnedRaw += n * r.points;
  }
  if (input.adjust) {
    rows.push({ kind: 'earn', title: 'Ручная корректировка', ap: input.adjust });
    earnedRaw += input.adjust;
  }

  const spent = spentTotal(input.spends);
  const t = dayTotal(earnedRaw, group.dailyCap, spent);
  if (t.capped) rows.push({ kind: 'cap', title: `Лимит ${group.dailyCap} AP: набрано ${t.sum}, урезано ${t.cut}`, ap: t.cut });

  return {
    factionName: input.factionName,
    date: input.date,
    cap: group.dailyCap,
    earnedRaw,
    earned: t.earned,
    spent,
    net: t.net,
    capped: t.capped,
    cut: t.cut,
    rows,
    empty: !rows.some((r) => r.kind !== 'cap'),
  };
}

/** «−34», «+20», «0» — с типографским минусом. */
export function signed(n: number): string {
  return n < 0 ? `−${-n}` : String(n);
}

/** Имя PNG: ap-<фракция>-<ГГГГ-ММ-ДД>.png (дата из ДД.ММ.ГГГГ). */
export function reportFileName(factionId: string, date: string): string {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(date);
  const iso = m ? `${m[3]}-${m[2]}-${m[1]}` : date.replace(/[^\d-]/g, '-');
  return `ap-${factionId}-${iso}.png`;
}
