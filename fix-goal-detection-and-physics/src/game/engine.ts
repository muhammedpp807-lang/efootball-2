import {
  BallState, Difficulty, FormationId, Instruction, MatchStats, PassMode, PitchPlayer,
  Playstyle, RefereeState, Side, SlotRole, Strictness, Team, TeamTactics,
} from '../types/game';
import { FORMATIONS, INSTRUCTIONS, PLAYSTYLES, ROLE_ATTACK } from '../data/formations';
import { displayName, displayNumber } from './tactics';

/* ==================================================================
   PITCH GEOMETRY — real proportions at 20 world units per metre.
   105 m x 68 m => 2100 x 1360 units. USER always attacks +x.
   ================================================================== */
const U = 20;
export const PITCH = {
  halfW: 52.5 * U,      // 1050
  halfH: 34 * U,        // 680
  goalHalf: 3.66 * U,   // 73.2
  crossbar: 2.44 * U,   // 48.8
  goalDepth: 2.2 * U,
  boxW: 16.5 * U,       // 330
  boxHalfH: 20.16 * U,  // 403
  sixW: 5.5 * U,
  sixHalfH: 9.16 * U,
  circle: 9.15 * U,     // 183
  penaltySpot: 11 * U,  // 220
  cornerArc: 1 * U,
};
export const BALL_R = 9;
export const WORLD = { halfW: PITCH.halfW + 290, halfH: PITCH.halfH + 250 };
export const PLAYER_RENDER_SCALE = 0.82;

export interface DiffProfile {
  speed: number; react: number; tackle: number; passAcc: number;
  shotAcc: number; keeper: number; aggro: number;
  /** Frames the CPU deliberates before it may pass again. Higher = slower football. */
  think: number;
  /** Chance per decision to carry/turn instead of passing. */
  dwell: number;
  /** Distance a non-tackling defender holds off the ball carrier. */
  standoff: number;
  /** Hard cap on how many players may hunt the ball at once. */
  maxPressers: number;
}

/**
 * Note: `speed` is 1.0 everywhere. Both teams run at the same base pace; the
 * only way to go quicker is to sprint. Difficulty changes decisions, accuracy
 * and pressure, never raw speed.
 */
export const DIFFICULTY: Record<Difficulty, DiffProfile> = {
  EASY:   { speed: 1, react: 0.38, tackle: 0.14, passAcc: 0.56, shotAcc: 0.48, keeper: 0.44, aggro: 0.42, think: 58, dwell: 0.55, standoff: 62, maxPressers: 1 },
  NORMAL: { speed: 1, react: 0.74, tackle: 0.38, passAcc: 0.78, shotAcc: 0.70, keeper: 0.70, aggro: 0.78, think: 26, dwell: 0.28, standoff: 26, maxPressers: 2 },
  HARD:   { speed: 1, react: 0.94, tackle: 0.60, passAcc: 0.91, shotAcc: 0.86, keeper: 0.87, aggro: 1.00, think: 10, dwell: 0.12, standoff: 10, maxPressers: 2 },
};
const ALLY: DiffProfile = { speed: 1, react: 0.85, tackle: 0.46, passAcc: 0.86, shotAcc: 0.74, keeper: 0.78, aggro: 0.85, think: 20, dwell: 0.2, standoff: 16, maxPressers: 2 };

/** Both teams share the same base pace. */
export const TEAM_SPEED = { USER: 1.0, CPU: 1.0 } as const;
/** AI sprint multiplier. Deliberately below the user's sprint. */
export const AI_SPRINT = 1.20;

const STRICT_FOUL: Record<Strictness, number> = { LENIENT: 0.34, STANDARD: 0.55, STRICT: 0.72 };
const STRICT_CARD: Record<Strictness, number> = { LENIENT: 0.16, STANDARD: 0.3, STRICT: 0.46 };

export type RestartKind = 'THROW' | 'CORNER' | 'GOALKICK' | 'FREEKICK' | 'PENALTY';

export type MatchEvent =
  | { type: 'GOAL'; side: Side; scorer: string; ownGoal: boolean }
  | { type: 'SAVE'; side: Side; caught: boolean }
  | { type: 'POST' }
  | { type: 'SHOT'; side: Side }
  | { type: 'PASS'; side: Side }
  | { type: 'TACKLE'; side: Side }
  | { type: 'RESTART'; kind: RestartKind; side: Side }
  | { type: 'DECISION'; text: string; card: 'YELLOW' | 'RED' | null }
  | { type: 'SUB'; side: Side; outName: string; inName: string };

interface Restart { type: RestartKind; side: Side; x: number; y: number; timer: number }

export interface InputState {
  up: boolean; down: boolean; left: boolean; right: boolean; sprint: boolean;
  /**
   * Normalised movement vector from the mouse drag (or on-screen stick).
   * Magnitude 0..1 scales the target speed; direction is in world space.
   */
  drag: { x: number; y: number; mag: number } | null;
  /** Caps Lock (or C): auto-pressure the ball carrier. */
  pressure: boolean;
  /** Milliseconds since the previous simulation step. */
  dt: number;
}

export interface RuntimeTactics {
  formation: FormationId;
  playstyle: Playstyle;
  mentality: number;
  defLine: number;
  pressing: number;
}

export interface World {
  userTeam: Team;
  cpuTeam: Team;
  players: PitchPlayer[];
  referee: RefereeState;
  ball: BallState;
  score: { user: number; cpu: number };
  stats: MatchStats;
  tactics: Record<Side, RuntimeTactics>;
  subsUsed: Record<Side, number>;
  controlledId: string;
  /** Frames until auto-switching may change the controlled player again. */
  switchCd: number;
  /** True while Caps Lock pressure is steering the controlled defender. */
  pressing: boolean;
  passTargetId: string | null;
  incomingReceiver: string | null;
  diff: DiffProfile;
  restart: Restart | null;
  gkHold: { side: Side; timer: number } | null;
  gkRelease: { id: string; timer: number } | null;
  live: boolean;
  awaitingKickoff: Side | null;
  lastTouch: { side: Side; name: string } | null;
  autoSwitch: boolean;
  passMode: PassMode;
  strictness: Strictness;
  events: MatchEvent[];
  pickupCd: number;
  passCd: number;
  tick: number;
  rand: () => number;
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

/* Possession decision windows, in frames at 60fps. */
export const DECIDE_MIN = 90;   // 1.5s — settle the ball first
export const DECIDE_WINDOW = 132; // ~2.2s — normal decision point
export const DECIDE_MAX = 180;  // 3.0s — hard deadline, must act

/**
 * Hands the ball to a player and starts their possession clock.
 * This is the single place possession changes, so the decision timer can never
 * be accidentally restarted by a dribble touch.
 */
function giveBall(w: World, p: PitchPlayer, hold: number) {
  const previous = w.ball.ownerId;
  w.ball.ownerId = p.id;
  w.ball.passTo = null;
  if (previous !== p.id) {
    p.possessionTimer = 0;
    p.decisionCd = 0;
    const old = previous ? w.players.find((q) => q.id === previous) : null;
    if (old) old.possessionTimer = -1;
  }
  p.holdTimer = hold;
}
const norm = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const dirOf = (side: Side) => (side === 'USER' ? 1 : -1);
const sideIndex = (side: Side) => (side === 'USER' ? 0 : 1);

export const onPitch = (w: World) => w.players.filter((p) => p.onPitch && !p.sentOff);
export const getById = (w: World, id: string | null) =>
  (id ? w.players.find((p) => p.id === id) || null : null);

const REF_NAMES = ['M. Oyelaran', 'D. Castellano', 'A. Bergström', 'R. Nakamura', 'L. Okafor', 'P. Vasquez'];

/** Converts a normalized formation position into world coordinates. */
function toWorld(side: Side, nx: number, ny: number) {
  const d = dirOf(side);
  return {
    x: (nx - 0.5) * 2 * PITCH.halfW * 0.90 * d,
    y: ny * PITCH.halfH * 0.86 * d,
  };
}

function buildSide(team: Team, side: Side, tactics: TeamTactics): PitchPlayer[] {
  const slots = FORMATIONS[tactics.formation];
  const byId = new Map(team.players.map((p) => [p.id, p]));

  return team.players.map((cfg) => {
    const slotIndex = tactics.starters.indexOf(cfg.id);
    const starting = slotIndex >= 0;
    const slot = starting ? slots[slotIndex] : null;
    const custom = tactics.customPositions[cfg.id];
    const nx = custom ? custom.nx : slot ? slot.nx : 0.3;
    const ny = custom ? custom.ny : slot ? slot.ny : 0;
    const slotRole: SlotRole = slot ? slot.role : (cfg.role === 'GK' ? 'GK' : cfg.role === 'DEF' ? 'CB' : cfg.role === 'MID' ? 'CM' : 'ST');
    const pos = toWorld(side, nx, ny);
    void byId;

    return {
      id: `${side}_${cfg.id}`,
      teamId: team.id,
      side,
      isGK: slotRole === 'GK',
      name: displayName(tactics, cfg),
      number: displayNumber(tactics, cfg),
      role: cfg.role,
      slotRole,
      instruction: tactics.instructions[cfg.id] ?? 'BALANCED',
      nx, ny,
      onPitch: starting,
      subbedOut: false,
      appearance: cfg.appearance,
      x: pos.x, y: pos.y, z: 0,
      vx: 0, vy: 0, vz: 0,
      facingAngle: side === 'USER' ? 0 : Math.PI,
      actionState: 'idle',
      animFrame: 0,
      actionTimer: 0, tackleCd: 0, decisionCd: 0, holdTimer: 0,
      possessionTimer: -1, markId: null,
      stamina: 100,
      speedRating: cfg.speed, shootRating: cfg.shooting, passRating: cfg.passing,
      homeX: pos.x, homeY: pos.y,
      yellowCards: 0, sentOff: false,
    };
  });
}

export function createWorld(
  userTeam: Team, cpuTeam: Team, difficulty: Difficulty, autoSwitch: boolean,
  passMode: PassMode, strictness: Strictness,
  userTactics: TeamTactics, cpuTacticsIn: TeamTactics
): World {
  let seed = 1337;
  const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const refIndex = Math.floor(rand() * REF_NAMES.length);

  const world: World = {
    userTeam, cpuTeam,
    players: [...buildSide(userTeam, 'USER', userTactics), ...buildSide(cpuTeam, 'CPU', cpuTacticsIn)],
    referee: {
      x: 0, y: -200, vx: 0, vy: 0, facingAngle: 0, animFrame: 0,
      cardType: null, cardTimer: 0, whistleTimer: 0,
      name: REF_NAMES[refIndex],
      assistants: ['Assistant 1 · K. Haruna', 'Assistant 2 · J. Moreau'],
    },
    ball: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, spin: 0, rotationX: 0, rotationY: 0, ownerId: null, passTo: null, passTimer: 0 },
    score: { user: 0, cpu: 0 },
    stats: {
      possession: [0, 0], shots: [0, 0], onTarget: [0, 0], passes: [0, 0],
      tackles: [0, 0], saves: [0, 0], corners: [0, 0], fouls: [0, 0], yellows: [0, 0], reds: [0, 0],
    },
    tactics: {
      USER: { formation: userTactics.formation, playstyle: userTactics.playstyle, mentality: userTactics.mentality, defLine: userTactics.defLine, pressing: userTactics.pressing },
      CPU: { formation: cpuTacticsIn.formation, playstyle: cpuTacticsIn.playstyle, mentality: cpuTacticsIn.mentality, defLine: cpuTacticsIn.defLine, pressing: cpuTacticsIn.pressing },
    },
    subsUsed: { USER: 0, CPU: 0 },
    controlledId: '',
    switchCd: 0,
    pressing: false,
    passTargetId: null,
    incomingReceiver: null,
    diff: DIFFICULTY[difficulty],
    restart: null, gkHold: null, gkRelease: null,
    live: false, awaitingKickoff: 'USER',
    lastTouch: null,
    autoSwitch, passMode, strictness,
    events: [], pickupCd: 0, passCd: 0, tick: 0, rand,
  };

  const firstOutfield = world.players.find((p) => p.side === 'USER' && p.onPitch && !p.isGK);
  world.controlledId = firstOutfield ? firstOutfield.id : world.players[0].id;
  setupKickoff(world, 'USER');
  return world;
}

/** Applies a tactical change mid-match. Players walk to the new shape, nothing teleports. */
export function applyTactics(w: World, side: Side, tactics: TeamTactics, team: Team) {
  const slots = FORMATIONS[tactics.formation];
  w.tactics[side] = {
    formation: tactics.formation, playstyle: tactics.playstyle,
    mentality: tactics.mentality, defLine: tactics.defLine, pressing: tactics.pressing,
  };

  team.players.forEach((cfg) => {
    const p = w.players.find((q) => q.id === `${side}_${cfg.id}`);
    if (!p || p.subbedOut) return;
    const slotIndex = tactics.starters.indexOf(cfg.id);
    const slot = slotIndex >= 0 ? slots[slotIndex] : null;
    const custom = tactics.customPositions[cfg.id];
    p.onPitch = slotIndex >= 0;
    p.nx = custom ? custom.nx : slot ? slot.nx : p.nx;
    p.ny = custom ? custom.ny : slot ? slot.ny : p.ny;
    if (slot) { p.slotRole = slot.role; p.isGK = slot.role === 'GK'; }
    p.instruction = tactics.instructions[cfg.id] ?? 'BALANCED';
    p.name = displayName(tactics, cfg);
    p.number = displayNumber(tactics, cfg);
  });

  const controlled = getById(w, w.controlledId);
  if (!controlled || !controlled.onPitch || controlled.sentOff || controlled.isGK) switchPlayer(w);
}

/** Brings a substitute on in place of a player who is on the pitch. */
export function substitute(w: World, side: Side, outPlayerId: string, inPlayerId: string): boolean {
  const out = getById(w, `${side}_${outPlayerId}`);
  const inc = getById(w, `${side}_${inPlayerId}`);
  if (!out || !inc) return false;
  if (!out.onPitch || out.sentOff) return false;
  if (inc.onPitch || inc.subbedOut) return false;
  if (out.isGK !== inc.isGK && out.isGK) return false;

  inc.onPitch = true;
  inc.nx = out.nx; inc.ny = out.ny;
  inc.slotRole = out.slotRole;
  inc.isGK = out.isGK;
  inc.x = out.x; inc.y = out.y; inc.z = 0;
  inc.vx = 0; inc.vy = 0; inc.vz = 0;
  inc.facingAngle = out.facingAngle;
  inc.actionTimer = 0; inc.tackleCd = 0; inc.holdTimer = 0;

  out.onPitch = false;
  out.subbedOut = true;
  out.vx = 0; out.vy = 0;

  if (w.ball.ownerId === out.id) {
    w.ball.ownerId = inc.id;
    inc.possessionTimer = out.possessionTimer;
  }
  out.possessionTimer = -1;
  if (w.controlledId === out.id) w.controlledId = inc.isGK ? w.controlledId : inc.id;
  if (w.controlledId === out.id) switchPlayer(w);

  w.subsUsed[side]++;
  w.events.push({ type: 'SUB', side, outName: out.name, inName: inc.name });
  return true;
}

export function setupKickoff(w: World, side: Side) {
  onPitch(w).forEach((p) => {
    // Compress the formation into the team's own half for a legal kick-off.
    const ownHalfNx = Math.min(p.nx, 0.47);
    const pos = toWorld(p.side, ownHalfNx, p.ny);
    p.x = pos.x; p.y = pos.y; p.z = 0;
    p.vx = 0; p.vy = 0; p.vz = 0;
    p.actionState = 'idle';
    p.actionTimer = 0; p.tackleCd = 0; p.decisionCd = 0; p.holdTimer = 0;
    p.possessionTimer = -1; p.markId = null;
    p.facingAngle = p.side === 'USER' ? 0 : Math.PI;
  });

  const attackers = onPitch(w)
    .filter((p) => p.side === side && !p.isGK)
    .sort((a, b) => b.nx - a.nx);
  const taker = attackers[0];
  if (taker) { taker.x = -24 * dirOf(side); taker.y = 0; }
  if (attackers[1]) { attackers[1].x = -70 * dirOf(side); attackers[1].y = 90 * dirOf(side); }

  // The defending side must be out of the centre circle and in its own half.
  onPitch(w).forEach((p) => {
    if (p.side === side || p.isGK) return;
    const d = dirOf(p.side);
    if (p.x * d > -30) p.x = -60 * d;
    if (dist(p.x, p.y, 0, 0) < PITCH.circle + 40) {
      p.x = -(PITCH.circle + 90) * d;
    }
  });

  w.ball = {
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, spin: 0, rotationX: 0, rotationY: 0,
    ownerId: taker ? taker.id : null, passTo: null, passTimer: 0,
  };
  if (taker) { taker.holdTimer = 30; taker.possessionTimer = 0; }

  w.restart = null; w.gkHold = null; w.gkRelease = null;
  w.pickupCd = 0; w.passCd = 0; w.incomingReceiver = null;
  w.lastTouch = taker ? { side, name: taker.name } : null;
  w.referee.x = 0; w.referee.y = -220; w.referee.vx = 0; w.referee.vy = 0;

  if (side === 'USER' && taker) w.controlledId = taker.id;
  else {
    const near = onPitch(w).filter((p) => p.side === 'USER' && !p.isGK)
      .sort((a, b) => dist(a.x, a.y, 0, 0) - dist(b.x, b.y, 0, 0))[0];
    if (near) w.controlledId = near.id;
  }
}

export function kickOff(w: World, side?: Side) {
  setupKickoff(w, side ?? w.awaitingKickoff ?? 'USER');
  w.awaitingKickoff = null;
  w.live = true;
  w.referee.whistleTimer = 30;
}

/* ==================================================================
   TACTICAL ANCHORS — formation + playstyle + instruction driven
   ================================================================== */
function attackWeight(p: PitchPlayer) {
  return clamp(ROLE_ATTACK[p.slotRole] + INSTRUCTIONS[p.instruction].attack, 0, 1.25);
}
const atkOf = attackWeight;

const DEFENDER_SLOTS: SlotRole[] = ['CB', 'LB', 'RB'];
const FORWARD_SLOTS: SlotRole[] = ['ST', 'LW', 'RW'];

/**
 * Positional discipline for AI-driven players.
 *   Defenders advance no further than the halfway line.
 *   Forwards drop back no further than the halfway line.
 * The user is never restricted: take control of any player and they may run
 * anywhere on the pitch, including past these limits.
 */
function clampRoleX(p: PitchPlayer, x: number) {
  const d = dirOf(p.side);
  const halfway = 0;
  if (DEFENDER_SLOTS.includes(p.slotRole)) {
    return d === 1 ? Math.min(x, halfway) : Math.max(x, halfway);
  }
  if (FORWARD_SLOTS.includes(p.slotRole)) {
    return d === 1 ? Math.max(x, halfway) : Math.min(x, halfway);
  }
  return x;
}

/** Where this player wants to be right now, given the tactics and the ball. */
function anchorFor(w: World, p: PitchPlayer, possSide: Side | null) {
  const T = w.tactics[p.side];
  const ps = PLAYSTYLES[T.playstyle];
  const ins = INSTRUCTIONS[p.instruction];
  const d = dirOf(p.side);

  let ax = (p.nx - 0.5) * 2;                       // -1 own goal .. +1 opponent goal
  let ay = p.ny * ps.width * ins.width;

  ax += ps.line + (T.defLine - 50) / 300 + (T.mentality - 50) / 380;

  // Ball position in this team's attacking space.
  const ballAx = (w.ball.x * d) / PITCH.halfW;
  const ballAy = (w.ball.y * d) / PITCH.halfH;
  const atk = attackWeight(p);

  // The block slides with the ball; defenders slide less than forwards.
  ax += (ballAx - ax) * ps.shiftX * (0.45 + atk * 0.55);
  ay += (ballAy - ay) * ps.shiftY * (p.slotRole === 'CB' ? 0.55 : 1);

  if (possSide === p.side) ax += ps.joinAttack * atk * 0.62;
  else if (possSide) ax -= 0.14 + (1 - atk) * 0.06;

  /* ----------------------------------------------------------------
     Live shape. Without this, a stationary ball produces a stationary
     anchor and every off-ball player freezes once they arrive.
     ---------------------------------------------------------------- */
  const carrier = getById(w, w.ball.ownerId);
  const dwell = carrier && carrier.possessionTimer > 0 ? carrier.possessionTimer : 0;

  if (possSide === p.side && dwell > 40) {
    // Our carrier is holding the ball: break forward to offer an option.
    const urge = Math.min(1, (dwell - 40) / 150);
    ax += urge * (0.10 + atk * 0.22);
    ay += urge * (p.ny >= 0 ? 0.08 : -0.08) * ps.width;
  } else if (possSide && possSide !== p.side && dwell > 40) {
    // They are dwelling: step the block up and squeeze the space.
    const squeeze = Math.min(1, (dwell - 40) / 150);
    ax += squeeze * 0.10;
    ay *= 1 - squeeze * 0.16;
  }

  // Continuous positional adjustment, unique per player. Small amplitude, but
  // it guarantees nobody ever stands perfectly still while the ball is live.
  let h = 0;
  for (let i = 0; i < p.id.length; i++) h = (h * 31 + p.id.charCodeAt(i)) >>> 0;
  const phase = (h % 628) / 100;
  const t = w.tick / 60;
  ax += Math.sin(t * 0.55 + phase) * 0.028;
  ay += Math.cos(t * 0.41 + phase * 1.7) * 0.042;

  // A defensive line must never drift behind its own keeper.
  ax = clamp(ax, -0.94, 0.97);
  ay = clamp(ay, -0.99, 0.99);

  return {
    x: ax * PITCH.halfW * 0.90 * d,
    y: ay * PITCH.halfH * 0.86 * d,
  };
}

/* ==================================================================
   ACTIONS
   ================================================================== */
function profileFor(w: World, p: PitchPlayer) { return p.side === 'CPU' ? w.diff : ALLY; }
function setTouch(w: World, p: PitchPlayer) { w.lastTouch = { side: p.side, name: p.name }; }

function laneBlocked(w: World, from: PitchPlayer, tx: number, ty: number) {
  const dx = tx - from.x;
  const dy = ty - from.y;
  const lenSq = dx * dx + dy * dy || 1;
  let penalty = 0;
  onPitch(w).forEach((opp) => {
    if (opp.side === from.side) return;
    const t = clamp(((opp.x - from.x) * dx + (opp.y - from.y) * dy) / lenSq, 0, 1);
    const gap = Math.hypot(opp.x - (from.x + dx * t), opp.y - (from.y + dy * t));
    if (t > 0.08 && t < 0.96 && gap < 60) penalty += 190 * (1 - gap / 60);
  });
  return penalty;
}

export function bestPassTarget(w: World, passer: PitchPlayer, coneOnly = false): PitchPlayer | null {
  const d = dirOf(passer.side);
  const ps = PLAYSTYLES[w.tactics[passer.side].playstyle];
  const ideal = 330 * ps.passLen;
  const mates = onPitch(w).filter((p) => p.side === passer.side && p.id !== passer.id);
  let best: PitchPlayer | null = null;
  let bestScore = -Infinity;

  mates.forEach((mate) => {
    const dx = mate.x - passer.x;
    const dy = mate.y - passer.y;
    const dd = Math.hypot(dx, dy);
    if (dd < 55 || dd > 1300) return;

    if (coneOnly && Math.abs(norm(Math.atan2(dy, dx) - passer.facingAngle)) > 0.95) return;

    let score = 300 - Math.abs(dd - ideal) * 0.30;
    score += (dx * d) * 0.30;
    score += (mate.x * d) * 0.12;
    score -= laneBlocked(w, passer, mate.x, mate.y);

    let nearest = 9999;
    onPitch(w).forEach((o) => {
      if (o.side === passer.side) return;
      nearest = Math.min(nearest, dist(o.x, o.y, mate.x, mate.y));
    });
    score += Math.min(nearest, 240) * 0.5;

    // Reward a forward target when the style is direct.
    if (ps.directness > 0.3 && attackWeight(mate) > 0.7) score += 120;
    if (mate.isGK) score -= 900;
    if (coneOnly) score += (1 - Math.abs(norm(Math.atan2(dy, dx) - passer.facingAngle))) * 200;

    if (score > bestScore) { bestScore = score; best = mate; }
  });
  return best;
}

export function releaseFromKeeper(w: World, keeper: PitchPlayer): boolean {
  if (!w.live || !keeper || keeper.sentOff) return false;
  if (w.ball.ownerId !== keeper.id) return false;

  const d = dirOf(keeper.side);
  const target = bestPassTarget(w, keeper);
  keeper.facingAngle = target
    ? Math.atan2(target.y - keeper.y, target.x - keeper.x)
    : (d === 1 ? 0 : Math.PI);

  w.passCd = 0;
  keeper.holdTimer = 0;
  if (!doPass(w, keeper)) return false;

  w.gkHold = null;
  w.gkRelease = { id: keeper.id, timer: 80 };
  w.pickupCd = Math.max(w.pickupCd, 12);
  if (keeper.side === 'USER' && w.autoSwitch && w.incomingReceiver) {
    const receiver = getById(w, w.incomingReceiver);
    if (receiver && !receiver.isGK) w.controlledId = receiver.id;
  }
  return true;
}

export function doPass(w: World, passerArg?: PitchPlayer | null): boolean {
  if (!w.live) return false;
  if (!passerArg) {
    const holder = getById(w, w.ball.ownerId);
    if (holder && holder.isGK && holder.side === 'USER') return releaseFromKeeper(w, holder);
  }
  if (w.passCd > 0) return false;

  const passer = passerArg || getById(w, w.controlledId);
  if (!passer || passer.sentOff || !passer.onPitch) return false;
  const b = w.ball;
  if (b.ownerId !== passer.id && dist(passer.x, passer.y, b.x, b.y) > 46) return false;

  const manual = w.passMode === 'MANUAL' && passer.id === w.controlledId;
  const target = bestPassTarget(w, passer, manual);
  const prof = profileFor(w, passer);
  const userPass = passer.id === w.controlledId;

  // Long balls and passes played under pressure are noticeably less reliable.
  const squeezed = onPitch(w).some(
    (o) => o.side !== passer.side && !o.isGK && dist(o.x, o.y, passer.x, passer.y) < 120
  );
  const range = target ? dist(passer.x, passer.y, target.x, target.y) : 300;
  const difficulty = (range > 520 ? 0.14 : 0) + (squeezed ? 0.12 : 0);
  const accuracy = userPass
    ? (manual ? 0.86 : 0.97)
    : Math.max(0.3, prof.passAcc * (0.9 + passer.passRating / 900) - difficulty);

  let tx: number;
  let ty: number;
  if (target) {
    const lead = Math.min(42, dist(passer.x, passer.y, target.x, target.y) * 0.09);
    tx = target.x + target.vx * lead;
    ty = target.y + target.vy * lead;
  } else {
    tx = passer.x + Math.cos(passer.facingAngle) * 340;
    ty = passer.y + Math.sin(passer.facingAngle) * 340;
  }
  tx = clamp(tx, -PITCH.halfW + 40, PITCH.halfW - 40);
  ty = clamp(ty, -PITCH.halfH + 40, PITCH.halfH - 40);

  let angle = Math.atan2(ty - b.y, tx - b.x);
  angle += (1 - accuracy) * 0.3 * (w.rand() * 2 - 1);
  const dd = Math.hypot(tx - b.x, ty - b.y);
  // Straight passes get no in-flight correction, so weight them to carry the
  // full distance against ground friction.
  const speed = clamp(10.5 + dd * 0.036, 13, 29);

  b.ownerId = null;
  passer.possessionTimer = -1;
  b.vx = Math.cos(angle) * speed;
  b.vy = Math.sin(angle) * speed;
  b.vz = dd > 520 ? 3.4 : 1.2;
  b.spin = 0;
  b.passTo = target && !manual ? target.id : null;
  b.passTimer = 200;

  w.pickupCd = 8; w.passCd = 12;
  w.incomingReceiver = target ? target.id : null;
  passer.actionState = 'pass'; passer.actionTimer = 15; passer.facingAngle = angle;
  setTouch(w, passer);
  w.stats.passes[sideIndex(passer.side)]++;
  w.events.push({ type: 'PASS', side: passer.side });

  if (passer.side === 'USER' && userPass && target && !target.isGK && w.autoSwitch) {
    w.controlledId = target.id;
  }
  return true;
}

export function doShoot(w: World, shooterArg?: PitchPlayer | null): boolean {
  if (!w.live) return false;
  const shooter = shooterArg || getById(w, w.controlledId);
  if (!shooter || shooter.sentOff || !shooter.onPitch) return false;
  const b = w.ball;
  if (b.ownerId !== shooter.id && dist(shooter.x, shooter.y, b.x, b.y) > 50) return false;

  const prof = profileFor(w, shooter);
  const userShot = shooter.id === w.controlledId;
  const d = dirOf(shooter.side);
  const goalX = PITCH.halfW * d;

  const keeper = onPitch(w).find((p) => p.isGK && p.side !== shooter.side);
  const corner = keeper ? (keeper.y >= 0 ? -1 : 1) : (shooter.y >= 0 ? -1 : 1);
  const aimY = corner * (PITCH.goalHalf - 22);

  const accuracy = userShot ? 0.9 + shooter.shootRating / 1800 : prof.shotAcc * (0.85 + shooter.shootRating / 900);
  let angle = Math.atan2(aimY - b.y, goalX - b.x);
  angle += (1 - accuracy) * 0.17 * (w.rand() * 2 - 1);

  const dd = Math.hypot(goalX - b.x, aimY - b.y);
  const power = clamp(21 + dd * 0.011, 22, 32);

  b.ownerId = null; b.passTo = null;
  shooter.possessionTimer = -1;
  b.vx = Math.cos(angle) * power;
  b.vy = Math.sin(angle) * power;
  b.vz = 2.6 + w.rand() * 2.2;
  b.spin = (w.rand() - 0.5) * 0.1;
  w.pickupCd = 10; w.incomingReceiver = null;

  shooter.actionState = 'shoot'; shooter.actionTimer = 21; shooter.facingAngle = angle;
  setTouch(w, shooter);

  const idx = sideIndex(shooter.side);
  w.stats.shots[idx]++;
  const travel = (goalX - b.x) / (b.vx || d * 0.01);
  if (travel > 0 && Math.abs(b.y + b.vy * travel) < PITCH.goalHalf) w.stats.onTarget[idx]++;
  w.events.push({ type: 'SHOT', side: shooter.side });
  return true;
}

function showCard(w: World, offender: PitchPlayer, type: 'YELLOW' | 'RED'): 'YELLOW' | 'RED' {
  let final: 'YELLOW' | 'RED' = type;
  if (type === 'YELLOW') {
    offender.yellowCards++;
    w.stats.yellows[sideIndex(offender.side)]++;
    if (offender.yellowCards >= 2) final = 'RED';
  }
  if (final === 'RED') {
    offender.sentOff = true;
    offender.onPitch = false;
    offender.vx = 0; offender.vy = 0;
    w.stats.reds[sideIndex(offender.side)]++;
    if (w.controlledId === offender.id) switchPlayer(w);
  }
  w.referee.cardType = final;
  w.referee.cardTimer = 110;
  return final;
}

function awardFoul(w: World, offender: PitchPlayer, victim: PitchPlayer) {
  const d = dirOf(offender.side);
  const ownGoalX = -PITCH.halfW * d;
  w.stats.fouls[sideIndex(offender.side)]++;

  const insideOwnBox = Math.abs(victim.x - ownGoalX) < PITCH.boxW && Math.abs(victim.y) < PITCH.boxHalfH;
  const reckless = Math.hypot(offender.vx, offender.vy) > 5.4;
  const roll = w.rand();
  const chance = STRICT_CARD[w.strictness] * (reckless ? 1.6 : 0.7) * (insideOwnBox ? 1.3 : 1);

  let card: 'YELLOW' | 'RED' | null = null;
  if (roll < chance * 0.08) card = showCard(w, offender, 'RED');
  else if (roll < chance) card = showCard(w, offender, 'YELLOW');

  w.referee.whistleTimer = 26;
  w.ball.passTo = null;
  w.incomingReceiver = null;
  const teamName = offender.side === 'USER' ? w.userTeam.shortName : w.cpuTeam.shortName;

  if (insideOwnBox) {
    beginRestart(w, 'PENALTY', victim.side, ownGoalX + PITCH.penaltySpot * d, 0);
    w.events.push({ type: 'DECISION', text: `Penalty! Foul by ${teamName} · ${offender.name}`, card });
  } else {
    beginRestart(w, 'FREEKICK', victim.side,
      clamp(victim.x, -PITCH.halfW + 50, PITCH.halfW - 50),
      clamp(victim.y, -PITCH.halfH + 40, PITCH.halfH - 40));
    w.events.push({
      type: 'DECISION',
      text: `Free kick · foul by ${teamName} ${offender.name}${card ? ` (${card.toLowerCase()} card)` : ''}`,
      card,
    });
  }
}

export function doTackle(w: World, playerArg?: PitchPlayer | null): boolean {
  if (!w.live) return false;
  const p = playerArg || getById(w, w.controlledId);
  if (!p || p.sentOff || !p.onPitch || p.tackleCd > 0 || w.restart) return false;
  const b = w.ball;

  p.actionState = 'tackle'; p.actionTimer = 17; p.tackleCd = 40;
  p.vx = Math.cos(p.facingAngle) * 7.2;
  p.vy = Math.sin(p.facingAngle) * 7.2;

  const owner = getById(w, b.ownerId);
  if (owner && owner.isGK && owner.side !== p.side) return false;

  const prof = profileFor(w, p);
  if (dist(p.x, p.y, b.x, b.y) < 46 && (!owner || owner.side !== p.side)) {
    const chance = p.id === w.controlledId ? 0.78 : 0.3 + prof.tackle * 0.55;
    if (w.rand() < chance) {
      b.vx = 0; b.vy = 0;
      giveBall(w, p, 22);
      setTouch(w, p);
      w.stats.tackles[sideIndex(p.side)]++;
      w.events.push({ type: 'TACKLE', side: p.side });
      if (p.side === 'USER' && !p.isGK && w.autoSwitch) w.controlledId = p.id;
      return true;
    }
  }
  if (owner && owner.side !== p.side && dist(p.x, p.y, owner.x, owner.y) < 42) {
    if (w.rand() < STRICT_FOUL[w.strictness]) { awardFoul(w, p, owner); return false; }
  }
  return false;
}

export function switchPlayer(w: World) {
  const outfield = onPitch(w).filter((p) => p.side === 'USER' && !p.isGK);
  if (!outfield.length) return;
  const sorted = [...outfield].sort(
    (a, b) => dist(a.x, a.y, w.ball.x, w.ball.y) - dist(b.x, b.y, w.ball.x, w.ball.y)
  );
  const current = sorted.findIndex((p) => p.id === w.controlledId);
  w.controlledId = sorted[(current + 1) % sorted.length].id;
}

/* ==================================================================
   REFEREE
   ================================================================== */
function updateReferee(w: World) {
  const ref = w.referee;
  const b = w.ball;
  if (ref.cardTimer > 0) ref.cardTimer--; else ref.cardType = null;
  if (ref.whistleTimer > 0) ref.whistleTimer--;

  const away = Math.atan2(ref.y - b.y, ref.x - b.x);
  const standoff = 170;
  let tx = b.x + Math.cos(away) * standoff;
  let ty = b.y + Math.sin(away) * standoff;
  ty = clamp(ty, -PITCH.halfH + 50, PITCH.halfH - 50);
  tx = clamp(tx, -PITCH.halfW + 80, PITCH.halfW - 80);

  const dx = tx - ref.x;
  const dy = ty - ref.y;
  const d = Math.hypot(dx, dy);
  if (d > 8) {
    const speed = Math.min(4.6, 1.2 + d * 0.05);
    ref.vx += ((dx / d) * speed - ref.vx) * 0.12;
    ref.vy += ((dy / d) * speed - ref.vy) * 0.12;
  } else { ref.vx *= 0.8; ref.vy *= 0.8; }

  ref.x += ref.vx; ref.y += ref.vy;

  const ballGap = dist(ref.x, ref.y, b.x, b.y);
  if (ballGap < 64 && ballGap > 0.01) {
    ref.x = b.x + ((ref.x - b.x) / ballGap) * 64;
    ref.y = b.y + ((ref.y - b.y) / ballGap) * 64;
  }
  onPitch(w).forEach((p) => {
    const gap = dist(ref.x, ref.y, p.x, p.y);
    if (gap < 44 && gap > 0.01) {
      ref.x = p.x + ((ref.x - p.x) / gap) * 44;
      ref.y = p.y + ((ref.y - p.y) / gap) * 44;
    }
  });

  ref.x = clamp(ref.x, -PITCH.halfW + 20, PITCH.halfW - 20);
  ref.y = clamp(ref.y, -PITCH.halfH + 20, PITCH.halfH - 20);
  const speed = Math.hypot(ref.vx, ref.vy);
  if (speed > 0.25) { ref.animFrame += speed * 0.07; ref.facingAngle = Math.atan2(ref.vy, ref.vx); }
}

/* ==================================================================
   RESTARTS
   ================================================================== */
function beginRestart(w: World, type: RestartKind, side: Side, x: number, y: number) {
  w.restart = { type, side, x, y, timer: type === 'PENALTY' ? 95 : 60 };
  const b = w.ball;
  b.ownerId = null; b.passTo = null;
  b.vx = 0; b.vy = 0; b.vz = 0; b.z = 0; b.x = x; b.y = y;
  w.incomingReceiver = null;
  if (type === 'CORNER') w.stats.corners[sideIndex(side)]++;
  w.events.push({ type: 'RESTART', kind: type, side });
}

function handleRestart(w: World) {
  const r = w.restart;
  if (!r) return;
  const b = w.ball;
  b.x = r.x; b.y = r.y; b.z = 0; b.vx = 0; b.vy = 0; b.vz = 0; b.ownerId = null;
  const d = dirOf(r.side);

  if (r.type === 'PENALTY') {
    onPitch(w).forEach((p) => {
      if (p.isGK) {
        if (p.side !== r.side) {
          p.x = PITCH.halfW * d - 10 * d;
          p.y = clamp(p.y, -PITCH.goalHalf + 10, PITCH.goalHalf - 10);
        }
        return;
      }
      const isTaker = p.side === r.side && attackWeight(p) > 0.85;
      if (isTaker) { p.x = r.x - 46 * d; p.y = 0; return; }
      const behind = r.x - 230 * d;
      p.x += (behind - p.x) * 0.12;
      p.y += ((p.y >= 0 ? 300 : -300) - p.y) * 0.1;
    });
  } else {
    const required = r.type === 'FREEKICK' ? 200 : 180;
    onPitch(w).forEach((p) => {
      if (p.side === r.side) return;
      const dd = dist(p.x, p.y, r.x, r.y);
      if (dd < required && dd > 0.01) {
        p.x += ((p.x - r.x) / dd) * 4.6;
        p.y += ((p.y - r.y) / dd) * 4.6;
      }
    });
  }

  r.timer--;
  if (r.timer > 0) return;

  const pool = onPitch(w).filter((p) => {
    if (r.type === 'GOALKICK') return p.side === r.side && p.isGK;
    if (r.type === 'PENALTY') return p.side === r.side && attackWeight(p) > 0.85;
    return p.side === r.side && !p.isGK;
  });
  const taker = pool.sort((a, b2) => dist(a.x, a.y, r.x, r.y) - dist(b2.x, b2.y, r.x, r.y))[0]
    || onPitch(w).find((p) => p.side === r.side);

  if (taker) {
    taker.x = r.x - 38 * d;
    taker.y = r.y;
    taker.facingAngle = d === 1 ? 0 : Math.PI;
    giveBall(w, taker, 34);
    setTouch(w, taker);
    if (taker.side === 'USER' && !taker.isGK) w.controlledId = taker.id;
  }
  w.restart = null;
  w.pickupCd = 6;
}

/* ==================================================================
   MOVEMENT
   ================================================================== */
function baseSpeed(p: PitchPlayer, prof: DiffProfile) {
  return (4.35 + (p.speedRating - 75) * 0.016) * prof.speed * TEAM_SPEED[p.side];
}

function moveTo(p: PitchPlayer, tx: number, ty: number, speed: number) {
  const dx = tx - p.x;
  const dy = ty - p.y;
  const d = Math.hypot(dx, dy);
  if (d < 14) {
    p.vx *= 0.74; p.vy *= 0.74;
    if (p.actionTimer <= 0) p.actionState = 'idle';
    return;
  }
  const want = Math.min(speed, 1.3 + d * 0.06);
  p.vx += ((dx / d) * want - p.vx) * 0.2;
  p.vy += ((dy / d) * want - p.vy) * 0.2;
  const sp = Math.hypot(p.vx, p.vy);
  if (sp > 0.3) p.facingAngle = Math.atan2(p.vy, p.vx);
  if (p.actionTimer <= 0) p.actionState = sp > 4.6 ? 'sprint' : sp > 1.9 ? 'run' : 'walk';
}

function separation(w: World, p: PitchPlayer) {
  let sx = 0; let sy = 0;
  onPitch(w).forEach((o) => {
    if (o.id === p.id || o.side !== p.side) return;
    const d = dist(p.x, p.y, o.x, o.y);
    if (d < 130 && d > 0.01) { sx += (p.x - o.x) / d; sy += (p.y - o.y) / d; }
  });
  return { sx: sx * 70, sy: sy * 70 };
}

/* ==================================================================
   AI
   ================================================================== */
function goalkeeperHoldShape(w: World, p: PitchPlayer, holdingSide: Side) {
  const anchor = anchorFor(w, p, holdingSide);
  const d = dirOf(p.side);
  const tx = p.side === holdingSide ? anchor.x + 90 * d : anchor.x - 110 * d;
  moveTo(p, clampRoleX(p, clamp(tx, -PITCH.halfW + 90, PITCH.halfW - 90)), anchor.y, 3.6);
}

function keeperAI(w: World, p: PitchPlayer) {
  const prof = profileFor(w, p);
  const d = dirOf(p.side);
  const goalX = -PITCH.halfW * d;
  const b = w.ball;
  const sweeper = p.instruction === 'SWEEPER_KEEPER';

  if (b.ownerId === p.id) {
    moveTo(p, goalX + 110 * d, clamp(b.y * 0.25, -110, 110), 2.8);
    if (p.actionTimer <= 0) p.actionState = 'idle';
    if (!w.gkHold && p.holdTimer <= 0) releaseFromKeeper(w, p);
    return;
  }

  const threat = Math.abs(b.x - goalX) < 700;
  const advance = sweeper ? 150 : 70;
  const targetX = goalX + (threat ? advance : 34) * d;
  let targetY = clamp(b.y * 0.62, -PITCH.goalHalf - 10, PITCH.goalHalf + 10);

  const incoming = !b.ownerId && (d === 1 ? b.vx < -8 : b.vx > 8) && Math.abs(b.x - goalX) < 900;
  if (incoming) {
    const t = (goalX - b.x) / b.vx;
    if (t > 0 && t < 90) {
      const error = (1 - prof.keeper) * 110 * (w.rand() * 2 - 1);
      targetY = clamp(b.y + b.vy * t + error, -PITCH.goalHalf - 30, PITCH.goalHalf + 30);
      if (Math.abs(targetY - p.y) > 40 && p.actionTimer <= 0) {
        p.actionState = 'dive_save'; p.actionTimer = 16;
      }
    }
  }

  moveTo(p, targetX, targetY, 3.0 + prof.keeper * 2.6);
  const boxFar = goalX + PITCH.boxW * d;
  p.x = clamp(p.x, Math.min(goalX, boxFar) + 10, Math.max(goalX, boxFar) - 10);
  p.y = clamp(p.y, -PITCH.boxHalfH + 20, PITCH.boxHalfH - 20);
}

function carrierAI(w: World, p: PitchPlayer) {
  const prof = profileFor(w, p);
  const T = w.tactics[p.side];
  const d = dirOf(p.side);
  const goalX = PITCH.halfW * d;
  const toGoal = Math.hypot(goalX - p.x, p.y * 0.8);
  const pressure = onPitch(w).filter((o) => o.side !== p.side && !o.isGK && dist(o.x, o.y, p.x, p.y) < 170).length;

  /* ---------------------- possession decision clock ----------------------
     The clock is advanced centrally in stepWorld so it also runs while the
     user is the carrier. It starts when possession is gained and is never
     restarted by dribbling. A meaningful action must begin by DECIDE_MAX. */
  if (p.decisionCd > 0) p.decisionCd--;

  const held = p.possessionTimer;
  const shootRange = 600 + (T.mentality - 50) * 2.4;
  const canShoot = toGoal < shootRange && Math.abs(p.y) < 430;
  const option = bestPassTarget(w, p);

  // Under real pressure with a safe outlet, decide sooner than the usual window.
  const squeezed = pressure > 0 && onPitch(w).some(
    (o) => o.side !== p.side && !o.isGK && dist(o.x, o.y, p.x, p.y) < 95
  );
  const earliest = squeezed ? Math.round(DECIDE_MIN * 0.5) : DECIDE_MIN;

  if (held >= earliest && p.decisionCd <= 0 && p.holdTimer <= 0) {
    const deadline = held >= DECIDE_MAX;
    const inWindow = held >= DECIDE_WINDOW;

    // 1. Shot, when the position genuinely warrants it.
    if (canShoot && (toGoal < 320 || pressure === 0 || deadline || w.rand() < 0.3 * prof.aggro)) {
      doShoot(w, p); p.decisionCd = 40; return;
    }

    // 2. Past the deadline the player must release the ball if anyone is open.
    if (deadline) {
      if (option && doPass(w, p)) { p.decisionCd = 30; return; }
      if (canShoot) { doShoot(w, p); p.decisionCd = 40; return; }
      // Nobody on: drive into space, then reassess very shortly.
      p.decisionCd = 24;
    } else if (option) {
      // 3. Inside the normal window, weigh passing against carrying.
      const forward = (option.x - p.x) * d > 90;
      let urge = squeezed ? 0.75 : inWindow ? 0.45 : 0.12;
      if (forward) urge += 0.18;
      urge *= 0.5 + prof.aggro * 0.7;
      if (w.rand() < urge) {
        if (doPass(w, p)) { p.decisionCd = 30; return; }
      }
      // Took a touch instead; look up again soon, but the clock keeps running.
      p.decisionCd = Math.round(14 + w.rand() * prof.think * 0.5);
    } else {
      // 4. No option: carry to open a lane, re-check quickly.
      p.decisionCd = 20;
    }
  }

  let targetY = clamp(p.y * 0.6, -480, 480);
  const nearest = onPitch(w)
    .filter((o) => o.side !== p.side && !o.isGK)
    .sort((a, b2) => dist(a.x, a.y, p.x, p.y) - dist(b2.x, b2.y, p.x, p.y))[0];
  if (nearest && dist(nearest.x, nearest.y, p.x, p.y) < 200) {
    targetY = clamp(p.y + (p.y >= nearest.y ? 190 : -190), -PITCH.halfH + 90, PITCH.halfH - 90);
  }
  moveTo(p, p.x + d * 300, targetY, baseSpeed(p, prof) * 0.98);
  if (p.actionTimer <= 0) p.actionState = 'dribble';
}

function receiveAI(w: World, p: PitchPlayer) {
  const prof = profileFor(w, p);
  const b = w.ball;
  // Run onto the ball's predicted path rather than its current position.
  const t = clamp(dist(p.x, p.y, b.x, b.y) / 22, 2, 18);
  moveTo(
    p,
    clamp(b.x + b.vx * t * 0.5, -PITCH.halfW + 30, PITCH.halfW - 30),
    clamp(b.y + b.vy * t * 0.5, -PITCH.halfH + 30, PITCH.halfH - 30),
    baseSpeed(p, prof) * 1.08
  );
  if (dist(p.x, p.y, b.x, b.y) < 80 && p.actionTimer <= 0) p.actionState = 'receive';
}

function updateAI(w: World) {
  const owner = getById(w, w.ball.ownerId);
  const possSide: Side | null = owner ? owner.side : null;
  const list = onPitch(w);

  // Rank each side by distance to the ball so only a few players press.
  const ranks: Record<Side, string[]> = { USER: [], CPU: [] };
  (['USER', 'CPU'] as Side[]).forEach((side) => {
    ranks[side] = list
      .filter((p) => p.side === side && !p.isGK)
      .sort((a, b) => dist(a.x, a.y, w.ball.x, w.ball.y) - dist(b.x, b.y, w.ball.x, w.ball.y))
      .map((p) => p.id);
  });

  w.players.forEach((p) => {
    if (p.actionTimer > 0) p.actionTimer--;
    if (p.tackleCd > 0) p.tackleCd--;
    if (p.holdTimer > 0) p.holdTimer--;
  });

  list.forEach((p) => {
    if (p.id === w.controlledId) return;
    if (w.gkHold && !p.isGK) { goalkeeperHoldShape(w, p, w.gkHold.side); return; }
    if (p.isGK) { keeperAI(w, p); return; }
    if (w.ball.ownerId === p.id) { carrierAI(w, p); return; }
    if (w.incomingReceiver === p.id && !w.ball.ownerId) { receiveAI(w, p); return; }

    const prof = profileFor(w, p);
    const T = w.tactics[p.side];
    const ps = PLAYSTYLES[T.playstyle];
    const rank = ranks[p.side].indexOf(p.id);
    // Hard cap: at most one or two players ever hunt the ball, so the carrier
    // is never swarmed by three defenders at once.
    let pressers = Math.max(1, Math.min(
      prof.maxPressers,
      Math.round(1 + (T.pressing / 100) * ps.press * 1.4)
    ));
    // The user's own player counts as a presser, so teammates drop into cover
    // instead of piling onto the same opponent.
    if (p.side === 'USER') {
      const userRank = ranks.USER.indexOf(w.controlledId);
      if (userRank >= 0 && userRank < pressers) pressers = Math.max(1, pressers - 1);
      if (w.pressing) pressers = Math.max(1, pressers - 1);
    }
    const anchor = anchorFor(w, p, possSide);
    const sep = separation(w, p);

    const shouldPress = rank >= 0 && rank < pressers && possSide !== p.side;
    const chaseLoose = possSide === null && rank === 0;

    if (shouldPress || chaseLoose) {
      const lead = 8;
      let aimX = w.ball.x + w.ball.vx * lead * 0.4;
      let aimY = w.ball.y + w.ball.vy * lead * 0.4;
      const dd = dist(p.x, p.y, w.ball.x, w.ball.y);

      // The standoff shrinks the longer the carrier dwells, so a presser never
      // parks on a fixed ring: it keeps closing until it can engage.
      const dwell = owner && owner.possessionTimer > 0 ? owner.possessionTimer : 0;
      const patience = Math.max(0, 1 - dwell / 150);
      const standoff = prof.standoff * patience;

      if (!chaseLoose && standoff > 1 && dd > 1) {
        aimX += ((p.x - w.ball.x) / dd) * standoff;
        aimY += ((p.y - w.ball.y) / dd) * standoff;
      }

      // Jockey sideways while containing, rather than standing still.
      if (!chaseLoose && dd < standoff + 90) {
        const across = Math.atan2(w.ball.y - p.y, w.ball.x - p.x) + Math.PI / 2;
        const sway = Math.sin(w.tick / 22 + p.x * 0.01) * 26;
        aimX += Math.cos(across) * sway;
        aimY += Math.sin(across) * sway;
      }

      // Sprint when the ball is a long way off, jog when containing.
      const pace = dd > 260 ? AI_SPRINT : dd < standoff + 40 ? 0.78 : 1.0;
      moveTo(p, clampRoleX(p, aimX), aimY, baseSpeed(p, prof) * pace);

      const ownerIsKeeper = owner ? owner.isGK : false;
      // Willingness to commit also grows while the carrier holds on.
      const eagerness = 0.028 * prof.react * (1 + INSTRUCTIONS[p.instruction].press)
        * (1 + Math.min(1.5, dwell / 120));
      if (dd < 46 && p.tackleCd <= 0 && !ownerIsKeeper && possSide && possSide !== p.side && w.rand() < eagerness) {
        doTackle(w, p);
      }
      return;
    }

    /* ------------------------- man-marking ------------------------- */
    // Defenders track a specific opponent, so they keep moving with the game
    // instead of settling onto a static formation point.
    let markX = anchor.x;
    let markY = anchor.y;
    if (possSide && possSide !== p.side && atkOf(p) < 0.8) {
      const dir = dirOf(p.side);
      let mark: PitchPlayer | null = null;
      let bestCost = Infinity;
      onPitch(w).forEach((o) => {
        if (o.side === p.side || o.isGK || o.id === (owner ? owner.id : '')) return;
        // Prefer the dangerous opponent nearest this defender's zone.
        const cost = dist(o.x, o.y, anchor.x, anchor.y) - (o.x * dir) * 0.35;
        if (cost < bestCost) { bestCost = cost; mark = o; }
      });
      if (mark) {
        const m = mark as PitchPlayer;
        p.markId = m.id;
        // Sit goal-side of the man, between them and our goal.
        markX = m.x - dir * 52 + m.vx * 6;
        markY = m.y * 0.9 + m.vy * 6;
        // Stay roughly in position rather than following them everywhere.
        markX = anchor.x + clamp(markX - anchor.x, -230, 230);
        markY = anchor.y + clamp(markY - anchor.y, -230, 230);
      } else p.markId = null;
    } else p.markId = null;

    // Sprint into position when a long way from the required spot.
    const travel = dist(p.x, p.y, markX, markY);
    const pace = travel > 300 ? AI_SPRINT : 0.94;
    moveTo(p, clampRoleX(p, markX + sep.sx), markY + sep.sy, baseSpeed(p, prof) * pace);
  });
}

/**
 * Chooses the best defender to hand the user when the opponent has the ball.
 * Scored on distance, closing angle, cover value and stamina, with hysteresis
 * so the selection never flickers between two similar players.
 */
function bestDefender(w: World, carrier: PitchPlayer): PitchPlayer | null {
  const candidates = onPitch(w).filter((p) => p.side === 'USER' && !p.isGK);
  if (!candidates.length) return null;
  const d = dirOf('USER');
  const ownGoalX = -PITCH.halfW * d;

  let best: PitchPlayer | undefined;
  let bestScore = -Infinity;

  candidates.forEach((p) => {
    const dx = carrier.x - p.x;
    const dy = carrier.y - p.y;
    const gap = Math.hypot(dx, dy) || 1;

    // Closer is better, but weight it by how long it would actually take.
    let score = 1400 - gap * 1.25;

    // Reward a defender already moving toward the carrier (good momentum).
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > 0.4) score += ((p.vx * dx + p.vy * dy) / (sp * gap)) * 150;

    // Prefer someone goal-side: between the carrier and our goal.
    const defenderIsGoalSide = (p.x - carrier.x) * d < 0;
    if (defenderIsGoalSide) score += 220;

    // Don't drag a centre-back out of the box when the ball is nowhere near it.
    const carrierThreat = 1 - Math.min(1, Math.abs(carrier.x - ownGoalX) / (PITCH.halfW * 1.2));
    if (p.slotRole === 'CB') score -= 260 * (1 - carrierThreat);

    // Defensive roles are naturally better suited to pressing.
    score += ROLE_ATTACK[p.slotRole] * -120;
    score += (p.stamina - 60) * 1.2;

    if (score > bestScore) { bestScore = score; best = p; }
  });

  if (!best) return null;

  // Hysteresis: only switch if the new option is clearly better.
  const current = getById(w, w.controlledId);
  if (current && current.side === 'USER' && current.onPitch && !current.sentOff && !current.isGK) {
    const curGap = dist(current.x, current.y, carrier.x, carrier.y);
    const newGap = dist(best.x, best.y, carrier.x, carrier.y);
    if (best.id !== current.id && curGap - newGap < 110) return current;
  }
  return best;
}

/** PES-style automatic switching. Only ever acts while defending. */
function updateAutoSwitch(w: World) {
  if (w.switchCd > 0) { w.switchCd--; return; }
  const owner = getById(w, w.ball.ownerId);
  const current = getById(w, w.controlledId);

  // Attacking: keep whoever is on the ball, never switch away from them.
  if (owner && owner.side === 'USER') {
    if (current?.id !== owner.id && !owner.isGK) {
      w.controlledId = owner.id;
      w.switchCd = 24;
    }
    return;
  }

  // Loose ball in the air or on the ground: take the best-placed challenger.
  const target = owner ?? ({
    x: w.ball.x + w.ball.vx * 8,
    y: w.ball.y + w.ball.vy * 8,
  } as PitchPlayer);

  const pick = bestDefender(w, target as PitchPlayer);
  if (pick && pick.id !== w.controlledId) {
    w.controlledId = pick.id;
    w.switchCd = 30;
  }
}

/**
 * Caps Lock pressure: steer the controlled defender onto the ball carrier
 * without any mouse input, using a curved approach rather than a blind charge.
 */
function autoPressure(w: World, p: PitchPlayer): boolean {
  const owner = getById(w, w.ball.ownerId);
  const ball = w.ball;
  const d = dirOf('USER');
  const ownGoalX = -PITCH.halfW * d;

  const targetX = owner ? owner.x : ball.x + ball.vx * 6;
  const targetY = owner ? owner.y : ball.y + ball.vy * 6;
  const gap = dist(p.x, p.y, targetX, targetY);

  // Lead the carrier so we cut them off instead of trailing behind.
  const leadT = clamp(gap / 220, 0, 1) * 10;
  let aimX = targetX + (owner ? owner.vx * leadT : 0);
  let aimY = targetY + (owner ? owner.vy * leadT : 0);

  // Approach from the goal side: stand between the carrier and our goal.
  const gx = ownGoalX - aimX;
  const gy = 0 - aimY;
  const gl = Math.hypot(gx, gy) || 1;
  const standoff = gap > 150 ? 34 : 20;
  aimX += (gx / gl) * standoff;
  aimY += (gy / gl) * standoff;

  // Steer around nearby teammates so we never bundle into each other.
  let avoidX = 0; let avoidY = 0;
  onPitch(w).forEach((o) => {
    if (o.id === p.id || o.side !== p.side) return;
    const od = dist(p.x, p.y, o.x, o.y);
    if (od < 90 && od > 0.01) { avoidX += (p.x - o.x) / od; avoidY += (p.y - o.y) / od; }
  });
  aimX += avoidX * 46;
  aimY += avoidY * 46;

  // Slow into a contained defensive stance rather than running straight past.
  const prof = ALLY;
  const full = baseSpeed(p, prof) * 1.05 * staminaFactor(p);
  const speed = gap < 60 ? full * 0.52 : gap < 130 ? full * 0.82 : full;
  moveTo(p, aimX, aimY, speed);

  if (p.actionTimer <= 0) p.actionState = gap < 60 ? 'walk' : Math.hypot(p.vx, p.vy) > 4.6 ? 'sprint' : 'run';

  // Commit to a tackle only when genuinely in range and roughly square to them.
  const ownerIsKeeper = owner ? owner.isGK : false;
  if (!ownerIsKeeper && p.tackleCd <= 0 && dist(p.x, p.y, ball.x, ball.y) < 44) {
    const facing = Math.abs(norm(Math.atan2(ball.y - p.y, ball.x - p.x) - p.facingAngle));
    if (facing < 1.1 && w.rand() < 0.07) doTackle(w, p);
  }
  return true;
}

/** Stamina scales top speed; it never drops low enough to make a player useless. */
function staminaFactor(p: PitchPlayer) {
  return 0.80 + (clamp(p.stamina, 0, 100) / 100) * 0.20;
}

function updateControlled(w: World, input: InputState) {
  const p = getById(w, w.controlledId);
  if (!p || p.sentOff || !p.onPitch) { switchPlayer(w); return; }

  const dt = clamp(input.dt / 16.6667, 0.2, 2);
  const carrying = w.ball.ownerId === p.id;

  /* ----------------------- gather a direction ----------------------- */
  let mx = 0; let my = 0; let mag = 0;
  if (input.drag && input.drag.mag > 0) {
    mx = input.drag.x; my = input.drag.y; mag = input.drag.mag;
  } else {
    if (input.up) my -= 1;
    if (input.down) my += 1;
    if (input.left) mx -= 1;
    if (input.right) mx += 1;
    const len = Math.hypot(mx, my);
    if (len > 0) { mx /= len; my /= len; mag = 1; }
  }

  // Cursor-motion magnitude naturally fluctuates, so the sprint gate is low:
  // holding Shift while actually moving is enough.
  const wantsSprint = input.sprint && mag > 0.25;

  /* --------------------------- stamina --------------------------- */
  if (wantsSprint) p.stamina = clamp(p.stamina - 0.22 * dt, 0, 100);
  else p.stamina = clamp(p.stamina + (mag > 0.1 ? 0.07 : 0.17) * dt, 0, 100);

  /* ------------------ Caps Lock automatic pressure ------------------ */
  const owner = getById(w, w.ball.ownerId);
  const defending = !owner || owner.side !== 'USER';
  if (input.pressure && defending && mag < 0.15) {
    w.pressing = true;
    autoPressure(w, p);
    return;
  }
  w.pressing = false;

  /* ------------------------ run / sprint ------------------------ */
  // Sprinting builds up; it is never reached instantly.
  // Both teams run at the same base pace. Sprinting is the only way to go
  // faster, and a sprinting human is quicker than a sprinting AI.
  const boost = TEAM_SPEED[p.side];
  const rating = 1 + (p.speedRating - 78) * 0.0022;
  const walk = 2.5 * boost;
  const run = 4.6 * boost * rating * staminaFactor(p);
  const sprint = run * 1.42;
  const ceiling = wantsSprint ? sprint : run;
  const target = mag <= 0 ? 0 : walk + (ceiling - walk) * clamp(mag, 0, 1);

  if (mag > 0) {
    const desiredVx = mx * target;
    const desiredVy = my * target;

    // Turning sharply costs speed, exactly like a real player planting a foot.
    const current = Math.hypot(p.vx, p.vy);
    let turnPenalty = 1;
    if (current > 1.2) {
      const dot = (p.vx * mx + p.vy * my) / current;
      turnPenalty = 0.55 + 0.45 * clamp((dot + 1) / 2, 0, 1);
    }

    // Accelerate toward the target velocity; sprinting ramps in more slowly.
    const accel = (wantsSprint ? 0.085 : 0.13) * turnPenalty;
    const k = 1 - Math.pow(1 - accel, dt);
    p.vx += (desiredVx - p.vx) * k;
    p.vy += (desiredVy - p.vy) * k;

    // Rotate the body toward the run instead of snapping to it.
    const want = Math.atan2(my, mx);
    const turnRate = (carrying ? 0.20 : 0.28) * dt;
    p.facingAngle += clamp(norm(want - p.facingAngle), -turnRate * Math.PI, turnRate * Math.PI);

    if (p.actionTimer <= 0) {
      const sp = Math.hypot(p.vx, p.vy);
      p.actionState = wantsSprint && sp > 4.8 ? 'sprint'
        : carrying ? 'dribble'
        : sp > 1.6 ? 'run' : 'walk';
    }
  } else {
    // Decelerate smoothly; no instant stop, no sliding.
    const decel = 1 - Math.pow(0.80, dt);
    p.vx -= p.vx * decel;
    p.vy -= p.vy * decel;
    if (p.actionTimer <= 0 && Math.hypot(p.vx, p.vy) < 0.5) p.actionState = 'idle';
  }

  // Sprinting with the ball pushes the touch further ahead.
  if (carrying) p.holdTimer = Math.max(p.holdTimer, wantsSprint ? 0 : p.holdTimer);
}

/* ==================================================================
   PHYSICS
   ================================================================== */
function integratePlayers(w: World) {
  const list = onPitch(w);
  list.forEach((p) => {
    p.x += p.vx; p.y += p.vy;
    const speed = Math.hypot(p.vx, p.vy);
    if (speed > 0.25) p.animFrame += speed * 0.062;
    p.x = clamp(p.x, -PITCH.halfW + 18, PITCH.halfW - 18);
    p.y = clamp(p.y, -PITCH.halfH + 18, PITCH.halfH - 18);
  });

  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      const d = dist(a.x, a.y, b.x, b.y);
      if (d < 34 && d > 0.01) {
        const push = (34 - d) / 2;
        const nx = (a.x - b.x) / d;
        const ny = (a.y - b.y) / d;
        a.x += nx * push; a.y += ny * push;
        b.x -= nx * push; b.y -= ny * push;
      }
    }
  }
}

function scoreGoal(w: World, side: Side) {
  const touch = w.lastTouch;
  const ownGoal = !!touch && touch.side !== side;
  const scorer = touch ? touch.name : 'Unknown';
  if (side === 'USER') w.score.user++; else w.score.cpu++;

  const b = w.ball;
  b.vx = 0; b.vy = 0; b.vz = 0; b.ownerId = null; b.passTo = null;
  w.players.forEach((q) => { q.possessionTimer = -1; });
  w.live = false;
  w.awaitingKickoff = side === 'USER' ? 'CPU' : 'USER';
  w.restart = null; w.gkHold = null; w.gkRelease = null; w.incomingReceiver = null;
  w.referee.whistleTimer = 30;
  w.events.push({ type: 'GOAL', side, scorer, ownGoal });
}

function handleBounds(w: World): boolean {
  const b = w.ball;
  const insidePosts = Math.abs(b.y) <= PITCH.goalHalf - BALL_R * 0.5;
  const underBar = b.z + BALL_R <= PITCH.crossbar;

  if (insidePosts && underBar) {
    if (b.x - BALL_R >= PITCH.halfW) { scoreGoal(w, 'USER'); return true; }
    if (b.x + BALL_R <= -PITCH.halfW) { scoreGoal(w, 'CPU'); return true; }
  }

  if (Math.abs(b.y) > PITCH.halfH + BALL_R) {
    const side: Side = w.lastTouch && w.lastTouch.side === 'USER' ? 'CPU' : 'USER';
    beginRestart(w, 'THROW', side, clamp(b.x, -PITCH.halfW + 60, PITCH.halfW - 60), Math.sign(b.y) * (PITCH.halfH - 10));
    return true;
  }
  if (b.x > PITCH.halfW + BALL_R) {
    const lastUser = w.lastTouch ? w.lastTouch.side === 'USER' : true;
    if (lastUser) beginRestart(w, 'GOALKICK', 'CPU', PITCH.halfW - PITCH.sixW - 40, 0);
    else beginRestart(w, 'CORNER', 'USER', PITCH.halfW - 18, Math.sign(b.y || 1) * (PITCH.halfH - 18));
    return true;
  }
  if (b.x < -PITCH.halfW - BALL_R) {
    const lastCpu = w.lastTouch ? w.lastTouch.side === 'CPU' : true;
    if (lastCpu) beginRestart(w, 'GOALKICK', 'USER', -PITCH.halfW + PITCH.sixW + 40, 0);
    else beginRestart(w, 'CORNER', 'CPU', -PITCH.halfW + 18, Math.sign(b.y || 1) * (PITCH.halfH - 18));
    return true;
  }
  return false;
}

function hitFrame(w: World) {
  const b = w.ball;
  const posts: [number, number][] = [
    [PITCH.halfW, PITCH.goalHalf], [PITCH.halfW, -PITCH.goalHalf],
    [-PITCH.halfW, PITCH.goalHalf], [-PITCH.halfW, -PITCH.goalHalf],
  ];
  posts.forEach(([px, py]) => {
    const d = dist(b.x, b.y, px, py);
    const r = BALL_R + 7;
    if (d < r && d > 0.01 && b.z < PITCH.crossbar) {
      const nx = (b.x - px) / d;
      const ny = (b.y - py) / d;
      b.x = px + nx * r; b.y = py + ny * r;
      const dot = b.vx * nx + b.vy * ny;
      b.vx = (b.vx - 2 * dot * nx) * 0.7;
      b.vy = (b.vy - 2 * dot * ny) * 0.7;
      b.passTo = null;
      w.events.push({ type: 'POST' });
    }
  });
  [PITCH.halfW, -PITCH.halfW].forEach((lineX) => {
    if (Math.abs(b.x - lineX) < BALL_R + 6 && Math.abs(b.y) < PITCH.goalHalf &&
      b.z + BALL_R > PITCH.crossbar && b.z - BALL_R < PITCH.crossbar + 14) {
      b.vz = -Math.abs(b.vz) * 0.55;
      b.vx *= -0.45;
      b.z = PITCH.crossbar - BALL_R - 2;
      b.passTo = null;
      w.events.push({ type: 'POST' });
    }
  });
}

function beginGkHold(w: World, keeper: PitchPlayer) {
  const b = w.ball;
  b.vx = 0; b.vy = 0; b.vz = 0; b.z = 0;
  giveBall(w, keeper, 100);
  keeper.actionState = 'dive_save';
  keeper.actionTimer = 22;
  w.gkHold = { side: keeper.side, timer: 100 };
  w.incomingReceiver = null;
  setTouch(w, keeper);
}

function keeperInterception(w: World) {
  const b = w.ball;
  if (b.ownerId || w.gkHold || w.pickupCd > 0) return;
  onPitch(w).forEach((p) => {
    if (!p.isGK) return;
    if (w.gkRelease && w.gkRelease.id === p.id) return;
    const d = dist(p.x, p.y, b.x, b.y);
    if (d > 44 || b.z > 150) return;

    const prof = profileFor(w, p);
    const fast = Math.hypot(b.vx, b.vy) > 14;

    // Back-pass rule: no handling a deliberate pass from a teammate.
    if (!fast && w.lastTouch && w.lastTouch.side === p.side) {
      b.vx = 0; b.vy = 0; b.vz = 0; b.z = 0;
      giveBall(w, p, 30);
      p.actionState = 'receive'; p.actionTimer = 9;
      w.incomingReceiver = null;
      setTouch(w, p);
      return;
    }

    if (!fast || w.rand() < 0.25 + prof.keeper * 0.45) {
      beginGkHold(w, p);
      if (fast) { w.stats.saves[sideIndex(p.side)]++; w.events.push({ type: 'SAVE', side: p.side, caught: true }); }
    } else {
      const d2 = dirOf(p.side);
      b.vx = Math.abs(b.vx) * 0.55 * d2;
      b.vy = (b.vy + (w.rand() - 0.5) * 14) * 0.85;
      b.vz = 2.2; b.passTo = null;
      w.pickupCd = 10;
      w.stats.saves[sideIndex(p.side)]++;
      p.actionState = 'dive_save'; p.actionTimer = 20;
      w.events.push({ type: 'SAVE', side: p.side, caught: false });
    }
  });
}

function updateBall(w: World) {
  const b = w.ball;
  const SUB = 4;

  for (let s = 0; s < SUB; s++) {
    const owner = getById(w, b.ownerId);
    if (owner) {
      // A sprinting dribbler knocks the ball further in front of himself.
      const speed = Math.hypot(owner.vx, owner.vy);
      const push = owner.isGK ? 0 : clamp((speed - 3.4) * 7, 0, 22);
      const reach = (owner.isGK ? 20 : 26) + push;
      const settle = owner.isGK ? 0.45 : 0.45 - Math.min(0.16, push * 0.006);
      b.x += (owner.x + Math.cos(owner.facingAngle) * reach - b.x) * settle;
      b.y += (owner.y + Math.sin(owner.facingAngle) * reach - b.y) * settle;
      b.z = 0;
      b.vx = owner.vx; b.vy = owner.vy; b.vz = 0;
      b.rotationX += owner.vx * 0.04; b.rotationY += owner.vy * 0.04;

      if (owner.holdTimer <= 0 && !owner.isGK) {
        for (const op of onPitch(w)) {
          if (op.side === owner.side || op.tackleCd > 0 || op.isGK) continue;
          if (dist(op.x, op.y, b.x, b.y) < 32) {
            const prof = profileFor(w, op);
            if (w.rand() < 0.010 + prof.tackle * 0.028) {
              giveBall(w, op, 22);
              owner.actionState = 'idle';
              setTouch(w, op);
              w.stats.tackles[sideIndex(op.side)]++;
              w.events.push({ type: 'TACKLE', side: op.side });
              if (op.side === 'USER' && w.autoSwitch) w.controlledId = op.id;
              break;
            }
          }
        }
      }
    } else {
      b.x += b.vx / SUB; b.y += b.vy / SUB; b.z += b.vz / SUB;
      if (b.z > 0) b.vz -= 0.34 / SUB;
      else { b.z = 0; b.vz = Math.abs(b.vz) > 1.1 ? -b.vz * 0.52 : 0; }

      const friction = b.z > 4 ? 0.9985 : 0.9925;
      b.vx *= Math.pow(friction, 1 / SUB);
      b.vy *= Math.pow(friction, 1 / SUB);
      b.vy += b.spin / SUB;
      b.spin *= 0.985;
      b.rotationX += b.vx * 0.04; b.rotationY += b.vy * 0.04;

      // Passes travel in a straight line. Accuracy is decided at the moment of
      // the kick, not by bending the ball in flight toward the receiver.
      if (b.passTo) {
        b.passTimer--;
        const target = getById(w, b.passTo);
        if (!target || !target.onPitch || target.sentOff || b.passTimer <= 0) b.passTo = null;
      }

      if (w.pickupCd > 0) {
        onPitch(w).forEach((p) => {
          const d = dist(p.x, p.y, b.x, b.y);
          if (d < 24 && d > 0.01 && b.z < 70) {
            const nx = (b.x - p.x) / d;
            const ny = (b.y - p.y) / d;
            b.x = p.x + nx * 24; b.y = p.y + ny * 24;
            b.vx = nx * Math.abs(b.vx) * 0.7;
            b.vy = ny * Math.abs(b.vy) * 0.7;
          }
        });
      } else {
        const claimant = onPitch(w)
          .filter((p) => p.actionTimer <= 6 && dist(p.x, p.y, b.x, b.y) < 34 && b.z < 60)
          .sort((a, b2) => dist(a.x, a.y, b.x, b.y) - dist(b2.x, b2.y, b.x, b.y))[0];
        if (claimant) {
          const backPass = !!w.lastTouch && w.lastTouch.side === claimant.side;
          const justReleased = !!w.gkRelease && w.gkRelease.id === claimant.id;
          if (claimant.isGK && !backPass && !justReleased) beginGkHold(w, claimant);
          else {
            giveBall(w, claimant, claimant.isGK ? 30 : 16);
            claimant.actionState = 'receive'; claimant.actionTimer = 9;
            setTouch(w, claimant);
            if (claimant.side === 'USER' && w.autoSwitch && !claimant.isGK) w.controlledId = claimant.id;
          }
          w.incomingReceiver = null;
        }
      }
    }

    hitFrame(w);
    keeperInterception(w);
    if (handleBounds(w)) return;
  }
  if (w.pickupCd > 0) w.pickupCd--;
}

/* ==================================================================
   STEP
   ================================================================== */
export function stepWorld(w: World, input: InputState): MatchEvent[] {
  w.events = [];
  w.tick++;

  if (!w.live) {
    onPitch(w).forEach((p) => { p.animFrame += 0.16; });
    return w.events;
  }
  if (w.passCd > 0) w.passCd--;

  const controlled = getById(w, w.controlledId);
  if (!controlled || controlled.isGK || controlled.sentOff || !controlled.onPitch) switchPlayer(w);

  if (w.gkRelease) { w.gkRelease.timer--; if (w.gkRelease.timer <= 0) w.gkRelease = null; }
  if (w.gkHold) {
    w.gkHold.timer--;
    const keeper = onPitch(w).find((p) => p.isGK && p.side === (w.gkHold as { side: Side }).side);
    if (!keeper || w.ball.ownerId !== keeper.id) w.gkHold = null;
    else if (w.gkHold.timer <= 0) { releaseFromKeeper(w, keeper); w.gkHold = null; }
  }

  // Advance the possession clock for whoever holds the ball, including the
  // user. Opponent pressure keys off this, so standing still is not safe.
  const holder = getById(w, w.ball.ownerId);
  if (holder) {
    if (holder.possessionTimer < 0) holder.possessionTimer = 0;
    holder.possessionTimer++;
  }

  handleRestart(w);
  updateAutoSwitch(w);
  updateControlled(w, input);
  updateAI(w);
  integratePlayers(w);
  updateReferee(w);

  if (!w.restart) updateBall(w);
  else { w.ball.x = w.restart.x; w.ball.y = w.restart.y; w.ball.z = 0; }

  const owner = getById(w, w.ball.ownerId);
  if (owner) w.stats.possession[sideIndex(owner.side)]++;

  const carrier = getById(w, w.controlledId);
  w.passTargetId = carrier && w.ball.ownerId === carrier.id
    ? (bestPassTarget(w, carrier, w.passMode === 'MANUAL')?.id ?? null)
    : null;

  return w.events;
}

/* ==================================================================
   REPLAY
   ================================================================== */
export interface Snapshot {
  bx: number; by: number; bz: number;
  rx: number; ry: number; rf: number; ra: number;
  p: { id: string; x: number; y: number; z: number; f: number; a: PitchPlayer['actionState']; anim: number; vx: number; vy: number }[];
}

export function captureSnapshot(w: World): Snapshot {
  return {
    bx: w.ball.x, by: w.ball.y, bz: w.ball.z,
    rx: w.referee.x, ry: w.referee.y, rf: w.referee.facingAngle, ra: w.referee.animFrame,
    p: onPitch(w).map((p) => ({
      id: p.id, x: p.x, y: p.y, z: p.z, f: p.facingAngle,
      a: p.actionState, anim: p.animFrame, vx: p.vx, vy: p.vy,
    })),
  };
}

export function possessionPercent(stats: MatchStats): [number, number] {
  const total = stats.possession[0] + stats.possession[1];
  if (!total) return [50, 50];
  const user = Math.round((stats.possession[0] / total) * 100);
  return [user, 100 - user];
}

export type { Instruction, SlotRole };
