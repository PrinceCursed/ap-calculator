/**
 * Декодирование файла логов. Сначала UTF-8; если в результате заметная доля символов «�»
 * (байты, не являющиеся UTF-8), пробуем windows-1251 и берём вариант с меньшим числом «�».
 */
export function decodeBytes(bytes: Uint8Array): { text: string; encoding: 'utf-8' | 'windows-1251' } {
  const utf = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  const bad = countReplacement(utf);
  if (bad === 0 || bad < Math.max(3, utf.length * 0.001)) return { text: utf, encoding: 'utf-8' };
  try {
    const cp = new TextDecoder('windows-1251', { fatal: false }).decode(bytes);
    if (countReplacement(cp) < bad) return { text: cp, encoding: 'windows-1251' };
  } catch {
    /* декодер windows-1251 недоступен — остаёмся на UTF-8 */
  }
  return { text: utf, encoding: 'utf-8' };
}

function countReplacement(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) === 0xfffd) n++;
  return n;
}
