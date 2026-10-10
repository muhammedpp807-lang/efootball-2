import { Standing, WCFixture, WCSlot, WorldCupState } from '../types/game';
import { NATIONS, WC_GROUP_IDS, nationsInGroup } from '../data/nations';
import { buildOfficialFixtures, WC_EDITION } from '../data/wcSchedule';
import { getTeam } from '../data/teams';

export function createWorldCup(userTeamId: string): WorldCupState {
  return {
    edition: WC_EDITION,
    verified: true,
    userTeamId,
    fixtures: buildOfficialFixtures(),
    champion: null,
    runnerUp: null,
    thirdPlace: null,
    createdAt: Date.now(),
  };
}

function emptyRow(teamId: string): Standing {
  return { teamId, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 };
}

/** Group table with FIFA ordering: points, goal difference, goals scored, head-to-head. */
export function groupTable(state: WorldCupState, group: string): Standing[] {
  const rows = new Map<string, Standing>();
  nationsInGroup(group).forEach((nation) => rows.set(nation.id, emptyRow(nation.id)));

  const fixtures = state.fixtures.filter(
    (f) => f.stage === 'GROUP' && f.group === group && f.played && f.homeId && f.awayId
  );

  fixtures.forEach((f) => {
    const home = rows.get(f.homeId as string);
    const away = rows.get(f.awayId as string);
    if (!home || !away || f.homeGoals === null || f.awayGoals === null) return;
    home.played++; away.played++;
    home.gf += f.homeGoals; home.ga += f.awayGoals;
    away.gf += f.awayGoals; away.ga += f.homeGoals;
    if (f.homeGoals > f.awayGoals) { home.won++; home.points += 3; away.lost++; }
    else if (f.homeGoals < f.awayGoals) { away.won++; away.points += 3; home.lost++; }
    else { home.drawn++; away.drawn++; home.points++; away.points++; }
  });

  const list = [...rows.values()];
  list.forEach((row) => { row.gd = row.gf - row.ga; });

  return list.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    const h2h = headToHead(fixtures, a.teamId, b.teamId);
    if (h2h !== 0) return h2h;
    return getTeam(a.teamId).name.localeCompare(getTeam(b.teamId).name);
  });
}

function headToHead(fixtures: WCFixture[], aId: string, bId: string): number {
  const match = fixtures.find(
    (f) => (f.homeId === aId && f.awayId === bId) || (f.homeId === bId && f.awayId === aId)
  );
  if (!match || match.homeGoals === null || match.awayGoals === null) return 0;
  const aGoals = match.homeId === aId ? match.homeGoals : match.awayGoals;
  const bGoals = match.homeId === aId ? match.awayGoals : match.homeGoals;
  return bGoals - aGoals;
}

export function groupStageComplete(state: WorldCupState): boolean {
  return state.fixtures.filter((f) => f.stage === 'GROUP').every((f) => f.played);
}

/** The eight best third-placed teams, ranked across all twelve groups. */
export function bestThirds(state: WorldCupState): { teamId: string; group: string; row: Standing }[] {
  const thirds = WC_GROUP_IDS.map((group) => {
    const table = groupTable(state, group);
    return { group, row: table[2], teamId: table[2]?.teamId };
  }).filter((entry) => entry.teamId);

  return thirds
    .sort((a, b) =>
      b.row.points - a.row.points ||
      b.row.gd - a.row.gd ||
      b.row.gf - a.row.gf ||
      getTeam(a.teamId).name.localeCompare(getTeam(b.teamId).name)
    )
    .slice(0, 8)
    .map((entry) => ({ teamId: entry.teamId as string, group: entry.group, row: entry.row }));
}

export function fixtureWinnerId(f: WCFixture): string | null {
  if (!f.played || f.homeGoals === null || f.awayGoals === null) return null;
  if (f.homeGoals > f.awayGoals) return f.homeId;
  if (f.awayGoals > f.homeGoals) return f.awayId;
  if (f.homePens !== null && f.awayPens !== null) {
    return f.homePens > f.awayPens ? f.homeId : f.awayId;
  }
  return null;
}

export function fixtureLoserId(f: WCFixture): string | null {
  const win = fixtureWinnerId(f);
  if (!win) return null;
  return win === f.homeId ? f.awayId : f.homeId;
}

/**
 * Assigns the eight qualified third-placed teams to the eight bracket slots.
 * Each slot only accepts thirds from a fixed set of groups, so this is solved as
 * a constraint matching problem (most constrained slot first, with backtracking).
 */
function assignThirds(state: WorldCupState, slots: { index: number; groups: string[] }[]):
Record<number, string> {
  const thirds = bestThirds(state);
  const byGroup = new Map(thirds.map((t) => [t.group, t.teamId]));
  const available = new Set(thirds.map((t) => t.group));
  const result: Record<number, string> = {};

  const order = [...slots].sort((a, b) => a.groups.length - b.groups.length);

  const solve = (depth: number): boolean => {
    if (depth >= order.length) return true;
    const slot = order[depth];
    for (const group of slot.groups) {
      if (!available.has(group)) continue;
      available.delete(group);
      result[slot.index] = byGroup.get(group) as string;
      if (solve(depth + 1)) return true;
      available.add(group);
      delete result[slot.index];
    }
    return false;
  };

  if (!solve(0)) {
    // Fallback: fill remaining slots in ranking order so the bracket is never broken.
    const pool = thirds.map((t) => t.group).filter((g) => available.has(g));
    order.forEach((slot, i) => {
      if (result[slot.index] === undefined && pool[i]) {
        result[slot.index] = byGroup.get(pool[i]) as string;
      }
    });
  }
  return result;
}

function resolveSlot(
  state: WorldCupState,
  slot: WCSlot,
  thirdAssignment: Record<number, string>
): string | null {
  switch (slot.kind) {
    case 'TEAM':
      return slot.teamId ?? null;
    case 'GROUP_WINNER': {
      if (!groupStageComplete(state)) return null;
      return groupTable(state, slot.group as string)[0]?.teamId ?? null;
    }
    case 'GROUP_RUNNER': {
      if (!groupStageComplete(state)) return null;
      return groupTable(state, slot.group as string)[1]?.teamId ?? null;
    }
    case 'BEST_THIRD': {
      if (!groupStageComplete(state)) return null;
      return thirdAssignment[slot.slotIndex as number] ?? null;
    }
    case 'MATCH_WINNER': {
      const src = state.fixtures.find((f) => f.matchNo === slot.matchNo);
      return src ? fixtureWinnerId(src) : null;
    }
    case 'MATCH_LOSER': {
      const src = state.fixtures.find((f) => f.matchNo === slot.matchNo);
      return src ? fixtureLoserId(src) : null;
    }
    default:
      return null;
  }
}

/** Fills in every knockout fixture whose participants are now known. */
export function resolveBracket(state: WorldCupState): WorldCupState {
  const next: WorldCupState = { ...state, fixtures: state.fixtures.map((f) => ({ ...f })) };

  const thirdSlots = next.fixtures
    .filter((f) => f.home.kind === 'BEST_THIRD' || f.away.kind === 'BEST_THIRD')
    .map((f) => (f.home.kind === 'BEST_THIRD' ? f.home : f.away))
    .map((slot) => ({ index: slot.slotIndex as number, groups: slot.thirdGroups as string[] }));

  const assignment = groupStageComplete(next) ? assignThirds(next, thirdSlots) : {};

  next.fixtures.forEach((f) => {
    if (f.played) return;
    f.homeId = resolveSlot(next, f.home, assignment);
    f.awayId = resolveSlot(next, f.away, assignment);
  });

  const final = next.fixtures.find((f) => f.matchNo === 104);
  const third = next.fixtures.find((f) => f.matchNo === 103);
  next.champion = final && final.played ? fixtureWinnerId(final) : null;
  next.runnerUp = final && final.played ? fixtureLoserId(final) : null;
  next.thirdPlace = third && third.played ? fixtureWinnerId(third) : null;

  return next;
}

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** In-game simulation of a CPU-vs-CPU fixture. Never a real-world result. */
export function simulateWCFixture(f: WCFixture, salt: number): { home: number; away: number; pens?: [number, number] } {
  if (!f.homeId || !f.awayId) return { home: 0, away: 0 };
  const home = getTeam(f.homeId);
  const away = getTeam(f.awayId);
  const rand = mulberry(f.matchNo * 7919 + salt);

  const goals = (attack: number, defence: number, boost: number) => {
    const p = Math.max(0.05, Math.min(0.5, 0.16 + (attack + boost - defence) / 180));
    let total = 0;
    for (let i = 0; i < 5; i++) if (rand() < p) total++;
    return total;
  };

  let h = goals(home.rating, away.rating, 2);
  const a = goals(away.rating, home.rating, 0);

  if (f.stage !== 'GROUP' && h === a) {
    if (rand() < 0.3) h++;
    else {
      let ph = 3 + Math.floor(rand() * 3);
      const pa = 3 + Math.floor(rand() * 3);
      if (ph === pa) ph += 1;
      return { home: h, away: a, pens: [ph, pa] };
    }
  }
  return { home: h, away: a };
}

export function applyWCResult(
  state: WorldCupState,
  matchNo: number,
  homeGoals: number,
  awayGoals: number,
  pens?: [number, number] | null
): WorldCupState {
  const next: WorldCupState = { ...state, fixtures: state.fixtures.map((f) => ({ ...f })) };
  const fixture = next.fixtures.find((f) => f.matchNo === matchNo);
  // Guard: a fixture result can only ever be written once.
  if (!fixture || fixture.played) return state;

  fixture.homeGoals = homeGoals;
  fixture.awayGoals = awayGoals;
  fixture.homePens = pens ? pens[0] : null;
  fixture.awayPens = pens ? pens[1] : null;
  fixture.played = true;
  return resolveBracket(next);
}

export function nextUserWCFixture(state: WorldCupState): WCFixture | null {
  return state.fixtures.find(
    (f) => !f.played && (f.homeId === state.userTeamId || f.awayId === state.userTeamId)
  ) ?? null;
}

export function userEliminated(state: WorldCupState): boolean {
  if (state.champion) return true;
  if (nextUserWCFixture(state)) return false;
  return state.fixtures.some((f) => f.played);
}

/** Simulates every outstanding fixture that the user is not involved in, up to their next match. */
export function simulateUpToUserMatch(state: WorldCupState): WorldCupState {
  let next = resolveBracket(state);
  let guard = 0;

  while (guard++ < 140) {
    const pending = next.fixtures.find((f) => !f.played && f.homeId && f.awayId);
    if (!pending) break;
    if (pending.homeId === next.userTeamId || pending.awayId === next.userTeamId) break;

    const result = simulateWCFixture(pending, next.createdAt % 997);
    next = applyWCResult(next, pending.matchNo, result.home, result.away, result.pens ?? null);
  }
  return next;
}

/** Simulates one fixture only (the next pending one, user match included). */
export function simulateSingle(state: WorldCupState, matchNo: number): WorldCupState {
  const fixture = state.fixtures.find((f) => f.matchNo === matchNo);
  if (!fixture || fixture.played || !fixture.homeId || !fixture.awayId) return state;
  const result = simulateWCFixture(fixture, state.createdAt % 997);
  return applyWCResult(state, matchNo, result.home, result.away, result.pens ?? null);
}

export function qualificationLabel(state: WorldCupState, teamId: string): string | null {
  if (!groupStageComplete(state)) return null;
  const nation = NATIONS.find((n) => n.id === teamId);
  if (!nation) return null;
  const table = groupTable(state, nation.group);
  const position = table.findIndex((row) => row.teamId === teamId);
  if (position === 0) return 'Group winner';
  if (position === 1) return 'Runner-up';
  if (position === 2) {
    return bestThirds(state).some((t) => t.teamId === teamId) ? 'Best third' : 'Eliminated';
  }
  return 'Eliminated';
}
