import { CompetitionId, HairStyle, PlayerConfig, Team, TeamCategory } from '../types/game';

/* ------------------------------------------------------------------ */
/* Deterministic RNG so every team keeps the same squad between loads  */
/* ------------------------------------------------------------------ */
function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SKIN_TONES = ['#F3D2B3', '#E8B98C', '#D99B66', '#C68642', '#A9703F', '#8D5524', '#6F4E37', '#5C3A21'];
const HAIR_COLORS = ['#1A1110', '#2B1B17', '#0B0B0B', '#4A2C17', '#6B4423', '#C9A227', '#8B5A2B'];
const HAIR_STYLES: HairStyle[] = [
  'fade_crop', 'afro_curls', 'slick_back', 'mohawk_fade', 'braids', 'buzz_cut', 'wavy_top', 'classic_part',
];
const BOOTS = ['#F97316', '#EC4899', '#FACC15', '#22C55E', '#38BDF8', '#FFFFFF', '#111827', '#A855F7'];

/* Original fictional player names — no real-player likenesses are used. */
const INDIAN_FIRST = ['Arjun', 'Sanju', 'Rahul', 'Vishal', 'Nikhil', 'Jithin', 'Sreejith', 'Manoj', 'Karan', 'Vivek', 'Deepak', 'Pranav', 'Hari', 'Ajay', 'Bibin', 'Noufal', 'Rohit', 'Anand', 'Febin', 'Akhil'];
const INDIAN_LAST = ['Nair', 'Menon', 'Pillai', 'Thomas', 'Kumar', 'Reddy', 'Singh', 'Das', 'Sharma', 'Iyer', 'Varma', 'Joseph', 'Rao', 'Shetty', 'Gowda', 'Mathew', 'Francis', 'Bose'];
const EURO_FIRST = ['Mateo', 'Luca', 'Dario', 'Elias', 'Nuno', 'Tomas', 'Andre', 'Kai', 'Rafa', 'Milos', 'Jonas', 'Enzo', 'Pierre', 'Stefan', 'Diego', 'Viktor', 'Mika', 'Noah', 'Aron', 'Bruno'];
const EURO_LAST = ['Varga', 'Silvestri', 'Moreau', 'Lindqvist', 'Kovac', 'Ferreira', 'Brandt', 'Arrieta', 'Delgado', 'Novak', 'Hansen', 'Beaulieu', 'Castellan', 'Ricci', 'Lemaire', 'Oduya', 'Varela', 'Jensen'];

export function buildSquad(team: { id: string; rating: number; category: TeamCategory }): PlayerConfig[] {
  const rand = mulberry32(hashString(team.id));
  const indian = team.category === 'ISL' || team.category === 'KSL';
  const first = indian ? INDIAN_FIRST : EURO_FIRST;
  const last = indian ? INDIAN_LAST : EURO_LAST;
  const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)];

  // 11 starters (default 4-3-3 shape) followed by 5 substitutes.
  const roles: PlayerConfig['role'][] = [
    'GK', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'FWD', 'FWD', 'FWD',
    'GK', 'DEF', 'MID', 'MID', 'FWD',
  ];
  const usedNames = new Set<string>();
  const usedNumbers = new Set<number>();

  const nextNumber = (preferred: number) => {
    let n = preferred;
    let guard = 0;
    while (usedNumbers.has(n) && guard++ < 40) n = 2 + Math.floor(rand() * 32);
    usedNumbers.add(n);
    return n;
  };

  return roles.map((role, index) => {
    let name = `${pick(first)} ${pick(last)}`;
    let guard = 0;
    while (usedNames.has(name) && guard++ < 25) name = `${pick(first)} ${pick(last)}`;
    usedNames.add(name);

    const sub = index >= 11;
    const variance = (rand() - 0.5) * 8 - (sub ? 5 : 0);
    const base = team.rating + variance;
    const number = nextNumber(index === 0 ? 1 : index === 11 ? 12 : index + 1);

    return {
      id: `${team.id}_p${index}`,
      name,
      number,
      role,
      speed: Math.round(role === 'GK' ? base - 12 : role === 'FWD' ? base + 4 : base),
      shooting: Math.round(role === 'GK' ? 45 : role === 'FWD' ? base + 3 : base - 6),
      passing: Math.round(role === 'MID' ? base + 4 : base - 3),
      appearance: {
        skinTone: indian ? SKIN_TONES[2 + Math.floor(rand() * 4)] : pick(SKIN_TONES),
        hairColor: pick(HAIR_COLORS),
        hairStyle: pick(HAIR_STYLES),
        bootColor: pick(BOOTS),
        heightScale: role === 'GK' ? 1.04 + rand() * 0.04 : 0.95 + rand() * 0.1,
        buildWidth: 0.94 + rand() * 0.13,
      },
    };
  });
}

type TeamSeed = [name: string, short: string, city: string, primary: string, secondary: string, shorts: string, socks: string, gk: string, pattern: Team['pattern'], rating: number];

function makeTeams(category: TeamCategory, prefix: string, seeds: TeamSeed[]): Team[] {
  return seeds.map((seed) => {
    const [name, shortName, city, primaryColor, secondaryColor, shortsColor, socksColor, gkColor, pattern, rating] = seed;
    const id = `${prefix}_${shortName.toLowerCase()}`;
    const team: Team = {
      id, name, shortName, city, category,
      primaryColor, secondaryColor, shortsColor, socksColor, gkColor,
      pattern, rating, players: [],
    };
    team.players = buildSquad({ id, rating, category });
    return team;
  });
}

/* ------------------------------------------------------------------ */
/* INDIAN SUPER LEAGUE — participating clubs                           */
/* ------------------------------------------------------------------ */
export const ISL_TEAMS = makeTeams('ISL', 'isl', [
  ['Kerala Blasters FC', 'KBF', 'Kochi', '#FFD100', '#1D4ED8', '#1D4ED8', '#FFD100', '#16A34A', 'solid', 78],
  ['Mohun Bagan Super Giant', 'MBS', 'Kolkata', '#0F7A3D', '#8B1D2C', '#8B1D2C', '#0F7A3D', '#F59E0B', 'stripes', 84],
  ['Bengaluru FC', 'BFC', 'Bengaluru', '#1D4ED8', '#DC2626', '#1D4ED8', '#1D4ED8', '#22C55E', 'solid', 81],
  ['Mumbai City FC', 'MCF', 'Mumbai', '#5BC2E7', '#0A1E3C', '#0A1E3C', '#5BC2E7', '#F97316', 'solid', 82],
  ['FC Goa', 'GOA', 'Margao', '#F97316', '#1E3A8A', '#1E3A8A', '#F97316', '#22C55E', 'solid', 80],
  ['Chennaiyin FC', 'CFC', 'Chennai', '#1E40AF', '#F59E0B', '#1E40AF', '#F59E0B', '#EF4444', 'solid', 76],
  ['Odisha FC', 'OFC', 'Bhubaneswar', '#7C3AED', '#FBBF24', '#1F2937', '#7C3AED', '#22C55E', 'solid', 78],
  ['Jamshedpur FC', 'JFC', 'Jamshedpur', '#C2410C', '#111827', '#111827', '#C2410C', '#38BDF8', 'stripes', 77],
  ['Punjab FC', 'PFC', 'Mohali', '#DC2626', '#FBBF24', '#FFFFFF', '#DC2626', '#22C55E', 'solid', 74],
  ['NorthEast United FC', 'NEU', 'Guwahati', '#E11D48', '#111827', '#111827', '#E11D48', '#FACC15', 'solid', 75],
  ['Hyderabad FC', 'HFC', 'Hyderabad', '#FDE047', '#0F172A', '#0F172A', '#FDE047', '#38BDF8', 'solid', 73],
  ['East Bengal FC', 'EBF', 'Kolkata', '#B91C1C', '#FBBF24', '#B91C1C', '#FBBF24', '#22C55E', 'sash', 76],
]);

/* ------------------------------------------------------------------ */
/* KERALA SUPER LEAGUE — participating clubs                           */
/* ------------------------------------------------------------------ */
export const KSL_TEAMS = makeTeams('KSL', 'ksl', [
  ['Kannur Warriors FC', 'KNW', 'Kannur', '#F59E0B', '#111827', '#111827', '#F59E0B', '#22C55E', 'solid', 74],
  ['Thrissur Magic FC', 'TMG', 'Thrissur', '#7C3AED', '#FDE047', '#2E1065', '#FDE047', '#38BDF8', 'solid', 75],
  ['Malappuram FC', 'MLP', 'Malappuram', '#15803D', '#FDE047', '#15803D', '#FDE047', '#F97316', 'solid', 77],
  ['Calicut FC', 'CLT', 'Kozhikode', '#0EA5E9', '#FFFFFF', '#0C4A6E', '#0EA5E9', '#FACC15', 'stripes', 76],
  ['Forza Kochi FC', 'FZK', 'Kochi', '#DC2626', '#0F172A', '#0F172A', '#DC2626', '#22C55E', 'solid', 75],
  ['Thiruvananthapuram Kombans FC', 'TVK', 'Thiruvananthapuram', '#B45309', '#FDE047', '#78350F', '#FDE047', '#38BDF8', 'solid', 74],
  ['Wayanad United FC', 'WYD', 'Kalpetta', '#065F46', '#A7F3D0', '#065F46', '#A7F3D0', '#F97316', 'hoops', 72],
  ['Alappuzha United FC', 'ALP', 'Alappuzha', '#1D4ED8', '#F97316', '#1E3A8A', '#F97316', '#FACC15', 'solid', 73],
]);

/* ------------------------------------------------------------------ */
/* UEFA CHAMPIONS LEAGUE — participating clubs                         */
/* ------------------------------------------------------------------ */
export const UCL_TEAMS = makeTeams('UCL', 'ucl', [
  ['Real Madrid', 'RMA', 'Madrid', '#FFFFFF', '#FEBE10', '#FFFFFF', '#FFFFFF', '#16A34A', 'solid', 91],
  ['FC Barcelona', 'BAR', 'Barcelona', '#1E3A8A', '#A50044', '#1E3A8A', '#A50044', '#FACC15', 'stripes', 88],
  ['Manchester City', 'MCI', 'Manchester', '#6CABDD', '#FFFFFF', '#FFFFFF', '#6CABDD', '#22C55E', 'solid', 90],
  ['Liverpool', 'LIV', 'Liverpool', '#C8102E', '#FFFFFF', '#C8102E', '#C8102E', '#FDE047', 'solid', 88],
  ['Arsenal', 'ARS', 'London', '#EF0107', '#FFFFFF', '#FFFFFF', '#EF0107', '#FDE047', 'solid', 87],
  ['Bayern Munich', 'BAY', 'Munich', '#DC052D', '#FFFFFF', '#DC052D', '#DC052D', '#22C55E', 'solid', 89],
  ['Paris Saint-Germain', 'PSG', 'Paris', '#004170', '#DA291C', '#004170', '#004170', '#F97316', 'sash', 88],
  ['Inter Milan', 'INT', 'Milan', '#0B1F3B', '#1E88E5', '#0B1F3B', '#0B1F3B', '#FDE047', 'stripes', 86],
  ['Borussia Dortmund', 'DOR', 'Dortmund', '#FDE100', '#111827', '#111827', '#FDE100', '#EF4444', 'solid', 85],
  ['Atletico Madrid', 'ATM', 'Madrid', '#CB3524', '#FFFFFF', '#1E3A8A', '#CB3524', '#22C55E', 'stripes', 85],
  ['Juventus', 'JUV', 'Turin', '#FFFFFF', '#111827', '#FFFFFF', '#111827', '#38BDF8', 'stripes', 84],
  ['AC Milan', 'ACM', 'Milan', '#AC1620', '#111827', '#111827', '#AC1620', '#FACC15', 'stripes', 85],
]);

/* ------------------------------------------------------------------ */
/* NATIONAL TEAMS — exhibition / friendly mode                         */
/* ------------------------------------------------------------------ */
export const NATIONAL_TEAMS = makeTeams('NATIONAL', 'nat', [
  ['Brazil', 'BRA', 'Rio de Janeiro', '#FACC15', '#15803D', '#1D4ED8', '#FFFFFF', '#16A34A', 'solid', 90],
  ['France', 'FRA', 'Paris', '#1E3A8A', '#EF4444', '#FFFFFF', '#DC2626', '#F59E0B', 'solid', 90],
  ['Argentina', 'ARG', 'Buenos Aires', '#6EC7F2', '#FFFFFF', '#0F172A', '#FFFFFF', '#22C55E', 'stripes', 90],
  ['England', 'ENG', 'London', '#FFFFFF', '#1E3A8A', '#1E3A8A', '#FFFFFF', '#EAB308', 'solid', 88],
  ['Spain', 'ESP', 'Madrid', '#DC2626', '#FACC15', '#1E3A8A', '#DC2626', '#38BDF8', 'solid', 88],
  ['Germany', 'GER', 'Berlin', '#FFFFFF', '#111827', '#111827', '#FFFFFF', '#10B981', 'sash', 88],
  ['Portugal', 'POR', 'Lisbon', '#B91C1C', '#15803D', '#15803D', '#B91C1C', '#FACC15', 'solid', 88],
  ['Netherlands', 'NED', 'Amsterdam', '#F97316', '#FFFFFF', '#111827', '#F97316', '#38BDF8', 'solid', 87],
]);

export const CLUB_TEAMS = [...ISL_TEAMS, ...KSL_TEAMS, ...UCL_TEAMS];
export const ALL_TEAMS = [...CLUB_TEAMS, ...NATIONAL_TEAMS];

const TEAM_INDEX = new Map<string, Team>(ALL_TEAMS.map((team) => [team.id, team]));

/** Lets other data modules (e.g. World Cup nations) add teams to the lookup. */
export function registerTeams(teams: Team[]) {
  teams.forEach((team) => TEAM_INDEX.set(team.id, team));
}

export function getTeam(id: string): Team {
  return TEAM_INDEX.get(id) || ALL_TEAMS[0];
}

export interface CompetitionMeta {
  id: CompetitionId;
  name: string;
  shortName: string;
  blurb: string;
  teams: Team[];
  format: 'LEAGUE' | 'LEAGUE_KNOCKOUT';
  leagueRounds: number;
  accent: string;
  accentSoft: string;
  trophy: string;
}

export const COMPETITIONS: Record<CompetitionId, CompetitionMeta> = {
  ISL: {
    id: 'ISL',
    name: 'Indian Super League',
    shortName: 'ISL',
    blurb: 'Twelve Indian clubs, one round-robin season, champion decided on points.',
    teams: ISL_TEAMS,
    format: 'LEAGUE',
    leagueRounds: 11,
    accent: '#38BDF8',
    accentSoft: 'rgba(56,189,248,0.14)',
    trophy: 'ISL Champions',
  },
  KSL: {
    id: 'KSL',
    name: 'Kerala Super League',
    shortName: 'KSL',
    blurb: 'Eight Kerala clubs in a fast seven-matchday league under the floodlights.',
    teams: KSL_TEAMS,
    format: 'LEAGUE',
    leagueRounds: 7,
    accent: '#FACC15',
    accentSoft: 'rgba(250,204,21,0.14)',
    trophy: 'KSL Champions',
  },
  UCL: {
    id: 'UCL',
    name: 'UEFA Champions League',
    shortName: 'UCL',
    blurb: 'Six-matchday league phase, then quarter-finals, semi-finals and the final.',
    teams: UCL_TEAMS,
    format: 'LEAGUE_KNOCKOUT',
    leagueRounds: 6,
    accent: '#A78BFA',
    accentSoft: 'rgba(167,139,250,0.14)',
    trophy: 'Champions League Winners',
  },
};
