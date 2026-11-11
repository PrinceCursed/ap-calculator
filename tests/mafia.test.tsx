// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { FactionPicker } from '../src/components/FactionPicker';
import { GROUPS, isFactionSelectable } from '../src/config';
import { gangs as crime } from '../src/config/gangs';
import { mafia } from '../src/config/mafia';
import { analyze, GroupDisabledError, loadFiles } from '../src/lib/pipeline';

afterEach(cleanup);

const GANGS = ['ballas', 'marabunta', 'vagos', 'families', 'bloods'];
const MAFIAS = ['rm', 'lcn', 'am', 'mm', 'yak'];

describe('Crime: «Банды» открыты, «Мафии» закрыты', () => {
  it('в конфиге: банды — 5 фракций с правилами, мафии — 5 фракций, enabled: false, без правил', () => {
    expect(crime.factions.map((f) => f.id)).toEqual(GANGS);
    expect(crime.rules.length).toBeGreaterThan(0);
    expect(mafia.factions.map((f) => f.id)).toEqual(MAFIAS);
    expect(mafia.enabled).toBe(false);
    expect(mafia.rules).toEqual([]);
    expect(mafia.tab).toBe('crime');
  });

  it('мафии нельзя выбрать, банды — можно', () => {
    for (const id of MAFIAS) expect(isFactionSelectable(id), id).toBe(false);
    for (const id of GANGS) expect(isFactionSelectable(id), id).toBe(true);
  });

  it('расчёт для мафии отклоняется', () => {
    const loaded = loadFiles([{ name: 'x', text: '1\tDon [5]\tРусская Мафия\tГрабит человека.\t09.11.2026, 10:00:00' }]);
    expect(() => analyze(loaded, 'rm', null)).toThrow(GroupDisabledError);
  });

  it('во вкладке Crime два раздела: «БАНДЫ» и «МАФИИ» со «Скоро»; мафии с замком, без бейджа, подсказка при наведении', () => {
    const onFaction = vi.fn();
    const badges = Object.fromEntries([...GANGS, ...MAFIAS].map((id) => [id, 7]));
    render(<FactionPicker groups={GROUPS} tabId="crime" factionId="ballas" onTab={() => {}} onFaction={onFaction} badges={badges} />);
    const gangs = screen.getByTestId('section-gangs');
    const maf = screen.getByTestId('section-mafia');
    expect(gangs.textContent).toContain('БАНДЫ');
    expect(gangs.textContent).not.toContain('Скоро');
    expect(maf.textContent).toContain('МАФИИ');
    expect(maf.querySelectorAll('.soon')).toHaveLength(1);
    for (const id of MAFIAS) {
      const b = screen.getByTestId(`faction-${id}`);
      expect(b.getAttribute('aria-disabled')).toBe('true');
      expect(b.querySelector('.fitem-badge')).toBeNull();
      expect(b.querySelector('svg.lucide-lock')).not.toBeNull();
      fireEvent.click(b);
    }
    expect(onFaction).not.toHaveBeenCalled();
    fireEvent.mouseEnter(screen.getByTestId('faction-yak'));
    expect(screen.getByRole('tooltip').textContent).toBe('Правила для мафий ещё не добавлены');
    fireEvent.click(screen.getByTestId('faction-vagos'));
    expect(onFaction).toHaveBeenCalledWith('vagos');
    expect(screen.getByTestId('faction-vagos').querySelector('.fitem-badge')!.textContent).toBe('7');
  });

  it('вкладка Crime без замка (банды открыты), вкладка Гос — с замком', () => {
    render(<FactionPicker groups={GROUPS} tabId="crime" factionId={null} onTab={() => {}} onFaction={() => {}} />);
    const [crimeTab, govTab] = screen.getAllByRole('tab');
    expect(crimeTab.querySelector('svg')).toBeNull();
    expect(govTab.querySelector('svg')).not.toBeNull();
  });
});

describe('Сохранённая фракция-мафия сбрасывается', () => {
  beforeEach(() => {
    // Воркер в jsdom не нужен — заглушка.
    class FakeWorker {
      onmessage: unknown = null;
      postMessage() {}
      terminate() {}
    }
    vi.stubGlobal('Worker', FakeWorker);
  });

  it('если в localStorage мафия — выбирается первая банда и она сохраняется', async () => {
    localStorage.setItem('ap-faction', 'rm');
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('The Ballas Gang');
    await waitFor(() => expect(localStorage.getItem('ap-faction')).toBe('ballas'));
  });

  it('если в localStorage банда — она и остаётся', () => {
    localStorage.setItem('ap-faction', 'vagos');
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Los Santos Vagos');
  });
});
