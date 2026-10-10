import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ClipboardList, Flag, Pause, Play, Repeat2, Whistle } from 'lucide-react';
import { MatchStats, Settings, Team, TeamTactics } from '../types/game';
import {
  applyTactics, captureSnapshot, createWorld, DIFFICULTY, doPass, doShoot, doTackle, kickOff,
  InputState, MatchEvent, possessionPercent, setupKickoff, Snapshot, stepWorld,
  substitute, switchPlayer, World,
} from '../game/engine';
import { CameraRig } from '../game/camera';
import { renderWorld, STADIUMS } from './PitchRenderer';
import { FORMATIONS, PLAYSTYLES } from '../data/formations';
import { TacticsBoard } from './TacticsBoard';
import { sound } from '../utils/sound';

const CANVAS_W = 1280;
const CANVAS_H = 720;
const MAX_SUBS = 5;

export interface MatchResult { userGoals: number; cpuGoals: number; pens?: [number, number] }

interface MatchScreenProps {
  userTeam: Team;
  cpuTeam: Team;
  settings: Settings;
  userTactics: TeamTactics;
  cpuTactics: TeamTactics;
  competitionLabel: string;
  matchNumberLabel: string;
  official: boolean;
  knockout: boolean;
  onExit: () => void;
  onFinish: (result: MatchResult) => void;
  onSaveTactics: (tactics: TeamTactics) => void;
}

type Phase = 'PREMATCH' | 'FIRST' | 'HALFTIME' | 'SECOND' | 'GOAL' | 'EXTRA' | 'PENS' | 'FULLTIME';

const KEY_MAP: Record<string, string> = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
};

export function MatchScreen(props: MatchScreenProps) {
  const {
    userTeam, cpuTeam, settings, competitionLabel, matchNumberLabel,
    official, knockout, onExit, onFinish, onSaveTactics,
  } = props;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tactics, setTactics] = useState<TeamTactics>(props.userTactics);

  const worldLazy = useRef<World | null>(null);
  if (!worldLazy.current) {
    worldLazy.current = createWorld(
      userTeam, cpuTeam, settings.difficulty, settings.autoSwitch,
      settings.passMode, settings.strictness, props.userTactics, props.cpuTactics
    );
  }
  const worldRef = worldLazy as React.MutableRefObject<World>;

  const rigRef = useRef<CameraRig>(
    new CameraRig(settings.cameraPreset, settings.cameraZoom, settings.cameraHeight, settings.cameraDistance)
  );
  const keysRef = useRef<Record<string, boolean>>({});
  const padRef = useRef<Record<string, boolean>>({});
  /**
   * Pointer input. Held entirely in refs: touching React state on every
   * pointermove would re-render this whole screen ~120x/sec and stall input.
   *
   * MOTION mode (default) steers the player from how the cursor is moving, with
   * no button held. DRAG mode keeps the older click-and-drag stick.
   */
  const dragRef = useRef({ active: false, ax: 0, ay: 0, cx: 0, cy: 0, id: -1 });
  const cursorRef = useRef({
    has: false, lastX: 0, lastY: 0,
    pendingX: 0, pendingY: 0,
    vx: 0, vy: 0,
  });
  const pressureRef = useRef(false);
  const [pressureOn, setPressureOn] = useState(false);
  const clockRef = useRef(0);
  const phaseRef = useRef<Phase>('PREMATCH');
  const replayRef = useRef<Snapshot[]>([]);
  const replayPlayRef = useRef<{ frames: Snapshot[]; index: number } | null>(null);
  const finishedRef = useRef(false);
  const pausedRef = useRef(false);
  const resumePhaseRef = useRef<Phase>('FIRST');

  const [phase, setPhaseState] = useState<Phase>('PREMATCH');
  const [score, setScore] = useState({ user: 0, cpu: 0 });
  const [clock, setClock] = useState(0);
  const [goalBanner, setGoalBanner] = useState<{ name: string; side: 'USER' | 'CPU'; own: boolean } | null>(null);
  const [decision, setDecision] = useState<{ text: string; card: 'YELLOW' | 'RED' | null } | null>(null);
  const [statTick, setStatTick] = useState(0);
  const [paused, setPaused] = useState(false);
  const [controlled, setControlled] = useState('');
  const [gkHolding, setGkHolding] = useState<'USER' | 'CPU' | null>(null);
  const [showTactics, setShowTactics] = useState(false);
  const [subsUsed, setSubsUsed] = useState(0);
  const [pens, setPens] = useState<{ user: boolean[]; cpu: boolean[]; turn: 'USER' | 'CPU'; done: boolean }>({
    user: [], cpu: [], turn: 'USER', done: false,
  });

  const halfLength = settings.halfLengthSec;
  const extraLength = Math.round(settings.halfLengthSec / 2);

  const setPhase = useCallback((next: Phase) => { phaseRef.current = next; setPhaseState(next); }, []);

  const DEAD_ZONE = 16;
  const FULL_THROTTLE = 130;
  /** Cursor speed thresholds in CSS pixels per second. */
  const MOTION_DEAD = 70;
  const MOTION_FULL = 720;

  /** Screen vector -> pitch vector. The camera never yaws, so X maps straight
   *  across; Y is divided by the camera's foreshortening so diagonals are square. */
  const toPitchDir = useCallback((dx: number, dy: number) => {
    const cam = rigRef.current.state;
    const squash = Math.max(0.35, Math.sin(Math.atan2(cam.height, cam.dist)));
    const wx = dx;
    const wy = dy / squash;
    const wl = Math.hypot(wx, wy) || 1;
    return { x: wx / wl, y: wy / wl };
  }, []);

  /**
   * Integrates raw cursor deltas into a smoothed velocity, once per rendered
   * frame. Rise is quick so the player responds immediately; fall is slower so
   * the player eases to a stop when the cursor stops moving.
   */
  const updateCursorVector = useCallback((deltaMs: number) => {
    const c = cursorRef.current;
    const dt = Math.min(0.05, Math.max(0.001, deltaMs / 1000));
    const instX = c.pendingX / dt;
    const instY = c.pendingY / dt;
    c.pendingX = 0;
    c.pendingY = 0;

    const moving = Math.hypot(instX, instY) > Math.hypot(c.vx, c.vy);
    const k = 1 - Math.exp(-(moving ? 18 : 6) * dt);
    c.vx += (instX - c.vx) * k;
    c.vy += (instY - c.vy) * k;
  }, []);

  const readDrag = useCallback((): InputState['drag'] => {
    if (settings.mouseControl === 'MOTION') {
      const c = cursorRef.current;
      const speed = Math.hypot(c.vx, c.vy);
      if (speed < MOTION_DEAD) return null;
      const dir = toPitchDir(c.vx, c.vy);
      const mag = Math.min(1, (speed - MOTION_DEAD) / (MOTION_FULL - MOTION_DEAD));
      return { x: dir.x, y: dir.y, mag };
    }

    if (settings.mouseControl === 'OFF') return null;

    const d = dragRef.current;
    if (!d.active) return null;
    const dx = d.cx - d.ax;
    const dy = d.cy - d.ay;
    const len = Math.hypot(dx, dy);
    if (len < DEAD_ZONE) return null;
    const dir = toPitchDir(dx, dy);
    const mag = Math.min(1, (len - DEAD_ZONE) / (FULL_THROTTLE - DEAD_ZONE));
    return { x: dir.x, y: dir.y, mag };
  }, [settings.mouseControl, toPitchDir]);

  useEffect(() => {
    rigRef.current.configure(
      settings.cameraPreset, settings.cameraZoom, settings.cameraHeight,
      settings.cameraDistance, settings.cameraSmoothness
    );
  }, [settings.cameraPreset, settings.cameraZoom, settings.cameraHeight, settings.cameraDistance, settings.cameraSmoothness]);

  useEffect(() => {
    sound.setSfx(settings.sfx);
    sound.setCrowd(settings.crowd);
    if (settings.crowd) sound.startCrowd();
    return () => sound.stopCrowd();
  }, [settings.sfx, settings.crowd]);

  /* ----------------------------- input ----------------------------- */
  useEffect(() => {
    const syncPressure = (e: KeyboardEvent) => {
      // Caps Lock keyup is unreliable across browsers, so the modifier state is
      // the source of truth and C is offered as a dependable hold alternative.
      const caps = typeof e.getModifierState === 'function' && e.getModifierState('CapsLock');
      const next = !!caps || !!keysRef.current.pressC;
      if (next !== pressureRef.current) { pressureRef.current = next; setPressureOn(next); }
    };

    const down = (e: KeyboardEvent) => {
      const mapped = KEY_MAP[e.code];
      if (mapped) { keysRef.current[mapped] = true; e.preventDefault(); }
      if (['Space', 'KeyJ', 'KeyK', 'Tab', 'Escape', 'KeyT'].includes(e.code)) e.preventDefault();
      if (e.code === 'KeyC') { keysRef.current.pressC = true; e.preventDefault(); }
      if (e.code === 'CapsLock') e.preventDefault();
      syncPressure(e);
      if (e.repeat) return;

      const w = worldRef.current;
      if (e.code === 'KeyT' && phaseRef.current !== 'PREMATCH' && phaseRef.current !== 'FULLTIME') {
        setShowTactics((s) => !s);
        return;
      }
      if (!w.live || pausedRef.current) {
        if (e.code === 'Escape') setPaused((p) => !p);
        return;
      }
      if (e.code === 'Space') doPass(w);
      else if (e.code === 'KeyJ') doShoot(w);
      else if (e.code === 'KeyK') doTackle(w);
      else if (e.code === 'Tab') switchPlayer(w);
      else if (e.code === 'Escape') setPaused((p) => !p);
    };
    const up = (e: KeyboardEvent) => {
      const mapped = KEY_MAP[e.code];
      if (mapped) keysRef.current[mapped] = false;
      if (e.code === 'KeyC') keysRef.current.pressC = false;
      syncPressure(e);
    };
    const blur = () => {
      keysRef.current = {}; padRef.current = {};
      dragRef.current.active = false;
      dragRef.current.id = -1;
      pressureRef.current = false;
      setPressureOn(false);
    };
    // Pointer tracking lives on the window so the cursor can leave the canvas
    // or release anywhere without input being lost.
    const globalMove = (e: PointerEvent) => {
      const c = cursorRef.current;

      // Only steer from motion over the pitch itself. Moving across the HUD,
      // the pause menu or the tactics board must never move the player.
      const overPitch = e.target === canvasRef.current;
      if (overPitch && c.has) {
        c.pendingX += e.clientX - c.lastX;
        c.pendingY += e.clientY - c.lastY;
      }
      c.lastX = e.clientX;
      c.lastY = e.clientY;
      c.has = true;

      const d = dragRef.current;
      if (!d.active || e.pointerId !== d.id) return;
      d.cx = e.clientX;
      d.cy = e.clientY;
    };
    const globalUp = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d.active) return;
      if (e.pointerId !== d.id) return;
      d.active = false;
      d.id = -1;
    };

    window.addEventListener('keydown', down, { passive: false });
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    window.addEventListener('pointermove', globalMove, { passive: true });
    window.addEventListener('pointerup', globalUp);
    window.addEventListener('pointercancel', globalUp);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      window.removeEventListener('pointermove', globalMove);
      window.removeEventListener('pointerup', globalUp);
      window.removeEventListener('pointercancel', globalUp);
    };
  }, []);

  useEffect(() => { pausedRef.current = paused || showTactics; }, [paused, showTactics]);

  /* --------------------------- match flow -------------------------- */
  const onGoal = useCallback((event: Extract<MatchEvent, { type: 'GOAL' }>) => {
    const w = worldRef.current;
    setScore({ user: w.score.user, cpu: w.score.cpu });
    setGoalBanner({ name: event.scorer, side: event.side, own: event.ownGoal });
    sound.playGoal();
    rigRef.current.playCinematic(150);
    resumePhaseRef.current = phaseRef.current === 'EXTRA' ? 'EXTRA' : (clockRef.current < halfLength ? 'FIRST' : 'SECOND');
    const frames = replayRef.current.slice(-110);
    replayPlayRef.current = frames.length > 20 ? { frames, index: 0 } : null;
    setPhase('GOAL');
  }, [halfLength, setPhase]);

  const handleEvents = useCallback((events: MatchEvent[]) => {
    events.forEach((event) => {
      switch (event.type) {
        case 'GOAL': onGoal(event); break;
        case 'SHOT': sound.playKick(1); break;
        case 'PASS': sound.playPass(); break;
        case 'POST': sound.playPost(); break;
        case 'SAVE': sound.playSave(); if (event.caught) setGkHolding(event.side); break;
        case 'SUB':
          setDecision({ text: `Substitution · ${event.inName} on for ${event.outName}`, card: null });
          window.setTimeout(() => setDecision(null), 2600);
          break;
        case 'RESTART': {
          sound.playWhistle(false);
          const who = event.side === 'USER' ? userTeam.shortName : cpuTeam.shortName;
          const label: Record<string, string> = {
            THROW: 'Throw-in', CORNER: 'Corner', GOALKICK: 'Goal kick',
            FREEKICK: 'Free kick', PENALTY: 'Penalty kick',
          };
          setDecision({ text: `${label[event.kind]} — ${who}`, card: null });
          window.setTimeout(() => setDecision(null), 2200);
          break;
        }
        case 'DECISION': {
          sound.playWhistle(false);
          setDecision({ text: event.text, card: event.card });
          window.setTimeout(() => setDecision(null), 3000);
          break;
        }
        default: break;
      }
    });
  }, [onGoal, userTeam.shortName, cpuTeam.shortName]);

  const finishMatch = useCallback(() => {
    const w = worldRef.current;
    w.live = false;
    if (knockout && w.score.user === w.score.cpu) {
      if (phaseRef.current === 'SECOND') {
        clockRef.current = halfLength * 2;
        sound.playWhistle(true);
        setPhase('EXTRA');
        kickOff(w, 'USER');
        rigRef.current.snapTo(0, 0);
        return;
      }
      sound.playWhistle(true);
      setPhase('PENS');
      return;
    }
    sound.playWhistle(true);
    setPhase('FULLTIME');
  }, [knockout, halfLength, setPhase]);

  /* --------------------------- game loop --------------------------- */
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let statAcc = 0;
    const STEP = 1000 / 60;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const delta = Math.min(100, now - last);
      last = now;

      const w = worldRef.current;
      const simulate = w.live && !pausedRef.current;

      // Cursor velocity is integrated every rendered frame, with the real
      // delta, so the response is identical at any refresh rate.
      updateCursorVector(delta);
      if (!simulate) {
        const c = cursorRef.current;
        c.pendingX = 0; c.pendingY = 0; c.vx = 0; c.vy = 0;
      }

      if (simulate) {
        acc += delta;
        let steps = 0;
        while (acc >= STEP && steps < 5) {
          const input: InputState = {
            up: !!(keysRef.current.up || padRef.current.up),
            down: !!(keysRef.current.down || padRef.current.down),
            left: !!(keysRef.current.left || padRef.current.left),
            right: !!(keysRef.current.right || padRef.current.right),
            sprint: !!(keysRef.current.sprint || padRef.current.sprint),
            drag: readDrag(),
            pressure: pressureRef.current,
            dt: STEP,
          };
          handleEvents(stepWorld(w, input));
          replayRef.current.push(captureSnapshot(w));
          if (replayRef.current.length > 140) replayRef.current.shift();
          acc -= STEP;
          steps++;
          if (!w.live) break;
        }

        if (w.live) clockRef.current += delta / 1000;
        statAcc += delta;
        if (statAcc > 220) {
          statAcc = 0;
          setClock(clockRef.current);
          setStatTick((t) => t + 1);
          setControlled(w.controlledId);
          setGkHolding(w.gkHold ? w.gkHold.side : null);
          setSubsUsed(w.subsUsed.USER);
        }

        if (phaseRef.current === 'FIRST' && clockRef.current >= halfLength) {
          clockRef.current = halfLength; setClock(halfLength);
          w.live = false; sound.playWhistle(true); setPhase('HALFTIME');
        } else if (phaseRef.current === 'SECOND' && clockRef.current >= halfLength * 2) {
          clockRef.current = halfLength * 2; setClock(halfLength * 2); finishMatch();
        } else if (phaseRef.current === 'EXTRA' && clockRef.current >= halfLength * 2 + extraLength) {
          clockRef.current = halfLength * 2 + extraLength; setClock(clockRef.current); finishMatch();
        }
      }

      /* ------------------------- render ------------------------- */
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const replay = replayPlayRef.current;
      let snapshot: Snapshot | null = null;
      if (replay) {
        snapshot = replay.frames[Math.floor(replay.index)];
        replay.index += 0.5;
        if (replay.index >= replay.frames.length) replay.index = replay.frames.length - 1;
      }

      // Set-piece and replay cameras use a fixed focus; normal play follows the action.
      let focus: { x: number; y: number } | null = null;
      if (snapshot) focus = { x: snapshot.bx, y: snapshot.by };
      else if (w.restart) focus = { x: w.restart.x, y: w.restart.y };
      else if (!w.live && w.awaitingKickoff) focus = { x: 0, y: 0 };

      rigRef.current.update(w, delta, focus);
      renderWorld(ctx, CANVAS_W, CANVAS_H, w, rigRef.current.state, settings.quality, snapshot, !snapshot, settings.stadium);

      // Drag stick (touch, or DRAG mode). Cursor steering draws nothing: the
      // player marker alone shows who you are controlling.
      const d = dragRef.current;
      if (d.active && w.live) {
        const rect = canvas.getBoundingClientRect();
        const ds = Math.min(rect.width / CANVAS_W, rect.height / CANVAS_H) || 1;
        const ox = (rect.width - CANVAS_W * ds) / 2;
        const oy = (rect.height - CANVAS_H * ds) / 2;
        const ax = (d.ax - rect.left - ox) / ds;
        const ay = (d.ay - rect.top - oy) / ds;
        const cxp = (d.cx - rect.left - ox) / ds;
        const cyp = (d.cy - rect.top - oy) / ds;

        const dx = cxp - ax;
        const dy = cyp - ay;
        const len = Math.hypot(dx, dy) || 1;
        const cap = Math.min(len, 86);

        ctx.save();
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(255,255,255,0.28)';
        ctx.beginPath();
        ctx.arc(ax, ay, 86, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(52,211,153,0.55)';
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax + (dx / len) * cap, ay + (dy / len) * cap);
        ctx.stroke();

        ctx.fillStyle = 'rgba(52,211,153,0.42)';
        ctx.strokeStyle = 'rgba(167,243,208,0.95)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ax + (dx / len) * cap, ay + (dy / len) * cap, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [
    handleEvents, finishMatch, halfLength, extraLength,
    settings.quality, settings.stadium, setPhase, readDrag, updateCursorVector,
  ]);

  /* --------------------------- pointer ----------------------------- */
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button === 2) { doShoot(worldRef.current); return; }
    if (e.button !== 0) return;
    // Touch devices always get the drag stick, since there is no hover motion.
    if (settings.mouseControl !== 'DRAG' && e.pointerType === 'mouse') return;
    e.preventDefault();
    dragRef.current = { active: true, ax: e.clientX, ay: e.clientY, cx: e.clientX, cy: e.clientY, id: e.pointerId };
  };

  const hold = (key: string) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      padRef.current[key] = true;
    },
    onPointerUp: () => { padRef.current[key] = false; },
    onPointerCancel: () => { padRef.current[key] = false; },
    onPointerLeave: () => { padRef.current[key] = false; },
  });

  /* --------------------------- penalties --------------------------- */
  const takePenalty = (choice: 'L' | 'C' | 'R') => {
    setPens((state) => {
      if (state.done) return state;
      const keeper = ['L', 'C', 'R'][Math.floor(Math.random() * 3)];
      const profile = DIFFICULTY[settings.difficulty];
      const user = [...state.user];
      const cpu = [...state.cpu];
      if (state.turn === 'USER') {
        const scored = keeper !== choice || Math.random() < 0.45;
        user.push(scored);
        if (scored) sound.playGoal(); else sound.playSave();
      } else {
        const cpuAim = ['L', 'C', 'R'][Math.floor(Math.random() * 3)];
        const saved = cpuAim === choice && Math.random() < 0.55;
        const scored = !saved && Math.random() < 0.55 + profile.shotAcc * 0.35;
        cpu.push(scored);
        if (scored) sound.playGoal(); else sound.playSave();
      }
      const next = { ...state, user, cpu, turn: state.turn === 'USER' ? ('CPU' as const) : ('USER' as const) };
      const u = user.filter(Boolean).length;
      const c = cpu.filter(Boolean).length;
      const rounds = Math.max(user.length, cpu.length);
      if (user.length === cpu.length && rounds >= 5 && u !== c) next.done = true;
      return next;
    });
  };

  const penScore = useMemo(() => ({
    user: pens.user.filter(Boolean).length,
    cpu: pens.cpu.filter(Boolean).length,
  }), [pens]);

  useEffect(() => {
    if (phase !== 'PENS' || !pens.done || finishedRef.current) return;
    finishedRef.current = true;
    const w = worldRef.current;
    window.setTimeout(() => onFinish({ userGoals: w.score.user, cpuGoals: w.score.cpu, pens: [penScore.user, penScore.cpu] }), 900);
  }, [phase, pens.done, penScore, onFinish]);

  /* ----------------------------- UI -------------------------------- */
  const world = worldRef.current;
  const stats = world.stats;
  const [posUser, posCpu] = possessionPercent(stats);
  void statTick;

  const displayClock = Math.min(clock, halfLength * 2 + (phase === 'EXTRA' ? extraLength : 0));
  const mm = String(Math.floor(displayClock / 60)).padStart(2, '0');
  const ss = String(Math.floor(displayClock % 60)).padStart(2, '0');
  const periodLabel = phase === 'EXTRA' ? 'EXTRA TIME' : displayClock < halfLength ? '1ST HALF' : '2ND HALF';
  const controlledPlayer = world.players.find((p) => p.id === controlled);

  const commitTactics = (next: TeamTactics) => {
    setTactics(next);
    applyTactics(worldRef.current, 'USER', next, userTeam);
    onSaveTactics(next);
  };

  const startMatch = () => {
    sound.startCrowd();
    sound.playWhistle(false);
    applyTactics(worldRef.current, 'USER', tactics, userTeam);
    kickOff(worldRef.current, 'USER');
    rigRef.current.snapTo(0, 0);
    setPhase('FIRST');
  };

  const resumeAfterGoal = () => {
    replayPlayRef.current = null;
    setGoalBanner(null);
    sound.playWhistle(false);
    kickOff(worldRef.current);
    rigRef.current.snapTo(0, 0);
    setPhase(resumePhaseRef.current);
  };

  const startSecondHalf = () => {
    sound.playWhistle(false);
    setupKickoff(worldRef.current, 'CPU');
    kickOff(worldRef.current, 'CPU');
    rigRef.current.snapTo(0, 0);
    setPhase('SECOND');
  };

  const confirmResult = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinish({ userGoals: world.score.user, cpuGoals: world.score.cpu });
  };

  const onPitchIds = tactics.starters;

  return (
    <div
      className="relative h-[100dvh] w-full select-none overflow-hidden bg-[#05070d] text-white"
      style={{ touchAction: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
      onDragStart={(e) => e.preventDefault()}
    >
      <canvas
        ref={canvasRef} width={CANVAS_W} height={CANVAS_H}
        className="absolute inset-0 h-full w-full object-contain"
        onPointerDown={onPointerDown}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* Scoreboard */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-2 sm:p-3">
        <div className="pointer-events-auto flex items-stretch overflow-hidden rounded-xl border border-white/15 bg-[#060b16]/95 shadow-2xl backdrop-blur">
          <button onClick={onExit} className="px-2.5 text-slate-400 transition hover:bg-white/10 hover:text-white" title="Leave match">
            <ArrowLeft className="size-4" />
          </button>
          <ScoreSide name={userTeam.shortName} flag={userTeam.flag} color={userTeam.primaryColor} goals={score.user} tag="YOU" accent />
          <div className="flex min-w-[104px] flex-col items-center justify-center border-x border-white/10 bg-black/40 px-3 py-1.5">
            <span className="text-[9px] font-black uppercase tracking-[.18em] text-emerald-400">{periodLabel}</span>
            <span className="font-mono text-lg font-black tabular-nums">{mm}:{ss}</span>
            <span className="text-[8px] font-bold uppercase tracking-wider text-slate-500">{matchNumberLabel}</span>
          </div>
          <ScoreSide name={cpuTeam.shortName} flag={cpuTeam.flag} color={cpuTeam.primaryColor} goals={score.cpu} tag="CPU" reverse />
          <button onClick={() => setShowTactics(true)} className="px-2.5 text-slate-400 transition hover:bg-white/10 hover:text-emerald-300" title="Tactics (T)">
            <ClipboardList className="size-4" />
          </button>
          <button onClick={() => setPaused((p) => !p)} className="px-2.5 text-slate-400 transition hover:bg-white/10 hover:text-white" title="Pause">
            {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
          </button>
        </div>
      </div>

      <div className="pointer-events-none absolute left-1/2 top-[74px] w-[240px] -translate-x-1/2 sm:top-[82px]">
        <div className="flex h-1.5 overflow-hidden rounded-full bg-black/60">
          <div className="bg-emerald-400" style={{ width: `${posUser}%` }} />
          <div className="bg-rose-400" style={{ width: `${posCpu}%` }} />
        </div>
        <div className="mt-1 flex justify-between text-[9px] font-black text-slate-400">
          <span>{posUser}%</span>
          <span className="flex gap-1.5">
            {stats.yellows[0] + stats.yellows[1] > 0 && <span className="text-amber-300">🟨 {stats.yellows[0]}-{stats.yellows[1]}</span>}
            {stats.reds[0] + stats.reds[1] > 0 && <span className="text-rose-400">🟥 {stats.reds[0]}-{stats.reds[1]}</span>}
          </span>
          <span>{posCpu}%</span>
        </div>
      </div>

      {decision && (
        <div className="pointer-events-none absolute left-1/2 top-28 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-white/15 bg-black/85 px-3 py-2 text-[11px] font-black uppercase tracking-wider">
          {decision.card && <span className={`inline-block h-4 w-3 rounded-sm ${decision.card === 'YELLOW' ? 'bg-amber-400' : 'bg-rose-500'}`} />}
          <span className="text-amber-300">{decision.text}</span>
        </div>
      )}


      {pressureOn && world.live && (
        <div className="pointer-events-none absolute left-1/2 top-[108px] -translate-x-1/2 rounded-lg border border-amber-400/40 bg-amber-400/15 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-amber-300">
          Auto pressure active
        </div>
      )}

      {gkHolding && !decision && (
        <div className="pointer-events-none absolute left-1/2 top-28 -translate-x-1/2 rounded-lg bg-black/80 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-sky-300">
          {gkHolding === 'USER' ? 'Your keeper has the ball — press PASS' : 'Keeper has the ball'}
        </div>
      )}

      <div className="pointer-events-none absolute bottom-2 left-2 rounded-lg border border-emerald-400/30 bg-black/70 px-2.5 py-1.5 text-[10px] sm:bottom-3 sm:left-3">
        <span className="text-slate-400">CONTROL </span>
        <span className="font-black text-emerald-400">
          {controlledPlayer ? `${controlledPlayer.number} ${controlledPlayer.name}` : '—'}
        </span>
        <span className="ml-2 text-slate-500">{tactics.formation} · {PLAYSTYLES[tactics.playstyle].label}</span>
        {controlledPlayer && (
          <span className="mt-1 block h-1 w-28 overflow-hidden rounded-full bg-black/60">
            <span
              className={`block h-full transition-[width] ${controlledPlayer.stamina > 45 ? 'bg-emerald-400' : 'bg-amber-400'}`}
              style={{ width: `${Math.round(controlledPlayer.stamina)}%` }}
            />
          </span>
        )}
      </div>

      {world.live && !paused && !showTactics && (
        <>
          <div className="absolute bottom-16 left-3 grid grid-cols-3 grid-rows-3 gap-1 opacity-90 sm:bottom-20 sm:left-6">
            <span /><PadButton label="▲" {...hold('up')} /><span />
            <PadButton label="◀" {...hold('left')} />
            <PadButton label="RUN" accent {...hold('sprint')} />
            <PadButton label="▶" {...hold('right')} />
            <span /><PadButton label="▼" {...hold('down')} /><span />
          </div>
          <div className="absolute bottom-16 right-3 grid grid-cols-2 gap-2 opacity-95 sm:bottom-20 sm:right-6">
            <ActionButton label="PASS" color="bg-sky-500" onPress={() => doPass(worldRef.current)} />
            <ActionButton label="SHOOT" color="bg-rose-500" onPress={() => doShoot(worldRef.current)} />
            <ActionButton label="SWITCH" color="bg-slate-700" small onPress={() => switchPlayer(worldRef.current)} />
            <ActionButton label="TACKLE" color="bg-amber-500" small dark onPress={() => doTackle(worldRef.current)} />
          </div>
        </>
      )}

      {/* ------------------------- overlays ------------------------- */}
      {phase === 'PREMATCH' && (
        <Overlay wide>
          <p className="text-[10px] font-black uppercase tracking-[.3em] text-emerald-400">{competitionLabel}</p>
          <h2 className="mt-2 flex items-center justify-center gap-2 text-2xl font-black tracking-tight sm:text-3xl">
            {userTeam.flag && <span>{userTeam.flag}</span>}
            {userTeam.shortName} <span className="text-slate-500">vs</span> {cpuTeam.shortName}
            {cpuTeam.flag && <span>{cpuTeam.flag}</span>}
          </h2>
          <div className={`mt-2 inline-block rounded px-2 py-1 text-[9px] font-black uppercase tracking-wider ${official ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white/10 text-slate-400'}`}>
            {matchNumberLabel}
          </div>

          <div className="mt-4 grid gap-2 text-left sm:grid-cols-2">
            <TeamSheet team={userTeam} tactics={tactics} label="Your XI" accent />
            <TeamSheet team={cpuTeam} tactics={props.cpuTactics} label="CPU XI" />
          </div>

          <div className="mt-2 grid gap-2 text-left sm:grid-cols-2">
            <InfoBox icon={<Whistle className="size-3.5" />} title="Match officials">
              <p className="text-[11px] font-bold text-slate-200">{world.referee.name}</p>
              <p className="text-[10px] text-slate-500">{world.referee.assistants[0]}</p>
              <p className="text-[10px] text-slate-500">{world.referee.assistants[1]}</p>
            </InfoBox>
            <InfoBox icon={<Flag className="size-3.5" />} title="Match setup">
              <p className="text-[11px] font-bold text-slate-200">{STADIUMS[settings.stadium].name}</p>
              <p className="text-[10px] text-slate-500">{settings.difficulty} · {halfLength}s halves {knockout ? '· knockout' : ''}</p>
              <p className="text-[10px] text-slate-500">Camera: {settings.cameraPreset.replace('_', ' ').toLowerCase()}</p>
            </InfoBox>
          </div>

          <div className="mt-3 flex gap-2">
            <button onClick={() => setShowTactics(true)} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-white/10 py-3 text-[11px] font-black uppercase tracking-wider text-white hover:bg-white/20">
              <ClipboardList className="size-4" /> Squad & tactics
            </button>
            <button onClick={startMatch} className="flex-1 rounded-lg bg-emerald-400 py-3 text-[11px] font-black uppercase tracking-[.16em] text-slate-950 transition hover:bg-white">
              Kick off
            </button>
          </div>
          <p className="mt-2 text-[9px] leading-4 text-slate-500">
            {settings.mouseControl === 'MOTION'
              ? <><strong className="text-emerald-400">Move the cursor</strong> over the pitch to run — no clicking · <strong className="text-emerald-400">Shift</strong> to sprint</>
              : settings.mouseControl === 'DRAG'
              ? <><strong className="text-emerald-400">Hold left mouse and drag</strong> to run · <strong className="text-emerald-400">Shift</strong> to sprint</>
              : <><strong className="text-emerald-400">Arrows / WASD</strong> to run · <strong className="text-emerald-400">Shift</strong> to sprint</>}
            {' '}· <strong className="text-emerald-400">Caps Lock</strong> (or hold <strong className="text-emerald-400">C</strong>) for auto pressure
          </p>
          <p className="mt-1 text-[9px] text-slate-600">Space pass · J shoot · K tackle · Tab switch · T tactics · Arrows/WASD also work</p>
        </Overlay>
      )}

      {phase === 'GOAL' && goalBanner && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/35">
          <div className="absolute left-4 top-24 rounded bg-black/70 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-amber-300">
            <Repeat2 className="mr-1 inline size-3" /> Goal replay
          </div>
          <div className="rounded-2xl border-2 border-white/30 bg-gradient-to-r from-emerald-600 to-teal-600 px-10 py-5 text-center shadow-2xl">
            <p className="text-5xl font-black italic tracking-tighter sm:text-7xl">GOAL!</p>
            <p className="mt-1 text-sm font-black uppercase tracking-wider">{goalBanner.own ? 'Own goal · ' : ''}{goalBanner.name}</p>
            <p className="mt-2 text-xs font-black">{userTeam.shortName} {score.user} — {score.cpu} {cpuTeam.shortName}</p>
          </div>
          <button onClick={resumeAfterGoal} className="mt-5 rounded-lg bg-white px-8 py-3 text-xs font-black uppercase tracking-[.16em] text-slate-950 hover:bg-emerald-300">
            Kick off
          </button>
        </div>
      )}

      {phase === 'HALFTIME' && (
        <Overlay>
          <p className="text-[10px] font-black uppercase tracking-[.3em] text-amber-400">Half time</p>
          <ScoreLine home={userTeam.name} away={cpuTeam.name} hg={score.user} ag={score.cpu} />
          <StatTable stats={stats} posUser={posUser} posCpu={posCpu} />
          <div className="mt-4 flex gap-2">
            <button onClick={() => setShowTactics(true)} className="flex-1 rounded-lg bg-white/10 py-3 text-[11px] font-black uppercase text-white hover:bg-white/20">Tactics</button>
            <button onClick={startSecondHalf} className="flex-1 rounded-lg bg-emerald-400 py-3 text-[11px] font-black uppercase text-slate-950 hover:bg-white">Second half</button>
          </div>
        </Overlay>
      )}

      {phase === 'PENS' && (
        <Overlay>
          <p className="text-[10px] font-black uppercase tracking-[.3em] text-amber-400">Penalty shootout</p>
          <ScoreLine home={userTeam.name} away={cpuTeam.name} hg={penScore.user} ag={penScore.cpu} />
          <div className="mt-3 space-y-2 text-left">
            <PenRow label={userTeam.shortName} kicks={pens.user} />
            <PenRow label={cpuTeam.shortName} kicks={pens.cpu} />
          </div>
          {!pens.done ? (
            <>
              <p className="mt-4 text-xs font-bold text-slate-300">{pens.turn === 'USER' ? 'Pick your corner' : 'Pick your dive'}</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(['L', 'C', 'R'] as const).map((side) => (
                  <button key={side} onClick={() => takePenalty(side)} className="rounded-lg bg-white/10 py-3 text-xs font-black uppercase hover:bg-emerald-400 hover:text-slate-950">
                    {side === 'L' ? 'Left' : side === 'C' ? 'Centre' : 'Right'}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm font-black text-emerald-400">
              {penScore.user > penScore.cpu ? `${userTeam.name} win the shootout` : `${cpuTeam.name} win the shootout`}
            </p>
          )}
        </Overlay>
      )}

      {phase === 'FULLTIME' && (
        <Overlay>
          <p className="text-[10px] font-black uppercase tracking-[.3em] text-emerald-400">Full time</p>
          <ScoreLine home={userTeam.name} away={cpuTeam.name} hg={score.user} ag={score.cpu} />
          <p className="mt-1 text-xs font-bold text-slate-400">
            {score.user > score.cpu ? 'You won the match' : score.user === score.cpu ? 'The match ended level' : 'You lost the match'}
          </p>
          <StatTable stats={stats} posUser={posUser} posCpu={posCpu} />
          <button onClick={confirmResult} className="mt-4 w-full rounded-lg bg-emerald-400 py-3 text-xs font-black uppercase tracking-[.16em] text-slate-950 hover:bg-white">
            Confirm result
          </button>
        </Overlay>
      )}

      {paused && !showTactics && phase !== 'PREMATCH' && phase !== 'FULLTIME' && phase !== 'GOAL' && (
        <Overlay>
          <p className="text-[10px] font-black uppercase tracking-[.3em] text-emerald-400">Paused</p>
          <h3 className="mt-2 text-2xl font-black">Match paused</h3>
          <div className="mt-5 flex gap-2">
            <button onClick={() => setPaused(false)} className="flex-1 rounded-lg bg-emerald-400 py-3 text-xs font-black uppercase text-slate-950">Resume</button>
            <button onClick={() => { setPaused(false); setShowTactics(true); }} className="flex-1 rounded-lg bg-white/10 py-3 text-xs font-black uppercase">Tactics</button>
            <button onClick={onExit} className="flex-1 rounded-lg bg-white/10 py-3 text-xs font-black uppercase">Quit</button>
          </div>
        </Overlay>
      )}

      {showTactics && (
        <TacticsBoard
          team={userTeam}
          tactics={tactics}
          mode={phase === 'PREMATCH' ? 'PREMATCH' : 'INMATCH'}
          subsUsed={subsUsed}
          maxSubs={MAX_SUBS}
          onPitchIds={onPitchIds}
          onSubstitute={(outId, inId) => substitute(worldRef.current, 'USER', outId, inId)}
          onChange={commitTactics}
          onClose={() => setShowTactics(false)}
        />
      )}
    </div>
  );
}

/* ---------------------------- small UI ---------------------------- */
function TeamSheet({ team, tactics, label, accent }: { team: Team; tactics: TeamTactics; label: string; accent?: boolean }) {
  const squad = new Map(team.players.map((p) => [p.id, p]));
  const slots = FORMATIONS[tactics.formation];
  return (
    <div className="rounded-lg border border-white/10 bg-white/[.03] p-3">
      <p className={`mb-1 text-[9px] font-black uppercase tracking-wider ${accent ? 'text-emerald-400' : 'text-slate-400'}`}>
        {label} · {tactics.formation} · {PLAYSTYLES[tactics.playstyle].label}
      </p>
      <div className="grid max-h-28 grid-cols-2 gap-x-2 overflow-y-auto text-[10px] leading-4">
        {tactics.starters.map((id, i) => {
          const p = squad.get(id);
          if (!p) return null;
          return (
            <span key={id} className="flex gap-1 truncate text-slate-300">
              <span className="w-4 shrink-0 text-right text-slate-600">{tactics.numbers[id] ?? p.number}</span>
              <span className="truncate">{tactics.names[id] ?? p.name}</span>
              <span className="shrink-0 text-emerald-500/70">{slots[i].role}</span>
            </span>
          );
        })}
      </div>
      <p className="mt-1 text-[9px] text-slate-600">Bench: {tactics.bench.length}</p>
    </div>
  );
}

function ScoreSide({ name, flag, color, goals, tag, accent, reverse }: {
  name: string; flag?: string; color: string; goals: number; tag: string; accent?: boolean; reverse?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 ${reverse ? 'flex-row-reverse' : ''}`}>
      {flag ? <span className="text-base leading-none">{flag}</span>
        : <span className="size-3.5 rounded-full ring-2 ring-white/25" style={{ background: color }} />}
      <div className={reverse ? 'text-left' : 'text-right'}>
        <p className={`text-[8px] font-black uppercase tracking-wider ${accent ? 'text-emerald-400' : 'text-slate-500'}`}>{tag}</p>
        <p className="text-sm font-black leading-none">{name}</p>
      </div>
      <p className="px-1 text-2xl font-black tabular-nums">{goals}</p>
    </div>
  );
}

function InfoBox({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[.03] p-3">
      <p className="mb-1.5 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-emerald-400">{icon}{title}</p>
      {children}
    </div>
  );
}

function Overlay({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center overflow-y-auto bg-black/70 p-3 backdrop-blur-sm">
      <div className={`w-full ${wide ? 'max-w-xl' : 'max-w-md'} rounded-2xl border border-white/15 bg-[#070c17]/95 p-5 text-center shadow-2xl`}>
        {children}
      </div>
    </div>
  );
}

function ScoreLine({ home, away, hg, ag }: { home: string; away: string; hg: number; ag: number }) {
  return (
    <div className="mt-3 flex items-center justify-center gap-4 rounded-xl bg-black/50 px-4 py-3">
      <div className="flex-1 text-right text-[11px] font-bold text-slate-300">{home}</div>
      <div className="text-2xl font-black tabular-nums">{hg} - {ag}</div>
      <div className="flex-1 text-left text-[11px] font-bold text-slate-300">{away}</div>
    </div>
  );
}

function StatTable({ stats, posUser, posCpu }: { stats: MatchStats; posUser: number; posCpu: number }) {
  const rows: [string, number | string, number | string][] = [
    ['Possession', `${posUser}%`, `${posCpu}%`],
    ['Shots', stats.shots[0], stats.shots[1]],
    ['On target', stats.onTarget[0], stats.onTarget[1]],
    ['Passes', stats.passes[0], stats.passes[1]],
    ['Tackles', stats.tackles[0], stats.tackles[1]],
    ['Saves', stats.saves[0], stats.saves[1]],
    ['Corners', stats.corners[0], stats.corners[1]],
    ['Fouls', stats.fouls[0], stats.fouls[1]],
    ['Cards', `${stats.yellows[0]}/${stats.reds[0]}`, `${stats.yellows[1]}/${stats.reds[1]}`],
  ];
  return (
    <div className="mt-3 max-h-52 space-y-1 overflow-y-auto text-[11px]">
      {rows.map(([label, a, b]) => (
        <div key={label} className="flex items-center justify-between rounded bg-white/[.04] px-3 py-1.5">
          <span className="w-12 text-left font-black text-emerald-400">{a}</span>
          <span className="font-bold uppercase tracking-wider text-slate-400">{label}</span>
          <span className="w-12 text-right font-black text-rose-400">{b}</span>
        </div>
      ))}
    </div>
  );
}

function PenRow({ label, kicks }: { label: string; kicks: boolean[] }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 text-[10px] font-black text-slate-400">{label}</span>
      <div className="flex gap-1">
        {Array.from({ length: Math.max(5, kicks.length) }).map((_, i) => (
          <span key={i} className={`size-3.5 rounded-full border ${i >= kicks.length ? 'border-white/20' : kicks[i] ? 'border-emerald-400 bg-emerald-400' : 'border-rose-400 bg-rose-400/30'}`} />
        ))}
      </div>
    </div>
  );
}

function PadButton({ label, accent, ...handlers }: { label: string; accent?: boolean } & Record<string, unknown>) {
  return (
    <button {...handlers}
      className={`size-11 rounded-lg border text-[9px] font-black shadow-lg sm:size-12 ${accent ? 'border-emerald-300/40 bg-emerald-500/90 text-slate-950' : 'border-white/15 bg-black/70 text-white'}`}>
      {label}
    </button>
  );
}

function ActionButton({ label, color, onPress, small, dark }: {
  label: string; color: string; onPress: () => void; small?: boolean; dark?: boolean;
}) {
  return (
    <button onPointerDown={(e) => { e.preventDefault(); onPress(); }}
      className={`${color} ${small ? 'size-12 text-[8px]' : 'size-14 text-[10px]'} ${dark ? 'text-slate-950' : 'text-white'} rounded-full border border-white/25 font-black shadow-lg active:scale-95`}>
      {label}
    </button>
  );
}


