// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { ReportCard, REPORT_WIDTH } from '../src/components/Report';
import { SpendsTab } from '../src/components/Spends';
import { GROUPS } from '../src/config';
import { gangs } from '../src/config/gangs';
import { gov } from '../src/config/gov';
import { mafia } from '../src/config/mafia';
import type { ShopItem } from '../src/config/types';
import { buildReport, reportFileName } from '../src/lib/report';
import { dayTotal, EMPTY_SPENDS, shopCost, shopLabel, spendList, spentTotal, type SpendState } from '../src/lib/spend';
import { analyze, loadFiles } from '../src/lib/pipeline';
import { ach, at, L, P, run } from './helpers';

afterEach(cleanup);

const item = (id: string) => gangs.shop!.find((s) => s.id === id)! as ShopItem;
const lines = (...xs: string[]) => xs.join('\n');

describe('Траты: расчёт', () => {
  it('3 пакета анальгетика = 30 AP, «300 анальгетика»', () => {
    expect(shopCost(item('analgesic'), 3)).toBe(30);
    expect(shopLabel(item('analgesic'), 3)).toBe('300 анальгетика');
  });
  it('2000 матов = 20 AP', () => {
    expect(shopCost(item('mats'), 2)).toBe(20);
    expect(shopLabel(item('mats'), 2)).toBe('2000 матов');
  });
  it('замена авто 1 шт = 50 AP, «Замена 1 авто (1 неделя)»', () => {
    expect(shopCost(item('car'), 1)).toBe(50);
    expect(shopLabel(item('car'), 1)).toBe('Замена 1 авто (1 неделя)');
    expect(shopLabel(item('car'), 2)).toBe('Замена 1 авто (2 недели)');
  });
  it('единичный товар без количества в названии: «×N» при нескольких', () => {
    expect(shopLabel(item('x2mats'), 1)).toBe('x2 маты со следующего ганшопа');
    expect(shopLabel(item('x2mats'), 2)).toBe('x2 маты со следующего ганшопа ×2');
    expect(shopLabel(item('leader'), 5)).toBe('5 баллов лидерского срока');
  });
  it('своя трата 20 AP входит в сумму', () => {
    const st: SpendState = { packs: { analgesic: 3 }, custom: [{ id: 'c1', title: 'Аренда', ap: 20 }] };
    const list = spendList(st, gangs.shop);
    expect(list.map((s) => [s.title, s.ap])).toEqual([
      ['300 анальгетика', 30],
      ['Аренда', 20],
    ]);
    expect(spentTotal(list)).toBe(50);
  });
});

describe('Итог дня и лимит', () => {
  it('начислено 16, потрачено 50 → −34', () => {
    expect(dayTotal(16, 30, 50)).toMatchObject({ earned: 16, spent: 50, net: -34, capped: false });
  });
  it('начислено 47 (лимит), потрачено 10 → 20', () => {
    expect(dayTotal(47, 30, 10)).toMatchObject({ earned: 30, net: 20, capped: true, cut: 17, sum: 47 });
  });
  it('траты не меняют лимит: урезание одинаково при любых тратах, итог от урезанных 30', () => {
    for (const spent of [0, 10, 100]) {
      const t = dayTotal(47, 30, spent);
      expect(t.cut).toBe(17);
      expect(t.earned).toBe(30);
      expect(t.net).toBe(30 - spent);
    }
  });
});

describe('Магазин зависит от группы', () => {
  it('у банд есть, у мафий и Гос — нет', () => {
    expect(gangs.shop?.length).toBe(9);
    expect(mafia.shop).toBeUndefined();
    expect(gov.shop).toBeUndefined();
  });
  it('без магазина — «Магазин для этой группы ещё не добавлен» и только «Своя трата»', () => {
    render(<SpendsTab shop={undefined} state={EMPTY_SPENDS} onChange={() => {}} />);
    expect(screen.getByTestId('no-shop').textContent).toBe('Магазин для этой группы ещё не добавлен');
    expect(screen.queryByTestId('shop')).toBeNull();
    expect(screen.getByText('Своя трата')).toBeTruthy();
  });
  function Harness({ spy }: { spy?: (s: SpendState) => void }) {
    const [st, setSt] = useState<SpendState>(EMPTY_SPENDS);
    spy?.(st);
    return <SpendsTab shop={gangs.shop} state={st} onChange={setSt} />;
  }
  it('у банд — 9 плиток, счётчик и подсказка с итогом; быстрые клики не теряются', () => {
    render(<Harness />);
    expect(screen.getByTestId('shop').children).toHaveLength(9);
    const plus = screen.getByLabelText('Больше · Анальгетик');
    act(() => {
      for (let i = 0; i < 3; i++) plus.click(); // в одном батче
    });
    expect(screen.getByTestId('calc-analgesic').textContent).toBe('300 анальгетика = 30 AP');
    expect(screen.getByTestId('spent-total').textContent).toBe('30 AP');
    fireEvent.click(screen.getByLabelText('Удалить · 300 анальгетика'));
    expect(screen.getByTestId('spent-total').textContent).toBe('0 AP');
  });
  it('своя трата: целое > 0, иначе не добавляется', () => {
    let st: SpendState = EMPTY_SPENDS;
    render(<Harness spy={(s) => (st = s)} />);
    fireEvent.change(screen.getByLabelText('Название траты'), { target: { value: 'Аренда' } });
    fireEvent.click(screen.getByText('Добавить'));
    expect(st.custom).toEqual([]);
    expect(screen.getByText('Укажите название и целое число AP больше 0')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Баллы траты'), { target: { value: '0' } });
    fireEvent.click(screen.getByText('Добавить'));
    expect(st.custom).toEqual([]);
    fireEvent.change(screen.getByLabelText('Баллы траты'), { target: { value: '20' } });
    fireEvent.click(screen.getByText('Добавить'));
    expect(st.custom).toEqual([expect.objectContaining({ title: 'Аренда', ap: 20 })]);
    expect(screen.getByTestId('spent-total').textContent).toBe('20 AP');
  });
});

// ── Модель отчёта ──
const ems = (start: string) => [1, 2, 3, 4].map((n, i) => L(at(start, i * 15), P(n), `Разгружает 750 аптек из EMS${n} на склад фракции`));
const houses = (k: number) => Array.from({ length: k }, (_, i) => L(at('01:00:00', i * 30), P(i % 5), `Взламывает дом #${i}.`));

function model(text: string, extra: { manual?: Record<string, number>; adjust?: number; spends?: SpendState } = {}) {
  const a = run(text);
  return buildReport({
    group: gangs,
    factionName: 'The Ballas Gang',
    date: a.date!,
    achievements: a.result!.achievements,
    manualCounts: extra.manual ?? {},
    adjust: extra.adjust ?? 0,
    spends: spendList(extra.spends ?? EMPTY_SPENDS, gangs.shop),
  });
}

describe('Модель отчёта', () => {
  it('двухразовое EMS = две строки', () => {
    const m = model(lines(...ems('12:00:00'), ...ems('12:26:00')));
    const rows = m.rows.filter((r) => r.title === 'Успешная доставка поставки EMS');
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.kind === 'earn' && r.ap === ach(lines(...ems('12:00:00')), 'ems').unitPoints)).toBe(true);
  });
  it('60 домов = две строки «Ограбление 30 домов · 2»', () => {
    const m = model(lines(...houses(60)));
    expect(m.rows).toEqual([
      { kind: 'earn', title: 'Ограбление 30 домов', ap: 2 },
      { kind: 'earn', title: 'Ограбление 30 домов', ap: 2 },
    ]);
    expect(m.capped).toBe(false);
    expect(m.rows.some((r) => r.kind === 'cap')).toBe(false);
  });
  it('сначала траты, затем начисления; ручные — по строке на выполнение; корректировка одной строкой', () => {
    const m = model(lines(...houses(30)), {
      manual: { m_bank: 2 },
      adjust: -1,
      spends: { packs: { mats: 3 }, custom: [] },
    });
    expect(m.rows.map((r) => `${r.kind}:${r.title}:${r.ap}`)).toEqual([
      'spend:3000 матов:30',
      'earn:Ограбление 30 домов:2',
      'earn:Захват банка:5',
      'earn:Захват банка:5',
      'earn:Ручная корректировка:-1',
    ]);
    expect(m).toMatchObject({ earned: 11, spent: 30, net: -19 });
  });
  it('при превышении лимита — строка «Лимит 30 AP: набрано 47, урезано 17» в самом низу', () => {
    const m = model(lines(...houses(30)), { manual: { m_gov_capture: 3 }, spends: { packs: { analgesic: 1 }, custom: [] } }); // 2 + 45 = 47
    expect(m).toMatchObject({ earnedRaw: 47, earned: 30, spent: 10, net: 20, capped: true, cut: 17 });
    expect(m.rows.at(-1)).toEqual({ kind: 'cap', title: 'Лимит 30 AP: набрано 47, урезано 17', ap: 17 });
  });
  it('пустой отчёт', () => {
    expect(model(lines(L('10:00:00', P(1), 'Просто стоит'))).empty).toBe(true);
  });
  it('имя файла: ap-<фракция>-<ГГГГ-ММ-ДД>.png', () => {
    expect(reportFileName('ballas', '09.11.2026')).toBe('ap-ballas-2026-11-09.png');
  });
});

describe('Рендер картинки-отчёта', () => {
  it('узел строится: ширина 900 px, строки есть, кириллица на месте', () => {
    const m = model(lines(...houses(60)), { spends: { packs: { analgesic: 3 }, custom: [] }, manual: { m_gov_capture: 2 } });
    render(<ReportCard model={m} faction={gangs.factions[0]} logo={null} />);
    const card = screen.getByTestId('report-card');
    expect(REPORT_WIDTH).toBe(900);
    expect(card.style.width).toBe('900px');
    expect(card.style.fontFamily).toContain('IBM Plex Sans');
    const text = card.textContent!;
    expect(text).toMatch(/[А-Яа-яЁё]/);
    for (const s of ['The Ballas Gang', 'Дата', 'Активность / бонус', 'Начислено', 'Потрачено', 'Итог дня', '300 анальгетика', 'Ограбление 30 домов', 'AP Calculator']) {
      expect(text).toContain(s);
    }
    expect(screen.getByTestId('report-total').textContent).toContain('Итог дня 0 AP'); // 4 + 30 = 34 → лимит 30, − 30 трат
    expect(screen.getAllByTestId('report-row-spend')).toHaveLength(1);
    expect(screen.getAllByTestId('report-row-earn')).toHaveLength(4);
    expect(screen.getByTestId('report-row-cap').textContent).toBe('Лимит 30 AP: набрано 34, урезано 4');
  });
  it('отрицательный итог с минусом', () => {
    const m = model(lines(...houses(30)), { spends: { packs: { car: 1 }, custom: [] } });
    render(<ReportCard model={m} faction={gangs.factions[0]} logo={null} />);
    expect(screen.getByTestId('report-total').textContent).toContain('Итог дня −48 AP');
  });
});

// ── Сброс трат в App: воркер-заглушка на настоящем пайплайне ──
describe('Траты в App: сброс при смене фракции и даты, но не при добавлении логов', () => {
  beforeEach(() => {
    class PipelineWorker {
      onmessage: ((e: { data: unknown }) => void) | null = null;
      loaded: ReturnType<typeof loadFiles> | null = null;
      postMessage(msg: { type: string; files?: File[]; factionId: string; date: string | null }) {
        void (async () => {
          const send = (data: unknown) => this.onmessage?.({ data });
          if (msg.type === 'load') {
            const files = await Promise.all(msg.files!.map(async (f) => ({ name: f.name, text: await f.text() })));
            this.loaded = loadFiles(files);
            send({ type: 'loaded', info: { files: files.map((f) => f.name), bytes: 1, total: this.loaded.total, parsed: this.loaded.lines.length, skipped: 0, duplicates: 0, unparsedExamples: [], encodings: [] } });
          }
          send({ type: 'result', analysis: analyze(this.loaded!, msg.factionId, msg.date), ms: 0 });
        })();
      }
      terminate() {}
    }
    vi.stubGlobal('Worker', PipelineWorker);
    localStorage.setItem('ap-faction', 'ballas');
  });

  const log = lines(...houses(30), ...houses(30).map((l) => l.replace('09.11.2026', '10.11.2026')), L('02:00:00', P(1), 'Взламывает дом #x.'));
  const upload = async (name: string) => {
    const input = document.querySelector('input[type=file]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [new File([log], name, { type: 'text/plain' })] } });
    });
    await waitFor(() => expect(screen.getByTestId('day-parts')).toBeTruthy());
  };
  const openSpends = () => fireEvent.click(within(screen.getByRole('tablist', { name: 'Результат' })).getByText('Траты', { selector: '.only-desk' }));

  it('сценарий', async () => {
    render(<App />);
    await upload('a.txt');
    openSpends();
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByLabelText('Больше · Анальгетик'));
    expect(screen.getByTestId('spent').textContent).toBe('30');
    expect(screen.getByTestId('earned').textContent).toBe('2');
    expect(screen.getByTestId('net').textContent).toBe('−28');

    // добавили ещё логи — траты остались
    await upload('b.txt');
    expect(screen.getByTestId('spent').textContent).toBe('30');

    // сменили дату — сбросились
    const select = screen.getByLabelText('Дата') as HTMLSelectElement;
    const other = [...select.options].map((o) => o.value).find((v) => v !== select.value)!;
    await act(async () => {
      fireEvent.change(select, { target: { value: other } });
    });
    await waitFor(() => expect(screen.getByTestId('spent').textContent).toBe('0'));

    // снова потратили и сменили фракцию — сбросились
    openSpends();
    fireEvent.click(screen.getByLabelText('Больше · Маты'));
    expect(screen.getByTestId('spent').textContent).toBe('10');
    await act(async () => {
      fireEvent.click(screen.getAllByTestId('faction-vagos')[0]);
    });
    await act(async () => {
      fireEvent.click(screen.getAllByTestId('faction-ballas')[0]);
    });
    await waitFor(() => expect(screen.getByTestId('spent').textContent).toBe('0'));
  });

  it('кнопка «Отчёт» открывает окно; без начислений и трат — «Нечего показывать», кнопки заблокированы', async () => {
    render(<App />);
    const input = document.querySelector('input[type=file]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [new File([L('10:00:00', P(1), 'Просто стоит')], 'e.txt')] } });
    });
    await waitFor(() => expect(screen.getByTestId('report-btn')).toBeTruthy());
    fireEvent.click(screen.getByTestId('report-btn'));
    const dlg = screen.getByRole('dialog', { name: 'Отчёт' });
    expect(dlg.textContent).toContain('Нечего показывать: нет начислений и трат');
    expect((within(dlg).getByText('Скачать PNG').closest('button') as HTMLButtonElement).disabled).toBe(true);
    expect((within(dlg).getByText('Копировать').closest('button') as HTMLButtonElement).disabled).toBe(true);
  });
});

it('GROUPS: магазин только у банд', () => {
  expect(GROUPS.filter((g) => g.shop).map((g) => g.id)).toEqual(['gangs']);
});
