import type { Rule, SequenceRule } from './types';

const minParticipants = 5;
type GovFaction = 'LSPD' | 'FIB' | 'LSSD';

const supply = (
  faction: GovFaction,
  kind: 'ARMY' | 'EMS',
  minVehicles: number,
  participationPhrase: string,
  deliveryPhrase: string,
): SequenceRule => ({
  type: 'sequence',
  id: `${faction.toLowerCase()}_${kind.toLowerCase()}_supply`,
  title: `Успешная доставка поставки ${kind} на свою фракцию`,
  points: 3,
  step1: {
    minDistinct: minParticipants,
    label: `участников ${faction}`,
    actor: 'player',
    phrases: [participationPhrase],
    windowMinutes: 90,
  },
  final: {
    phrases: [deliveryPhrase],
    label: 'разгрузка поставки',
    distinctGroup: { gapMinutes: 10, minDistinct: minVehicles, label: 'машин' },
  },
  hint: `Минимум ${minParticipants} участников ${faction} и разные машины в одной поставке (минимум ${minVehicles})`,
});

function sharedRules(faction: GovFaction): Rule[] {
  const prefix = faction.toLowerCase();
  const participation = { minDistinct: minParticipants, label: `участников ${faction}`, actor: 'player' } as const;

  return [
    supply(
      faction,
      'ARMY',
      3,
      're:^участвует\\s+(?=.*поставк)(?=.*(?:army|армейск|материал))',
      're:^разгружает поставку материалов:.*\\((?<key>army\\d+)\\)',
    ),
    supply(
      faction,
      'EMS',
      2,
      're:^участвует\\s+(?=.*поставк)(?=.*(?:ems|аптеч|медикамент))',
      're:^разгружает поставку аптечек:.*\\((?<key>ems\\d+)\\)',
    ),
    {
      type: 'manual', id: `${prefix}_contraband`, title: 'Успешное отбитие поставки контрабанды', points: 3,
      hint: `Минимум 5 участников ${faction} и 1 матовозка. Подтвердите результат вручную.`,
    },
    {
      type: 'manual', id: `${prefix}_prostitutes`, title: 'Доставить 5 проституток', points: 2,
      hint: 'Отметьте выполнение за каждые 5 доставок. Событие не логируется.',
    },
    {
      type: 'manual', id: `${prefix}_fz_defense`, title: 'Успешное отбитие ФЗ', points: 4,
      hint: `Минимум 5 участников ${faction} и 5 спасённых матовозок. Факт успеха не логируется.`,
    },
    {
      type: 'manual', id: `${prefix}_ft_defense`, title: 'Успешное отбитие ФТ', points: 4,
      hint: `Минимум 5 участников ${faction} и не более 5 освобождённых. Участие не логируется.`,
    },
    {
      type: 'manual', id: `${prefix}_gunshop_defense`, title: 'Успешное отбитие Gunshop’а', points: 3,
      evidence: { phrases: ['спас украденную машину'], actor: 'player' },
      hint: `Довоз отмечается строкой «Спас». Подтвердите минимум 5 участников ${faction} вручную.`,
    },
    {
      type: 'sequence',
      id: `${prefix}_train_defense`,
      title: 'Успешное отбитие поезда',
      points: 3,
      step1: { ...participation, windowMinutes: 90, phrases: ['участвует в обороне поезда'] },
      final: { phrases: ['re:^доставляет\\s+.*из поезда'], label: 'доставка груза из поезда' },
      hint: `Минимум 5 участников ${faction} в обороне и доставка груза из поезда`,
    },
    {
      type: 'sequence',
      id: `${prefix}_airdrop`,
      title: 'Победа в аир-дропе',
      points: 4,
      step1: {
        ...participation,
        windowMinutes: 30,
        phrases: ['re:^участвует\\s+.*выпавшего.*(?:груз|припас)'],
      },
      final: { phrases: ['re:^получает припасы(?: из выпавшего.*|[:.!]|$)'], actor: 'system', label: 'припасы получены' },
      hint: `Минимум 5 участников ${faction} и системная строка о получении припасов`,
    },
    {
      type: 'manual', id: `${prefix}_blackmarket`, title: 'Победить в захвате чёрного рынка', points: 4,
      hint: `Подтвердите победу и минимум 5 участников ${faction}.`,
    },
    {
      type: 'manual', id: `${prefix}_supply_escort`, title: 'Помочь в сопровождении 2 поставок', points: 3,
      hint: `Минимум 5 участников ${faction}. Отметьте выполнение за каждые 2 сопровождения.`,
    },
    { type: 'manual', id: `${prefix}_case`, title: 'Составить 1 дело на crime-организацию', points: 3 },
    { type: 'manual', id: `${prefix}_raid_lead`, title: 'Провести рейд на преступную организацию', points: 12 },
    {
      type: 'manual', id: `${prefix}_raid_participation`, title: 'Принять участие в рейде на преступную группировку', points: 6,
      hint: `Минимум 5 участников ${faction}.`,
    },
  ];
}

function policeRules(faction: 'LSPD' | 'LSSD'): Rule[] {
  const prefix = faction.toLowerCase();
  return [
    ...sharedRules(faction),
    {
      type: 'perCount',
      id: `${prefix}_returned_cars`,
      title: 'Доставить 5 угнанных авто',
      points: 2,
      per: 5,
      unitLabel: 'авто',
      actor: 'player',
      phrases: ['re:^возвращает\\s+.*(?:автомобил|машин|транспорт|угнанн|(?<![а-яa-z])тс(?![а-яa-z]))'],
      hint: 'Каждые 5 возвратов угнанных авто = 2 AP',
    },
    {
      type: 'manual', id: `${prefix}_fishing`, title: 'Проверить 15 человек на наличие лицензии на рыболовство', points: 2,
      hint: 'Отметьте выполнение за каждые 15 проверенных человек.',
    },
    {
      type: 'perCount',
      id: `${prefix}_fines`,
      title: '13 выписанных штрафов за дорожный кодекс',
      points: 2,
      per: 13,
      unitLabel: 'штрафов',
      actor: 'player',
      phrases: ['re:^(?:выписывает|выдает|выписал|выдал)\\s+(?=.*штраф)(?=.*[^а-яa-z]дк\\s*\\))'],
      hint: 'Каждые 13 выписанных штрафов с отметкой «ДК» = 2 AP',
    },
    {
      type: 'manual', id: `${prefix}_interrogations`, title: 'Провести 2 допроса игроков', points: 2,
      hint: 'Отметьте выполнение за каждые 2 допроса.',
    },
  ];
}

export const lspdRules: Rule[] = [
  ...policeRules('LSPD'),
  {
    type: 'perCount',
    id: 'lspd_vehicle_registration',
    title: 'Поставить на учёт 5 машин',
    points: 3,
    per: 5,
    unitLabel: 'машин',
    actor: 'player',
    phrases: ['re:^(?:ставит|поставил)\\s+(?=.*(?:автомобил|машин|транспорт|(?<![а-яa-z])тс(?![а-яa-z])))(?:.*?\\s+)?на учет(?:[^а-я]|$)'],
    hint: 'Каждые 5 поставленных на учёт машин = 3 AP',
  },
];

export const lssdRules: Rule[] = [
  ...policeRules('LSSD'),
  {
    type: 'manual', id: 'lssd_hunting', title: 'Проверить 5 человек на наличие лицензии на охоту', points: 2,
    hint: 'Отметьте выполнение за каждые 5 проверенных человек.',
  },
];

export const fibRules: Rule[] = [
  ...sharedRules('FIB'),
  {
    type: 'manual', id: 'fib_interrogations', title: 'Проведение 2 допросов с пристрастием', points: 3,
    oncePerDay: true,
    hint: 'Отметьте выполнение за 2 допроса. Доступно один раз в день.',
  },
  {
    type: 'manual', id: 'fib_evidence', title: 'Сбор 4 улик в отношении crime-организации', points: 3,
    hint: 'Отметьте выполнение за каждые 4 улики.',
  },
];
