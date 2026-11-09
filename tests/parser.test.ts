import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cleanLine, parseLine, parseLog } from '../src/lib/parser';
import { allFactionNames, analyze, loadFiles } from '../src/lib/pipeline';

const fixture = readFileSync(new URL('./fixtures/parsing.txt', import.meta.url), 'utf8');

describe('парсер строк', () => {
  it('разбирает строку с табами', () => {
    const { line } = parseLine('501\tJohn_Smith [12345]\tThe Ballas Gang\tГрабит человека.\t09.11.2026, 14:00:01', 1);
    expect(line).toMatchObject({ id: '501', nick: 'John_Smith', staticId: '12345', faction: 'The Ballas Gang', text: 'Грабит человека.', date: '09.11.2026', time: '14:00:01', isSystem: false });
  });

  it('разбирает строку, где табы превратились в 4 пробела', () => {
    const { line } = parseLine('502    Mike_Black [222]    The Ballas Gang    Взламывает дом #65.    09.11.2026, 14:00:05', 1);
    expect(line).toMatchObject({ id: '502', nick: 'Mike_Black', staticId: '222', faction: 'The Ballas Gang', text: 'Взламывает дом #65.' });
  });

  it('SYSTEM [1] — системное событие, не игрок', () => {
    const { line } = parseLine('503\tSYSTEM [1]\tThe Ballas Gang\tПолучает припасы\t09.11.2026, 14:10:00', 1);
    expect(line?.isSystem).toBe(true);
    expect(line?.staticId).toBeNull();
  });

  it('вычищает невидимый U+2060 в «Взламывает дом ⁠137.»', () => {
    expect(cleanLine('Взламывает дом ⁠137.')).toBe('Взламывает дом 137.');
    const { line } = parseLine('501\tJohn [1234]\tThe Ballas Gang\tВзламывает дом ⁠137.\t09.11.2026, 14:00:01', 1);
    expect(line?.text).toBe('Взламывает дом 137.');
  });

  it('неразрывные пробелы и BOM', () => {
    const { line } = parseLine('﻿504  Ann [333]  Ballas  Грабит человека.  09.11.2026, 14:11:00', 1);
    expect(line).toMatchObject({ id: '504', faction: 'Ballas', staticId: '333' });
  });

  it('терпимый режим: одиночные пробелы, фракция по известным названиям', () => {
    const { line } = parseLine('507 Zed_Q [666] The Ballas Gang Грабит человека. 09.11.2026, 15:00:00', 1, allFactionNames());
    expect(line).toMatchObject({ nick: 'Zed_Q', faction: 'The Ballas Gang', text: 'Грабит человека.' });
  });

  it('мусор Discord пропускается и считается', () => {
    const r = parseLog(fixture, { knownFactions: allFactionNames() });
    expect(r.stats.parsed).toBe(7);
    expect(r.stats.skipped).toBe(5); // Prince — 23:50, message.txt, 8 кб, заголовок, мусор
  });

  it('фильтр фракции (с алиасами) и даты, счётчики проигнорированных', () => {
    const a = analyze(loadFiles([{ name: 'f', text: fixture }]), 'ballas', null);
    expect(a.date).toBe('09.11.2026'); // самая частая
    expect(a.dayLines).toBe(5); // 501, 502, 503, 504 (алиас Ballas), 507
    expect(a.ignoredOtherFaction).toBe(1); // Vagos
    expect(a.ignoredOtherDate).toBe(1); // 08.11
  });

  it('«#65» и «⁠137» оба считаются как дом', () => {
    const a = analyze(loadFiles([{ name: 'f', text: fixture }]), 'ballas', '09.11.2026');
    const d = a.result!.disputed.find((x) => x.ruleId === 'houses')!;
    expect(d.reason).toBe('2 из 30 домов');
  });

  it('повторная загрузка того же файла не удваивает строки', () => {
    const l = loadFiles([{ name: 'a', text: fixture }, { name: 'b', text: fixture }]);
    expect(l.lines.length).toBe(7);
    expect(l.duplicates).toBe(7);
  });
});
