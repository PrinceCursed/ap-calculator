// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CoverageWarning, DateSummary, Diagnostics } from '../src/components/Diagnostics';
import { AchievementsTable, Summary } from '../src/components/Results';
import { decodeBytes } from '../src/lib/decode';
import { analyze, loadFiles } from '../src/lib/pipeline';

afterEach(cleanup);

const real = readFileSync('samples/real-families-short.txt', 'utf8');
const run = (text: string, faction = 'families', date: string | null = null) => {
  const loaded = loadFiles([{ name: 'real.txt', text }]);
  return { loaded, a: analyze(loaded, faction, date) };
};

describe('samples/real-families-short.txt (The Families, 09.11.2026, 50 строк)', () => {
  const { loaded, a } = run(real);
  const houses = a.result!.achievements.find((x) => x.id === 'houses')!;

  it('все 50 строк разобраны (табы + CRLF)', () => {
    expect(loaded.total).toBe(50);
    expect(loaded.lines).toHaveLength(50);
    expect(loaded.skipped).toBe(0);
  });

  it('дата по умолчанию — 09.11.2026 (больше всего строк), итог 0 AP', () => {
    expect(a.date).toBe('09.11.2026');
    expect(a.dayLines).toBe(38);
    expect(a.result!.autoSum).toBe(0);
  });

  it('«Найдено в файле»: домов 1 из 30, граффити 0 из 3', () => {
    expect(houses.count).toBe(0);
    expect(houses.progress).toMatchObject({ found: 1, need: 30 });
    expect(houses.progress.text).toBe('1 из 30 домов');
    expect(a.result!.achievements.find((x) => x.id === 'graffiti')!.progress.text).toBe('0 из 3 побед');
  });

  it('ненулевой прогресс без зачёта дублируется в «Спорных» с теми же цифрами', () => {
    const d = a.result!.disputed.find((x) => x.ruleId === 'houses')!;
    expect(d.reason).toBe('1 из 30 домов');
    for (const ach of a.result!.achievements) {
      if (ach.count === 0 && ach.progress.found > 0) expect(a.result!.disputed.some((x) => x.ruleId === ach.ruleId), ach.id).toBe(true);
    }
  });

  it('предупреждение о неполном логе', () => {
    expect(a.coverage).toMatchObject({ first: '23:36', last: '23:55', minutes: 20, lines: 38, partial: true });
    expect(a.coverage!.message).toBe(
      'Файл покрывает только 23:36–23:55 (20 мин, 38 строк). Для расчёта за сутки нужен полный лог за выбранную дату',
    );
  });

  it('сводка по датам: 09.11 и 10.11', () => {
    expect(a.dates).toEqual([
      { date: '09.11.2026', count: 38 },
      { date: '10.11.2026', count: 12 },
    ]);
  });

  it('диагностика: строки без достижения и их частые начала', () => {
    expect(a.result!.unmatched.count).toBe(37);
    expect(a.result!.unmatched.top[0]).toEqual({ text: 'Берет набор Броня', count: 10 });
    expect(a.result!.unmatched.top.map((t) => t.text)).toContain('Создает 12mm');
  });

  it('интерфейс: «0 / 30 AP (по неполному логу)», жёлтая строка (в файле 09.11 идёт 23:36:02–23:55:29), даты, «1 из 30 домов», диагностика', () => {
    const { container } = render(
      <>
        <DateSummary dates={a.dates} current={a.date} onPick={() => {}} />
        <CoverageWarning coverage={a.coverage!} />
        <Summary auto={0} manual={0} adjust={0} cap={30} date={a.date!} fileName="real.txt" fileSize={5826} lines={50} partial />
        <AchievementsTable items={a.result!.achievements} />
        <Diagnostics
          analysis={a}
          info={{ files: ['real.txt'], bytes: 5826, total: 50, parsed: 50, skipped: 0, duplicates: 0, unparsedExamples: [], encodings: [] }}
        />
      </>,
    );
    expect(screen.getByTestId('total').textContent).toBe('0/ 30 AP (по неполному логу)');
    expect(screen.getByTestId('coverage-warning').textContent).toContain('Файл покрывает только 23:36–23:55 (20 мин, 38 строк)');
    expect(screen.getByTestId('date-summary').textContent).toBe('В файле:09.11 — 38 строк10.11 — 12 строк');
    expect(screen.getByTestId('progress-houses').textContent).toBe('1 из 30 домов');
    fireEvent.click(screen.getByText('Диагностика разбора'));
    expect(container.textContent).toContain('Берет набор Броня… — 10');
  });

  it('другая дата (10.11) выбирается и тоже даёт предупреждение', () => {
    const b = analyze(loaded, 'families', '10.11.2026');
    expect(b.dayLines).toBe(12);
    expect(b.coverage!.partial).toBe(true);
  });

  it('для фракции без строк — подсказка «В файле найдены»', () => {
    const b = analyze(loaded, 'ballas', null);
    expect(b.result).toBeNull();
    expect(b.fileFactions).toEqual([{ name: 'The Families', id: 'families', count: 50 }]);
    expect(b.fileDates.map((d) => d.date)).toEqual(['09.11.2026', '10.11.2026']);
  });
});

describe('Полный лог за сутки — без предупреждения', () => {
  it('10 000 строк за 00:00–23:59 не показывают предупреждение', () => {
    const rows: string[] = [];
    for (let i = 0; i < 10_000; i++) {
      const sec = Math.floor((i / 10_000) * 86_399);
      const t = [Math.floor(sec / 3600), Math.floor((sec % 3600) / 60), sec % 60].map((n) => String(n).padStart(2, '0')).join(':');
      rows.push(`${i + 1}\tP_${i % 50} [${100 + (i % 50)}]\tThe Families\tБерет набор Броня\t09.11.2026, ${t}`);
    }
    const { a } = run(rows.join('\r\n'));
    expect(a.coverage).toMatchObject({ partial: false, message: null, lines: 10_000 });
    render(<Summary auto={0} manual={0} adjust={0} cap={30} date="09.11.2026" fileName="f" fileSize={1} lines={1} partial={a.coverage!.partial} />);
    expect(screen.getByTestId('total').textContent).toBe('0/ 30 AP');
  });
});

describe('Реальный формат: разделители, CRLF, кодировка', () => {
  const base = run(real).a;
  const sig = (x: ReturnType<typeof run>['a']) => ({ date: x.date, day: x.dayLines, other: x.ignoredOtherDate, sum: x.result?.autoSum, houses: x.result?.achievements.find((a) => a.id === 'houses')!.progress.text });

  it('одиночные пробелы вместо табов → тот же результат', () => {
    const r = run(real.replace(/\t/g, ' '));
    expect(r.loaded.skipped).toBe(0);
    expect(sig(r.a)).toEqual(sig(base));
  });

  it('LF вместо CRLF → тот же результат', () => {
    expect(sig(run(real.replace(/\r\n/g, '\n')).a)).toEqual(sig(base));
  });

  it('смешанный файл: табы, 2–4 пробела, одиночные пробелы, BOM, NBSP, без запятой в дате', () => {
    const lines = real.split('\r\n').filter(Boolean);
    const mixed = lines.map((l, i) => {
      if (i === 0) return '﻿' + l;
      if (i % 4 === 1) return l.replace(/\t/g, '    ');
      if (i % 4 === 2) return l.replace(/\t/g, ' ');
      if (i % 4 === 3) return l.replace(/\t/g, '  ').replace(/(\d{4}),\s/, '$1 ');
      return l;
    });
    const r = run(['Prince — 23:50', ...mixed, 'message.txt', '8 кб'].join('\r\n'));
    expect(r.loaded.lines).toHaveLength(50);
    expect(r.loaded.skipped).toBe(3);
    expect(r.loaded.unparsedExamples).toEqual(['Prince — 23:50', 'message.txt', '8 кб']);
    expect(sig(r.a)).toEqual(sig(base));
  });

  it('SYSTEM [1] в режиме одиночных пробелов', () => {
    const r = run('77 SYSTEM [1] The Families Получает припасы из выпавшего армейского груза: 5 09.11.2026, 12:00:00');
    expect(r.loaded.lines[0]).toMatchObject({ isSystem: true, staticId: null, faction: 'The Families' });
  });

  it('windows-1251 распознаётся по «�» и перекодируется', () => {
    // кодируем первые строки файла в cp1251 вручную
    const table = 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя';
    const sample = real.split('\r\n').slice(0, 10).join('\r\n');
    const bytes = Uint8Array.from([...sample].map((ch) => {
      const i = table.indexOf(ch);
      if (i >= 0) return 0xc0 + i;
      if (ch === 'ё') return 0xb8;
      if (ch === 'Ё') return 0xa8;
      return ch.charCodeAt(0);
    }));
    const dec = decodeBytes(bytes);
    expect(dec.encoding).toBe('windows-1251');
    expect(dec.text).toBe(sample);
    expect(decodeBytes(new TextEncoder().encode(sample)).encoding).toBe('utf-8');
  });

  it('границы суток по дате в строке, без часового пояса', () => {
    const t = [
      '1\tA [1]\tThe Families\tГрабит человека.\t08.11.2026, 23:59:59',
      '2\tA [1]\tThe Families\tГрабит человека.\t09.11.2026, 00:00:00',
      '3\tA [1]\tThe Families\tГрабит человека.\t09.11.2026, 23:59:59',
      '4\tA [1]\tThe Families\tГрабит человека.\t10.11.2026, 00:00:00',
    ].join('\n');
    const a = run(t, 'families', '09.11.2026').a;
    expect(a.dayLines).toBe(2);
    expect(a.result!.achievements.find((x) => x.id === 'robbery')!.progress.text).toBe('2 из 20 ограблений');
  });
});
