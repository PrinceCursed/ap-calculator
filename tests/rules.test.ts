import { describe, expect, it } from 'vitest';
import { applyCap, runRules } from '../src/lib/engine';
import { parseLog } from '../src/lib/parser';
import type { Rule } from '../src/config/types';
import { ach, at, disputed, L, P, run, SYS } from './helpers';

const lines = (...xs: string[]) => xs.join('\n');

function train(participants: number, boxes: number, start = '18:00:00') {
  const out: string[] = [];
  for (let i = 0; i < participants; i++) out.push(L(at(start, i * 5), P(i), 'Участвует в нападении на поезд с военным грузом.'));
  out.push(L(at(start, 40 * 60), P(0), `Доставляет грузовик с украденным из поезда грузом (${boxes} ящ.)`));
  return out;
}

describe('Поезд (sequence)', () => {
  it('6 участников + доставка 239 ящ. → спорный (не хватает участников)', () => {
    const t = lines(...train(6, 239));
    expect(ach(t, 'train').count).toBe(0);
    const d = disputed(t, 'train');
    expect(d).toHaveLength(1);
    expect(d[0].reason).toBe('6 из 10 участников');
    expect(d[0].steps.map((s) => s.label)).toEqual(['Шаг 1: 6 участников', 'Шаг 2: доставка, 239 ящ.']);
  });

  it('10+ участников + 239 ящ. → 3 AP', () => {
    const a = ach(lines(...train(12, 239)), 'train');
    expect(a.count).toBe(1);
    expect(a.total).toBe(3);
    expect(a.occurrences[0].steps[0].label).toBe('Шаг 1: 12 участников');
  });

  // В ТЗ: «доставка 189 ящ. даёт спорный случай». По порогу ≥ 125 ящики проходят, поэтому
  // спорной такая доставка становится из-за недобора участников (см. README, «Принятые решения»).
  it('доставка 189 ящ. при недоборе участников → спорный, причина — участники', () => {
    const t = lines(...train(7, 189));
    expect(ach(t, 'train').count).toBe(0);
    const d = disputed(t, 'train');
    expect(d[0].reason).toBe('7 из 10 участников');
    expect(d[0].steps[1].label).toBe('Шаг 2: доставка, 189 ящ.');
  });

  it('доставка ниже 125 ящ. → спорный', () => {
    const t = lines(...train(12, 100));
    expect(ach(t, 'train').count).toBe(0);
    expect(disputed(t, 'train')[0].reason).toBe('100 ящ. — нужно ≥ 125');
  });

  it('участники позже доставки не считаются; участники старше 90 мин не считаются', () => {
    const late: string[] = [];
    for (let i = 0; i < 12; i++) late.push(L(at('17:00:00', i), P(i), 'Участвует в нападении на поезд с военным грузом.'));
    late.push(L('19:00:00', P(1), 'Доставляет грузовик с украденным из поезда грузом (239 ящ.)'));
    expect(ach(lines(...late), 'train').count).toBe(0);
  });

  it('одни и те же участники не используются для двух доставок', () => {
    const t = [...train(10, 239)];
    t.push(L(at('18:00:00', 41 * 60), P(1), 'Доставляет грузовик с украденным из поезда грузом (200 ящ.)'));
    const a = ach(lines(...t), 'train');
    expect(a.count).toBe(1);
  });
});

function army(from: number, to: number, start: string) {
  const out: string[] = [];
  for (let n = from; n <= to; n++) out.push(L(at(start, (n - from) * 20), P(n), `Разгружает 300 материалов из армейского грузовика Army${n}`));
  return out;
}

describe('ФЗ против NG (variantCluster)', () => {
  it('шесть выгрузок Army28–33 без ЭМИ → NG 2 AP', () => {
    const t = lines(...army(28, 33, '20:00:00'));
    expect(ach(t, 'ng')).toMatchObject({ count: 1, total: 2 });
    expect(ach(t, 'fz').count).toBe(0);
  });

  it('с ЭМИ-строкой перед ними → ФЗ', () => {
    const t = lines(L('19:20:00', P(1), 'Применяет комплект для ЭМИ на Форте Занкудо.'), ...army(28, 33, '20:00:00'));
    expect(ach(t, 'fz')).toMatchObject({ count: 1, total: 2 });
    expect(ach(t, 'ng').count).toBe(0);
  });

  it('ЭМИ раньше чем за 60 минут → NG', () => {
    const t = lines(L('18:30:00', P(1), 'Применяет комплект для ЭМИ на Форте Занкудо.'), ...army(28, 33, '20:00:00'));
    expect(ach(t, 'ng').count).toBe(1);
  });

  it('2 грузовика из 3 → спорный', () => {
    const t = lines(...army(28, 29, '20:00:00'));
    expect(disputed(t, 'army')[0].reason).toBe('2 грузовика из 3');
  });
});

describe('EMS (cluster)', () => {
  const ems = (start: string) => [1, 2, 3, 4].map((n, i) => L(at(start, i * 15), P(n), `Разгружает 750 аптек из EMS${n} на склад фракции`));
  it('4 разных EMS за минуту → одна атака (2 AP)', () => {
    expect(ach(lines(...ems('12:00:00')), 'ems')).toMatchObject({ count: 1, total: 2 });
  });
  it('две такие группы с паузой 25 минут → две атаки', () => {
    expect(ach(lines(...ems('12:00:00'), ...ems('12:26:00')), 'ems')).toMatchObject({ count: 2, total: 4 });
  });
});

describe('ФТ (cluster по статику освобождённого)', () => {
  it('3 разных освобождённых → 2 AP, 2 → спорный', () => {
    const f = (who: number, t: string) => L(t, P(1), `Помогает Prisoner_${who}[${700 + who}] сбежать из тюрьмы`);
    expect(ach(lines(f(1, '10:00:00'), f(2, '10:05:00'), f(3, '10:30:00')), 'ft').total).toBe(2);
    expect(disputed(lines(f(1, '10:00:00'), f(1, '10:01:00'), f(2, '10:05:00')), 'ft')[0].reason).toBe('2 из 3 освобождённых');
  });
});

describe('Граффити (perCount)', () => {
  it('7 побед = 2 раза по 2 AP, остаток 1 — спорный', () => {
    const t = lines(...Array.from({ length: 7 }, (_, i) => L(at('13:00:00', i * 60), P(i), 'Получает $500 за победу в GRAFFITI WAR')));
    expect(ach(t, 'graffiti')).toMatchObject({ count: 2, total: 4 });
    expect(disputed(t, 'graffiti')[0].reason).toBe('1 из 3 побед');
  });
});

describe('Ганшоп (perLine с тирами)', () => {
  it('4000 → успешный 3 AP, 1500 → нападение 2 AP, 500 → спорный, «Спас украденную машину» не считается', () => {
    const t = lines(
      L('11:00:00', P(1), 'Разгружает 4000 материалов из оружейного магазина'),
      L('11:10:00', P(2), 'Разгружает 1500 материалов из оружейного магазина'),
      L('11:20:00', P(3), 'Разгружает 500 материалов из оружейного магазина'),
      L('11:30:00', P(4), 'Спас украденную машину и разгружает 5000 материалов из оружейного магазина'),
    );
    expect(ach(t, 'gunshop_success')).toMatchObject({ count: 1, total: 3 });
    expect(ach(t, 'gunshop_attack')).toMatchObject({ count: 1, total: 2 });
    expect(disputed(t, 'gunshop')[0].reason).toBe('500 — меньше порога 1000');
  });
});

describe('Остальные правила', () => {
  it('Рэкет: 10 нападений = 2 AP', () => {
    const kinds = ['Нападает на Магазин 24/7 #3', 'Нападает на Тату салон #1', 'Нападает на Магазин спортивной одежды #2'];
    const t = lines(...Array.from({ length: 10 }, (_, i) => L(at('09:00:00', i * 60), P(i), kinds[i % 3])));
    expect(ach(t, 'racket').total).toBe(2);
  });

  it('Дома: 60 = 2 раза по 2 AP', () => {
    const t = lines(...Array.from({ length: 60 }, (_, i) => L(at('01:00:00', i * 30), P(i % 5), `Взламывает дом #${i}.`)));
    expect(ach(t, 'houses')).toMatchObject({ count: 2, total: 4 });
  });

  it('Аирдроп: 10 участников + SYSTEM-строка → 4 AP; без SYSTEM → спорный', () => {
    const part = Array.from({ length: 10 }, (_, i) => L(at('16:00:00', i * 10), P(i), 'Участвует в захвате выпавшего армейского воздушного груза.'));
    const fin = L('16:20:00', SYS, 'Получает припасы из выпавшего армейского груза: 100 патронов');
    expect(ach(lines(...part, fin), 'airdrop').total).toBe(4);
    const d = disputed(lines(...part), 'airdrop');
    expect(d[0].reason).toContain('нет строки');
    // финальная строка от игрока (не SYSTEM) не считается
    expect(ach(lines(...part, L('16:20:00', P(1), 'Получает припасы из выпавшего армейского груза: x')), 'airdrop').count).toBe(0);
  });

  it('Чёрный рынок: ≥10 уникальных участников, 8 → «8 из 10 участников»', () => {
    const mk = (n: number) => Array.from({ length: n }, (_, i) => L(at('21:00:00', i * 30), P(i), 'Участвует в захвате чёрного рынка.'));
    expect(ach(lines(...mk(11)), 'blackmarket').total).toBe(4);
    expect(disputed(lines(...mk(8)), 'blackmarket')[0].reason).toBe('8 из 10 участников');
  });

  it('PvP: группа хаммеров = 1 мероприятие, «занимает 1 место» — отдельное', () => {
    const t = lines(
      L('15:00:00', P(1), 'Вывозит хаммер с территории и получает $1000'),
      L('15:20:00', P(2), 'Вывозит хаммер с территории и получает $1000'),
      L('17:00:00', P(3), 'Занимает 1 место и получает $5000'),
    );
    expect(ach(t, 'pvp')).toMatchObject({ count: 2, total: 4 });
  });

  it('Флаг/вагонетка: каждая победа', () => {
    const t = lines(
      L('15:00:00', P(1), 'Побеждает в бою против The Families в режиме Захват флага'),
      L('15:30:00', P(1), 'Побеждает в бою против Bloods в режиме Сопровождение вагонетки'),
    );
    expect(ach(t, 'flag').total).toBe(4);
  });

  it('oncePerDay ограничивает до одного раза', () => {
    const rule: Rule = { type: 'perLine', id: 'x', title: 'X', points: 5, phrases: ['грабит человека'], oncePerDay: true };
    const { lines: ls } = parseLog(lines(L('10:00:00', P(1), 'Грабит человека.'), L('10:01:00', P(1), 'Грабит человека.')));
    const r = runRules([rule], ls, { start: Date.UTC(2026, 10, 9), end: Date.UTC(2026, 10, 10) });
    expect(r.achievements[0]).toMatchObject({ count: 1, total: 5, droppedByOncePerDay: 1 });
  });
});

describe('Лимит 30 AP', () => {
  it('искусственно набранные 47 → 30', () => {
    // 2 поезда (6) + 10 групп EMS (20) + ганшоп 4000 ×7 (21) = 47
    const t: string[] = [];
    t.push(...train(10, 239, '01:00:00'));
    t.push(...train(10, 239, '03:00:00').map((s) => s.replace(/Player_(\d+) \[(\d+)\]/, (_m, a, b) => `Player_${a} [${Number(b) + 50}]`)));
    for (let g = 0; g < 10; g++) {
      const start = at('05:00:00', g * 30 * 60);
      t.push(L(start, P(1), 'Разгружает 750 аптек из EMS1 на склад'), L(at(start, 10), P(2), 'Разгружает 750 аптек из EMS2 на склад'));
    }
    for (let i = 0; i < 7; i++) t.push(L(at('12:00:00', i * 600), P(i), 'Разгружает 4000 материалов из оружейного магазина'));
    const r = run(lines(...t)).result!;
    expect(r.autoSum).toBe(47);
    expect(applyCap(r.autoSum, 30)).toEqual({ sum: 47, total: 30, cut: 17, capped: true });
  });
});
