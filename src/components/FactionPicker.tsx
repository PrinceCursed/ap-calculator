import { Lock, Search } from 'lucide-react';
import { useState } from 'react';
import { TABS } from '../config';
import type { FactionGroup } from '../config/types';
import { FactionLogo } from './FactionLogo';

interface Props {
  groups: FactionGroup[];
  /** Активная вкладка («crime» | «gov»). */
  tabId: string;
  factionId: string | null;
  onTab: (id: string) => void;
  onFaction: (id: string) => void;
  /** AP фракций за день (после загрузки логов) — бейдж справа. */
  badges?: Record<string, number>;
  tabs?: { id: string; title: string }[];
}

const ICON = { size: 16, strokeWidth: 1.5 } as const;

/**
 * Поиск, сегментированный переключатель вкладок и разделы фракций («Банды», «Мафии», «Гос. структуры»).
 * Фракции закрытого раздела (enabled: false) видны, но недоступны: замок + подсказка при наведении.
 */
export function FactionPicker({ groups, tabId, factionId, onTab, onFaction, badges, tabs = TABS }: Props) {
  const [q, setQ] = useState('');
  const [tip, setTip] = useState<string | null>(null);
  const needle = q.trim().toLowerCase();
  const sections = groups.filter((g) => g.tab === tabId);
  let shown = 0;

  return (
    <div className="picker">
      <label className="search">
        <Search {...ICON} aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск фракции" aria-label="Поиск фракции" />
      </label>

      <div className="seg seg-2" role="tablist" aria-label="Группа фракций">
        {tabs.map((t) => {
          const locked = groups.filter((g) => g.tab === t.id).every((g) => !g.enabled);
          return (
            <button key={t.id} role="tab" aria-selected={t.id === tabId} className={t.id === tabId ? 'is-on' : ''} onClick={() => onTab(t.id)}>
              {locked && <Lock size={12} strokeWidth={1.5} aria-hidden />}
              {t.title}
            </button>
          );
        })}
      </div>

      <div className="flist" role="radiogroup" aria-label="Фракция">
        {sections.map((group) => {
          const items = group.factions.filter(
            (f) => !needle || [f.name, f.short ?? '', ...f.aliases].some((n) => n.toLowerCase().includes(needle)),
          );
          if (!items.length) return null;
          shown += items.length;
          const locked = !group.enabled;
          return (
            <div className="fsection" key={group.id} data-testid={`section-${group.id}`}>
              <div className="flist-label">
                <span>{group.title.toUpperCase()}</span>
                {locked && <span className="soon">Скоро</span>}
              </div>
              {items.map((f) => {
                const selected = factionId === f.id;
                const badge = badges?.[f.id];
                return (
                  <button
                    key={f.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-disabled={locked || undefined}
                    aria-label={locked ? `${f.name} · правила ещё не добавлены` : f.name}
                    data-testid={`faction-${f.id}`}
                    className={`fitem ${selected ? 'is-selected' : ''} ${locked ? 'is-locked' : ''}`}
                    onClick={() => !locked && onFaction(f.id)}
                    onMouseEnter={() => locked && setTip(f.id)}
                    onMouseLeave={() => setTip(null)}
                    onFocus={() => locked && setTip(f.id)}
                    onBlur={() => setTip(null)}
                  >
                    <FactionLogo faction={f} size={32} />
                    <span className="fitem-name">{f.short ?? f.name}</span>
                    {!locked && badge !== undefined && <span className="fitem-badge">{badge}</span>}
                    {locked && <Lock size={14} strokeWidth={1.5} aria-hidden />}
                    {locked && tip === f.id && (
                      <span className="tooltip" role="tooltip">
                        {group.disabledHint ?? 'Раздел пока недоступен'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
        {shown === 0 && <div className="flist-empty">Ничего не найдено</div>}
      </div>
    </div>
  );
}
