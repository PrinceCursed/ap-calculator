import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { findFaction, GROUPS, isFactionSelectable } from './config';
import type { ManualRule } from './config/types';
import type { Analysis } from './lib/pipeline';
import type { FromWorker, LoadInfo, ToWorker } from './worker/protocol';
import { FactionLogo } from './components/FactionLogo';
import { FactionPicker } from './components/FactionPicker';
import { AchievementsTable, DisputedList, ManualPanel, Summary } from './components/Results';
import { FileIcon, LockIcon, MoonIcon, ShieldIcon, SunIcon, UploadIcon } from './components/icons';

type Theme = 'light' | 'dark';
type Status = 'idle' | 'loading' | 'ready' | 'error';

const PHASE: Record<string, string> = { read: 'Чтение файла', parse: 'Разбор строк', compute: 'Расчёт достижений' };

function initialTheme(): Theme {
  try {
    const t = localStorage.getItem('ap-theme');
    if (t === 'light' || t === 'dark') return t;
  } catch {
    /* localStorage недоступен */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [groupId, setGroupId] = useState(GROUPS[0].id);
  const [factionId, setFactionId] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState<{ phase: string; pct: number }>({ phase: 'read', pct: 0 });
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [info, setInfo] = useState<LoadInfo | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [ms, setMs] = useState(0);
  const [manual, setManual] = useState<Record<string, number>>({});
  const [adjust, setAdjust] = useState(0);
  const [drag, setDrag] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('ap-theme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  useEffect(() => {
    const w = new Worker(new URL('./worker/apWorker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<FromWorker>) => {
      const m = e.data;
      if (m.type === 'progress') {
        setStatus('loading');
        setProgress({ phase: m.phase, pct: m.total ? Math.round((m.done / m.total) * 100) : 0 });
      } else if (m.type === 'loaded') {
        setInfo(m.info);
      } else if (m.type === 'result') {
        setAnalysis(m.analysis);
        setDate(m.analysis.date);
        setMs(m.ms);
        setError(null);
        setStatus('ready');
      } else if (m.type === 'error') {
        setError({ code: m.code, message: m.message });
        setStatus('error');
      }
    };
    workerRef.current = w;
    return () => w.terminate();
  }, []);

  const send = (m: ToWorker) => workerRef.current?.postMessage(m);

  const group = GROUPS.find((g) => g.id === groupId)!;
  const faction = factionId ? findFaction(factionId)?.faction : undefined;
  const activeGroup = factionId ? findFaction(factionId)!.group : group;
  const manualRules = useMemo(() => activeGroup.rules.filter((r): r is ManualRule => r.type === 'manual'), [activeGroup]);

  const resetManual = () => {
    setManual({});
    setAdjust(0);
  };

  const chooseFaction = (id: string) => {
    if (!isFactionSelectable(id)) return;
    setFactionId(id);
    resetManual();
    if (info) send({ type: 'analyze', factionId: id, date });
  };

  const chooseDate = (d: string | null) => {
    setDate(d);
    resetManual();
    if (info && factionId) send({ type: 'analyze', factionId, date: d });
  };

  const loadFiles = useCallback(
    (list: FileList | File[] | null) => {
      const files = Array.from(list ?? []);
      if (!files.length || !factionId || !isFactionSelectable(factionId)) return;
      setStatus('loading');
      setProgress({ phase: 'read', pct: 0 });
      setAnalysis(null);
      setError(null);
      resetManual();
      send({ type: 'load', files, factionId, date: null });
    },
    [factionId],
  );

  const manualSum = manualRules.reduce((s, r) => s + (manual[r.id] ?? 0) * r.points, 0);
  const canUpload = !!factionId && group.enabled && status !== 'loading';
  const result = analysis?.result;

  let main: React.ReactNode;
  if (!group.enabled) {
    main = (
      <div className="state state-locked">
        <LockIcon />
        <h2>Группа «{group.title}» скоро появится</h2>
        <p>{group.disabledHint}</p>
        <span className="badge badge-soon">Скоро</span>
      </div>
    );
  } else if (status === 'loading') {
    main = (
      <div className="state">
        <h2>{PHASE[progress.phase] ?? 'Обработка'}…</h2>
        <div className="progress" role="progressbar" aria-valuenow={progress.pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="progress-fill" style={{ width: `${progress.phase === 'compute' ? 100 : progress.pct}%` }} />
        </div>
        <p className="muted">{progress.phase === 'compute' ? 'Почти готово' : `${progress.pct}%`}</p>
      </div>
    );
  } else if (status === 'error' && error?.code === 'not-logs') {
    main = (
      <div className="state state-warn">
        <h2>Файл не похож на логи</h2>
        <p className="muted">
          Не найдено ни одной строки формата «ID · Ник [статик] · Фракция · Событие · ДД.ММ.ГГГГ, ЧЧ:ММ:СС».
          {info ? ` Строк в файле: ${info.total}, все пропущены.` : ''}
        </p>
      </div>
    );
  } else if (status === 'error') {
    main = (
      <div className="state state-warn">
        <h2>Ошибка обработки</h2>
        <p className="muted">{error?.message}</p>
      </div>
    );
  } else if (!factionId) {
    main = (
      <div className="state">
        <h2>Выберите фракцию</h2>
        <p className="muted">Затем загрузите .txt-логи фракции — расчёт идёт прямо в браузере.</p>
      </div>
    );
  } else if (!analysis) {
    main = (
      <div className="state">
        <UploadIcon />
        <h2>Загрузите логи «{faction?.name}»</h2>
        <p className="muted">Перетащите один или несколько .txt-файлов в область слева или нажмите «Выбрать файлы».</p>
      </div>
    );
  } else if (!result) {
    main = (
      <div className="state state-warn">
        <h2>Для этой фракции и даты строк нет</h2>
        <p className="muted">
          {analysis.factionLines
            ? `У «${faction?.name}» есть строки за другие даты — выберите дату слева.`
            : `В загруженных логах нет строк фракции «${faction?.name}». Проигнорировано строк других фракций: ${analysis.ignoredOtherFaction}.`}
        </p>
      </div>
    );
  } else {
    main = (
      <>
        <Summary auto={result.autoSum} manual={manualSum} adjust={adjust} cap={activeGroup.dailyCap} />
        <AchievementsTable items={result.achievements} />
        <DisputedList items={result.disputed} />
        <ManualPanel
          rules={manualRules}
          counts={manual}
          adjust={adjust}
          onCount={(id, n) => setManual((m) => ({ ...m, [id]: n }))}
          onAdjust={setAdjust}
        />
      </>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">AP</span>
          <div>
            <div className="brand-title">AP Calculator</div>
            <div className="brand-sub">GTA 5 RP · Activity Points фракций</div>
          </div>
        </div>
        <div className="topbar-right">
          <span className="chip" title="Файлы обрабатываются локально в вашем браузере и никуда не отправляются">
            <ShieldIcon /> Логи не покидают браузер
          </span>
          <button
            className="icon-btn"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
            title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <section className="card">
            <div className="step-title">
              <span className="step-no">1</span> Фракция
            </div>
            <FactionPicker groups={GROUPS} groupId={groupId} factionId={factionId} onGroup={setGroupId} onFaction={chooseFaction} />
          </section>

          <section className={`card ${!group.enabled ? 'is-disabled' : ''}`}>
            <div className="step-title">
              <span className="step-no">2</span> Логи
            </div>
            <div
              className={`dropzone ${drag ? 'is-drag' : ''} ${canUpload ? '' : 'is-disabled'}`}
              onDragOver={(e) => {
                e.preventDefault();
                if (canUpload) setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                if (canUpload) loadFiles(e.dataTransfer.files);
              }}
              onClick={() => canUpload && inputRef.current?.click()}
              role="button"
              tabIndex={canUpload ? 0 : -1}
              aria-disabled={!canUpload}
              onKeyDown={(e) => canUpload && (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
            >
              <UploadIcon />
              <div>
                <b>{canUpload ? 'Выбрать файлы' : !group.enabled ? 'Недоступно' : factionId ? 'Обработка…' : 'Сначала выберите фракцию'}</b>
                <div className="muted small">.txt, можно несколько, до десятков тысяч строк</div>
              </div>
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
            </div>
            {info && (
              <div className="files">
                {info.files.map((f, i) => (
                  <div key={i} className="file-row">
                    <FileIcon /> {f}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className={`card ${!info || !group.enabled ? 'is-disabled' : ''}`}>
            <div className="step-title">
              <span className="step-no">3</span> Дата
            </div>
            <select
              className="select"
              value={date ?? ''}
              disabled={!analysis?.dates.length || status === 'loading'}
              onChange={(e) => chooseDate(e.target.value || null)}
              aria-label="Дата"
            >
              {!analysis?.dates.length && <option value="">Авто — самая частая в файле</option>}
              {analysis?.dates.map((d) => (
                <option key={d.date} value={d.date}>
                  {d.date} — {d.count} строк
                </option>
              ))}
            </select>
            <div className="muted small">Календарные сутки 00:00–23:59:59. По умолчанию — самая частая дата.</div>
          </section>

          {info && (
            <section className="card stats">
              <div className="step-title">Статистика</div>
              <dl>
                <dt>Строк в файлах</dt>
                <dd>{info.total.toLocaleString('ru-RU')}</dd>
                <dt>Разобрано</dt>
                <dd>{info.parsed.toLocaleString('ru-RU')}</dd>
                <dt>Пропущено (мусор)</dt>
                <dd>{info.skipped.toLocaleString('ru-RU')}</dd>
                {info.duplicates > 0 && (
                  <>
                    <dt>Дубликаты</dt>
                    <dd>{info.duplicates.toLocaleString('ru-RU')}</dd>
                  </>
                )}
                {analysis && (
                  <>
                    <dt>Других фракций</dt>
                    <dd>{analysis.ignoredOtherFaction.toLocaleString('ru-RU')}</dd>
                    <dt>Других дат</dt>
                    <dd>{analysis.ignoredOtherDate.toLocaleString('ru-RU')}</dd>
                    <dt>За выбранный день</dt>
                    <dd>{analysis.dayLines.toLocaleString('ru-RU')}</dd>
                    <dt>Время расчёта</dt>
                    <dd>{ms} мс</dd>
                  </>
                )}
              </dl>
            </section>
          )}
        </aside>

        <main className="content">
          {analysis?.date && result && group.enabled && (
            <div className="content-head">
              {faction && <FactionLogo key={faction.id} faction={faction} size={36} />}
              <h1>{faction?.name}</h1>
              <span className="muted">{analysis.date}</span>
            </div>
          )}
          {main}
        </main>
      </div>
    </div>
  );
}
