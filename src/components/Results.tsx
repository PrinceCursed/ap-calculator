import { Fragment, useState } from 'react';
import type { ManualRule } from '../config/types';
import { applyCap, type AchievementResult, type DisputedCase } from '../lib/engine';
import { Evidence } from './Evidence';
import { ChevronIcon } from './icons';

export function Summary({ auto, manual, adjust, cap }: { auto: number; manual: number; adjust: number; cap: number }) {
  const c = applyCap(auto + manual + adjust, cap);
  return (
    <section className="card summary">
      <div className="summary-main">
        <div className="summary-label">Итого AP за день</div>
        <div className="summary-value" data-testid="total">
          {c.capped ? (
            <>
              <span className="summary-raw">{c.sum}</span>
              <span className="summary-arrow">→</span>
              <span>{c.total}</span>
            </>
          ) : (
            c.total
          )}
          <span className="summary-cap">/ {cap}</span>
        </div>
        {c.capped && (
          <div className="cap-note" data-testid="cap-note">
            лимит: засчитано {c.total}, набрано {c.sum}, урезано {c.cut}
          </div>
        )}
      </div>
      <div className="summary-parts">
        <div>
          <span className="muted">Автоматические</span>
          <b>{auto}</b>
        </div>
        <div>
          <span className="muted">Ручные</span>
          <b>{manual}</b>
        </div>
        <div>
          <span className="muted">Корректировка</span>
          <b>{adjust > 0 ? `+${adjust}` : adjust}</b>
        </div>
      </div>
      <div className="meter" aria-hidden>
        <div className="meter-fill" style={{ width: `${Math.min(100, (c.total / cap) * 100)}%` }} />
      </div>
    </section>
  );
}

export function AchievementsTable({ items }: { items: AchievementResult[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section className="card">
      <div className="card-head">
        <h2>Достижения</h2>
        <span className="muted small">Клик по строке — строки логов-доказательства</span>
      </div>
      <div className="table-wrap">
        <table className="ach-table">
          <thead>
            <tr>
              <th>Достижение</th>
              <th className="num">AP за ед.</th>
              <th className="num">Засчитано</th>
              <th className="num">Итого</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => {
              const isOpen = open === a.id;
              const ok = a.count > 0;
              return (
                <Fragment key={a.id}>
                  <tr
                    className={`ach-row ${ok ? 'is-ok' : 'is-zero'} ${isOpen ? 'is-open' : ''}`}
                    onClick={() => ok && setOpen(isOpen ? null : a.id)}
                    aria-expanded={ok ? isOpen : undefined}
                    tabIndex={ok ? 0 : -1}
                    onKeyDown={(e) => ok && (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setOpen(isOpen ? null : a.id))}
                  >
                    <td>
                      <span className="ach-title">
                        {ok ? <ChevronIcon open={isOpen} /> : <span className="chev-space" />}
                        {a.title}
                      </span>
                      {a.hint && <span className="ach-hint">{a.hint}</span>}
                      {a.droppedByOncePerDay ? <span className="ach-hint">раз в день: отброшено {a.droppedByOncePerDay}</span> : null}
                    </td>
                    <td className="num">{a.unitPoints}</td>
                    <td className="num">{a.count}</td>
                    <td className="num total-cell">{a.total}</td>
                  </tr>
                  {isOpen && (
                    <tr className="ach-detail">
                      <td colSpan={4}>
                        {a.occurrences.map((o, i) => (
                          <div className="occ" key={i}>
                            <div className="occ-label">
                              <span className="occ-index">{i + 1}</span>
                              {o.label}
                            </div>
                            <Evidence steps={o.steps} />
                          </div>
                        ))}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function DisputedList({ items }: { items: DisputedCase[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section className="card">
      <div className="card-head">
        <h2>Спорные случаи</h2>
        <span className="muted small">Похоже на достижение, но условие не выполнено</span>
      </div>
      {items.length === 0 ? (
        <div className="muted pad">Спорных случаев нет</div>
      ) : (
        <ul className="disputed">
          {items.map((d) => {
            const isOpen = open === d.id;
            return (
              <li key={d.id} className={isOpen ? 'is-open' : ''}>
                <button className="disputed-head" onClick={() => setOpen(isOpen ? null : d.id)} aria-expanded={isOpen}>
                  <ChevronIcon open={isOpen} />
                  <span className="disputed-title">{d.title}</span>
                  <span className="badge badge-warn">{d.reason}</span>
                </button>
                {isOpen && (
                  <div className="disputed-body">
                    <Evidence steps={d.steps} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function ManualPanel({
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
    <section className="card">
      <div className="card-head">
        <h2>Ручные достижения</h2>
        <span className="muted small">Не определяются по логам — отметьте вручную</span>
      </div>
      <ul className="manual">
        {rules.map((r) => {
          const n = counts[r.id] ?? 0;
          return (
            <li key={r.id} className={n > 0 ? 'is-on' : ''}>
              <label className="manual-title">
                <input type="checkbox" checked={n > 0} onChange={(e) => onCount(r.id, e.target.checked ? Math.max(1, n) : 0)} />
                <span>{r.title}</span>
              </label>
              <span className="manual-pts">{r.points} AP</span>
              <div className="stepper">
                <button onClick={() => onCount(r.id, Math.max(0, n - 1))} aria-label={`Уменьшить «${r.title}»`}>
                  −
                </button>
                <span className="stepper-val">{n}</span>
                <button onClick={() => onCount(r.id, n + 1)} aria-label={`Увеличить «${r.title}»`}>
                  +
                </button>
              </div>
              <span className="manual-total">{n * r.points}</span>
            </li>
          );
        })}
        <li className="manual-adjust">
          <span className="manual-title">Ручная корректировка «+/− AP»</span>
          <div className="stepper">
            <button onClick={() => onAdjust(adjust - 1)} aria-label="Минус 1 AP">
              −
            </button>
            <input
              type="number"
              className="stepper-input"
              value={adjust}
              onChange={(e) => onAdjust(Number.parseInt(e.target.value || '0', 10) || 0)}
              aria-label="Корректировка AP"
            />
            <button onClick={() => onAdjust(adjust + 1)} aria-label="Плюс 1 AP">
              +
            </button>
          </div>
        </li>
      </ul>
    </section>
  );
}
