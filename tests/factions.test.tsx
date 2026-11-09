// @vitest-environment jsdom
import { existsSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FactionLogo, monogram } from '../src/components/FactionLogo';
import { GROUPS } from '../src/config';
import { buildFactionResolver } from '../src/lib/parser';

afterEach(cleanup);

const all = GROUPS.flatMap((g) => g.factions);
const resolve = buildFactionResolver(all);

describe('Алиасы фракций', () => {
  it.each([
    ['LS Army', 'army'], ['National Guard', 'army'], ['NG', 'army'], ['  national   GUARD ', 'army'],
    ['Medical Services', 'ems'], ['Emergency Medical Service', 'ems'], ['EMS', 'ems'],
    ['Федеральная тюрьма', 'saspa'], ['San Andreas State Prison Authority', 'saspa'], ['SASPA', 'saspa'],
    ['Мэрия ЛС', 'gov'], ['Government', 'gov'],
    ['The Ballas Gang', 'ballas'], ['East Side Ballas', 'ballas'], ['Ballas', 'ballas'],
    ['Русская Мафия', 'rm'], ['русская мафия', 'rm'], ['РУССКАЯ  МАФИЯ', 'rm'],
    ['Итальянская мафия', 'lcn'], ['Армянская мафия', 'am'], ['Мексиканская мафия', 'mm'], ['Японская мафия', 'yak'],
    ['Los Santos Vagos', 'vagos'], ['Los Santos Sheriff', 'lssd'],
  ])('%s → %s', (name, id) => expect(resolve(name)).toBe(id));

  it('алиасы не пересекаются между фракциями', () => {
    const seen = new Map<string, string>();
    for (const f of all)
      for (const a of [f.name, ...f.aliases]) {
        const k = a.toLowerCase().replace(/\s+/g, ' ').trim();
        expect(seen.get(k) ?? f.id, `«${a}» у ${f.id} и ${seen.get(k)}`).toBe(f.id);
        seen.set(k, f.id);
      }
  });
});

describe('Логотипы', () => {
  it('для каждой фракции есть public/factions/<slug>.webp', () => {
    for (const f of all) expect(existsSync(resolvePath(process.cwd(), `public/factions/${f.logo ?? f.id}.webp`)), f.id).toBe(true);
  });

  it('монограммы', () => {
    expect(monogram('The Ballas Gang')).toBe('BG');
    expect(monogram('LSPD')).toBe('LS');
    expect(monogram('Русская Мафия')).toBe('РМ');
  });

  it('нет картинки → монограмма', () => {
    const { container } = render(<FactionLogo faction={{ id: 'nope', name: 'Los Santos Vagos', aliases: [] }} />);
    fireEvent.error(container.querySelector('img')!);
    expect(screen.getByTestId('mono-nope').textContent).toBe('LS');
  });
});
