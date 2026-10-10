import { FormationId, Instruction, Playstyle, SlotRole } from '../types/game';

export interface Slot { role: SlotRole; nx: number; ny: number }

/**
 * Formation templates in attacking-direction space:
 *   nx = 0 is the team's own goal line, nx = 1 is the opponent goal line.
 *   ny = -1 is the left touchline, ny = +1 is the right touchline.
 * The same template therefore works for both teams; the engine mirrors it.
 */
export const FORMATIONS: Record<FormationId, Slot[]> = {
  '4-3-3': [
    { role: 'GK', nx: 0.045, ny: 0 },
    { role: 'LB', nx: 0.21, ny: -0.70 }, { role: 'CB', nx: 0.16, ny: -0.26 },
    { role: 'CB', nx: 0.16, ny: 0.26 }, { role: 'RB', nx: 0.21, ny: 0.70 },
    { role: 'CM', nx: 0.41, ny: -0.33 }, { role: 'CM', nx: 0.36, ny: 0 }, { role: 'CM', nx: 0.41, ny: 0.33 },
    { role: 'LW', nx: 0.68, ny: -0.68 }, { role: 'ST', nx: 0.75, ny: 0 }, { role: 'RW', nx: 0.68, ny: 0.68 },
  ],
  '4-2-3-1': [
    { role: 'GK', nx: 0.045, ny: 0 },
    { role: 'LB', nx: 0.21, ny: -0.70 }, { role: 'CB', nx: 0.16, ny: -0.26 },
    { role: 'CB', nx: 0.16, ny: 0.26 }, { role: 'RB', nx: 0.21, ny: 0.70 },
    { role: 'DM', nx: 0.34, ny: -0.20 }, { role: 'DM', nx: 0.34, ny: 0.20 },
    { role: 'LM', nx: 0.57, ny: -0.62 }, { role: 'AM', nx: 0.55, ny: 0 }, { role: 'RM', nx: 0.57, ny: 0.62 },
    { role: 'ST', nx: 0.77, ny: 0 },
  ],
  '4-4-2': [
    { role: 'GK', nx: 0.045, ny: 0 },
    { role: 'LB', nx: 0.21, ny: -0.70 }, { role: 'CB', nx: 0.16, ny: -0.26 },
    { role: 'CB', nx: 0.16, ny: 0.26 }, { role: 'RB', nx: 0.21, ny: 0.70 },
    { role: 'LM', nx: 0.45, ny: -0.68 }, { role: 'CM', nx: 0.40, ny: -0.22 },
    { role: 'CM', nx: 0.40, ny: 0.22 }, { role: 'RM', nx: 0.45, ny: 0.68 },
    { role: 'ST', nx: 0.73, ny: -0.19 }, { role: 'ST', nx: 0.73, ny: 0.19 },
  ],
  '4-1-4-1': [
    { role: 'GK', nx: 0.045, ny: 0 },
    { role: 'LB', nx: 0.21, ny: -0.70 }, { role: 'CB', nx: 0.16, ny: -0.26 },
    { role: 'CB', nx: 0.16, ny: 0.26 }, { role: 'RB', nx: 0.21, ny: 0.70 },
    { role: 'DM', nx: 0.30, ny: 0 },
    { role: 'LM', nx: 0.51, ny: -0.66 }, { role: 'CM', nx: 0.47, ny: -0.22 },
    { role: 'CM', nx: 0.47, ny: 0.22 }, { role: 'RM', nx: 0.51, ny: 0.66 },
    { role: 'ST', nx: 0.75, ny: 0 },
  ],
  '3-5-2': [
    { role: 'GK', nx: 0.045, ny: 0 },
    { role: 'CB', nx: 0.17, ny: -0.38 }, { role: 'CB', nx: 0.14, ny: 0 }, { role: 'CB', nx: 0.17, ny: 0.38 },
    { role: 'LM', nx: 0.45, ny: -0.78 }, { role: 'CM', nx: 0.39, ny: -0.26 },
    { role: 'DM', nx: 0.33, ny: 0 }, { role: 'CM', nx: 0.39, ny: 0.26 }, { role: 'RM', nx: 0.45, ny: 0.78 },
    { role: 'ST', nx: 0.73, ny: -0.19 }, { role: 'ST', nx: 0.73, ny: 0.19 },
  ],
  '3-4-3': [
    { role: 'GK', nx: 0.045, ny: 0 },
    { role: 'CB', nx: 0.17, ny: -0.38 }, { role: 'CB', nx: 0.14, ny: 0 }, { role: 'CB', nx: 0.17, ny: 0.38 },
    { role: 'LM', nx: 0.45, ny: -0.74 }, { role: 'CM', nx: 0.38, ny: -0.22 },
    { role: 'CM', nx: 0.38, ny: 0.22 }, { role: 'RM', nx: 0.45, ny: 0.74 },
    { role: 'LW', nx: 0.70, ny: -0.60 }, { role: 'ST', nx: 0.77, ny: 0 }, { role: 'RW', nx: 0.70, ny: 0.60 },
  ],
  '5-3-2': [
    { role: 'GK', nx: 0.045, ny: 0 },
    { role: 'LB', nx: 0.23, ny: -0.80 }, { role: 'CB', nx: 0.14, ny: -0.34 },
    { role: 'CB', nx: 0.12, ny: 0 }, { role: 'CB', nx: 0.14, ny: 0.34 }, { role: 'RB', nx: 0.23, ny: 0.80 },
    { role: 'CM', nx: 0.41, ny: -0.30 }, { role: 'CM', nx: 0.36, ny: 0 }, { role: 'CM', nx: 0.41, ny: 0.30 },
    { role: 'ST', nx: 0.70, ny: -0.19 }, { role: 'ST', nx: 0.70, ny: 0.19 },
  ],
  '5-4-1': [
    { role: 'GK', nx: 0.045, ny: 0 },
    { role: 'LB', nx: 0.23, ny: -0.80 }, { role: 'CB', nx: 0.14, ny: -0.34 },
    { role: 'CB', nx: 0.12, ny: 0 }, { role: 'CB', nx: 0.14, ny: 0.34 }, { role: 'RB', nx: 0.23, ny: 0.80 },
    { role: 'LM', nx: 0.45, ny: -0.68 }, { role: 'CM', nx: 0.38, ny: -0.22 },
    { role: 'CM', nx: 0.38, ny: 0.22 }, { role: 'RM', nx: 0.45, ny: 0.68 },
    { role: 'ST', nx: 0.73, ny: 0 },
  ],
};

export const FORMATION_IDS = Object.keys(FORMATIONS) as FormationId[];

export interface PlaystyleProfile {
  label: string;
  blurb: string;
  /** Multiplies formation width. */
  width: number;
  /** Shifts the whole block forward (+) or back (-). */
  line: number;
  /** How strongly the block slides toward the ball. */
  shiftX: number;
  shiftY: number;
  /** Extra forward push for attacking players when the team has the ball. */
  joinAttack: number;
  /** Preferred pass distance multiplier. */
  passLen: number;
  /** How many players hunt the ball. */
  press: number;
  /** Willingness to play forward quickly after winning the ball. */
  counter: number;
  /** Chance per decision to attempt a long ball. */
  directness: number;
}

export const PLAYSTYLES: Record<Playstyle, PlaystyleProfile> = {
  POSSESSION: {
    label: 'Possession Game',
    blurb: 'Short passing, close support, patient build-up.',
    width: 0.92, line: 0.04, shiftX: 0.30, shiftY: 0.34, joinAttack: 0.42,
    passLen: 0.72, press: 0.55, counter: 0.75, directness: 0.06,
  },
  QUICK_COUNTER: {
    label: 'Quick Counter',
    blurb: 'Fast vertical passing and rapid forward runs after winning the ball.',
    width: 1.0, line: 0.0, shiftX: 0.22, shiftY: 0.26, joinAttack: 0.62,
    passLen: 1.12, press: 0.62, counter: 1.45, directness: 0.26,
  },
  LONG_BALL_COUNTER: {
    label: 'Long Ball Counter',
    blurb: 'Compact shape, forwards run in behind, longer passes forward.',
    width: 0.95, line: -0.05, shiftX: 0.20, shiftY: 0.24, joinAttack: 0.52,
    passLen: 1.48, press: 0.45, counter: 1.4, directness: 0.46,
  },
  OUT_WIDE: {
    label: 'Out Wide',
    blurb: 'Wingers hug the touchline, fullbacks overlap, crosses from wide.',
    width: 1.28, line: 0.02, shiftX: 0.24, shiftY: 0.18, joinAttack: 0.62,
    passLen: 1.05, press: 0.6, counter: 1.0, directness: 0.16,
  },
  LONG_BALL: {
    label: 'Long Ball',
    blurb: 'Direct deliveries to a target man, midfield collects second balls.',
    width: 1.04, line: -0.01, shiftX: 0.22, shiftY: 0.26, joinAttack: 0.56,
    passLen: 1.55, press: 0.52, counter: 1.1, directness: 0.52,
  },
  ALL_OUT_ATTACK: {
    label: 'All-Out Attack',
    blurb: 'Everyone joins in. High line, high risk.',
    width: 1.08, line: 0.11, shiftX: 0.30, shiftY: 0.3, joinAttack: 0.98,
    passLen: 1.05, press: 0.9, counter: 1.25, directness: 0.2,
  },
  DEFENSIVE: {
    label: 'Defensive',
    blurb: 'Deep compact block, protect the defence, counter safely.',
    width: 0.80, line: -0.12, shiftX: 0.18, shiftY: 0.34, joinAttack: 0.22,
    passLen: 0.95, press: 0.4, counter: 0.9, directness: 0.22,
  },
};

export const PLAYSTYLE_IDS = Object.keys(PLAYSTYLES) as Playstyle[];

export interface InstructionProfile {
  label: string;
  /** Added to the player's attacking weight. */
  attack: number;
  /** Multiplies the player's width. */
  width: number;
  /** Extra eagerness to press the ball. */
  press: number;
  roles: SlotRole[];
}

export const INSTRUCTIONS: Record<Instruction, InstructionProfile> = {
  BALANCED:         { label: 'Balanced',            attack: 0,     width: 1,    press: 0,    roles: [] },
  ATTACKING_FB:     { label: 'Attacking fullback',  attack: 0.42,  width: 1.1,  press: 0.05, roles: ['LB', 'RB'] },
  DEFENSIVE_FB:     { label: 'Defensive fullback',  attack: -0.2,  width: 0.9,  press: -0.05, roles: ['LB', 'RB'] },
  STAY_BACK:        { label: 'Stay-back midfielder', attack: -0.22, width: 0.9,  press: -0.1, roles: ['DM', 'CM'] },
  BOX_TO_BOX:       { label: 'Box-to-box',          attack: 0.3,   width: 1,    press: 0.12, roles: ['CM', 'DM', 'AM'] },
  PLAYMAKER:        { label: 'Playmaker',           attack: 0.1,   width: 0.88, press: -0.05, roles: ['CM', 'AM', 'DM'] },
  WINGER:           { label: 'Winger',              attack: 0.2,   width: 1.22, press: 0,    roles: ['LW', 'RW', 'LM', 'RM'] },
  INSIDE_FORWARD:   { label: 'Inside forward',      attack: 0.3,   width: 0.62, press: 0.05, roles: ['LW', 'RW', 'LM', 'RM'] },
  TARGET_MAN:       { label: 'Target striker',      attack: 0.1,   width: 0.8,  press: -0.08, roles: ['ST'] },
  PRESSING_FORWARD: { label: 'Pressing forward',    attack: 0.16,  width: 0.95, press: 0.35, roles: ['ST', 'AM', 'LW', 'RW'] },
  SWEEPER_KEEPER:   { label: 'Sweeper keeper',      attack: 0.12,  width: 1,    press: 0,    roles: ['GK'] },
};

/** Base attacking weight for each formation slot role. */
export const ROLE_ATTACK: Record<SlotRole, number> = {
  GK: 0, CB: 0.08, LB: 0.34, RB: 0.34, DM: 0.26, CM: 0.48,
  AM: 0.74, LM: 0.62, RM: 0.62, LW: 0.84, RW: 0.84, ST: 1,
};

export function instructionsForRole(role: SlotRole): Instruction[] {
  const list: Instruction[] = ['BALANCED'];
  (Object.keys(INSTRUCTIONS) as Instruction[]).forEach((key) => {
    if (key !== 'BALANCED' && INSTRUCTIONS[key].roles.includes(role)) list.push(key);
  });
  return list;
}

export function defaultInstruction(role: SlotRole): Instruction {
  if (role === 'LW' || role === 'RW') return 'WINGER';
  if (role === 'ST') return 'TARGET_MAN';
  return 'BALANCED';
}
