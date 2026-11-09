// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FactionPicker } from '../src/components/FactionPicker';
import { GROUPS, isFactionSelectable } from '../src/config';
import { gov } from '../src/config/gov';
import type { FactionGroup } from '../src/config/types';
import { analyze, GroupDisabledError, loadFiles } from '../src/lib/pipeline';

afterEach(cleanup);

describe('Группа «Гос» заблокирована (enabled: false)', () => {
  it('в конфиге выключена и без правил', () => {
    expect(gov.enabled).toBe(false);
    expect(gov.rules).toEqual([]);
  });

  it('isFactionSelectable: Гос — нет, Crime — да', () => {
    for (const f of gov.factions) expect(isFactionSelectable(f.id)).toBe(false);
    expect(isFactionSelectable('ballas')).toBe(true);
  });

  it('в интерфейсе фракции Гос видны, но disabled, клик не выбирает', () => {
    const onFaction = vi.fn();
    render(<FactionPicker groups={GROUPS} groupId="gov" factionId={null} onGroup={() => {}} onFaction={onFaction} />);
    expect(screen.getByText('Скоро')).toBeTruthy();
    expect(screen.getByText('Правила для гос. структур ещё не добавлены')).toBeTruthy();
    for (const f of gov.factions) {
      const btn = screen.getByTestId(`faction-${f.id}`) as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
      fireEvent.click(btn);
    }
    expect(onFaction).not.toHaveBeenCalled();
  });

  it('расчёт для Гос отклоняется', () => {
    const loaded = loadFiles([{ name: 'x', text: '1\tCop [5]\tLSPD\tчто-то\t09.11.2026, 10:00:00' }]);
    expect(() => analyze(loaded, 'lspd', null)).toThrow(GroupDisabledError);
  });

  it('достаточно поставить enabled: true — фракции становятся доступны', () => {
    const groups: FactionGroup[] = GROUPS.map((g) => (g.id === 'gov' ? { ...g, enabled: true } : g));
    expect(isFactionSelectable('lspd', groups)).toBe(true);
    const onFaction = vi.fn();
    render(<FactionPicker groups={groups} groupId="gov" factionId={null} onGroup={() => {}} onFaction={onFaction} />);
    fireEvent.click(screen.getByTestId('faction-lspd'));
    expect(onFaction).toHaveBeenCalledWith('lspd');
  });
});
