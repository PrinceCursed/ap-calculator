import { ChevronDown, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { isFactionSelectable } from '../config';
import type { Analysis, Coverage, DateCount } from '../lib/pipeline';
import type { LoadInfo } from '../worker/protocol';

const fmt = (n: number) => n.toLocaleString('ru-RU');
const short = (date: string) => date.slice(0, 5);

/** Жёлтая строка над итогом: файл покрывает сутки не полностью. */
export function CoverageWarning({ coverage }: { coverage: Coverage }) {
  if (!coverage.message) return null;
  return (
    <div className="warn-line" role="status" data-testid="coverage-warning">
      <TriangleAlert size={16} strokeWidth={1.5} aria-hidden />
      <span>{coverage.message}</span>
    </div>
  );
}

/** «В файле: 09.11 — 38 строк, 10.11 — 12 строк» с выбором даты. */
export function DateSummary({ dates, current, onPick }: { dates: DateCount[]; current: string | null; onPick: (d: string) => void }) {
  if (dates.length < 2) return null;
  return (
    <div className="date-sum" data-testid="date-summary">
      <span className="muted">В файле:</span>
      {dates.map((d) => (
        <button
          key={d.date}
          className={`chip-btn ${d.date === current ? 'is-on' : ''}`}
          onClick={() => onPick(d.date)}
          aria-pressed={d.date === current}
          title={d.date}
        >
          <span className="mono">{short(d.date)}</span> — {fmt(d.count)} строк
        </button>
      ))}
    </div>
  );
}

/** «В файле найдены: …» с кнопками выбора — когда для выбранных фракции и даты строк нет. */
export function FoundInFile({ analysis, onFaction }: { analysis: Analysis; onFaction: (id: string) => void }) {
  const others = analysis.fileFactions.filter((f) => f.id !== analysis.factionId);
  if (!others.length && analysis.fileDates.length === 0) return null;
  return (
    <div className="found-in" data-testid="found-in-file">
      <span className="muted">В файле найдены:</span>
      {others.map((f) => {
        const can = !!f.id && isFactionSelectable(f.id);
        return (
          <button key={f.name} className="chip-btn" disabled={!can} onClick={() => can && onFaction(f.id!)} title={can ? 'Выбрать фракцию' : 'Фракция недоступна'}>
            {f.name} ({fmt(f.count)} строк)
          </button>
        );
      })}
      {analysis.fileDates.map((d) => (
        <span key={d.date} className="chip-static mono">
          {d.date} ({fmt(d.count)} строк)
        </span>
      ))}
    </div>
  );
}

/** Свёрнутый блок «Диагностика разбора». */
export function Diagnostics({ analysis, info }: { analysis: Analysis | null; info: LoadInfo }) {
  const [open, setOpen] = useState(false);
  const um = analysis?.result?.unmatched;
  return (
    <div className="panel diag" data-testid="diagnostics">
      <button className="diag-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>Диагностика разбора</span>
        <span className="small muted">
          {fmt(info.parsed)} из {fmt(info.total)} строк разобрано
        </span>
        <span className={`chev ${open ? 'is-open' : ''}`}>
          <ChevronDown size={16} strokeWidth={1.5} aria-hidden />
        </span>
      </button>
      {open && (
        <div className="diag-body">
          <dl className="diag-grid">
            <dt>Всего строк в файле</dt>
            <dd>{fmt(info.total)}</dd>
            <dt>Разобрано</dt>
            <dd>{fmt(info.parsed)}</dd>
            <dt>Не разобрано</dt>
            <dd>{fmt(info.skipped)}</dd>
            {info.duplicates > 0 && (
              <>
                <dt>Дубликаты (повторная загрузка)</dt>
                <dd>{fmt(info.duplicates)}</dd>
              </>
            )}
            {analysis && (
              <>
                <dt>Строки других фракций</dt>
                <dd>{fmt(analysis.ignoredOtherFaction)}</dd>
                <dt>Строки других дат</dt>
                <dd>{fmt(analysis.ignoredOtherDate)}</dd>
                <dt>Строки выбранной фракции и даты</dt>
                <dd>{fmt(analysis.dayLines)}</dd>
              </>
            )}
            {um && (
              <>
                <dt>…из них без подходящего достижения</dt>
                <dd>{fmt(um.count)}</dd>
              </>
            )}
            {info.encodings.length > 0 && (
              <>
                <dt>Кодировка</dt>
                <dd>{info.encodings.join(', ')}</dd>
              </>
            )}
          </dl>

          {um && um.top.length > 0 && (
            <DiagList title="Частые строки без достижения" items={um.top.map((t) => `${t.text}… — ${fmt(t.count)}`)} />
          )}
          {info.unparsedExamples.length > 0 && <DiagList title="Примеры неразобранных строк" items={info.unparsedExamples} mono />}
          {analysis && analysis.fileFactions.length > 0 && (
            <DiagList title="Фракции в файле" items={analysis.fileFactions.map((f) => `${f.name} — ${fmt(f.count)}${f.id ? '' : ' (неизвестная)'}`)} />
          )}
          {analysis && analysis.fileDates.length > 0 && (
            <DiagList title="Даты в файле" items={analysis.fileDates.map((d) => `${d.date} — ${fmt(d.count)}`)} mono />
          )}
        </div>
      )}
    </div>
  );
}

function DiagList({ title, items, mono }: { title: string; items: string[]; mono?: boolean }) {
  return (
    <div className="diag-list">
      <div className="kicker">{title.toUpperCase()}</div>
      <ul className={mono ? 'mono' : ''}>
        {items.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  );
}
