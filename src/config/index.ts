import { gangs } from './gangs';
import { gov } from './gov';
import { mafia } from './mafia';
import type { Faction, FactionGroup } from './types';

/** Разделы фракций. Порядок = порядок в сайдбаре. У каждого свой флаг enabled и свои правила. */
export const GROUPS: FactionGroup[] = [gangs, mafia, gov];

/** Вкладки сайдбара («Crime | Гос»). Разделы попадают во вкладку по полю tab. */
export const TABS: { id: string; title: string }[] = [
  { id: 'crime', title: 'Crime' },
  { id: 'gov', title: 'Гос' },
];

export function findGroup(groupId: string, groups: FactionGroup[] = GROUPS): FactionGroup | undefined {
  return groups.find((g) => g.id === groupId);
}

export function findFaction(
  factionId: string,
  groups: FactionGroup[] = GROUPS,
): { group: FactionGroup; faction: Faction } | undefined {
  for (const group of groups) {
    const faction = group.factions.find((f) => f.id === factionId);
    if (faction) return { group, faction };
  }
  return undefined;
}

/** Можно ли выбрать фракцию (и загрузить для неё логи). Определяется только флагом enabled группы. */
export function isFactionSelectable(factionId: string, groups: FactionGroup[] = GROUPS): boolean {
  const found = findFaction(factionId, groups);
  return !!found && found.group.enabled;
}

export type { Faction, FactionGroup } from './types';
