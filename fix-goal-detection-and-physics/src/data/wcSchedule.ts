import { WCFixture, WCSlot } from '../types/game';
import { nationIdByCode } from './nations';

/**
 * Official 2026 FIFA World Cup match schedule.
 *
 * Match numbers, dates, venues and the knockout bracket links below are the real
 * published tournament numbers (matches 1-104). They are stored as immutable data
 * and are never renumbered by the game. Simulated results produced inside this app
 * are clearly separated from the real-world outcomes of these fixtures.
 */
export const WC_EDITION = '2026 FIFA World Cup';
export const WC_DATA_SOURCE =
  'Official fixture numbers, dates, venues and bracket from the FIFA World Cup 2026 schedule (final draw, 5 December 2025; play-off slots resolved March 2026).';

type GroupRow = [matchNo: number, group: string, home: string, away: string, date: string, venue: string];

/* ---------------- Group stage: matches 1-72 (official) ---------------- */
const GROUP_ROWS: GroupRow[] = [
  [1, 'A', 'MEX', 'RSA', 'Jun 11', 'Mexico City'],
  [2, 'A', 'KOR', 'CZE', 'Jun 11', 'Guadalajara'],
  [3, 'B', 'CAN', 'BIH', 'Jun 12', 'Toronto'],
  [4, 'D', 'USA', 'PAR', 'Jun 12', 'Los Angeles'],
  [5, 'D', 'AUS', 'TUR', 'Jun 13', 'Vancouver'],
  [6, 'B', 'QAT', 'SUI', 'Jun 13', 'San Francisco'],
  [7, 'C', 'BRA', 'MAR', 'Jun 13', 'New York-New Jersey'],
  [8, 'C', 'HAI', 'SCO', 'Jun 13', 'Boston'],
  [9, 'E', 'GER', 'CUW', 'Jun 14', 'Houston'],
  [10, 'F', 'NED', 'JPN', 'Jun 14', 'Dallas'],
  [11, 'E', 'CIV', 'ECU', 'Jun 14', 'Philadelphia'],
  [12, 'F', 'SWE', 'TUN', 'Jun 14', 'Monterrey'],
  [13, 'H', 'ESP', 'CPV', 'Jun 15', 'Atlanta'],
  [14, 'G', 'BEL', 'EGY', 'Jun 15', 'Seattle'],
  [15, 'H', 'KSA', 'URU', 'Jun 15', 'Miami'],
  [16, 'G', 'IRN', 'NZL', 'Jun 15', 'Los Angeles'],
  [17, 'I', 'FRA', 'SEN', 'Jun 16', 'New York-New Jersey'],
  [18, 'I', 'IRQ', 'NOR', 'Jun 16', 'Boston'],
  [19, 'J', 'ARG', 'ALG', 'Jun 16', 'Kansas City'],
  [20, 'J', 'AUT', 'JOR', 'Jun 16', 'San Francisco'],
  [21, 'K', 'POR', 'COD', 'Jun 17', 'Houston'],
  [22, 'L', 'ENG', 'CRO', 'Jun 17', 'Dallas'],
  [23, 'L', 'GHA', 'PAN', 'Jun 17', 'Toronto'],
  [24, 'K', 'UZB', 'COL', 'Jun 17', 'Mexico City'],
  [25, 'A', 'CZE', 'RSA', 'Jun 18', 'Atlanta'],
  [26, 'B', 'SUI', 'BIH', 'Jun 18', 'Los Angeles'],
  [27, 'B', 'CAN', 'QAT', 'Jun 18', 'Vancouver'],
  [28, 'A', 'MEX', 'KOR', 'Jun 18', 'Guadalajara'],
  [29, 'D', 'TUR', 'PAR', 'Jun 19', 'San Francisco'],
  [30, 'D', 'USA', 'AUS', 'Jun 19', 'Seattle'],
  [31, 'C', 'SCO', 'MAR', 'Jun 19', 'Boston'],
  [32, 'C', 'BRA', 'HAI', 'Jun 19', 'Philadelphia'],
  [33, 'F', 'NED', 'SWE', 'Jun 20', 'Houston'],
  [34, 'E', 'GER', 'CIV', 'Jun 20', 'Toronto'],
  [35, 'E', 'CUW', 'ECU', 'Jun 20', 'Kansas City'],
  [36, 'F', 'TUN', 'JPN', 'Jun 20', 'Monterrey'],
  [37, 'H', 'ESP', 'KSA', 'Jun 21', 'Atlanta'],
  [38, 'G', 'BEL', 'IRN', 'Jun 21', 'Los Angeles'],
  [39, 'H', 'URU', 'CPV', 'Jun 21', 'Miami'],
  [40, 'G', 'NZL', 'EGY', 'Jun 21', 'Vancouver'],
  [41, 'J', 'ARG', 'AUT', 'Jun 22', 'Dallas'],
  [42, 'I', 'FRA', 'IRQ', 'Jun 22', 'Philadelphia'],
  [43, 'I', 'NOR', 'SEN', 'Jun 22', 'New York-New Jersey'],
  [44, 'J', 'JOR', 'ALG', 'Jun 22', 'San Francisco'],
  [45, 'K', 'POR', 'UZB', 'Jun 23', 'Houston'],
  [46, 'L', 'ENG', 'GHA', 'Jun 23', 'Boston'],
  [47, 'L', 'PAN', 'CRO', 'Jun 23', 'Toronto'],
  [48, 'K', 'COL', 'COD', 'Jun 23', 'Guadalajara'],
  [49, 'B', 'SUI', 'CAN', 'Jun 24', 'Vancouver'],
  [50, 'B', 'BIH', 'QAT', 'Jun 24', 'Seattle'],
  [51, 'C', 'SCO', 'BRA', 'Jun 24', 'Miami'],
  [52, 'C', 'MAR', 'HAI', 'Jun 24', 'Atlanta'],
  [53, 'A', 'CZE', 'MEX', 'Jun 24', 'Mexico City'],
  [54, 'A', 'RSA', 'KOR', 'Jun 24', 'Monterrey'],
  [55, 'E', 'ECU', 'GER', 'Jun 25', 'New York-New Jersey'],
  [56, 'E', 'CUW', 'CIV', 'Jun 25', 'Philadelphia'],
  [57, 'F', 'JPN', 'SWE', 'Jun 25', 'Dallas'],
  [58, 'F', 'TUN', 'NED', 'Jun 25', 'Kansas City'],
  [59, 'D', 'TUR', 'USA', 'Jun 25', 'Los Angeles'],
  [60, 'D', 'PAR', 'AUS', 'Jun 25', 'San Francisco'],
  [61, 'I', 'NOR', 'FRA', 'Jun 26', 'Boston'],
  [62, 'I', 'SEN', 'IRQ', 'Jun 26', 'Toronto'],
  [63, 'H', 'CPV', 'KSA', 'Jun 26', 'Houston'],
  [64, 'H', 'URU', 'ESP', 'Jun 26', 'Guadalajara'],
  [65, 'G', 'EGY', 'IRN', 'Jun 26', 'Seattle'],
  [66, 'G', 'NZL', 'BEL', 'Jun 26', 'Vancouver'],
  [67, 'L', 'PAN', 'ENG', 'Jun 27', 'New York-New Jersey'],
  [68, 'L', 'CRO', 'GHA', 'Jun 27', 'Philadelphia'],
  [69, 'K', 'COL', 'POR', 'Jun 27', 'Miami'],
  [70, 'K', 'COD', 'UZB', 'Jun 27', 'Atlanta'],
  [71, 'J', 'ALG', 'AUT', 'Jun 27', 'Kansas City'],
  [72, 'J', 'JOR', 'ARG', 'Jun 27', 'Dallas'],
];

const winner = (group: string): WCSlot => ({ kind: 'GROUP_WINNER', group });
const runner = (group: string): WCSlot => ({ kind: 'GROUP_RUNNER', group });
const third = (groups: string, slotIndex: number): WCSlot => ({
  kind: 'BEST_THIRD', thirdGroups: groups.split('/'), slotIndex,
});
const winOf = (matchNo: number): WCSlot => ({ kind: 'MATCH_WINNER', matchNo });
const loseOf = (matchNo: number): WCSlot => ({ kind: 'MATCH_LOSER', matchNo });

type KnockRow = [matchNo: number, stage: WCFixture['stage'], home: WCSlot, away: WCSlot, date: string, venue: string];

/* ------- Round of 32 to Final: matches 73-104 (official bracket) ------- */
const KNOCKOUT_ROWS: KnockRow[] = [
  [73, 'R32', runner('A'), runner('B'), 'Jun 28', 'Los Angeles'],
  [74, 'R32', winner('E'), third('A/B/C/D/F', 0), 'Jun 29', 'Boston'],
  [75, 'R32', winner('F'), runner('C'), 'Jun 29', 'Monterrey'],
  [76, 'R32', winner('C'), runner('F'), 'Jun 29', 'Houston'],
  [77, 'R32', winner('I'), third('C/D/F/G/H', 1), 'Jun 30', 'New York-New Jersey'],
  [78, 'R32', runner('E'), runner('I'), 'Jun 30', 'Dallas'],
  [79, 'R32', winner('A'), third('C/E/F/H/I', 2), 'Jun 30', 'Mexico City'],
  [80, 'R32', winner('L'), third('E/H/I/J/K', 3), 'Jul 1', 'Atlanta'],
  [81, 'R32', winner('D'), third('B/E/F/I/J', 4), 'Jul 1', 'San Francisco'],
  [82, 'R32', winner('G'), third('A/E/H/I/J', 5), 'Jul 1', 'Seattle'],
  [83, 'R32', runner('K'), runner('L'), 'Jul 2', 'Toronto'],
  [84, 'R32', winner('H'), runner('J'), 'Jul 2', 'Los Angeles'],
  [85, 'R32', winner('B'), third('E/F/G/I/J', 6), 'Jul 2', 'Vancouver'],
  [86, 'R32', winner('J'), runner('H'), 'Jul 3', 'Miami'],
  [87, 'R32', winner('K'), third('D/E/I/J/L', 7), 'Jul 3', 'Kansas City'],
  [88, 'R32', runner('D'), runner('G'), 'Jul 3', 'Dallas'],

  [89, 'R16', winOf(74), winOf(77), 'Jul 4', 'Philadelphia'],
  [90, 'R16', winOf(73), winOf(75), 'Jul 4', 'Houston'],
  [91, 'R16', winOf(76), winOf(78), 'Jul 5', 'New York-New Jersey'],
  [92, 'R16', winOf(79), winOf(80), 'Jul 5', 'Mexico City'],
  [93, 'R16', winOf(83), winOf(84), 'Jul 6', 'Dallas'],
  [94, 'R16', winOf(81), winOf(82), 'Jul 6', 'Seattle'],
  [95, 'R16', winOf(86), winOf(88), 'Jul 7', 'Atlanta'],
  [96, 'R16', winOf(85), winOf(87), 'Jul 7', 'Vancouver'],

  [97, 'QF', winOf(89), winOf(90), 'Jul 9', 'Boston'],
  [98, 'QF', winOf(93), winOf(94), 'Jul 10', 'Los Angeles'],
  [99, 'QF', winOf(91), winOf(92), 'Jul 11', 'Miami'],
  [100, 'QF', winOf(95), winOf(96), 'Jul 11', 'Kansas City'],

  [101, 'SF', winOf(97), winOf(98), 'Jul 14', 'Dallas'],
  [102, 'SF', winOf(99), winOf(100), 'Jul 15', 'Atlanta'],

  [103, 'THIRD', loseOf(101), loseOf(102), 'Jul 18', 'Miami'],
  [104, 'FINAL', winOf(101), winOf(102), 'Jul 19', 'New York-New Jersey'],
];

export function buildOfficialFixtures(): WCFixture[] {
  const groupFixtures: WCFixture[] = GROUP_ROWS.map(([matchNo, group, home, away, date, venue]) => ({
    matchNo,
    official: true,
    stage: 'GROUP',
    group,
    date,
    venue,
    home: { kind: 'TEAM', teamId: nationIdByCode(home) },
    away: { kind: 'TEAM', teamId: nationIdByCode(away) },
    homeId: nationIdByCode(home),
    awayId: nationIdByCode(away),
    homeGoals: null, awayGoals: null, homePens: null, awayPens: null,
    played: false,
  }));

  const knockoutFixtures: WCFixture[] = KNOCKOUT_ROWS.map(([matchNo, stage, home, away, date, venue]) => ({
    matchNo,
    official: true,
    stage,
    date,
    venue,
    home,
    away,
    homeId: null,
    awayId: null,
    homeGoals: null, awayGoals: null, homePens: null, awayPens: null,
    played: false,
  }));

  return [...groupFixtures, ...knockoutFixtures];
}

export const WC_STAGE_LABEL: Record<WCFixture['stage'], string> = {
  GROUP: 'Group stage',
  R32: 'Round of 32',
  R16: 'Round of 16',
  QF: 'Quarter-final',
  SF: 'Semi-final',
  THIRD: 'Third-place play-off',
  FINAL: 'Final',
};
