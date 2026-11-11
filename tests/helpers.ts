import { gangs as crime } from '../src/config/gangs';
import { runRules } from '../src/lib/engine';
import { parseLog } from '../src/lib/parser';
import { analyze, loadFiles } from '../src/lib/pipeline';

let seq = 1000;
/** Строка лога в формате игры. sep — разделитель колонок (таб по умолчанию). */
export function L(time: string, nick: string, text: string, opts: { faction?: string; date?: string; sep?: string } = {}) {
  const sep = opts.sep ?? '\t';
  return [String(++seq), nick, opts.faction ?? 'The Ballas Gang', text, `${opts.date ?? '09.11.2026'}, ${time}`].join(sep);
}

/** Игрок с уникальным статиком. */
export const P = (i: number) => `Player_${i} [${10000 + i}]`;
export const SYS = 'SYSTEM [1]';

/** Добавляет секунды к ЧЧ:ММ:СС. */
export function at(base: string, plusSec: number) {
  const [h, m, s] = base.split(':').map(Number);
  const t = h * 3600 + m * 60 + s + plusSec;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(t / 3600))}:${p(Math.floor((t % 3600) / 60))}:${p(t % 60)}`;
}

export function run(text: string, factionId = 'ballas', date: string | null = '09.11.2026') {
  const loaded = loadFiles([{ name: 't.txt', text }]);
  return analyze(loaded, factionId, date);
}

export function ach(text: string, id: string) {
  const r = run(text).result!;
  return r.achievements.find((a) => a.id === id)!;
}

export function disputed(text: string, ruleId: string) {
  return run(text).result!.disputed.filter((d) => d.ruleId === ruleId);
}

export { crime, runRules, parseLog };
