import { Team } from '../types/game';
import { buildSquad, registerTeams } from './teams';

/**
 * 2026 FIFA World Cup participants.
 *
 * Source: the final draw held on 5 December 2025 in Washington, D.C. The six
 * play-off slots were resolved in March 2026. Team list and group composition
 * cross-checked against Wikipedia, Britannica and MLSsoccer.com reporting of
 * the draw. Squad members are original fictional players, not real footballers.
 */
type NationSeed = [
  code: string, name: string, short: string, flag: string, group: string,
  primary: string, secondary: string, shorts: string, socks: string, gk: string,
  pattern: Team['pattern'], rating: number,
];

const NATION_SEEDS: NationSeed[] = [
  // Group A
  ['MEX', 'Mexico', 'MEX', '🇲🇽', 'A', '#0B6B3A', '#FFFFFF', '#0B6B3A', '#C8102E', '#F59E0B', 'solid', 83],
  ['RSA', 'South Africa', 'RSA', '🇿🇦', 'A', '#FDE047', '#007A4D', '#FDE047', '#007A4D', '#38BDF8', 'solid', 72],
  ['KOR', 'South Korea', 'KOR', '🇰🇷', 'A', '#C8102E', '#0B1F3B', '#0B1F3B', '#C8102E', '#22C55E', 'solid', 80],
  ['CZE', 'Czechia', 'CZE', '🇨🇿', 'A', '#D7141A', '#11457E', '#FFFFFF', '#D7141A', '#FACC15', 'solid', 76],
  // Group B
  ['CAN', 'Canada', 'CAN', '🇨🇦', 'B', '#C8102E', '#FFFFFF', '#C8102E', '#C8102E', '#22C55E', 'solid', 78],
  ['BIH', 'Bosnia and Herzegovina', 'BIH', '🇧🇦', 'B', '#002395', '#FECB00', '#002395', '#002395', '#F97316', 'sash', 75],
  ['QAT', 'Qatar', 'QAT', '🇶🇦', 'B', '#8A1538', '#FFFFFF', '#FFFFFF', '#8A1538', '#FDE047', 'solid', 73],
  ['SUI', 'Switzerland', 'SUI', '🇨🇭', 'B', '#D52B1E', '#FFFFFF', '#FFFFFF', '#D52B1E', '#111827', 'solid', 82],
  // Group C
  ['BRA', 'Brazil', 'BRA', '🇧🇷', 'C', '#FFDF00', '#009739', '#002776', '#FFFFFF', '#16A34A', 'solid', 89],
  ['MAR', 'Morocco', 'MAR', '🇲🇦', 'C', '#C1272D', '#006233', '#C1272D', '#C1272D', '#FACC15', 'solid', 85],
  ['HAI', 'Haiti', 'HAI', '🇭🇹', 'C', '#00209F', '#D21034', '#D21034', '#00209F', '#22C55E', 'solid', 68],
  ['SCO', 'Scotland', 'SCO', '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'C', '#003F87', '#FFFFFF', '#003F87', '#C8102E', '#FDE047', 'solid', 76],
  // Group D
  ['USA', 'United States', 'USA', '🇺🇸', 'D', '#FFFFFF', '#0A3161', '#0A3161', '#FFFFFF', '#22C55E', 'sash', 84],
  ['PAR', 'Paraguay', 'PAR', '🇵🇾', 'D', '#D52B1E', '#0038A8', '#0038A8', '#FFFFFF', '#FACC15', 'stripes', 75],
  ['AUS', 'Australia', 'AUS', '🇦🇺', 'D', '#FFCD00', '#00843D', '#00843D', '#FFCD00', '#38BDF8', 'solid', 79],
  ['TUR', 'Türkiye', 'TUR', '🇹🇷', 'D', '#E30A17', '#FFFFFF', '#FFFFFF', '#E30A17', '#111827', 'solid', 78],
  // Group E
  ['GER', 'Germany', 'GER', '🇩🇪', 'E', '#FFFFFF', '#111827', '#111827', '#FFFFFF', '#10B981', 'sash', 87],
  ['CUW', 'Curaçao', 'CUW', '🇨🇼', 'E', '#002B7F', '#F9E814', '#002B7F', '#002B7F', '#EF4444', 'solid', 69],
  ['CIV', "Côte d'Ivoire", 'CIV', '🇨🇮', 'E', '#F77F00', '#FFFFFF', '#FFFFFF', '#F77F00', '#22C55E', 'solid', 74],
  ['ECU', 'Ecuador', 'ECU', '🇪🇨', 'E', '#FFDD00', '#0033A0', '#0033A0', '#FFDD00', '#EF4444', 'solid', 80],
  // Group F
  ['NED', 'Netherlands', 'NED', '🇳🇱', 'F', '#F36C21', '#FFFFFF', '#111827', '#F36C21', '#38BDF8', 'solid', 88],
  ['JPN', 'Japan', 'JPN', '🇯🇵', 'F', '#0B1F6B', '#FFFFFF', '#0B1F6B', '#0B1F6B', '#FACC15', 'solid', 82],
  ['SWE', 'Sweden', 'SWE', '🇸🇪', 'F', '#FFCD00', '#005293', '#005293', '#FFCD00', '#EF4444', 'solid', 77],
  ['TUN', 'Tunisia', 'TUN', '🇹🇳', 'F', '#E70013', '#FFFFFF', '#FFFFFF', '#E70013', '#22C55E', 'solid', 75],
  // Group G
  ['BEL', 'Belgium', 'BEL', '🇧🇪', 'G', '#C8102E', '#FDDA24', '#C8102E', '#C8102E', '#22C55E', 'solid', 87],
  ['EGY', 'Egypt', 'EGY', '🇪🇬', 'G', '#C8102E', '#FFFFFF', '#FFFFFF', '#C8102E', '#FACC15', 'solid', 76],
  ['IRN', 'Iran', 'IRN', '🇮🇷', 'G', '#FFFFFF', '#239F40', '#FFFFFF', '#DA0000', '#38BDF8', 'solid', 81],
  ['NZL', 'New Zealand', 'NZL', '🇳🇿', 'G', '#FFFFFF', '#111827', '#111827', '#FFFFFF', '#F97316', 'solid', 68],
  // Group H
  ['ESP', 'Spain', 'ESP', '🇪🇸', 'H', '#C60B1E', '#FFC400', '#0B1F6B', '#C60B1E', '#38BDF8', 'solid', 91],
  ['CPV', 'Cabo Verde', 'CPV', '🇨🇻', 'H', '#003893', '#FFFFFF', '#FFFFFF', '#003893', '#FACC15', 'solid', 71],
  ['KSA', 'Saudi Arabia', 'KSA', '🇸🇦', 'H', '#FFFFFF', '#006C35', '#006C35', '#FFFFFF', '#F97316', 'solid', 72],
  ['URU', 'Uruguay', 'URU', '🇺🇾', 'H', '#5CBFEB', '#111827', '#111827', '#111827', '#FDE047', 'solid', 83],
  // Group I
  ['FRA', 'France', 'FRA', '🇫🇷', 'I', '#1E3A8A', '#EF4444', '#FFFFFF', '#C8102E', '#F59E0B', 'solid', 90],
  ['SEN', 'Senegal', 'SEN', '🇸🇳', 'I', '#FFFFFF', '#00853F', '#00853F', '#FFFFFF', '#EF4444', 'solid', 81],
  ['IRQ', 'Iraq', 'IRQ', '🇮🇶', 'I', '#007A3D', '#FFFFFF', '#FFFFFF', '#007A3D', '#FACC15', 'solid', 71],
  ['NOR', 'Norway', 'NOR', '🇳🇴', 'I', '#BA0C2F', '#00205B', '#00205B', '#BA0C2F', '#22C55E', 'solid', 78],
  // Group J
  ['ARG', 'Argentina', 'ARG', '🇦🇷', 'J', '#6EC7F2', '#FFFFFF', '#0B1F3B', '#FFFFFF', '#22C55E', 'stripes', 91],
  ['ALG', 'Algeria', 'ALG', '🇩🇿', 'J', '#FFFFFF', '#007229', '#007229', '#FFFFFF', '#F97316', 'solid', 76],
  ['AUT', 'Austria', 'AUT', '🇦🇹', 'J', '#ED2939', '#FFFFFF', '#FFFFFF', '#ED2939', '#38BDF8', 'solid', 79],
  ['JOR', 'Jordan', 'JOR', '🇯🇴', 'J', '#111827', '#CE1126', '#111827', '#111827', '#FDE047', 'solid', 71],
  // Group K
  ['POR', 'Portugal', 'POR', '🇵🇹', 'K', '#C8102E', '#046A38', '#046A38', '#C8102E', '#FACC15', 'solid', 88],
  ['COD', 'Congo DR', 'COD', '🇨🇩', 'K', '#007FFF', '#F7D618', '#007FFF', '#007FFF', '#EF4444', 'sash', 74],
  ['UZB', 'Uzbekistan', 'UZB', '🇺🇿', 'K', '#FFFFFF', '#1EB53A', '#0099B5', '#FFFFFF', '#F97316', 'solid', 73],
  ['COL', 'Colombia', 'COL', '🇨🇴', 'K', '#FCD116', '#003893', '#003893', '#C8102E', '#22C55E', 'solid', 84],
  // Group L
  ['ENG', 'England', 'ENG', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'L', '#FFFFFF', '#1E3A8A', '#1E3A8A', '#FFFFFF', '#FACC15', 'solid', 90],
  ['CRO', 'Croatia', 'CRO', '🇭🇷', 'L', '#FFFFFF', '#C8102E', '#0B1F6B', '#FFFFFF', '#38BDF8', 'stripes', 86],
  ['GHA', 'Ghana', 'GHA', '🇬🇭', 'L', '#FFFFFF', '#CE1126', '#FFFFFF', '#FCD116', '#22C55E', 'solid', 70],
  ['PAN', 'Panama', 'PAN', '🇵🇦', 'L', '#DA121A', '#0B1F6B', '#0B1F6B', '#DA121A', '#22C55E', 'solid', 77],
];

export const WC_GROUP_IDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

export interface Nation extends Team {
  code: string;
  group: string;
}

export const NATIONS: Nation[] = NATION_SEEDS.map((seed) => {
  const [code, name, short, flag, group, primary, secondary, shorts, socks, gk, pattern, rating] = seed;
  const id = `wc_${code.toLowerCase()}`;
  const nation: Nation = {
    id,
    code,
    group,
    name,
    shortName: short,
    city: name,
    category: 'NATIONAL',
    flag,
    primaryColor: primary,
    secondaryColor: secondary,
    shortsColor: shorts,
    socksColor: typeof socks === 'string' && socks.startsWith('#') ? socks : primary,
    gkColor: gk,
    pattern,
    rating,
    players: [],
  };
  nation.players = buildSquad({ id, rating, category: 'NATIONAL' });
  return nation;
});

registerTeams(NATIONS);

const BY_CODE = new Map(NATIONS.map((nation) => [nation.code, nation]));

export function nationByCode(code: string): Nation {
  return BY_CODE.get(code) || NATIONS[0];
}

export function nationIdByCode(code: string): string {
  return nationByCode(code).id;
}

export function nationsInGroup(group: string): Nation[] {
  return NATIONS.filter((nation) => nation.group === group);
}

/** The 16 host venues used by the 2026 tournament schedule. */
export const WC_VENUES = [
  'Atlanta', 'Boston', 'Dallas', 'Guadalajara', 'Houston', 'Kansas City',
  'Los Angeles', 'Mexico City', 'Miami', 'Monterrey', 'New York-New Jersey',
  'Philadelphia', 'San Francisco', 'Seattle', 'Toronto', 'Vancouver',
];
