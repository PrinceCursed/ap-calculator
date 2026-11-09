import { crime } from './crime';
import { gov } from './gov';
import type { Faction, FactionGroup } from './types';

export const GROUPS: FactionGroup[] = [crime, gov];

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
