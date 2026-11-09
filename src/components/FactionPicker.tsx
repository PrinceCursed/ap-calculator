import { Lock, Search } from 'lucide-react';
import { useState } from 'react';
import type { FactionGroup } from '../config/types';
import { FactionLogo } from './FactionLogo';

interface Props {
  groups: FactionGroup[];
  groupId: string;
  factionId: string | null;
  onGroup: (id: string) => void;
  onFaction: (id: string) => void;
  /** AP фракций за день (после загрузки логов) — бейдж справа. */
  badges?: Record<string, number>;
}

const ICON = { size: 16, strokeWidth: 1.5 } as const;

/**
 * Поиск, сегментированный переключатель групп и список фракций.
 * Фракции заблокированной группы (enabled: false) видны, но недоступны: замок + подсказка при наведении.
 */
export function FactionPicker({ groups, groupId, factionId, onGroup, onFaction, badges }: Props) {
  const [q, setQ] = useState('');
  const [tip, setTip] = useState<string | null>(null);
  const group = groups.find((g) => g.id === groupId) ?? groups[0];
  const needle = q.trim().toLowerCase();
  const items = group.factions.filter(
    (f) => !needle || [f.name, f.short ?? '', ...f.aliases].some((n) => n.toLowerCase().includes(needle)),
  );

  return (
    <div className="picker">
      <label className="search">
        <Search {...ICON} aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск фракции" aria-label="Поиск фракции" />
      </label>

      <div className="seg seg-2" role="tablist" aria-label="Группа фракций">
        {groups.map((g) => (
          <button
            key={g.id}
            role="tab"
            aria-selected={g.id === group.id}
            className={g.id === group.id ? 'is-on' : ''}
            onClick={() => onGroup(g.id)}
          >
            {!g.enabled && <Lock size={12} strokeWidth={1.5} aria-hidden />}
            {g.title}
          </button>
        ))}
      </div>

      <div className="flist" role="radiogroup" aria-label="Фракция">
        <div className="flist-label">
          <span>{group.id === 'crime' ? 'CRIME' : group.title === 'Гос' ? 'ГОС. СТРУКТУРЫ' : group.title.toUpperCase()}</span>
          {!group.enabled && <span className="soon">Скоро</span>}
        </div>
        {items.map((f) => {
          const locked = !group.enabled;
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
                  {group.disabledHint ?? 'Группа пока недоступна'}
                </span>
              )}
            </button>
          );
        })}
        {items.length === 0 && <div className="flist-empty">Ничего не найдено</div>}
      </div>
    </div>
  );
}
