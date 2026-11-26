// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FactionPicker } from '../src/components/FactionPicker';
import { ManualGrid } from '../src/components/Results';
import { findFaction, GROUPS, isFactionSelectable } from '../src/config';
import { gov } from '../src/config/gov';
import type { ManualRule } from '../src/config/types';
import { analyze, GroupDisabledError, loadFiles } from '../src/lib/pipeline';
import { buildReport } from '../src/lib/report';
import { at, L, P, SYS } from './helpers';

afterEach(cleanup);

const lines = (...rows: string[]) => rows.join('\n');

const cop = (time: string, player: number, event: string, faction = 'LSPD') => L(time, P(player), event, { faction });
const system = (time: string, event: string) => L(time, SYS, event, { faction: 'LSPD' });
const openGov = ['lspd', 'lssd', 'fib'];
const analyzeGov = (faction: string, ...rows: string[]) => analyze(loadFiles([{ name: 'gov.txt', text: lines(...rows) }]), faction, null);
const analyzeLspd = (...rows: string[]) => analyzeGov('lspd', ...rows);
const achievement = (a: ReturnType<typeof analyzeGov>, id: string) => a.result!.achievements.find((r) => r.id === `${a.factionId}_${id}`);
const group = (phrase: string, n = 5, faction = 'LSPD', start = '12:00:00') =>
  Array.from({ length: n }, (_, i) => cop(at(start, i * 5), i, phrase, faction));

describe('Вкладка «Гос»', () => {
  it('LSPD, LSSD и FIB выбираются в интерфейсе, остальные фракции закрыты', () => {
    const onFaction = vi.fn();
    render(<FactionPicker groups={GROUPS} tabId="gov" factionId={null} onTab={() => {}} onFaction={onFaction} />);
    for (const f of gov.factions) {
      const btn = screen.getByTestId(`faction-${f.id}`);
      const enabled = openGov.includes(f.id);
      expect(isFactionSelectable(f.id)).toBe(enabled);
      expect(btn.getAttribute('aria-disabled')).toBe(enabled ? null : 'true');
      fireEvent.click(btn);
    }
    expect(onFaction.mock.calls).toEqual(openGov.map((id) => [id]));
    fireEvent.mouseEnter(screen.getByTestId('faction-army'));
    expect(screen.getByRole('tooltip').textContent).toBe('Правила для этой фракции ещё не добавлены');
    expect(isFactionSelectable('ballas')).toBe(true);
  });

  it('закрытые фракции видны в диагностике, но не получают результат и бейдж AP', () => {
    const loaded = loadFiles([{ name: 'x', text: lines(
      cop('12:00:00', 1, 'Стоит на месте', 'Los Santos Police Department'),
      ...group('Ставит машину на учёт', 5, 'National Guard'),
    ) }]);
    const a = analyze(loaded, 'lspd', null);
    expect(a.fileFactions.map((f) => f.id)).toEqual(['army', 'lspd']);
    expect(a.badges).toEqual({ lspd: 0 });
    for (const f of gov.factions.filter((f) => !openGov.includes(f.id))) {
      expect(() => analyze(loaded, f.id, null)).toThrow(GroupDisabledError);
    }
  });
});

describe('Автоматические достижения LSPD', () => {
  it.each([
    { id: 'returned_cars', per: 5, points: 2, phrase: 'Возвращает угнанный автомобиль', other: 'Возвращает лицензию владельцу' },
    { id: 'fines', per: 13, points: 2, phrase: 'Выписывает штраф за нарушение (ДК)', other: 'Выписывает штраф (УК)' },
    { id: 'vehicle_registration', per: 5, points: 3, phrase: 'Ставит на учёт автомобиль', other: 'Ставит на учёт гражданина' },
  ])('$id начисляется по $points AP за каждые $per строк', ({ id, per, points, phrase, other }) => {
    const partial = [
      ...group(phrase, per - 1),
      cop('12:10:01', 1, other),
      cop('12:10:02', 2, phrase, 'LSSD'),
      system('12:10:03', phrase),
    ];
    expect(achievement(analyzeLspd(...partial), id)).toMatchObject({ count: 0, progress: { found: per - 1, need: per } });
    expect(achievement(analyzeLspd(...partial, cop('12:10:04', 1, phrase)), id)).toMatchObject({ count: 1, total: points });
  });

  it.each([
    { id: 'army_supply', kind: 'материалов', prefix: 'Army', amount: 7500, per: 3 },
    { id: 'ems_supply', kind: 'аптечек', prefix: 'EMS', amount: 750, per: 2 },
  ])('для $id нужны 5 участников и $per разных машин LSPD', ({ id, kind, prefix, amount, per }) => {
    const participation = `Участвует в сопровождении поставки ${kind}`;
    const unloading = (i: number, faction = 'LSPD', time = at('12:20:00', i * 5)) =>
      cop(time, 1, `Разгружает поставку ${kind}: ${amount} шт. (${prefix}${14 + i})`, faction);
    const partial = Array.from({ length: per - 1 }, (_, i) => unloading(i));
    const repeated = unloading(0, 'LSPD', '12:21:00');
    const foreign = unloading(per - 1, 'Мексиканская Мафия');
    const withoutVehicles = analyzeLspd(...group(participation), ...partial, repeated, foreign);
    expect(achievement(withoutVehicles, id)).toMatchObject({ count: 0, total: 0 });
    expect(withoutVehicles.result!.disputed).toContainEqual(expect.objectContaining({ reason: `${per - 1} из ${per} машин (не хватило 1)` }));

    const deliveries = [...partial, unloading(per - 1)];
    const withoutParticipants = analyzeLspd(...group(participation, 4), cop('12:01:00', 0, participation), ...deliveries, cop('12:00:22', 4, participation, 'LSSD'));
    expect(achievement(withoutParticipants, id)).toMatchObject({ count: 0 });
    expect(withoutParticipants.result!.disputed).toContainEqual(expect.objectContaining({ reason: '4 из 5 участников LSPD (не хватило 1)' }));

    const secondDelivery = Array.from({ length: per }, (_, i) => unloading(i, 'LSPD', at('12:45:00', i * 5)));
    const full = analyzeLspd(...group(participation), ...deliveries, ...secondDelivery);
    expect(achievement(full, id)).toMatchObject({ count: 1, total: 3 });
    expect(achievement(full, id)!.occurrences[0].steps.map((s) => s.lines.length)).toEqual([5, per]);
  });

  it('поезд и аир-дроп требуют реальное завершение и 5 разных игроков своей фракции', () => {
    const train = 'Участвует в обороне поезда';
    const drop = 'Участвует в захвате выпавшего армейского воздушного груза';
    const trainDelivery = cop('12:20:00', 0, 'Доставляет грузовик с грузом из поезда');
    const dropWin = 'Получает припасы из выпавшего армейского груза: 100 патронов';
    const dropParticipation = group(drop, 5, 'LSPD', '15:00:00');
    const partial = analyzeLspd(
      ...group(train, 4), cop('12:01:00', 0, train), cop('12:02:00', 4, train, 'FIB'),
      trainDelivery, ...dropParticipation, cop('15:20:00', 0, dropWin),
    );
    expect(achievement(partial, 'train_defense')).toMatchObject({ total: 0 });
    expect(achievement(partial, 'airdrop')).toMatchObject({ total: 0 });

    const unrelated = system('15:15:00', 'Получает припасы со склада');
    const full = analyzeLspd(...group(train), trainDelivery, ...dropParticipation, unrelated, system('15:20:00', dropWin));
    expect(achievement(full, 'train_defense')).toMatchObject({ count: 1, total: 3 });
    expect(achievement(full, 'airdrop')).toMatchObject({ count: 1, total: 4 });
  });
});

describe('Ручные достижения LSPD', () => {
  it('показывает условие для ФЗ и передаёт ручное начисление в отчёт', () => {
    const allRules = findFaction('lspd')!.rules;
    const rules = allRules.filter((rule): rule is ManualRule => rule.type === 'manual');
    const onCount = vi.fn();
    render(<ManualGrid rules={rules} counts={{}} adjust={0} onCount={onCount} onAdjust={() => {}} />);
    expect(screen.getByText('Минимум 5 участников LSPD и 5 спасённых матовозок. Факт успеха не логируется.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Увеличить · Успешное отбитие ФЗ' }));
    expect(onCount).toHaveBeenCalledWith('lspd_fz_defense', 1);
    const report = buildReport({
      group: gov, rules: allRules, factionName: 'LSPD', date: '09.11.2026', achievements: [],
      manualCounts: { lspd_fz_defense: 1 }, adjust: 0, spends: [],
    });
    expect(report.rows).toEqual([{ kind: 'earn', title: 'Успешное отбитие ФЗ', ap: 4 }]);
  });
});


describe('Правила отдельных гос. фракций', () => {
  it('общие правила считаются по своей фракции и дают раздельные бейджи', () => {
    const ownSupply = 'Участвует в сопровождении поставки аптечек';
    const rows = [
      ...group(ownSupply, 4, 'FIB'),
      ...group(ownSupply, 5, 'LSSD'),
      ...group('Возвращает угнанный автомобиль', 5, 'LSSD'),
      ...group('Ставит на учёт машину', 5, 'LSPD'),
      ...['FIB', 'LSSD'].flatMap((f) => [14, 15].map((n) => cop('12:30:00', n,
        `Разгружает поставку аптечек: 750 шт. (EMS${n})`, f))),
    ];
    const fib = analyzeGov('fib', ...rows);
    expect(achievement(fib, 'ems_supply')).toMatchObject({ total: 0 });
    expect(fib.result!.disputed).toContainEqual(expect.objectContaining({ reason: '4 из 5 участников FIB (не хватило 1)' }));
    expect(fib.badges).toEqual({ lspd: 3, lssd: 5, fib: 0 });
    expect(achievement(fib, 'returned_cars')).toBeUndefined();

    const lssd = analyzeGov('lssd', ...rows);
    expect(achievement(lssd, 'ems_supply')).toMatchObject({ total: 3 });
    expect(achievement(lssd, 'returned_cars')).toMatchObject({ total: 2 });
    expect(achievement(lssd, 'vehicle_registration')).toBeUndefined();
  });

  it('у LSSD есть охотничьи лицензии, у FIB — улики и разовые допросы', () => {
    const lssd = findFaction('lssd')!.rules;
    expect(lssd).toHaveLength(19);
    expect(findFaction('lspd')!.rules).toHaveLength(19);
    expect(lssd).toContainEqual(expect.objectContaining({ id: 'lssd_hunting', type: 'manual', points: 2 }));
    expect(findFaction('lspd')!.rules.some((r) => r.id.endsWith('_hunting'))).toBe(false);

    const rules = findFaction('fib')!.rules;
    expect(rules).toHaveLength(16);
    const fibManual = rules.filter((r): r is ManualRule => r.type === 'manual');
    const onCount = vi.fn();
    render(<ManualGrid rules={fibManual} counts={{ fib_interrogations: 1 }} adjust={0} onCount={onCount} onAdjust={() => {}} />);
    const add = screen.getByRole('button', { name: 'Увеличить · Проведение 2 допросов с пристрастием' });
    expect((add as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(add);
    expect(onCount).not.toHaveBeenCalled();
    const report = buildReport({
      group: gov, rules, factionName: 'FIB', date: '09.11.2026', achievements: [],
      manualCounts: { fib_interrogations: 2, fib_evidence: 2, lssd_hunting: 1 }, adjust: 0, spends: [],
    });
    expect(report.rows.map((r) => r.ap)).toEqual([3, 3, 3]);
    expect(report.earned).toBe(9);
  });

  it('строка о спасённой машине становится основанием для проверки Gunshop, без начисления', () => {
    const result = analyzeGov('fib', cop('12:00:00', 1, 'Спас украденную машину', 'ФИБ')).result!;
    expect(result.autoSum).toBe(0);
    expect(result.disputed).toContainEqual(expect.objectContaining({
      ruleId: 'fib_gunshop_defense',
      steps: [expect.objectContaining({ lines: [expect.objectContaining({ text: 'Спас украденную машину' })] })],
    }));
  });
});
