import type { FactionGroup } from '../config/types';
import { LockIcon } from './icons';

interface Props {
  groups: FactionGroup[];
  groupId: string;
  factionId: string | null;
  onGroup: (id: string) => void;
  onFaction: (id: string) => void;
}

/** Вкладки групп и список фракций. Фракции заблокированной группы (enabled: false) видны, но disabled. */
export function FactionPicker({ groups, groupId, factionId, onGroup, onFaction }: Props) {
  const group = groups.find((g) => g.id === groupId) ?? groups[0];
  return (
    <div className="picker">
      <div className="tabs" role="tablist" aria-label="Группа фракций">
        {groups.map((g) => (
          <button
            key={g.id}
            role="tab"
            aria-selected={g.id === group.id}
            className={`tab ${g.id === group.id ? 'is-active' : ''} ${g.enabled ? '' : 'is-locked'}`}
            onClick={() => onGroup(g.id)}
            title={g.enabled ? undefined : g.disabledHint}
          >
            {!g.enabled && <LockIcon />}
            {g.title}
            {!g.enabled && <span className="badge badge-soon">Скоро</span>}
          </button>
        ))}
      </div>

      {!group.enabled && (
        <div className="locked-hint" role="note">
          <LockIcon /> {group.disabledHint ?? 'Группа пока недоступна'}
        </div>
      )}

      <div className="faction-list" role="radiogroup" aria-label="Фракция">
        {group.factions.map((f) => {
          const disabled = !group.enabled;
          return (
            <button
              key={f.id}
              role="radio"
              aria-checked={factionId === f.id}
              disabled={disabled}
              data-testid={`faction-${f.id}`}
              className={`faction ${factionId === f.id ? 'is-selected' : ''}`}
              onClick={() => !disabled && onFaction(f.id)}
              title={disabled ? group.disabledHint : undefined}
            >
              <span className="faction-dot" />
              <span className="faction-name">{f.name}</span>
              {disabled && (
                <span className="faction-lock">
                  <LockIcon />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
