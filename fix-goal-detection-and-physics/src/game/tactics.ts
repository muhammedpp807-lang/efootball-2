import { FormationId, Instruction, Playstyle, SlotRole, Team, TeamTactics } from '../types/game';
import { FORMATIONS, defaultInstruction } from '../data/formations';

/** Picks the best available squad player for a formation slot. */
function pickForSlot(role: SlotRole, pool: Team['players'], taken: Set<string>) {
  const want: Record<SlotRole, Team['players'][number]['role']> = {
    GK: 'GK', CB: 'DEF', LB: 'DEF', RB: 'DEF', DM: 'MID', CM: 'MID',
    AM: 'MID', LM: 'MID', RM: 'MID', LW: 'FWD', RW: 'FWD', ST: 'FWD',
  };
  const target = want[role];
  const exact = pool.find((p) => !taken.has(p.id) && p.role === target);
  if (exact) return exact;
  const any = pool.find((p) => !taken.has(p.id) && (role === 'GK' ? p.role === 'GK' : p.role !== 'GK'));
  return any ?? pool.find((p) => !taken.has(p.id)) ?? pool[0];
}

export function createDefaultTactics(
  team: Team,
  formation: FormationId = '4-3-3',
  playstyle: Playstyle = 'POSSESSION'
): TeamTactics {
  const slots = FORMATIONS[formation];
  const taken = new Set<string>();
  const starters: string[] = [];
  const instructions: Record<string, Instruction> = {};

  slots.forEach((slot) => {
    const player = pickForSlot(slot.role, team.players, taken);
    taken.add(player.id);
    starters.push(player.id);
    instructions[player.id] = defaultInstruction(slot.role);
  });

  const bench = team.players.filter((p) => !taken.has(p.id)).map((p) => p.id);
  bench.forEach((id) => { instructions[id] = 'BALANCED'; });

  const outfield = starters.slice(1);
  return {
    teamId: team.id,
    formation,
    playstyle,
    starters,
    bench,
    instructions,
    names: {},
    numbers: {},
    customPositions: {},
    captain: outfield[4] ?? starters[1],
    penaltyTaker: starters[9] ?? outfield[0],
    freeKickTaker: starters[8] ?? outfield[0],
    cornerTaker: starters[10] ?? outfield[0],
    mentality: 50,
    defLine: 50,
    pressing: 50,
  };
}

/** CPU teams get a style that suits their squad rating, so opponents differ. */
export function cpuTactics(team: Team): TeamTactics {
  const pool: [FormationId, Playstyle][] = [
    ['4-3-3', 'POSSESSION'],
    ['4-2-3-1', 'QUICK_COUNTER'],
    ['4-4-2', 'OUT_WIDE'],
    ['5-3-2', 'DEFENSIVE'],
    ['3-5-2', 'LONG_BALL'],
    ['4-1-4-1', 'LONG_BALL_COUNTER'],
    ['3-4-3', 'ALL_OUT_ATTACK'],
  ];
  let hash = 0;
  for (let i = 0; i < team.id.length; i++) hash = (hash * 31 + team.id.charCodeAt(i)) >>> 0;
  const strong = team.rating >= 84;
  const choice = pool[hash % pool.length];
  const formation = choice[0];
  const style: Playstyle = strong && choice[1] === 'DEFENSIVE' ? 'POSSESSION' : choice[1];
  const tactics = createDefaultTactics(team, formation, style);
  tactics.mentality = strong ? 60 : 44;
  tactics.defLine = strong ? 58 : 46;
  tactics.pressing = strong ? 60 : 46;
  return tactics;
}

/** Re-seats the squad into a new formation while keeping the keeper and sensible roles. */
export function applyFormation(tactics: TeamTactics, team: Team, formation: FormationId): TeamTactics {
  const slots = FORMATIONS[formation];
  const squad = new Map(team.players.map((p) => [p.id, p]));
  const available = [...tactics.starters, ...tactics.bench].filter((id) => squad.has(id));
  const taken = new Set<string>();
  const starters: string[] = [];

  // Keep the current keeper in goal.
  const currentGk = tactics.starters.find((id) => squad.get(id)?.role === 'GK');
  slots.forEach((slot, index) => {
    if (slot.role === 'GK') {
      const gk = currentGk ?? available.find((id) => squad.get(id)?.role === 'GK') ?? available[0];
      taken.add(gk);
      starters[index] = gk;
    }
  });

  slots.forEach((slot, index) => {
    if (starters[index]) return;
    const pool = available.filter((id) => !taken.has(id)).map((id) => squad.get(id)!);
    const player = pickForSlot(slot.role, pool, new Set());
    taken.add(player.id);
    starters[index] = player.id;
  });

  const instructions = { ...tactics.instructions };
  starters.forEach((id, index) => {
    const role = slots[index].role;
    const current = instructions[id];
    // Drop an instruction that no longer makes sense in the new slot.
    if (!current || current === 'BALANCED') instructions[id] = defaultInstruction(role);
  });

  return {
    ...tactics,
    formation,
    starters,
    bench: available.filter((id) => !taken.has(id)),
    instructions,
    customPositions: {},
  };
}

export function swapPlayers(tactics: TeamTactics, aId: string, bId: string): TeamTactics {
  const starters = [...tactics.starters];
  const bench = [...tactics.bench];
  const ai = starters.indexOf(aId);
  const bi = starters.indexOf(bId);
  const abi = bench.indexOf(aId);
  const bbi = bench.indexOf(bId);

  if (ai >= 0 && bi >= 0) { starters[ai] = bId; starters[bi] = aId; }
  else if (ai >= 0 && bbi >= 0) { starters[ai] = bId; bench[bbi] = aId; }
  else if (bi >= 0 && abi >= 0) { starters[bi] = aId; bench[abi] = bId; }
  else return tactics;

  const custom = { ...tactics.customPositions };
  delete custom[aId];
  delete custom[bId];
  return { ...tactics, starters, bench, customPositions: custom };
}

export function slotRoleFor(tactics: TeamTactics, playerId: string): SlotRole | null {
  const index = tactics.starters.indexOf(playerId);
  if (index < 0) return null;
  return FORMATIONS[tactics.formation][index].role;
}

export function displayName(tactics: TeamTactics | null, player: { id: string; name: string }) {
  return tactics?.names[player.id]?.trim() || player.name;
}

export function displayNumber(tactics: TeamTactics | null, player: { id: string; number: number }) {
  const custom = tactics?.numbers[player.id];
  return typeof custom === 'number' && custom > 0 ? custom : player.number;
}

/** Guards against corrupt or outdated saved tactics. */
export function validateTactics(tactics: TeamTactics | undefined, team: Team): TeamTactics {
  if (!tactics) return createDefaultTactics(team);
  const ids = new Set(team.players.map((p) => p.id));
  const starters = tactics.starters.filter((id) => ids.has(id));
  const unique = [...new Set(starters)];
  if (unique.length !== 11) return createDefaultTactics(team, tactics.formation, tactics.playstyle);
  const hasKeeper = unique.some((id) => team.players.find((p) => p.id === id)?.role === 'GK');
  if (!hasKeeper) return createDefaultTactics(team, tactics.formation, tactics.playstyle);
  const bench = team.players.map((p) => p.id).filter((id) => !unique.includes(id));
  return { ...tactics, starters: unique, bench };
}
