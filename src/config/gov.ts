import type { FactionGroup } from './types';

/**
 * Группа «Гос». Сейчас ЗАБЛОКИРОВАНА (enabled: false): вкладка и фракции видны, но выбрать их нельзя.
 * Чтобы включить: заполнить rules (формат — как в src/config/crime.ts) и поставить enabled: true.
 * Остальной код править не нужно.
 */
export const gov: FactionGroup = {
  id: 'gov',
  title: 'Гос',
  enabled: false,
  disabledHint: 'Правила для гос. структур ещё не добавлены',
  dailyCap: 30,
  factions: [
    { id: 'lspd', name: 'LSPD', aliases: ['LSPD', 'Los Santos Police Department', 'Полиция ЛС'] },
    { id: 'lssd', name: 'LSSD', aliases: ['LSSD', 'Los Santos Sheriff Department', 'Шериф'] },
    { id: 'fib', name: 'FIB', aliases: ['FIB', 'ФИБ'] },
    { id: 'army', name: 'LS Army', aliases: ['LS Army', 'Army', 'Армия', 'Армия ЛС'] },
    { id: 'prison', name: 'Федеральная тюрьма', aliases: ['Федеральная тюрьма', 'Federal Prison', 'Тюрьма'] },
    { id: 'wn', name: 'Weazel News', aliases: ['Weazel News', 'WN', 'Weazel'] },
    { id: 'mayor', name: 'Мэрия ЛС', aliases: ['Мэрия ЛС', 'Мэрия', 'Правительство', 'Government'] },
    { id: 'ems', name: 'Medical Services', aliases: ['Medical Services', 'EMS', 'Больница', 'Emergency Medical Services'] },
  ],
  // TODO: достижения для гос. структур (ждём от владельца)
  rules: [],
};
