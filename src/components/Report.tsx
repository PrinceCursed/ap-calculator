import { Copy, Download, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Faction } from '../config/types';
import { reportFileName, signed, type ReportModel } from '../lib/report';
import { logoUrl, monogram } from './FactionLogo';

/** Палитра отчёта: всегда светлая, независимо от темы сайта. */
const C = {
  bg: '#ffffff',
  tx: '#1f1b26',
  mut: '#6b6475',
  line: '#e7e2ee',
  head: '#4a2c6e',
  headTx: '#ffffff',
  lav: '#efe8f8',
  earn: '#1d6b3c',
  spend: '#a3245e',
};
const FONT = "'IBM Plex Sans', sans-serif";
export const REPORT_WIDTH = 900;
const COLS = '132px minmax(0, 1fr) 132px 132px';

const cell = (extra: React.CSSProperties = {}): React.CSSProperties => ({ padding: '10px 16px', minWidth: 0, ...extra });
const num = (color: string): React.CSSProperties => cell({ textAlign: 'right', color, fontWeight: 600 });

/**
 * Картинка-отчёт (DOM-узел фиксированной ширины 900 px). Все стили — inline, цвета светлые,
 * эмблема — data URI (иначе html-to-image оставит пустое место).
 */
export function ReportCard({ model, faction, logo }: { model: ReportModel; faction: Faction; logo: string | null }) {
  const rows = model.rows.filter((r) => r.kind !== 'cap');
  const capRow = model.rows.find((r) => r.kind === 'cap');
  return (
    <div
      data-testid="report-card"
      style={{
        width: REPORT_WIDTH,
        boxSizing: 'border-box',
        padding: 32,
        background: C.bg,
        color: C.tx,
        fontFamily: FONT,
        fontSize: 15,
        lineHeight: 1.4,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        {logo ? (
          <img src={logo} alt="" width={44} height={44} style={{ width: 44, height: 44, borderRadius: '50%', display: 'block' }} />
        ) : (
          <span
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              border: `1px solid ${C.line}`,
              display: 'grid',
              placeItems: 'center',
              fontWeight: 600,
              color: C.mut,
            }}
          >
            {monogram(faction.name)}
          </span>
        )}
        <div style={{ flex: 1, fontSize: 22, fontWeight: 600 }}>{model.factionName}</div>
        <div style={{ fontSize: 16, fontWeight: 500, color: C.mut }}>{model.date}</div>
      </div>

      <div style={{ border: `1px solid ${C.line}`, borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: COLS, background: C.head, color: C.headTx, fontWeight: 600, fontSize: 14 }}>
          <div style={cell()}>Дата</div>
          <div style={cell()}>Активность / бонус</div>
          <div style={cell({ textAlign: 'right' })}>Начислено</div>
          <div style={cell({ textAlign: 'right' })}>Потрачено</div>
        </div>
        <div data-testid="report-total" style={{ display: 'grid', gridTemplateColumns: COLS, background: C.lav, fontWeight: 600 }}>
          <div style={cell()}>{model.date}</div>
          <div style={cell()}>Итог дня {signed(model.net)} AP</div>
          <div style={num(C.earn)}>{model.earned}</div>
          <div style={num(C.spend)}>{model.spent}</div>
        </div>
        {rows.map((r, i) => (
          <div
            key={i}
            data-testid={`report-row-${r.kind}`}
            style={{ display: 'grid', gridTemplateColumns: COLS, borderTop: `1px solid ${C.line}` }}
          >
            <div style={cell()} />
            <div style={cell()}>{r.title}</div>
            <div style={num(C.earn)}>{r.kind === 'earn' ? signed(r.ap) : ''}</div>
            <div style={num(C.spend)}>{r.kind === 'spend' ? r.ap : ''}</div>
          </div>
        ))}
        {capRow && (
          <div
            data-testid="report-row-cap"
            style={{ display: 'grid', gridTemplateColumns: COLS, borderTop: `1px solid ${C.line}`, color: C.mut, fontSize: 14 }}
          >
            <div style={cell()} />
            <div style={cell({ gridColumn: '2 / 5' })}>{capRow.title}</div>
          </div>
        )}
      </div>
      <div style={{ marginTop: 14, fontSize: 12, color: C.mut }}>AP Calculator</div>
    </div>
  );
}

/** SVG/картинку эмблемы — в data URI, чтобы она попала в PNG. */
async function logoDataUri(f: Faction): Promise<string | null> {
  try {
    const res = await fetch(logoUrl(f));
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith('image/')) return null;
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Ждём шрифты IBM Plex (все начертания отчёта), чтобы кириллица не ушла в системный шрифт. */
async function fontsReady() {
  try {
    await Promise.all(
      ['400', '500', '600'].map((w) => document.fonts.load(`${w} 16px 'IBM Plex Sans'`, 'Итог дня AP 0123')),
    );
    await document.fonts.ready;
  } catch {
    /* fonts API недоступен — рендерим как есть */
  }
}

type Phase = 'prep' | 'render' | 'ready' | 'error';

/** Окно предпросмотра: «Готовлю картинку…» → PNG, кнопки «Скачать PNG» и «Копировать». */
export function ReportModal({ model, faction, onClose }: { model: ReportModel; faction: Faction; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>(model.empty ? 'ready' : 'prep');
  const [logo, setLogo] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const nodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // 1) готовим эмблему и шрифты, 2) монтируем узел, 3) рендерим PNG. Закрытие окна отменяет результат.
  useEffect(() => {
    if (model.empty) return;
    let alive = true;
    (async () => {
      const [uri] = await Promise.all([logoDataUri(faction), fontsReady()]);
      if (!alive) return;
      setLogo(uri);
      setPhase('render');
    })();
    return () => {
      alive = false;
    };
  }, []); // один раз при открытии окна: модель фиксируется на момент нажатия «Отчёт»

  useEffect(() => {
    if (phase !== 'render' || !nodeRef.current) return;
    let alive = true;
    (async () => {
      try {
        const { toBlob } = await import('html-to-image');
        const node = nodeRef.current!.firstElementChild as HTMLElement;
        const b = await toBlob(node, { pixelRatio: 2, width: REPORT_WIDTH, backgroundColor: '#ffffff', cacheBust: false });
        if (!alive) return;
        if (!b) throw new Error('пустая картинка');
        setBlob(b);
        setUrl(URL.createObjectURL(b));
        setPhase('ready');
      } catch (e) {
        if (alive) {
          setNote(`Не удалось подготовить картинку: ${(e as Error)?.message ?? e}`);
          setPhase('error');
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [phase]);

  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);

  const fileName = reportFileName(faction.id, model.date);

  const download = () => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const copy = async () => {
    if (!blob) return;
    setNote(null);
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('unsupported');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setNote('Картинка скопирована — вставьте её в Discord или Telegram');
    } catch {
      setNote('Браузер не дал скопировать картинку. Нажмите «Скачать PNG» и отправьте файл.');
    }
  };

  const busy = phase === 'prep' || phase === 'render';
  const disabled = model.empty || !blob;

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Отчёт">
        <div className="modal-head">
          <div>
            <div className="modal-title">Отчёт</div>
            <div className="small muted">
              {faction.name} · {model.date}
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Закрыть">
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
        <div className="modal-body" data-testid="report-preview">
          {model.empty ? (
            <div className="modal-empty muted">Нечего показывать: нет начислений и трат</div>
          ) : busy ? (
            <div className="modal-empty muted">Готовлю картинку…</div>
          ) : url ? (
            <img className="report-img" src={url} alt={`Отчёт AP: ${faction.name}, ${model.date}`} />
          ) : (
            <div className="modal-empty muted">Картинка не готова</div>
          )}
        </div>
        {note && <div className="modal-note small">{note}</div>}
        <div className="modal-foot">
          <button className="btn btn-outline" onClick={copy} disabled={disabled}>
            <Copy size={16} strokeWidth={1.5} aria-hidden />
            Копировать
          </button>
          <button className="btn btn-acc" onClick={download} disabled={disabled}>
            <Download size={16} strokeWidth={1.5} aria-hidden />
            Скачать PNG
          </button>
        </div>
      </div>
      {/* Узел для рендера: вне экрана, фиксированная ширина 900 px. */}
      {phase !== 'prep' && !model.empty && !blob && (
        <div ref={nodeRef} className="report-stage" aria-hidden>
          <ReportCard model={model} faction={faction} logo={logo} />
        </div>
      )}
    </div>
  );
}
