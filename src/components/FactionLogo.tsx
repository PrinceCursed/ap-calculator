import { useState } from 'react';
import type { Faction } from '../config/types';

/** Две буквы для монограммы: «The Ballas Gang» → «BG», «LSPD» → «LS», «Русская Мафия» → «РМ». */
export function monogram(name: string): string {
  const words = name.split(/\s+/).filter((w) => w && !/^the$/i.test(w));
  const s = words.length >= 2 ? words[0][0] + words[1][0] : (words[0] ?? name).slice(0, 2);
  return s.toUpperCase();
}

export function logoUrl(f: Faction): string {
  return `${import.meta.env.BASE_URL}factions/${f.logo ?? f.id}.webp`;
}

/** Логотип фракции. Картинка грузится из public/factions; если её нет или она битая — монограмма. */
export function FactionLogo({ faction, size = 28 }: { faction: Faction; size?: number }) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size, fontSize: Math.round(size * 0.4) };
  if (failed) {
    return (
      <span className="flogo flogo-mono" style={style} aria-hidden data-testid={`mono-${faction.id}`}>
        {monogram(faction.name)}
      </span>
    );
  }
  return (
    <img
      className="flogo"
      style={style}
      src={logoUrl(faction)}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
