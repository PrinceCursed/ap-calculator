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
  // id = слаг логотипа public/factions/<id>.webp.
  factions: [
    { id: 'lspd', name: 'LSPD', aliases: ['Los Santos Police Department', 'Полиция ЛС'] },
    { id: 'lssd', name: 'LSSD', aliases: ['Los Santos Sheriff', 'Los Santos Sheriff Department', "Los Santos County Sheriff's Department", 'Шериф'] },
    { id: 'fib', name: 'FIB', aliases: ['ФИБ'] },
    { id: 'army', name: 'LS Army', aliases: ['National Guard', 'NG', 'Army', 'Армия', 'Армия ЛС'] },
    { id: 'saspa', name: 'Федеральная тюрьма', aliases: ['San Andreas State Prison Authority', 'SASPA', 'Federal Prison', 'Тюрьма'] },
    { id: 'wn', name: 'Weazel News', aliases: ['WN', 'Weazel'] },
    { id: 'gov', name: 'Мэрия ЛС', aliases: ['Government', 'Мэрия', 'Правительство'] },
    { id: 'ems', name: 'Medical Services', aliases: ['Emergency Medical Service', 'Emergency Medical Services', 'EMS', 'Больница'] },
  ],
  // TODO: достижения для гос. структур (ждём от владельца)
  rules: [],
};
