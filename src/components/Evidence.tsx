import { useState } from 'react';
import type { EvLine, EvStep } from '../lib/engine';

const PAGE = 200;

function Line({ l }: { l: EvLine }) {
  const [s, e] = l.hl ?? [0, 0];
  return (
    <div className="ev-line">
      <span className="ev-no">#{l.lineNo}</span>
      <span className="ev-time">{l.time}</span>
      <span className="ev-nick">
        {l.nick}
        {l.staticId && <span className="ev-static">[{l.staticId}]</span>}
      </span>
      <span className="ev-text">
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
    <div className="ev-step">
      <div className="ev-step-label">{step.label}</div>
      <div className="ev-lines">
        {step.lines.slice(0, shown).map((l) => (
          <Line key={`${l.lineNo}-${l.id}`} l={l} />
        ))}
        {step.lines.length > shown && (
          <button className="link-btn" onClick={() => setShown((n) => n + PAGE)}>
            Показать ещё {Math.min(PAGE, step.lines.length - shown)} из {step.lines.length - shown}
          </button>
        )}
        {step.lines.length === 0 && <div className="muted small">нет строк</div>}
      </div>
    </div>
  );
}

export function Evidence({ steps }: { steps: EvStep[] }) {
  return (
    <div className="evidence">
      {steps.map((s, i) => (
        <Step key={i} step={s} />
      ))}
    </div>
  );
}
