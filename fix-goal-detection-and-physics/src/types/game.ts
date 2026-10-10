export type Difficulty = 'EASY' | 'NORMAL' | 'HARD';
export type Quality = 'LOW' | 'MEDIUM' | 'HIGH';

export type FormationId =
  | '4-3-3' | '4-2-3-1' | '4-4-2' | '4-1-4-1' | '3-5-2' | '3-4-3' | '5-3-2' | '5-4-1';

export type Playstyle =
  | 'POSSESSION' | 'QUICK_COUNTER' | 'LONG_BALL_COUNTER' | 'OUT_WIDE'
  | 'LONG_BALL' | 'ALL_OUT_ATTACK' | 'DEFENSIVE';

export type Instruction =
  | 'BALANCED' | 'ATTACKING_FB' | 'DEFENSIVE_FB' | 'STAY_BACK' | 'BOX_TO_BOX'
  | 'PLAYMAKER' | 'WINGER' | 'INSIDE_FORWARD' | 'TARGET_MAN' | 'PRESSING_FORWARD'
  | 'SWEEPER_KEEPER';

export type SlotRole = 'GK' | 'CB' | 'LB' | 'RB' | 'DM' | 'CM' | 'AM' | 'LM' | 'RM' | 'LW' | 'RW' | 'ST';

export type CameraPreset = 'DYNAMIC_WIDE' | 'STADIUM' | 'PLAYER_FOLLOW' | 'CUSTOM';

/** Everything the user can configure for one team, persisted per team id. */
export interface TeamTactics {
  teamId: string;
  formation: FormationId;
  playstyle: Playstyle;
  /** Squad-player ids: first 11 are the starting XI, in formation slot order. */
  starters: string[];
  bench: string[];
  instructions: Record<string, Instruction>;
  names: Record<string, string>;
  numbers: Record<string, number>;
  /** Normalized manual position overrides, keyed by player id. */
  customPositions: Record<string, { nx: number; ny: number }>;
  captain: string;
  penaltyTaker: string;
  freeKickTaker: string;
  cornerTaker: string;
  mentality: number;
  defLine: number;
  pressing: number;
}
export type CompetitionId = 'ISL' | 'KSL' | 'UCL';
export type TeamCategory = 'ISL' | 'KSL' | 'UCL' | 'NATIONAL';
export type Side = 'USER' | 'CPU';
export type PassMode = 'ASSISTED' | 'MANUAL';
export type Strictness = 'LENIENT' | 'STANDARD' | 'STRICT';
export type StadiumId = 'ARENA' | 'COASTAL' | 'HIGHLAND' | 'NATIONAL';
/** MOTION: move the cursor to steer. DRAG: hold and drag. OFF: keyboard only. */
export type MouseControl = 'MOTION' | 'DRAG' | 'OFF';

export type PlayerActionState =
  | 'idle'
  | 'walk'
  | 'run'
  | 'sprint'
  | 'dribble'
  | 'pass'
  | 'shoot'
  | 'tackle'
  | 'receive'
  | 'celebrate'
  | 'dive_save';

export type HairStyle =
  | 'fade_crop'
  | 'afro_curls'
  | 'slick_back'
  | 'mohawk_fade'
  | 'braids'
  | 'buzz_cut'
  | 'wavy_top'
  | 'classic_part';

export interface PlayerAppearance {
  skinTone: string;
  hairColor: string;
  hairStyle: HairStyle;
  bootColor: string;
  heightScale: number;
  buildWidth: number;
}

export interface PlayerConfig {
  id: string;
  name: string;
  number: number;
  role: 'GK' | 'DEF' | 'MID' | 'FWD';
  appearance: PlayerAppearance;
  speed: number;
  shooting: number;
  passing: number;
}

export interface Team {
  id: string;
  name: string;
  shortName: string;
  city: string;
  category: TeamCategory;
  flag?: string;
  primaryColor: string;
  secondaryColor: string;
  shortsColor: string;
  socksColor: string;
  gkColor: string;
  pattern: 'solid' | 'stripes' | 'hoops' | 'sash';
  rating: number;
  players: PlayerConfig[];
}

export interface PitchPlayer {
  id: string;
  teamId: string;
  side: Side;
  isGK: boolean;
  name: string;
  number: number;
  role: 'GK' | 'DEF' | 'MID' | 'FWD';
  slotRole: SlotRole;
  instruction: Instruction;
  /** Normalized formation home: nx 0 (own goal) to 1 (opponent goal), ny -1..1. */
  nx: number;
  ny: number;
  onPitch: boolean;
  subbedOut: boolean;
  appearance: PlayerAppearance;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  facingAngle: number;
  actionState: PlayerActionState;
  animFrame: number;
  actionTimer: number;
  tackleCd: number;
  decisionCd: number;
  holdTimer: number;
  /** Frames since this player gained controlled possession. -1 when not on the ball. */
  possessionTimer: number;
  /** Opponent this player is currently man-marking. */
  markId: string | null;
  stamina: number;
  speedRating: number;
  shootRating: number;
  passRating: number;
  homeX: number;
  homeY: number;
  yellowCards: number;
  sentOff: boolean;
}

export interface BallState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  spin: number;
  rotationX: number;
  rotationY: number;
  ownerId: string | null;
  passTo: string | null;
  passTimer: number;
}

export interface RefereeState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facingAngle: number;
  animFrame: number;
  cardType: 'YELLOW' | 'RED' | null;
  cardTimer: number;
  whistleTimer: number;
  name: string;
  assistants: [string, string];
}

export interface MatchStats {
  possession: [number, number];
  shots: [number, number];
  onTarget: [number, number];
  passes: [number, number];
  tackles: [number, number];
  saves: [number, number];
  corners: [number, number];
  fouls: [number, number];
  yellows: [number, number];
  reds: [number, number];
}

export type Stage = 'LEAGUE' | 'QF' | 'SF' | 'FINAL';

export interface Fixture {
  id: string;
  round: number;
  stage: Stage;
  homeId: string;
  awayId: string;
  homeGoals: number | null;
  awayGoals: number | null;
  homePens: number | null;
  awayPens: number | null;
  played: boolean;
  userMatch: boolean;
}

export interface Standing {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}

export interface SeasonState {
  competitionId: CompetitionId;
  userTeamId: string;
  fixtures: Fixture[];
  stage: Stage;
  champion: string | null;
  createdAt: number;
}

/* ===================== FIFA WORLD CUP 2026 ===================== */

export type WCStage = 'GROUP' | 'R32' | 'R16' | 'QF' | 'SF' | 'THIRD' | 'FINAL';

/** A slot that is not yet resolved, e.g. "winner of group A" or "winner of match 74". */
export interface WCSlot {
  kind: 'TEAM' | 'GROUP_WINNER' | 'GROUP_RUNNER' | 'BEST_THIRD' | 'MATCH_WINNER' | 'MATCH_LOSER';
  teamId?: string;
  group?: string;
  /** Allowed groups for a best-third placeholder, per the official bracket. */
  thirdGroups?: string[];
  matchNo?: number;
  slotIndex?: number;
}

export interface WCFixture {
  /** Official FIFA match number (1-104). Immutable. */
  matchNo: number;
  /** True only when this fixture corresponds to a verified real scheduled match. */
  official: boolean;
  stage: WCStage;
  group?: string;
  date: string;
  venue: string;
  home: WCSlot;
  away: WCSlot;
  homeId: string | null;
  awayId: string | null;
  homeGoals: number | null;
  awayGoals: number | null;
  homePens: number | null;
  awayPens: number | null;
  played: boolean;
}

export interface WorldCupState {
  edition: string;
  /** True when teams/groups/fixtures come from verified real-world data. */
  verified: boolean;
  userTeamId: string;
  fixtures: WCFixture[];
  champion: string | null;
  runnerUp: string | null;
  thirdPlace: string | null;
  createdAt: number;
}

/* ============================ SAVE ============================= */

export interface Settings {
  difficulty: Difficulty;
  halfLengthSec: number;
  quality: Quality;
  cameraZoom: number;
  cameraPreset: CameraPreset;
  cameraHeight: number;
  cameraDistance: number;
  /** 0.45 (very cinematic) .. 1.8 (responsive). */
  cameraSmoothness: number;
  sfx: boolean;
  crowd: boolean;
  autoSwitch: boolean;
  passMode: PassMode;
  strictness: Strictness;
  stadium: StadiumId;
  mouseControl: MouseControl;
}

export interface MatchHistoryEntry {
  id: string;
  competition: CompetitionId | 'FRIENDLY' | 'WC';
  label?: string;
  homeName: string;
  awayName: string;
  homeGoals: number;
  awayGoals: number;
  userWasHome: boolean;
  pens?: string;
  date: number;
}

export interface CareerStats {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  trophies: string[];
}

export interface AppSave {
  version: number;
  settings: Settings;
  seasons: Partial<Record<CompetitionId, SeasonState>>;
  worldCup: WorldCupState | null;
  /** Custom tactics stored separately for every team id. */
  tactics: Record<string, TeamTactics>;
  history: MatchHistoryEntry[];
  career: CareerStats;
}
