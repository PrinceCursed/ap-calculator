import { fibRules, lspdRules, lssdRules } from './govRules';
import type { FactionGroup } from './types';

export const gov: FactionGroup = {
  id: 'gov',
  title: 'Гос. структуры',
  tab: 'gov',
  enabled: true,
  disabledHint: 'Правила для этой фракции ещё не добавлены',
  dailyCap: 30,
  // id = слаг логотипа public/factions/<id>.svg.
  factions: [
    { id: 'lspd', name: 'LSPD', rules: lspdRules, aliases: ['Los Santos Police Department', 'Полиция ЛС'] },
    { id: 'lssd', name: 'LSSD', rules: lssdRules, aliases: ['Los Santos Sheriff', 'Los Santos Sheriff Department', "Los Santos County Sheriff's Department", 'Шериф'] },
    { id: 'fib', name: 'FIB', rules: fibRules, aliases: ['ФИБ'] },
    { id: 'army', enabled: false, name: 'LS Army', short: 'National Guard', aliases: ['National Guard', 'NG', 'Army', 'Армия', 'Армия ЛС'] },
    { id: 'saspa', enabled: false, name: 'Федеральная тюрьма', aliases: ['San Andreas State Prison Authority', 'SASPA', 'Federal Prison', 'Тюрьма'] },
    { id: 'wn', enabled: false, name: 'Weazel News', aliases: ['WN', 'Weazel'] },
    { id: 'gov', enabled: false, name: 'Мэрия ЛС', aliases: ['Government', 'Мэрия', 'Правительство'] },
    { id: 'ems', enabled: false, name: 'Medical Services', aliases: ['Emergency Medical Service', 'Emergency Medical Services', 'EMS', 'Больница'] },
  ],
  rules: [],
};
