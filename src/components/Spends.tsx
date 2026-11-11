import { Minus, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { ShopItem } from '../config/types';
import { parseCustomAp, shopCost, shopLabel, spendList, spentTotal, type SpendState } from '../lib/spend';


/** Вкладка «Траты»: плитки магазина группы, форма «Своя трата», список трат и сумма. */
export function SpendsTab({
  shop,
  state,
  onChange,
}: {
  shop: ShopItem[] | undefined;
  state: SpendState;
  /** Принимает функцию-обновление (как setState), чтобы быстрые клики не терялись. */
  onChange: (update: (s: SpendState) => SpendState) => void;
}) {
  const [name, setName] = useState('');
  const [ap, setAp] = useState('');
  const [touched, setTouched] = useState(false);
  const list = spendList(state, shop);
  const total = spentTotal(list);
  const apVal = parseCustomAp(ap);
  const valid = name.trim().length > 0 && apVal !== null;

  const setPacks = (id: string, delta: number | null) =>
    onChange((st) => ({ ...st, packs: { ...st.packs, [id]: delta === null ? 0 : Math.max(0, (st.packs[id] ?? 0) + delta) } }));

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    const entry = { id: `custom:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 6)}`, title: name.trim(), ap: apVal! };
    onChange((st) => ({ ...st, custom: [...st.custom, entry] }));
    setName('');
    setAp('');
    setTouched(false);
  };

  const remove = (id: string) => {
    if (id.startsWith('shop:')) setPacks(id.slice(5), null);
    else onChange((st) => ({ ...st, custom: st.custom.filter((c) => c.id !== id) }));
  };

  return (
    <div className="spends">
      {shop?.length ? (
        <div className="shop-grid" data-testid="shop">
          {shop.map((item) => {
            const n = state.packs[item.id] ?? 0;
            const single = item.pack === 1;
            return (
              <div key={item.id} className={`shop-card ${n > 0 ? 'is-on' : ''}`} data-testid={`shop-${item.id}`}>
                <div className="shop-name">{item.title}</div>
                <div className="mono small muted">
                  {`${item.pack} шт`} → {item.cost} AP
                </div>
                <div className="shop-foot">
                  <span className="stepper">
                    <button className="sq" onClick={() => setPacks(item.id, -1)} aria-label={`Меньше · ${item.title}`} disabled={n === 0}>
                      <Minus size={14} strokeWidth={1.5} />
                    </button>
                    <span className="mono stepper-val" data-testid={`packs-${item.id}`}>
                      {n}
                    </span>
                    <button className="sq" onClick={() => setPacks(item.id, 1)} aria-label={`Больше · ${item.title}`}>
                      <Plus size={14} strokeWidth={1.5} />
                    </button>
                  </span>
                  <span className="small muted shop-unit">{single ? 'шт' : 'пакетов'}</span>
                </div>
                <div className={`small mono shop-calc ${n > 0 ? '' : 'fade'}`} data-testid={`calc-${item.id}`}>
                  {n > 0 ? `${shopLabel(item, n)} = ${shopCost(item, n)} AP` : `${shopLabel(item, 1)} = ${item.cost} AP`}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="panel panel-pad muted" data-testid="no-shop">
          Магазин для этой группы ещё не добавлен
        </div>
      )}

      <form className="panel panel-pad custom-spend" onSubmit={add} noValidate>
        <div className="custom-title">Своя трата</div>
        <div className="custom-row">
          <input
            className="field grow"
            placeholder="Название"
            aria-label="Название траты"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="field field-ap mono"
            placeholder="AP"
            aria-label="Баллы траты"
            inputMode="numeric"
            value={ap}
            onChange={(e) => setAp(e.target.value.replace(/[^\d]/g, ''))}
          />
          <button className="btn btn-outline" type="submit">
            <Plus size={16} strokeWidth={1.5} aria-hidden />
            Добавить
          </button>
        </div>
        {touched && !valid && <div className="small amber">Укажите название и целое число AP больше 0</div>}
      </form>

      <div className="panel">
        <div className="trow thead spend-cols">
          <span>Трата</span>
          <span className="right">AP</span>
          <span />
        </div>
        {list.length === 0 ? (
          <div className="panel-pad muted small">Трат пока нет</div>
        ) : (
          list.map((s) => (
            <div className="trow spend-cols spend-row" key={s.id} data-testid="spend-row">
              <span className="spend-title">{s.title}</span>
              <span className="right mono neg-tx">−{s.ap}</span>
              <button className="icon-btn icon-btn-sm" onClick={() => remove(s.id)} aria-label={`Удалить · ${s.title}`}>
                <Trash2 size={14} strokeWidth={1.5} />
              </button>
            </div>
          ))
        )}
        <div className="trow spend-cols spend-total">
          <span>Всего потрачено</span>
          <span className="right mono strong" data-testid="spent-total">
            {total} AP
          </span>
          <span />
        </div>
      </div>
    </div>
  );
}
