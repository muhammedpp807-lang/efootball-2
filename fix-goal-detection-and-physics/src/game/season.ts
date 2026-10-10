import { COMPETITIONS, getTeam } from '../data/teams';
import { CompetitionId, Fixture, SeasonState, Stage, Standing } from '../types/game';

/* Circle-method schedule: every pairing appears exactly once. */
function roundRobin(ids: string[]): { home: string; away: string }[][] {
  const arr = [...ids];
  const n = arr.length;
  const rounds: { home: string; away: string }[][] = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs: { home: string; away: string }[] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      pairs.push(r % 2 === 0 ? { home: a, away: b } : { home: b, away: a });
    }
    rounds.push(pairs);
    arr.splice(1, 0, arr.pop() as string);
  }
  return rounds;
}

export function createSeason(competitionId: CompetitionId, userTeamId: string): SeasonState {
  const meta = COMPETITIONS[competitionId];
  const ids = meta.teams.map((t) => t.id);
  const rounds = roundRobin(ids).slice(0, meta.leagueRounds);

  const fixtures: Fixture[] = [];
  rounds.forEach((pairs, roundIndex) => {
    pairs.forEach((pair, matchIndex) => {
      fixtures.push({
        id: `${competitionId}-L${roundIndex + 1}-${matchIndex}`,
        round: roundIndex + 1,
        stage: 'LEAGUE',
        homeId: pair.home,
        awayId: pair.away,
        homeGoals: null,
        awayGoals: null,
        homePens: null,
        awayPens: null,
        played: false,
        userMatch: pair.home === userTeamId || pair.away === userTeamId,
      });
    });
  });

  return {
    competitionId,
    userTeamId,
    fixtures,
    stage: 'LEAGUE',
    champion: null,
    createdAt: Date.now(),
  };
}

export function computeStandings(season: SeasonState): Standing[] {
  const meta = COMPETITIONS[season.competitionId];
  const table = new Map<string, Standing>();
  meta.teams.forEach((team) => {
    table.set(team.id, {
      teamId: team.id, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0,
    });
  });

  season.fixtures.forEach((f) => {
    if (!f.played || f.stage !== 'LEAGUE' || f.homeGoals === null || f.awayGoals === null) return;
    const home = table.get(f.homeId);
    const away = table.get(f.awayId);
    if (!home || !away) return;

    home.played++; away.played++;
    home.gf += f.homeGoals; home.ga += f.awayGoals;
    away.gf += f.awayGoals; away.ga += f.homeGoals;

    if (f.homeGoals > f.awayGoals) { home.won++; home.points += 3; away.lost++; }
    else if (f.homeGoals < f.awayGoals) { away.won++; away.points += 3; home.lost++; }
    else { home.drawn++; away.drawn++; home.points++; away.points++; }
  });

  const rows = [...table.values()];
  rows.forEach((row) => { row.gd = row.gf - row.ga; });
  return rows.sort((a, b) =>
    b.points - a.points ||
    b.gd - a.gd ||
    b.gf - a.gf ||
    getTeam(a.teamId).name.localeCompare(getTeam(b.teamId).name)
  );
}

export function nextUserFixture(season: SeasonState): Fixture | null {
  return season.fixtures.find((f) => f.userMatch && !f.played) || null;
}

export function fixtureWinner(f: Fixture): string | null {
  if (!f.played || f.homeGoals === null || f.awayGoals === null) return null;
  if (f.homeGoals > f.awayGoals) return f.homeId;
  if (f.awayGoals > f.homeGoals) return f.awayId;
  if (f.homePens !== null && f.awayPens !== null) {
    return f.homePens > f.awayPens ? f.homeId : f.awayId;
  }
  return null;
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

/* CPU-vs-CPU fixtures are simulated from team ratings (clearly simulated results). */
export function simulateFixture(fixture: Fixture, salt = 0): { home: number; away: number; pens?: [number, number] } {
  const home = getTeam(fixture.homeId);
  const away = getTeam(fixture.awayId);
  let seedSource = salt + fixture.round * 31;
  for (let i = 0; i < fixture.id.length; i++) seedSource += fixture.id.charCodeAt(i) * (i + 3);
  const rand = mulberry(seedSource);

  const goalsFor = (attack: number, defence: number, boost: number) => {
    const p = Math.max(0.06, Math.min(0.55, 0.17 + (attack + boost - defence) / 170));
    let goals = 0;
    for (let i = 0; i < 5; i++) if (rand() < p) goals++;
    return goals;
  };

  let h = goalsFor(home.rating, away.rating, 3);
  let a = goalsFor(away.rating, home.rating, 0);

  if (fixture.stage !== 'LEAGUE' && h === a) {
    // Knockout ties need a winner: extra time, then penalties.
    if (rand() < 0.35) { if (rand() < 0.5) h++; else a++; }
    else {
      let ph = 3 + Math.floor(rand() * 3);
      let pa = 3 + Math.floor(rand() * 3);
      if (ph === pa) ph += rand() < 0.5 ? 1 : -1;
      return { home: h, away: a, pens: [ph, Math.max(0, pa)] };
    }
  }
  return { home: h, away: a };
}

function cloneSeason(season: SeasonState): SeasonState {
  return { ...season, fixtures: season.fixtures.map((f) => ({ ...f })) };
}

export function applyResult(
  season: SeasonState,
  fixtureId: string,
  homeGoals: number,
  awayGoals: number,
  pens?: [number, number] | null
): SeasonState {
  const next = cloneSeason(season);
  const fixture = next.fixtures.find((f) => f.id === fixtureId);
  // Guard against duplicate result writes.
  if (!fixture || fixture.played) return season;

  fixture.homeGoals = homeGoals;
  fixture.awayGoals = awayGoals;
  fixture.homePens = pens ? pens[0] : null;
  fixture.awayPens = pens ? pens[1] : null;
  fixture.played = true;
  return next;
}

export function simulateRound(season: SeasonState, round: number, excludeFixtureId?: string): SeasonState {
  const next = cloneSeason(season);
  next.fixtures.forEach((f) => {
    if (f.round !== round || f.played || f.id === excludeFixtureId) return;
    const result = simulateFixture(f, next.createdAt % 1000);
    f.homeGoals = result.home;
    f.awayGoals = result.away;
    f.homePens = result.pens ? result.pens[0] : null;
    f.awayPens = result.pens ? result.pens[1] : null;
    f.played = true;
  });
  return next;
}

const STAGE_ORDER: Stage[] = ['LEAGUE', 'QF', 'SF', 'FINAL'];

export function stageLabel(stage: Stage, round?: number) {
  if (stage === 'LEAGUE') return round ? `Matchday ${round}` : 'League phase';
  if (stage === 'QF') return 'Quarter-final';
  if (stage === 'SF') return 'Semi-final';
  return 'Final';
}

/* Creates the next knockout round (UCL) or crowns the league champion. */
export function advanceSeason(season: SeasonState): SeasonState {
  const meta = COMPETITIONS[season.competitionId];
  const next = cloneSeason(season);
  const stageFixtures = (stage: Stage) => next.fixtures.filter((f) => f.stage === stage);
  const allPlayed = (stage: Stage) => {
    const list = stageFixtures(stage);
    return list.length > 0 && list.every((f) => f.played);
  };

  if (!allPlayed(next.stage)) return next;

  if (meta.format === 'LEAGUE') {
    if (next.stage === 'LEAGUE' && !next.champion) {
      next.champion = computeStandings(next)[0]?.teamId ?? null;
    }
    return next;
  }

  const addFixtures = (stage: Stage, pairs: [string, string][], round: number) => {
    pairs.forEach(([homeId, awayId], index) => {
      next.fixtures.push({
        id: `${next.competitionId}-${stage}-${index}`,
        round,
        stage,
        homeId,
        awayId,
        homeGoals: null, awayGoals: null, homePens: null, awayPens: null,
        played: false,
        userMatch: homeId === next.userTeamId || awayId === next.userTeamId,
      });
    });
    next.stage = stage;
  };

  if (next.stage === 'LEAGUE') {
    const top8 = computeStandings(next).slice(0, 8).map((row) => row.teamId);
    if (top8.length < 8) return next;
    addFixtures('QF', [
      [top8[0], top8[7]], [top8[1], top8[6]], [top8[2], top8[5]], [top8[3], top8[4]],
    ], meta.leagueRounds + 1);
    return next;
  }

  if (next.stage === 'QF') {
    const winners = stageFixtures('QF').map(fixtureWinner).filter(Boolean) as string[];
    if (winners.length < 4) return next;
    addFixtures('SF', [[winners[0], winners[3]], [winners[1], winners[2]]], meta.leagueRounds + 2);
    return next;
  }

  if (next.stage === 'SF') {
    const winners = stageFixtures('SF').map(fixtureWinner).filter(Boolean) as string[];
    if (winners.length < 2) return next;
    addFixtures('FINAL', [[winners[0], winners[1]]], meta.leagueRounds + 3);
    return next;
  }

  if (next.stage === 'FINAL' && !next.champion) {
    next.champion = fixtureWinner(stageFixtures('FINAL')[0]) ?? null;
  }
  return next;
}

export function isKnockoutStage(stage: Stage) {
  return STAGE_ORDER.indexOf(stage) > 0;
}

export function seasonProgress(season: SeasonState) {
  const played = season.fixtures.filter((f) => f.played).length;
  return { played, total: season.fixtures.length };
}
