import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analyze, loadFiles } from '../src/lib/pipeline';

const text = readFileSync(new URL('../samples/sample-ballas.txt', import.meta.url), 'utf8');

describe('samples/sample-ballas.txt целиком', () => {
  const a = analyze(loadFiles([{ name: 's', text }]), 'ballas', null);
  const get = (id: string) => a.result!.achievements.find((x) => x.id === id)!;
  it('дата по умолчанию — самая частая', () => expect(a.date).toBe('09.11.2026'));
  it('счётчики проигнорированных', () => {
    expect(a.ignoredOtherFaction).toBe(40);
    expect(a.ignoredOtherDate).toBe(15);
  });
  it('достижения', () => {
    expect(get('train').count).toBe(1);
    expect(get('ng').count).toBe(1);
    expect(get('fz').count).toBe(1);
    expect(get('ems').count).toBe(1);
    expect(get('graffiti').count).toBe(2);
    expect(get('gunshop_success').count).toBe(1);
    expect(get('gunshop_attack').count).toBe(1);
    expect(get('houses').count).toBe(1);
    expect(get('robbery')).toMatchObject({ count: 2, total: 4 });
    expect(get('airdrop').count).toBe(1);
    expect(get('racket').count).toBe(1);
    expect(get('flag').count).toBe(1);
    expect(get('blackmarket').count).toBe(0);
    // 3+2+2+2+4+3+2+2+4+4+2+2 = 32 → лимит 30
    expect(a.result!.autoSum).toBe(32);
  });
  it('спорные случаи с цифрами', () => {
    const reasons = a.result!.disputed.map((d) => `${d.title}: ${d.reason}`);
    expect(reasons).toEqual(
      expect.arrayContaining([
        'Поезд: 6 из 10 участников (не хватило 4)',
        'Граффити-вары: 1 из 3 побед (не хватило 2)',
        'Ограбление домов: 13 из 20 домов (не хватило 7)',
        'Угонки: 12 из 15 машин (не хватило 3)',
        'Ограбление игроков: 1 из 10 ограблений (не хватило 9)',
        'Чёрный рынок: 8 из 10 участников (не хватило 2)',
      ]),
    );
  });
});
