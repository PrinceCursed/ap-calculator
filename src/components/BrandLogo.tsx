import { useEffect, useState } from 'react';

/**
 * Логотип в шапке сайдбара. Ищет файлы в public/:
 *   logo.svg      — основной (или logo.png)
 *   logo-dark.svg — вариант для тёмной темы (необязательно)
 * Если основного файла нет — показывает текущий знак «AP».
 * Если в тёмной теме нет отдельного варианта — основной логотип кладётся на тонкую светлую подложку,
 * чтобы тёмный логотип читался (сам файл не меняется).
 */
const BASE = import.meta.env.BASE_URL;
const CANDIDATES = ['logo.svg', 'logo.png', 'logo.webp'];
const DARK = ['logo-dark.svg', 'logo-dark.png', 'logo-dark.webp'];

function probe(names: string[]): Promise<string | null> {
  return names.reduce<Promise<string | null>>(
    (acc, name) =>
      acc.then(
        (found) =>
          found ??
          new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img.naturalWidth > 0 ? BASE + name : null);
            img.onerror = () => resolve(null);
            img.src = BASE + name;
          }),
      ),
    Promise.resolve(null),
  );
}

export function BrandLogo({ theme }: { theme: 'light' | 'dark' }) {
  const [light, setLight] = useState<string | null>(null);
  const [dark, setDark] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    probe(CANDIDATES).then((u) => alive && setLight(u));
    probe(DARK).then((u) => alive && setDark(u));
    return () => {
      alive = false;
    };
  }, []);

  if (!light) {
    return (
      <span className="brand-mark" data-testid="brand-mark" aria-hidden>
        AP
      </span>
    );
  }
  const src = theme === 'dark' && dark ? dark : light;
  const underlay = theme === 'dark' && !dark;
  return (
    <span className={`brand-logo ${underlay ? 'has-underlay' : ''}`}>
      <img src={src} alt="" height={32} data-testid="brand-logo" />
    </span>
  );
}
