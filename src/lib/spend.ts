import type { ShopItem } from '../config/types';
import { applyCap, plural } from './engine';

/** Одна трата дня: из магазина (packs пакетов товара) или своя (произвольные AP). */
export interface Spend {
  id: string;
  kind: 'shop' | 'custom';
  /** Название строки: «3000 матов», «Замена 1 авто (1 неделя)», «Аренда склада». */
  title: string;
  ap: number;
}

/** Состояние трат текущего сеанса: число пакетов по товарам + свои траты. В localStorage не пишется. */
export interface SpendState {
  packs: Record<string, number>;
  custom: { id: string; title: string; ap: number }[];
}

export const EMPTY_SPENDS: SpendState = { packs: {}, custom: [] };

/** Стоимость N пакетов товара. */
export function shopCost(item: ShopItem, packs: number): number {
  return Math.max(0, packs) * item.cost;
}

/** Название строки трат по шаблону товара: «300 анальгетика», «x2 маты со следующего ганшопа ×2». */
export function shopLabel(item: ShopItem, packs: number): string {
  const qty = packs * item.pack;
  const tpl = item.label ?? (item.forms ? '{qty} {word}' : item.title);
  const word = item.forms ? plural(qty, item.forms) : '';
  const text = tpl.replaceAll('{qty}', String(qty)).replaceAll('{word}', word).replace(/\s+/g, ' ').trim();
  return !tpl.includes('{qty}') && packs > 1 ? `${text} ×${packs}` : text;
}

/** Своя трата валидна, если есть название и целое AP > 0. */
export function parseCustomAp(raw: string): number | null {
  const s = raw.trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** Плоский список трат (порядок: магазин в порядке прайса, затем свои в порядке добавления). */
export function spendList(state: SpendState, shop: ShopItem[] | undefined): Spend[] {
  const out: Spend[] = [];
  for (const item of shop ?? []) {
    const n = state.packs[item.id] ?? 0;
    if (n > 0) out.push({ id: `shop:${item.id}`, kind: 'shop', title: shopLabel(item, n), ap: shopCost(item, n) });
  }
  for (const c of state.custom) out.push({ id: c.id, kind: 'custom', title: c.title, ap: c.ap });
  return out;
}

export const spentTotal = (list: Spend[]) => list.reduce((s, x) => s + x.ap, 0);

/**
 * Итог дня: начислено (уже с лимитом) минус потрачено. Траты на лимит не влияют, итог может быть < 0.
 * @param earnedRaw сумма начислений до лимита (авто + ручные + корректировка)
 */
export function dayTotal(earnedRaw: number, cap: number, spent: number) {
  const c = applyCap(earnedRaw, cap);
  return { ...c, earned: c.total, spent, net: c.total - spent };
}
