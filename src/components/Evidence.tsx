import { useState } from 'react';
import type { EvLine, EvStep, Occurrence } from '../lib/engine';

const PAGE = 200;

function Line({ l }: { l: EvLine }) {
  const [s, e] = l.hl ?? [0, 0];
  return (
    <div className="ev-line">
      <span className="ev-no">{l.lineNo}</span>
      <span className="ev-time">{l.time}</span>
      <span className="ev-text">
        <span className="ev-nick">
          {l.nick}
          {l.staticId ? ` [${l.staticId}]` : ''}
        </span>{' '}
        {l.hl ? (
          <>
            {l.text.slice(0, s)}
            <mark>{l.text.slice(s, e)}</mark>
            {l.text.slice(e)}
          </>
        ) : (
          l.text
        )}
      </span>
    </div>
  );
}

function Step({ step }: { step: EvStep }) {
  const [shown, setShown] = useState(PAGE);
  return (
    <div className="ev-group">
      {step.label && <div className="ev-title">{step.label}</div>}
      <div className="ev-box">
        {step.lines.slice(0, shown).map((l) => (
          <Line key={`${l.lineNo}-${l.id}`} l={l} />
        ))}
        {step.lines.length > shown && (
          <button className="link-btn" onClick={() => setShown((n) => n + PAGE)}>
            … ещё {step.lines.length - shown} строк — показать {Math.min(PAGE, step.lines.length - shown)}
          </button>
        )}
        {step.lines.length === 0 && <div className="ev-empty">нет строк</div>}
      </div>
    </div>
  );
}

/** Раскрытая строка: «ДОКАЗАТЕЛЬСТВА» и группы строк логов по шагам. */
export function Evidence({ occurrences, steps, tone }: { occurrences?: Occurrence[]; steps?: EvStep[]; tone: 'acc' | 'amber' }) {
  return (
    <div className={`evidence tone-${tone}`}>
      <div className="kicker">ДОКАЗАТЕЛЬСТВА</div>
      {steps?.map((s, i) => <Step key={i} step={s} />)}
      {occurrences?.map((o, i) => (
        <div className="ev-occ" key={i}>
          {occurrences.length > 1 && (
            <div className="ev-occ-label">
              <span className="ev-occ-no">{i + 1}</span>
              {o.label}
            </div>
          )}
          {o.steps.map((s, j) => (
            <Step key={j} step={s} />
          ))}
        </div>
      ))}
      {occurrences && occurrences.length === 0 && <div className="muted">Выполнений не найдено</div>}
    </div>
  );
}
