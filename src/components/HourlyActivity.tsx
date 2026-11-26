import { useRef, useState } from 'react';
import { plural } from '../lib/engine';

const formatHour = (i: number) => `${String(i).padStart(2, '0')}:00`;
const label = (n: number) => `${n.toLocaleString('ru-RU')} ${plural(n, ['строка', 'строки', 'строк'])}`;

export function HourlyActivity({ counts }: { counts: number[] }) {
  const peak = Math.max(1, ...counts);
  const [picked, setPicked] = useState<number | null>(null);
  const active = picked ?? Math.max(0, counts.indexOf(peak));
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <section className="activity panel" aria-label="Строки лога по часам">
      <div className="activity-head">
        <strong>Строки лога по часам</strong>
        <output>{formatHour(active)} · {label(counts[active])}</output>
      </div>
      <div className="hours" role="group" aria-label="Выбор часа">
        {counts.map((count, i) => (
          <button
            type="button"
            className="hour"
            key={i}
            ref={(button) => { buttons.current[i] = button; }}
            aria-label={`${formatHour(i)} · ${label(count)}`}
            aria-pressed={i === active}
            tabIndex={i === active ? 0 : -1}
            onClick={() => setPicked(i)}
            onKeyDown={(event) => {
              const next = {
                ArrowLeft: Math.max(0, i - 1),
                ArrowRight: Math.min(counts.length - 1, i + 1),
                Home: 0,
                End: counts.length - 1,
              }[event.key];
              if (next === undefined) return;
              event.preventDefault();
              setPicked(next);
              buttons.current[next]?.focus();
            }}
          >
            <span style={{ height: `${count / peak * 100}%` }} />
          </button>
        ))}
      </div>
      <div className="hour-labels" aria-hidden="true"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:59</span></div>
    </section>
  );
}
