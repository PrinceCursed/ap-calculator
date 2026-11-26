import {
  Banknote,
  Car,
  Check,
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
import { useId, useState, useSyncExternalStore } from 'react';
import type { ManualRule } from '../config/types';
import { applyCap, manualCount, type AchievementResult, type DisputedCase } from '../lib/engine';
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
  /** Лог покрывает сутки не полностью. */
  partial?: boolean;
  /** Потрачено AP за день (вкладка «Траты»). */
  spent?: number;
}) {
  const c = applyCap(props.auto + props.manual + props.adjust, props.cap);
  const spent = props.spent ?? 0;
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
          <span className="summary-cap">
            / {props.cap} AP{props.partial && c.total < props.cap ? ' (по неполному логу)' : ''}
          </span>
        </div>
        <div className="bar">
          <div className={`bar-fill ${c.capped ? 'is-amber' : ''}`} style={{ width: `${Math.min(100, (c.total / props.cap) * 100)}%` }} />
        </div>
        {c.capped && (
          <div className="cap-note" data-testid="cap-note">
            Лимит: засчитано {c.total}, набрано {c.sum}, урезано {c.cut}
          </div>
        )}
        <div className="summary-parts" data-testid="day-parts">
          <span>
            Начислено <b data-testid="earned">{c.total}</b>
          </span>
          <span className="sep">·</span>
          <span>
            Потрачено <b data-testid="spent">{spent}</b>
          </span>
        </div>
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

export type ResultTab = 'ach' | 'man' | 'spend';

export function ResultTabs({ tab, onTab }: { tab: ResultTab; onTab: (t: ResultTab) => void }) {
  const tabs: [ResultTab, string][] = [
    ['ach', 'Достижения'],
    ['man', 'Ручные'],
    ['spend', 'Траты'],
  ];
  return (
    <div className="seg seg-tabs" role="tablist" aria-label="Результат">
      {tabs.map(([id, label]) => (
        <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'is-on' : ''} onClick={() => onTab(id)}>
          {label}
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

const evidenceLayout = '(min-width: 1060px)';
function subscribeToLayout(callback: () => void) {
  const query = window.matchMedia?.(evidenceLayout);
  query?.addEventListener('change', callback);
  return () => query?.removeEventListener('change', callback);
}
const sideBySide = () => window.matchMedia?.(evidenceLayout)?.matches ?? false;

export function AchievementsTable({ items, incomplete = [] }: { items: AchievementResult[]; incomplete?: DisputedCase[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);
  const showBeside = useSyncExternalStore(subscribeToLayout, sideBySide, () => false);
  const evidenceId = useId();
  const byAchievement = new Map<string, DisputedCase[]>();
  for (const attempt of incomplete) {
    const cases = byAchievement.get(attempt.achievementId);
    if (cases) cases.push(attempt);
    else byAchievement.set(attempt.achievementId, [attempt]);
  }
  const partialItems = items.filter((a) => !a.count && byAchievement.has(a.id));
  const visible = onlyIncomplete ? partialItems : items;
  const active = visible.find((a) => a.id === selected);
  return (
    <div className="achievement-view">
      {partialItems.length > 0 && (
        <div className="achievement-tools">
          <button
            type="button"
            className="btn btn-sm achievement-filter"
            aria-pressed={onlyIncomplete}
            onClick={() => setOnlyIncomplete(!onlyIncomplete)}
          >
            Только недобор <span className="mono">{partialItems.length}</span>
          </button>
        </div>
      )}
      <div className={`achievement-workspace${showBeside ? ' has-inspector' : ''}`}>
        <div className="panel achievement-list">
          <div className="trow thead ach-cols">
            <span>Достижение</span>
            <span className="only-desk">Найдено в файле</span>
            <span className="only-desk ach-extra">За ед.</span>
            <span className="only-desk ach-extra">Засчитано</span>
            <span className="right">Итого</span>
            <span />
          </div>
          {visible.map((a) => {
            const cases = byAchievement.get(a.id) ?? [];
            const completed = a.count > 0;
            const partial = !completed && cases.length > 0;
            const hasEvidence = completed || partial;
            const isOpen = hasEvidence && active?.id === a.id;
            const Row = hasEvidence ? 'button' : 'div';
            const progress = partial && cases.length === 1 ? cases[0].reason : a.progress.text;
            const label = completed ? 'Засчитано' : partial ? 'Частично выполнено' : 'Активность не найдена';
            return (
              <div className="tgroup" key={a.id}>
                <Row
                  className={`trow ach-cols ${completed ? 'is-click is-ok' : partial ? 'is-click is-partial' : 'is-zero'}`}
                  data-testid={`ach-${a.id}`}
                  type={hasEvidence ? 'button' : undefined}
                  onClick={hasEvidence ? () => setSelected(isOpen ? null : a.id) : undefined}
                  aria-expanded={hasEvidence ? isOpen : undefined}
                  aria-controls={isOpen || (hasEvidence && showBeside) ? evidenceId : undefined}
                  title={a.hint}
                >
                  <span className="tname">
                    <span className={`ach-status ${completed ? 'is-checked' : partial ? 'is-incomplete' : 'is-empty'}`} role="img" aria-label={label}>
                      {completed && <Check size={11} strokeWidth={2.5} aria-hidden />}
                    </span>
                    <span className="tname-text">
                      <span>{a.title}</span>
                      <span className="only-mob small muted">
                        +{a.unitPoints} за ед. · ×{a.count} · {progress}
                      </span>
                      {a.droppedByOncePerDay ? <span className="small muted">раз в день: отброшено {a.droppedByOncePerDay}</span> : null}
                    </span>
                  </span>
                  <span className={`only-desk mono small ${partial ? 'amber' : 'muted'}`} data-testid={`progress-${a.id}`}>
                    {progress}
                  </span>
                  <span className="only-desk mono muted ach-extra">+{a.unitPoints}</span>
                  <span className="only-desk mono ach-extra">{a.count}</span>
                  <span className="right mono strong">{completed ? `+${a.total}` : '0'}</span>
                  {hasEvidence ? <Chevron open={isOpen} /> : <span />}
                </Row>
                {isOpen && !showBeside && <div id={evidenceId}><Evidence occurrences={a.occurrences} incomplete={cases} /></div>}
              </div>
            );
          })}
        </div>
        {showBeside && (
          <aside className="panel achievement-inspector" id={evidenceId} aria-label="Доказательства">
            {active ? (
              <>
                <h2>{active.title}</h2>
                <Evidence key={active.id} occurrences={active.occurrences} incomplete={byAchievement.get(active.id)} />
              </>
            ) : <p className="small muted">Выберите достижение, чтобы увидеть строки лога.</p>}
          </aside>
        )}
      </div>
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
  incomplete = [],
  counts,
  adjust,
  onCount,
  onAdjust,
}: {
  rules: ManualRule[];
  incomplete?: DisputedCase[];
  counts: Record<string, number>;
  adjust: number;
  onCount: (id: string, n: number) => void;
  onAdjust: (n: number) => void;
}) {
  return (
    <div className="manual">
      <div className="manual-grid">
        {rules.map((r) => {
          const n = manualCount(r, counts[r.id]);
          const Icon = MANUAL_ICONS[r.id] ?? Star;
          const review = r.evidence ? incomplete.find((d) => d.achievementId === r.id) : undefined;
          return (
            <div key={r.id} className={`mcard ${n > 0 ? 'is-on' : ''}`}>
              <span className="mcard-icon">
                <Icon {...ICON} aria-hidden />
              </span>
              <span className="mcard-text">
                <span className="mcard-name">{r.title}</span>
                <span className="mono small muted">+{r.points} AP</span>
                {r.hint && <span className="small muted">{r.hint}</span>}
              </span>
              <span className="stepper">
                <button className="sq" onClick={() => onCount(r.id, Math.max(0, n - 1))} aria-label={`Уменьшить · ${r.title}`}>
                  <Minus size={14} strokeWidth={1.5} />
                </button>
                <span className="mono stepper-val">{n}</span>
                <button className="sq" disabled={r.oncePerDay && n >= 1} onClick={() => onCount(r.id, n + 1)} aria-label={`Увеличить · ${r.title}`}>
                  <Plus size={14} strokeWidth={1.5} />
                </button>
              </span>
              {review && (
                <details className="mcard-evidence">
                  <summary className="small amber">Строки для ручной проверки</summary>
                  <Evidence incomplete={[review]} />
                </details>
              )}
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
