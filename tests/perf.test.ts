import { describe, expect, it } from 'vitest';
import { analyze, loadFiles } from '../src/lib/pipeline';

const texts = [
  'Грабит человека.',
  'Взламывает дом #12.',
  'Участвует в нападении на поезд с военным грузом.',
  'Разгружает 750 аптек из EMS3 на склад',
  'Привозит угнанный автомобиль AB123',
  'Нападает на Тату салон #2',
  'Получает $100 за победу в GRAFFITI WAR',
  'Разгружает 300 материалов из армейского грузовика Army12',
  'Пишет в рацию',
];
const factions = ['The Ballas Gang', 'Los Santos Vagos', 'Bloods'];

function big(n: number) {
  const rows: string[] = [];
  for (let i = 0; i < n; i++) {
    const sec = Math.floor((i / n) * 86399);
    const hh = String(Math.floor(sec / 3600)).padStart(2, '0');
    const mm = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
    const ss = String(sec % 60).padStart(2, '0');
    rows.push([i + 1, `P_${i % 300} [${1000 + (i % 300)}]`, factions[i % 3], texts[i % texts.length], `09.11.2026, ${hh}:${mm}:${ss}`].join(i % 2 ? '\t' : '    '));
    if (i % 1000 === 0) rows.push('Prince — 23:50');
  }
  return rows.join('\n');
}

describe('Производительность', () => {
  it('50 000 строк: разбор + расчёт быстро и с прогрессом (выполняется в Web Worker)', () => {
    const text = big(50_000);
    const progress: number[] = [];
    const t0 = performance.now();
    const loaded = loadFiles([{ name: 'big.txt', text }], (done) => progress.push(done));
    const a = analyze(loaded, 'ballas', null);
    const ms = performance.now() - t0;
    expect(loaded.lines.length).toBe(50_000);
    expect(loaded.skipped).toBe(50);
    expect(a.dayLines).toBeGreaterThan(16_000);
    expect(a.result).not.toBeNull();
    // Прогресс репортится частями (каждые 2000 строк) — UI-индикатор обновляется по ходу работы.
    expect(progress.length).toBeGreaterThanOrEqual(25);
    // Даже на медленной машине CI — заметно меньше бюджета; UI при этом не блокируется,
    // т.к. в браузере всё это выполняется в Web Worker (src/worker/apWorker.ts).
    expect(ms).toBeLessThan(5000);
    console.log(`50k строк: ${Math.round(ms)} мс`);
  });

  it('вычисления вынесены в Web Worker', async () => {
    const { readFileSync } = await import('node:fs');
    const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
    expect(app).toMatch(/new Worker\(new URL\('\.\/worker\/apWorker\.ts', import\.meta\.url\)/);
    const worker = readFileSync(new URL('../src/worker/apWorker.ts', import.meta.url), 'utf8');
    expect(worker).toMatch(/loadFiles\(/);
    expect(worker).toMatch(/type: 'progress'/);
  });
});
