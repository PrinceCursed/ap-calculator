import { Calendar, ChevronDown, FileText, FileX, Moon, Sun, Upload } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { findFaction, GROUPS, isFactionSelectable } from './config';
import type { ManualRule } from './config/types';
import type { Analysis } from './lib/pipeline';
import type { FromWorker, LoadInfo, ToWorker } from './worker/protocol';
import { FactionLogo } from './components/FactionLogo';
import { FactionPicker } from './components/FactionPicker';
import {
  AchievementsTable,
  DisputedTable,
  formatBytes,
  ManualGrid,
  ResultTabs,
  Summary,
  type ResultTab,
} from './components/Results';

type Theme = 'light' | 'dark';
type Status = 'idle' | 'loading' | 'ready' | 'error';
const ICON = { size: 16, strokeWidth: 1.5 } as const;
const fmt = (n: number) => n.toLocaleString('ru-RU');

function readStore(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStore(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* localStorage недоступен — не страшно */
  }
}

function initialTheme(): Theme {
  const t = readStore('ap-theme');
  return t === 'light' || t === 'dark' ? t : 'dark'; // в макете по умолчанию тёмная
}

function initialFaction(): string {
  const f = readStore('ap-faction');
  if (f && isFactionSelectable(f)) return f;
  return GROUPS.find((g) => g.enabled)!.factions[0].id;
}

function createWorker() {
  return new Worker(new URL('./worker/apWorker.ts', import.meta.url), { type: 'module' });
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [factionId, setFactionId] = useState<string>(initialFaction);
  const [groupId, setGroupId] = useState(() => findFaction(factionId)!.group.id);
  const [date, setDate] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState({ phase: 'read', done: 0, total: 0 });
  const [pending, setPending] = useState<{ names: string[]; bytes: number } | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [info, setInfo] = useState<LoadInfo | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [tab, setTab] = useState<ResultTab>('ach');
  const [manual, setManual] = useState<Record<string, number>>({});
  const [adjust, setAdjust] = useState(0);
  const [drag, setDrag] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    writeStore('ap-theme', theme);
  }, [theme]);

  const attach = (w: Worker) => {
    w.onmessage = (e: MessageEvent<FromWorker>) => {
      const m = e.data;
      if (m.type === 'progress') {
        setStatus('loading');
        setProgress({ phase: m.phase, done: m.done, total: m.total });
      } else if (m.type === 'loaded') {
        setInfo(m.info);
      } else if (m.type === 'result') {
        setAnalysis(m.analysis);
        setDate(m.analysis.date);
        setError(null);
        setStatus('ready');
      } else if (m.type === 'error') {
        setError({ code: m.code, message: m.message });
        setStatus('error');
      }
    };
    workerRef.current = w;
  };

  useEffect(() => {
    const w = createWorker();
    attach(w);
    return () => w.terminate();
  }, []);

  const send = (m: ToWorker) => workerRef.current?.postMessage(m);

  const found = findFaction(factionId)!;
  const faction = found.faction;
  const activeGroup = found.group;
  const manualRules = useMemo(() => activeGroup.rules.filter((r): r is ManualRule => r.type === 'manual'), [activeGroup]);

  const resetManual = () => {
    setManual({});
    setAdjust(0);
  };

  const chooseFaction = (id: string) => {
    if (!isFactionSelectable(id)) return;
    setFactionId(id);
    writeStore('ap-faction', id);
    setMenuOpen(false);
    resetManual();
    if (info && status !== 'loading' && error?.code !== 'not-logs') send({ type: 'analyze', factionId: id, date });
  };

  const chooseDate = (d: string) => {
    setDate(d);
    resetManual();
    if (info) send({ type: 'analyze', factionId, date: d });
  };

  const loadFiles = (list: FileList | File[] | null) => {
    const files = Array.from(list ?? []);
    if (!files.length || !isFactionSelectable(factionId)) return;
    setPending({ names: files.map((f) => f.name), bytes: files.reduce((s, f) => s + f.size, 0) });
    setStatus('loading');
    setProgress({ phase: 'read', done: 0, total: 0 });
    setAnalysis(null);
    setInfo(null);
    setError(null);
    setTab('ach');
    resetManual();
    send({ type: 'load', files, factionId, date: null });
  };

  const cancel = () => {
    workerRef.current?.terminate();
    attach(createWorker());
    setStatus('idle');
    setPending(null);
    setInfo(null);
    setAnalysis(null);
  };

  const pick = () => inputRef.current?.click();
  const manualSum = manualRules.reduce((s, r) => s + (manual[r.id] ?? 0) * r.points, 0);
  const result = analysis?.result;
  const fileLabel = (info?.files ?? pending?.names ?? []).join(', ');
  const fileBytes = info?.bytes ?? pending?.bytes ?? 0;
  const pct = progress.phase === 'compute' ? 100 : progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  let body: React.ReactNode;
  if (status === 'loading') {
    body = (
      <div className="panel panel-pad loading">
        <div className="loading-head">
          <div className="loading-file">
            <span className="mono">{fileLabel || 'Файл'}</span>
            <span className="small muted">{formatBytes(fileBytes)}</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={cancel}>
            Отменить
          </button>
        </div>
        <div className="bar">
          <div className="bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="loading-foot small muted">
          <span>
            {progress.phase === 'read'
              ? 'Чтение файла…'
              : progress.phase === 'compute'
                ? 'Расчёт достижений…'
                : `Обработано ${fmt(progress.done)} из ${fmt(progress.total)} строк`}
          </span>
          <span className="mono strong-tx">{pct}%</span>
        </div>
      </div>
    );
  } else if (status === 'error') {
    body = (
      <div className="panel panel-pad state-card">
        <div className="state-row">
          <FileX size={24} strokeWidth={1.5} className="muted" aria-hidden />
          <div>
            <div className="state-title">{error?.code === 'not-logs' ? 'Файл не похож на логи' : 'Ошибка обработки'}</div>
            <div className="muted">
              {error?.code === 'not-logs'
                ? `Не найдено ни одной строки нужного формата${info ? ` (строк в файле: ${fmt(info.total)})` : ''}`
                : error?.message}
            </div>
          </div>
        </div>
        <button className="btn btn-outline" onClick={pick}>
          Выбрать другой файл
        </button>
      </div>
    );
  } else if (analysis && !result) {
    body = (
      <div className="panel panel-pad state-card">
        <div>
          <div className="state-title">За выбранную дату для этой фракции строк нет</div>
          <div className="muted">
            {analysis.factionLines ? 'Проверьте дату и фракцию.' : `В логах нет строк фракции «${faction.name}». Проверьте фракцию.`}
          </div>
        </div>
        <div className="small fade">
          Проигнорировано строк других фракций и дат: {fmt(analysis.ignoredOtherFaction + analysis.ignoredOtherDate)}
        </div>
      </div>
    );
  } else if (analysis && result && info) {
    body = (
      <div className="result">
        <Summary
          auto={result.autoSum}
          manual={manualSum}
          adjust={adjust}
          cap={activeGroup.dailyCap}
          date={analysis.date!}
          fileName={fileLabel}
          fileSize={info.bytes}
          lines={info.total}
        />
        <div className="result-tabs">
          <ResultTabs tab={tab} onTab={setTab} disputed={result.disputed.length} />
          {tab === 'ach' && <AchievementsTable items={result.achievements} />}
          {tab === 'disp' && <DisputedTable items={result.disputed} />}
          {tab === 'man' && (
            <ManualGrid
              rules={manualRules}
              counts={manual}
              adjust={adjust}
              onCount={(id, n) => setManual((m) => ({ ...m, [id]: n }))}
              onAdjust={setAdjust}
            />
          )}
          <div className="small fade footnote">
            Проигнорировано строк других фракций и дат: {fmt(analysis.ignoredOtherFaction + analysis.ignoredOtherDate)}
            {' · '}других фракций {fmt(analysis.ignoredOtherFaction)}, других дат {fmt(analysis.ignoredOtherDate)}
            {' · '}пропущено нераспознанных строк: {fmt(info.skipped)}
            {info.duplicates ? ` · дубликатов: ${fmt(info.duplicates)}` : ''}
          </div>
        </div>
      </div>
    );
  } else {
    body = (
      <button className={`dropzone ${drag ? 'is-drag' : ''}`} onClick={pick} type="button">
        <span className="dz-icon">
          <FileText size={26} strokeWidth={1.5} aria-hidden />
        </span>
        <span className="dz-title">Перетащите .txt-файл с логами</span>
        <span className="small muted">Файл обрабатывается в браузере и никуда не отправляется</span>
      </button>
    );
  }

  const ThemeIcon = theme === 'dark' ? Moon : Sun;

  return (
    <div className="shell">
      <aside className={`side ${menuOpen ? 'menu-open' : ''}`}>
        <div className="brand-row">
          <div className="brand">
            <span className="brand-mark">AP</span>AP Calculator
          </div>
          <button
            className="icon-btn only-mob-flex"
            aria-label="Переключить тему"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            <ThemeIcon {...ICON} />
          </button>
        </div>

        <button className="menu-btn only-mob-flex" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
          <FactionLogo key={faction.id} faction={faction} size={28} />
          <span className="grow">{faction.short ?? faction.name}</span>
          <ChevronDown {...ICON} className="muted" aria-hidden />
        </button>

        <div className="side-list">
          <FactionPicker
            groups={GROUPS}
            groupId={groupId}
            factionId={factionId}
            onGroup={setGroupId}
            onFaction={chooseFaction}
            badges={analysis?.badges}
          />
        </div>

        <div className="side-foot only-desk-flex">
          <div className="seg seg-2" role="group" aria-label="Тема">
            <button className={theme === 'dark' ? 'is-on' : ''} onClick={() => setTheme('dark')} aria-pressed={theme === 'dark'}>
              <Moon size={14} strokeWidth={1.5} aria-hidden />
              Тёмная
            </button>
            <button className={theme === 'light' ? 'is-on' : ''} onClick={() => setTheme('light')} aria-pressed={theme === 'light'}>
              <Sun size={14} strokeWidth={1.5} aria-hidden />
              Светлая
            </button>
          </div>
        </div>
      </aside>

      <main
        className="main"
        onDragOver={(e) => {
          e.preventDefault();
          if (status !== 'loading') setDrag(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrag(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (status !== 'loading') loadFiles(e.dataTransfer.files);
        }}
      >
        <header className="head">
          <FactionLogo key={faction.id} faction={faction} size={52} />
          <div className="head-title">
            <div className="kicker kicker-mut">РАСЧЁТ ACTIVITY POINTS</div>
            <h1>{faction.name}</h1>
          </div>
          <label className={`date-pill ${analysis?.date ? '' : 'is-empty'}`}>
            <Calendar {...ICON} aria-hidden className="muted" />
            {analysis?.dates.length ? (
              <select value={date ?? ''} onChange={(e) => chooseDate(e.target.value)} aria-label="Дата" disabled={status === 'loading'}>
                {analysis.dates.map((d) => (
                  <option key={d.date} value={d.date}>
                    {d.date} · {fmt(d.count)} строк
                  </option>
                ))}
              </select>
            ) : (
              <span>Определится из логов</span>
            )}
          </label>
          <button className="btn btn-acc" onClick={pick} disabled={status === 'loading'}>
            <Upload {...ICON} aria-hidden />
            Загрузить логи
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".txt,.log,text/plain"
            multiple
            hidden
            onChange={(e) => {
              loadFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </header>
        {body}
      </main>
    </div>
  );
}
