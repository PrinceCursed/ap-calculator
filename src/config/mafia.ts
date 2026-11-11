import type { FactionGroup } from './types';

/**
 * Раздел «Мафии» вкладки Crime. Сейчас ЗАКРЫТ (enabled: false): правила банд к мафиям не относятся,
 * у мафий свои достижения. Фракции видны, но выбрать их и загрузить логи нельзя.
 * Чтобы открыть: заполнить rules (формат — как в src/config/gangs.ts) и поставить enabled: true.
 */
export const mafia: FactionGroup = {
  id: 'mafia',
  title: 'Мафии',
  tab: 'crime',
  enabled: false,
  disabledHint: 'Правила для мафий ещё не добавлены',
  dailyCap: 30,
  // id = слаг логотипа public/factions/<id>.svg.
  factions: [
    { id: 'rm', name: 'Русская Мафия', short: 'Русская', aliases: ['Russian Mafia', 'РМ'] },
    { id: 'lcn', name: 'Итальянская Мафия', short: 'Итальянская', aliases: ['Italian Mafia', 'La Cosa Nostra', 'LCN'] },
    { id: 'am', name: 'Армянская Мафия', short: 'Армянская', aliases: ['Armenian Mafia'] },
    { id: 'mm', name: 'Мексиканская Мафия', short: 'Мексиканская', aliases: ['Mexican Mafia'] },
    { id: 'yak', name: 'Японская Мафия', short: 'Японская', aliases: ['Japanese Mafia', 'Yakuza', 'Якудза'] },
  ],
  // TODO: достижения для мафий (ждём от владельца)
  rules: [],
};
