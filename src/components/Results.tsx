import {
  Banknote,
  Car,
  ChevronDown,
  Handshake,
  Landmark,
  Minus,
  Newspaper,
  Plus,
  ShieldCheck,
  Star,
  Swords,
  UserX,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import type { ManualRule } from '../config/types';
import { applyCap, type AchievementResult, type DisputedCase } from '../lib/engine';
import { Evidence } from './Evidence';

const ICON = { size: 16, strokeWidth: 1.5 } as const;

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${(n / 1024).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} КБ`;
  return `${(n / 1024 / 1024).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} МБ`;
}

const fmt = (n: number) => n.toLocaleString('ru-RU');

export function Summary(props: {
  auto: number;
  manual: number;
  adjust: number;
  cap: number;
  date: string;
  fileName: string;
  fileSize: number;
  lines: number;
}) {
  const c = applyCap(props.auto + props.manual + props.adjust, props.cap);
  return (
    <section className="summary">
      <div className="summary-main">
        <div className="small muted">Итого за {props.date}</div>
        <div className="summary-value" data-testid="total">
          {c.capped && (
            <>
              <span className="summary-raw">{c.sum}</span>
              <span className="summary-arrow">→</span>
            </>
          )}
          <span className="summary-shown">{c.total}</span>
          <span className="summary-cap">/ {props.cap} AP</span>
        </div>
        <div className="bar">
          <div className={`bar-fill ${c.capped ? 'is-amber' : ''}`} style={{ width: `${Math.min(100, (c.total / props.cap) * 100)}%` }} />
        </div>
        {c.capped && (
          <div className="cap-note" data-testid="cap-note">
            Лимит: засчитано {c.total}, набрано {c.sum}, урезано {c.cut}
          </div>
        )}
      </div>
      <div className="summary-file small muted">
        <span className="mono summary-fname">{props.fileName}</span>
        <span>
          {formatBytes(props.fileSize)} · {fmt(props.lines)} строк
        </span>
      </div>
    </section>
  );
}

export type ResultTab = 'ach' | 'disp' | 'man';

export function ResultTabs({ tab, onTab, disputed }: { tab: ResultTab; onTab: (t: ResultTab) => void; disputed: number }) {
  const tabs: [ResultTab, string, string][] = [
    ['ach', 'Достижения', 'Достижения'],
    ['disp', `Спорные случаи (${disputed})`, `Спорные (${disputed})`],
    ['man', 'Ручные', 'Ручные'],
  ];
  return (
    <div className="seg seg-tabs" role="tablist" aria-label="Результат">
      {tabs.map(([id, long, short]) => (
        <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'is-on' : ''} onClick={() => onTab(id)}>
          <span className="only-desk">{long}</span>
          <span className="only-mob">{short}</span>
        </button>
      ))}
    </div>
  );
}

const Chevron = ({ open }: { open: boolean }) => (
  <span className={`chev ${open ? 'is-open' : ''}`}>
    <ChevronDown {...ICON} aria-hidden />
  </span>
);

export function AchievementsTable({ items }: { items: AchievementResult[] }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));
  return (
    <div className="panel">
      <div className="trow thead ach-cols">
        <span>Достижение</span>
        <span className="only-desk">За ед.</span>
        <span className="only-desk">Засчитано</span>
        <span className="right">Итого</span>
        <span />
      </div>
      {items.map((a) => {
        const isOpen = !!open[a.id];
        const zero = a.count === 0;
        return (
          <div className="tgroup" key={a.id}>
            <div
              className={`trow ach-cols is-click ${zero ? 'is-zero' : 'is-ok'}`}
              onClick={() => toggle(a.id)}
              role="button"
              tabIndex={0}
              aria-expanded={isOpen}
              title={a.hint}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), toggle(a.id))}
            >
              <span className="tname">
                <span className={`dot ${zero ? 'dot-empty' : 'dot-acc'}`} />
                <span className="tname-text">
                  <span>{a.title}</span>
                  <span className="only-mob small muted">
                    +{a.unitPoints} за ед. · ×{a.count}
                  </span>
                  {a.droppedByOncePerDay ? <span className="small muted">раз в день: отброшено {a.droppedByOncePerDay}</span> : null}
                </span>
              </span>
              <span className="only-desk mono muted">+{a.unitPoints}</span>
              <span className="only-desk mono">{a.count}</span>
              <span className="right mono strong">{zero ? '0' : `+${a.total}`}</span>
              <Chevron open={isOpen} />
            </div>
            {isOpen && <Evidence occurrences={a.occurrences} tone="acc" />}
          </div>
        );
      })}
    </div>
  );
}

export function DisputedTable({ items }: { items: DisputedCase[] }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));
  if (items.length === 0) return <div className="panel panel-pad muted">Спорных случаев нет</div>;
  return (
    <div className="panel">
      <div className="trow thead disp-cols">
        <span>Что было похоже</span>
        <span>Результат</span>
        <span />
      </div>
      {items.map((d) => {
        const isOpen = !!open[d.id];
        return (
          <div className="tgroup" key={d.id}>
            <div
              className="trow disp-cols is-click"
              onClick={() => toggle(d.id)}
              role="button"
              tabIndex={0}
              aria-expanded={isOpen}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), toggle(d.id))}
            >
              <span className="tname">
                <span className="dot dot-amber" />
                {d.title}
              </span>
              <span className="mono amber small">{d.reason}</span>
              <Chevron open={isOpen} />
            </div>
            {isOpen && <Evidence steps={d.steps} tone="amber" />}
          </div>
        );
      })}
    </div>
  );
}

/** Иконки ручных достижений (Lucide) по id правила; для новых правил — звезда. */
const MANUAL_ICONS: Record<string, LucideIcon> = {
  m_raid_defense: ShieldCheck,
  m_kidnap: UserX,
  m_gov_capture: Landmark,
  m_bank: Banknote,
  m_rp_strela: Swords,
  m_driveby: Car,
  m_gov_help: Handshake,
  m_wn: Newspaper,
};

export function ManualGrid({
  rules,
  counts,
  adjust,
  onCount,
  onAdjust,
}: {
  rules: ManualRule[];
  counts: Record<string, number>;
  adjust: number;
  onCount: (id: string, n: number) => void;
  onAdjust: (n: number) => void;
}) {
  return (
    <div className="manual">
      <div className="manual-grid">
        {rules.map((r) => {
          const n = counts[r.id] ?? 0;
          const Icon = MANUAL_ICONS[r.id] ?? Star;
          return (
            <div key={r.id} className={`mcard ${n > 0 ? 'is-on' : ''}`}>
              <span className="mcard-icon">
                <Icon {...ICON} aria-hidden />
              </span>
              <span className="mcard-text">
                <span className="mcard-name">{r.title}</span>
                <span className="mono small muted">+{r.points} AP</span>
              </span>
              <span className="stepper">
                <button className="sq" onClick={() => onCount(r.id, Math.max(0, n - 1))} aria-label={`Уменьшить · ${r.title}`}>
                  <Minus size={14} strokeWidth={1.5} />
                </button>
                <span className="mono stepper-val">{n}</span>
                <button className="sq" onClick={() => onCount(r.id, n + 1)} aria-label={`Увеличить · ${r.title}`}>
                  <Plus size={14} strokeWidth={1.5} />
                </button>
              </span>
            </div>
          );
        })}
      </div>
      <div className="panel panel-pad adjust">
        <div>
          <div>Ручная корректировка</div>
          <div className="small muted">+/− AP к итогу</div>
        </div>
        <span className="stepper">
          <button className="sq" onClick={() => onAdjust(adjust - 1)} aria-label="Уменьшить корректировку">
            <Minus size={14} strokeWidth={1.5} />
          </button>
          <input
            className="mono adjust-val"
            inputMode="numeric"
            value={adjust > 0 ? `+${adjust}` : adjust < 0 ? `−${-adjust}` : '0'}
            onChange={(e) => {
              const v = Number.parseInt(e.target.value.replace('−', '-').replace('+', ''), 10);
              onAdjust(Number.isFinite(v) ? v : 0);
            }}
            aria-label="Корректировка AP"
          />
          <button className="sq" onClick={() => onAdjust(adjust + 1)} aria-label="Увеличить корректировку">
            <Plus size={14} strokeWidth={1.5} />
          </button>
        </span>
      </div>
    </div>
  );
}
