import type { Actor, PhraseMatcher } from '../config/types';
import type { LogLine } from './parser';
import { normText } from './parser';

export interface Match {
  /** Позиция совпадения в тексте строки (для подсветки). */
  start: number;
  end: number;
  n?: number;
  key?: string;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

/** Превращает шаблон фразы в RegExp. См. описание плейсхолдеров в config/types.ts. */
export function compilePhrase(phrase: string): RegExp {
  if (phrase.startsWith('re:')) return new RegExp(phrase.slice(3), 'iu');
  const src = normText(phrase.trim())
    .split(/(\{n\}|\{key\}|\{\*\})/)
    .map((part) => {
      if (part === '{n}') return '#?\\s*(?<n>\\d+)';
      if (part === '{key}') return '#?(?<key>[^\\s.,\\[\\]()]+)';
      if (part === '{*}') return '.*?';
      return escapeRe(part).replace(/ +/g, '\\s+');
    })
    .join('');
  return new RegExp(src, 'iu');
}

export interface CompiledMatcher {
  test(line: LogLine): Match | null;
}

function actorOk(actor: Actor | undefined, line: LogLine): boolean {
  if (!actor || actor === 'any') return true;
  return actor === 'system' ? line.isSystem : !line.isSystem;
}

export function compileMatcher(m: PhraseMatcher | { phrases: string[]; excludePhrases?: string[]; actor?: Actor }): CompiledMatcher {
  const res = m.phrases.map(compilePhrase);
  const ex = (m.excludePhrases ?? []).map(compilePhrase);
  return {
    test(line) {
      if (!actorOk(m.actor, line)) return null;
      for (const r of ex) if (r.test(line.norm)) return null;
      for (const r of res) {
        const mm = r.exec(line.norm);
        if (mm) {
          const g = mm.groups ?? {};
          return {
            start: mm.index,
            end: mm.index + mm[0].length,
            n: g.n !== undefined ? Number(g.n) : undefined,
            key: g.key !== undefined ? extractKey(line, mm, g.key) : undefined,
          };
        }
      }
      return null;
    },
  };
}

/** key берём из исходного текста (с исходным регистром), но сравнивать будем в нижнем. */
function extractKey(line: LogLine, mm: RegExpExecArray, keyNorm: string): string {
  const idx = line.norm.indexOf(keyNorm, mm.index);
  return idx >= 0 ? line.text.slice(idx, idx + keyNorm.length) : keyNorm;
}
