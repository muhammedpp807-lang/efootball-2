import { PitchPlayer, Quality, StadiumId, Team } from '../types/game';
import { BALL_R, PITCH, PLAYER_RENDER_SCALE, Snapshot, World, WORLD, onPitch } from '../game/engine';
import { CameraState } from '../game/camera';
import { drawPlayer3D } from './Player3DRenderer';

interface CrowdDot { x: number; y: number; t: number; r: number }
let crowdCache: CrowdDot[] | null = null;

interface StadiumTheme {
  bowl: string; grassA: string; grassB: string; board: string; accent: string; crowd: string[];
}

export const STADIUMS: Record<StadiumId, { name: string; blurb: string; theme: StadiumTheme }> = {
  ARENA: {
    name: 'Neon Arena', blurb: 'Enclosed night bowl with bright floodlights.',
    theme: { bowl: '#05070d', grassA: '#14823f', grassB: '#116b35', board: '#0b1220', accent: 'rgba(16,185,129,0.5)', crowd: ['#1e293b', '#334155', '#475569', '#0f172a', '#065f46'] },
  },
  COASTAL: {
    name: 'Coastal Park', blurb: 'Sea-breeze evening pitch with a blue-lit crowd.',
    theme: { bowl: '#040a14', grassA: '#15854a', grassB: '#0f6a3b', board: '#081426', accent: 'rgba(56,189,248,0.5)', crowd: ['#0c4a6e', '#075985', '#1e3a8a', '#0f172a', '#155e75'] },
  },
  HIGHLAND: {
    name: 'Highland Ground', blurb: 'Cooler turf, tighter stands, older floodlight towers.',
    theme: { bowl: '#070c08', grassA: '#2b7a3d', grassB: '#226633', board: '#111a12', accent: 'rgba(250,204,21,0.45)', crowd: ['#3f3f46', '#52525b', '#27272a', '#7f1d1d', '#1c1917'] },
  },
  NATIONAL: {
    name: 'National Stadium', blurb: 'Showpiece tournament venue with a full house.',
    theme: { bowl: '#0a0710', grassA: '#13864a', grassB: '#0f6b3c', board: '#15101f', accent: 'rgba(167,139,250,0.5)', crowd: ['#312e81', '#4c1d95', '#1e1b4b', '#7c2d12', '#0f172a'] },
  },
};

const REFEREE_TEAM: Team = {
  id: 'referee', name: 'Match Referee', shortName: 'REF', city: '', category: 'NATIONAL',
  primaryColor: '#111827', secondaryColor: '#FACC15', shortsColor: '#111827',
  socksColor: '#111827', gkColor: '#111827', pattern: 'solid', rating: 0, players: [],
};

/* ==================================================================
   PERSPECTIVE CAMERA
   The camera sits above and behind the focus point and looks down at the
   pitch. Ground points get a true perspective divide, so the far end of the
   pitch is genuinely smaller and most of the ground is off screen.
   ================================================================== */
export interface Projector {
  project(wx: number, wy: number, wz: number): { x: number; y: number; s: number } | null;
  unproject(sx: number, sy: number): { x: number; y: number };
  scaleAt(wy: number): number;
}

export function makeProjector(cam: CameraState, canvasW: number, canvasH: number): Projector {
  const tilt = Math.atan2(cam.height, cam.dist);
  const sinT = Math.sin(tilt);
  const cosT = Math.cos(tilt);
  const f = canvasH * cam.zoom;
  const cx = canvasW / 2;
  const cy = canvasH * 0.54;
  const eyeY = cam.y + cam.dist;

  return {
    project(wx, wy, wz) {
      const D = eyeY - wy;
      const H = cam.height - wz;
      const forward = D * cosT + H * sinT;
      if (forward < 40) return null;
      const s = f / forward;
      return { x: cx + (wx - cam.x) * s, y: cy + (H * cosT - D * sinT) * s, s };
    },
    scaleAt(wy) {
      const forward = (eyeY - wy) * cosT + cam.height * sinT;
      return f / Math.max(40, forward);
    },
    unproject(sx, sy) {
      const u = (sx - cx) / f;
      const v = (sy - cy) / f;
      const denom = v * cosT + sinT;
      const D = Math.abs(denom) < 1e-4 ? 1e4 : (cam.height * (cosT - v * sinT)) / denom;
      const forward = D * cosT + cam.height * sinT;
      return { x: cam.x + u * forward, y: eyeY - D };
    },
  };
}

function buildCrowd(): CrowdDot[] {
  const dots: CrowdDot[] = [];
  const rnd = (() => { let s = 99; return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; })();
  const band = (x0: number, x1: number, y0: number, y1: number, count: number) => {
    for (let i = 0; i < count; i++) {
      dots.push({ x: x0 + rnd() * (x1 - x0), y: y0 + rnd() * (y1 - y0), t: Math.floor(rnd() * 5), r: 5 + rnd() * 4 });
    }
  };
  band(-WORLD.halfW, WORLD.halfW, -WORLD.halfH, -PITCH.halfH - 55, 420);
  band(-WORLD.halfW, WORLD.halfW, PITCH.halfH + 55, WORLD.halfH, 420);
  band(-WORLD.halfW, -PITCH.halfW - 70, -PITCH.halfH - 40, PITCH.halfH + 40, 190);
  band(PITCH.halfW + 70, WORLD.halfW, -PITCH.halfH - 40, PITCH.halfH + 40, 190);
  return dots;
}

export function renderWorld(
  ctx: CanvasRenderingContext2D,
  canvasW: number, canvasH: number,
  w: World, cam: CameraState, quality: Quality,
  snapshot: Snapshot | null, showIndicators: boolean, stadiumId: StadiumId
) {
  const theme = STADIUMS[stadiumId].theme;
  const P = makeProjector(cam, canvasW, canvasH);
  const high = quality === 'HIGH';
  const medium = quality !== 'LOW';

  ctx.fillStyle = theme.bowl;
  ctx.fillRect(0, 0, canvasW, canvasH);

  const onScreen = (p: { x: number; y: number } | null, pad = 180) =>
    !!p && p.x > -pad && p.x < canvasW + pad && p.y > -pad && p.y < canvasH + pad;

  /* ---------------- crowd ---------------- */
  if (medium) {
    if (!crowdCache) crowdCache = buildCrowd();
    const flicker = Math.sin(w.tick * 0.05) * 0.06 + 0.94;
    ctx.globalAlpha = 0.9 * flicker;
    for (const dot of crowdCache) {
      const sp = P.project(dot.x, dot.y, 90);
      if (!onScreen(sp, 40) || !sp) continue;
      // Rectangles are much cheaper than arcs for a dense crowd.
      const r = Math.max(1.2, dot.r * sp.s);
      ctx.fillStyle = theme.crowd[dot.t];
      ctx.fillRect(sp.x - r / 2, sp.y - r / 2, r, r);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------------- helper to fill a ground polygon ---------------- */
  const groundPoly = (pts: [number, number][], fill: string) => {
    ctx.beginPath();
    let started = false;
    for (const [px, py] of pts) {
      const sp = P.project(px, py, 0);
      if (!sp) return;
      if (!started) { ctx.moveTo(sp.x, sp.y); started = true; } else ctx.lineTo(sp.x, sp.y);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };

  const groundLine = (pts: [number, number][], width: number, color = 'rgba(255,255,255,0.9)') => {
    ctx.beginPath();
    let started = false;
    for (const [px, py] of pts) {
      const sp = P.project(px, py, 0);
      if (!sp) return;
      if (!started) { ctx.moveTo(sp.x, sp.y); started = true; } else ctx.lineTo(sp.x, sp.y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.2, width * P.scaleAt(cam.y));
    ctx.stroke();
  };

  /* ---------------- surround + boards ---------------- */
  const pad = 210;
  groundPoly([
    [-PITCH.halfW - pad, -PITCH.halfH - pad], [PITCH.halfW + pad, -PITCH.halfH - pad],
    [PITCH.halfW + pad, PITCH.halfH + pad], [-PITCH.halfW - pad, PITCH.halfH + pad],
  ], theme.board);

  /* ---------------- grass with mowing stripes ---------------- */
  const stripes = 20;
  const stepX = (PITCH.halfW * 2) / stripes;
  for (let i = 0; i < stripes; i++) {
    const x0 = -PITCH.halfW + i * stepX;
    groundPoly(
      [[x0, -PITCH.halfH], [x0 + stepX, -PITCH.halfH], [x0 + stepX, PITCH.halfH], [x0, PITCH.halfH]],
      i % 2 === 0 ? theme.grassA : theme.grassB
    );
  }

  if (high) {
    const far = P.project(0, -PITCH.halfH, 0);
    const near = P.project(0, PITCH.halfH, 0);
    if (far && near) {
      const g = ctx.createLinearGradient(0, far.y, 0, near.y);
      g.addColorStop(0, 'rgba(0,0,0,0.42)');
      g.addColorStop(0.45, 'rgba(255,255,255,0.07)');
      g.addColorStop(1, 'rgba(0,0,0,0.3)');
      ctx.fillStyle = g;
      groundPoly([
        [-PITCH.halfW, -PITCH.halfH], [PITCH.halfW, -PITCH.halfH],
        [PITCH.halfW, PITCH.halfH], [-PITCH.halfW, PITCH.halfH],
      ], g as unknown as string);
    }
  }

  /* ---------------- markings ---------------- */
  const LW = 4;
  groundLine([
    [-PITCH.halfW, -PITCH.halfH], [PITCH.halfW, -PITCH.halfH],
    [PITCH.halfW, PITCH.halfH], [-PITCH.halfW, PITCH.halfH], [-PITCH.halfW, -PITCH.halfH],
  ], LW);
  groundLine([[0, -PITCH.halfH], [0, PITCH.halfH]], LW);

  const arc = (cxw: number, cyw: number, r: number, a0: number, a1: number) => {
    const pts: [number, number][] = [];
    const steps = 42;
    for (let i = 0; i <= steps; i++) {
      const a = a0 + ((a1 - a0) * i) / steps;
      pts.push([cxw + Math.cos(a) * r, cyw + Math.sin(a) * r]);
    }
    groundLine(pts, LW);
  };
  arc(0, 0, PITCH.circle, 0, Math.PI * 2);

  ([-1, 1] as const).forEach((d) => {
    const lineX = PITCH.halfW * d;
    const boxFar = lineX - PITCH.boxW * d;
    const sixFar = lineX - PITCH.sixW * d;
    groundLine([
      [lineX, -PITCH.boxHalfH], [boxFar, -PITCH.boxHalfH],
      [boxFar, PITCH.boxHalfH], [lineX, PITCH.boxHalfH],
    ], LW);
    groundLine([
      [lineX, -PITCH.sixHalfH], [sixFar, -PITCH.sixHalfH],
      [sixFar, PITCH.sixHalfH], [lineX, PITCH.sixHalfH],
    ], LW);
    const spot = lineX - PITCH.penaltySpot * d;
    arc(spot, 0, PITCH.circle, d === 1 ? Math.PI * 0.63 : -Math.PI * 0.37, d === 1 ? Math.PI * 1.37 : Math.PI * 0.37);
    ([-1, 1] as const).forEach((vy) => {
      arc(lineX, PITCH.halfH * vy, PITCH.cornerArc * 2.2, 0, Math.PI * 2);
    });
    const sp = P.project(spot, 0, 0);
    if (sp) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sp.x, sp.y, 2.5 * sp.s, 0, Math.PI * 2); ctx.fill(); }
  });
  const mid = P.project(0, 0, 0);
  if (mid) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(mid.x, mid.y, 2.5 * mid.s, 0, Math.PI * 2); ctx.fill(); }

  /* ---------------- goals, posts and nets in 3D ---------------- */
  const drawGoal = (d: 1 | -1) => {
    const lineX = PITCH.halfW * d;
    const backX = lineX + PITCH.goalDepth * d;
    const gh = PITCH.goalHalf;
    const bar = PITCH.crossbar;

    const corners = {
      fl: P.project(lineX, -gh, 0), fr: P.project(lineX, gh, 0),
      bl: P.project(backX, -gh, 0), br: P.project(backX, gh, 0),
      flT: P.project(lineX, -gh, bar), frT: P.project(lineX, gh, bar),
      blT: P.project(backX, -gh, bar), brT: P.project(backX, gh, bar),
    };
    if (Object.values(corners).some((c) => !c)) return;
    const c = corners as Record<string, { x: number; y: number; s: number }>;

    // Net volume
    ctx.fillStyle = 'rgba(2,6,23,0.4)';
    ctx.beginPath();
    ctx.moveTo(c.flT.x, c.flT.y); ctx.lineTo(c.blT.x, c.blT.y);
    ctx.lineTo(c.brT.x, c.brT.y); ctx.lineTo(c.frT.x, c.frT.y);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(c.bl.x, c.bl.y); ctx.lineTo(c.blT.x, c.blT.y);
    ctx.lineTo(c.brT.x, c.brT.y); ctx.lineTo(c.br.x, c.br.y);
    ctx.closePath(); ctx.fill();

    // Net mesh on the back face
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const yw = -gh + gh * 2 * t;
      const a = P.project(backX, yw, 0);
      const b = P.project(backX, yw, bar);
      if (a && b) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    }
    for (let i = 0; i <= 5; i++) {
      const zh = (bar * i) / 5;
      const a = P.project(backX, -gh, zh);
      const b = P.project(backX, gh, zh);
      if (a && b) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    }

    // Frame
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = Math.max(2.5, 5 * c.fl.s);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(c.fl.x, c.fl.y); ctx.lineTo(c.flT.x, c.flT.y);
    ctx.lineTo(c.frT.x, c.frT.y); ctx.lineTo(c.fr.x, c.fr.y);
    ctx.stroke();
    ctx.lineWidth = Math.max(1.5, 3 * c.fl.s);
    ctx.beginPath();
    ctx.moveTo(c.flT.x, c.flT.y); ctx.lineTo(c.blT.x, c.blT.y);
    ctx.moveTo(c.frT.x, c.frT.y); ctx.lineTo(c.brT.x, c.brT.y);
    ctx.stroke();
  };
  drawGoal(-1);
  drawGoal(1);

  /* ---------------- restart marker ---------------- */
  if (w.restart && !snapshot) {
    const sp = P.project(w.restart.x, w.restart.y, 0);
    if (sp) {
      ctx.save();
      ctx.strokeStyle = 'rgba(250,204,21,0.9)';
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(sp.x, sp.y, 34 * sp.s, 16 * sp.s, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  /* ---------------- aiming aids ---------------- */
  const ballX = snapshot ? snapshot.bx : w.ball.x;
  const ballY = snapshot ? snapshot.by : w.ball.y;
  const ballZ = snapshot ? snapshot.bz : w.ball.z;
  const controlled = w.players.find((p) => p.id === w.controlledId);

  if (showIndicators && controlled && w.ball.ownerId === controlled.id) {
    const a = P.project(ballX, ballY, 0);
    const b = P.project(ballX + Math.cos(controlled.facingAngle) * 300, ballY + Math.sin(controlled.facingAngle) * 300, 0);
    if (a && b) {
      ctx.save();
      ctx.strokeStyle = 'rgba(52,211,153,0.5)';
      ctx.lineWidth = 2; ctx.setLineDash([8, 8]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      const target = w.players.find((p) => p.id === w.passTargetId);
      if (target) {
        const t = P.project(target.x, target.y, 0);
        if (t) {
          ctx.strokeStyle = 'rgba(56,189,248,0.6)';
          ctx.setLineDash([5, 7]);
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(t.x, t.y); ctx.stroke();
        }
      }
      ctx.restore();
    }
  }

  /* ---------------- entities, sorted far to near ---------------- */
  type Entity = { y: number; kind: 'P'; player: PitchPlayer } | { y: number; kind: 'B' } | { y: number; kind: 'R' };
  const snapById = new Map(snapshot ? snapshot.p.map((item) => [item.id, item]) : []);

  const entities: Entity[] = onPitch(w).map((player) => {
    const snap = snapById.get(player.id);
    return { y: snap ? snap.y : player.y, kind: 'P' as const, player };
  });
  entities.push({ y: ballY, kind: 'B' });
  entities.push({ y: snapshot ? snapshot.ry : w.referee.y, kind: 'R' });
  entities.sort((a, b) => a.y - b.y);

  for (const entity of entities) {
    if (entity.kind === 'P') {
      const base = entity.player;
      const snap = snapById.get(base.id);
      const view: PitchPlayer = snap
        ? { ...base, x: snap.x, y: snap.y, z: snap.z, facingAngle: snap.f, actionState: snap.a, animFrame: snap.anim, vx: snap.vx, vy: snap.vy }
        : base;
      const sp = P.project(view.x, view.y, 0);
      if (!onScreen(sp) || !sp) continue;
      const team: Team = base.side === 'USER' ? w.userTeam : w.cpuTeam;
      drawPlayer3D(
        ctx, view, team, sp.x, sp.y, sp.s * PLAYER_RENDER_SCALE,
        showIndicators && base.id === w.controlledId,
        showIndicators && base.id === w.passTargetId
      );
      if (base.yellowCards > 0 && !snapshot) {
        ctx.fillStyle = '#FACC15';
        ctx.fillRect(sp.x + 13 * sp.s, sp.y - 58 * sp.s, 4.5 * sp.s, 6.5 * sp.s);
      }
    } else if (entity.kind === 'R') {
      const ref = w.referee;
      const rx = snapshot ? snapshot.rx : ref.x;
      const ry = snapshot ? snapshot.ry : ref.y;
      const sp = P.project(rx, ry, 0);
      if (!onScreen(sp) || !sp) continue;
      const refPlayer: PitchPlayer = {
        id: 'referee', teamId: 'referee', side: 'CPU', isGK: false,
        name: 'Referee', number: 0, role: 'MID', slotRole: 'CM', instruction: 'BALANCED',
        nx: 0.5, ny: 0, onPitch: true, subbedOut: false,
        appearance: { skinTone: '#C68642', hairColor: '#1A1110', hairStyle: 'buzz_cut', bootColor: '#111827', heightScale: 1, buildWidth: 0.98 },
        x: rx, y: ry, z: 0, vx: ref.vx, vy: ref.vy, vz: 0,
        facingAngle: snapshot ? snapshot.rf : ref.facingAngle,
        actionState: Math.hypot(ref.vx, ref.vy) > 1.4 ? 'run' : 'idle',
        animFrame: snapshot ? snapshot.ra : ref.animFrame,
        actionTimer: 0, tackleCd: 0, decisionCd: 0, holdTimer: 0,
        possessionTimer: -1, markId: null, stamina: 100,
        speedRating: 70, shootRating: 0, passRating: 0, homeX: 0, homeY: 0,
        yellowCards: 0, sentOff: false,
      };
      drawPlayer3D(ctx, refPlayer, REFEREE_TEAM, sp.x, sp.y, sp.s * PLAYER_RENDER_SCALE * 0.96, false, false);

      if (ref.cardTimer > 0 && ref.cardType) {
        const lift = Math.min(1, (110 - ref.cardTimer) / 14);
        ctx.save();
        ctx.fillStyle = ref.cardType === 'YELLOW' ? '#FACC15' : '#EF4444';
        ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.2;
        const cw = 10 * sp.s; const ch = 14 * sp.s;
        const cxp = sp.x + 16 * sp.s; const cyp = sp.y - (52 + 16 * lift) * sp.s;
        ctx.fillRect(cxp, cyp, cw, ch); ctx.strokeRect(cxp, cyp, cw, ch);
        ctx.restore();
      }
      if (ref.whistleTimer > 0) {
        ctx.save();
        ctx.globalAlpha = Math.min(0.8, ref.whistleTimer / 30);
        ctx.strokeStyle = '#FDE047'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y - 46 * sp.s, (34 - ref.whistleTimer * 0.5) * sp.s, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    } else {
      const ground = P.project(ballX, ballY, 0);
      const air = P.project(ballX, ballY, ballZ);
      if (!onScreen(ground) || !ground || !air) continue;
      const r = BALL_R * air.s;

      ctx.fillStyle = 'rgba(0,0,0,0.42)';
      ctx.beginPath();
      const shrink = Math.max(0.45, 1 - ballZ * 0.004);
      ctx.ellipse(ground.x, ground.y, BALL_R * ground.s * shrink, BALL_R * 0.5 * ground.s * shrink, 0, 0, Math.PI * 2);
      ctx.fill();

      const grad = ctx.createRadialGradient(air.x - r * 0.35, air.y - r * 0.35, r * 0.1, air.x, air.y, r);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.7, '#e2e8f0');
      grad.addColorStop(1, '#8c9bad');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(air.x, air.y, r, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(air.x + Math.cos(w.ball.rotationX) * r * 0.35, air.y + Math.sin(w.ball.rotationY) * r * 0.35, r * 0.33, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ---------------- minimap: shows how little of the pitch is on screen ---------------- */
  if (showIndicators) {
    const mw = 150; const mh = 97;
    const mx = canvasW - mw - 14; const my = canvasH - mh - 14;
    ctx.save();
    ctx.globalAlpha = 0.86;
    ctx.fillStyle = 'rgba(2,6,23,0.8)';
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    ctx.fillRect(mx, my, mw, mh);
    ctx.strokeRect(mx, my, mw, mh);
    ctx.beginPath(); ctx.moveTo(mx + mw / 2, my); ctx.lineTo(mx + mw / 2, my + mh); ctx.stroke();

    const toMap = (wx: number, wy: number) => ({
      x: mx + ((wx + PITCH.halfW) / (PITCH.halfW * 2)) * mw,
      y: my + ((wy + PITCH.halfH) / (PITCH.halfH * 2)) * mh,
    });
    onPitch(w).forEach((p) => {
      const m = toMap(p.x, p.y);
      ctx.fillStyle = p.side === 'USER'
        ? (p.id === w.controlledId ? '#34d399' : w.userTeam.primaryColor)
        : w.cpuTeam.primaryColor;
      ctx.beginPath(); ctx.arc(m.x, m.y, p.id === w.controlledId ? 3 : 2, 0, Math.PI * 2); ctx.fill();
    });
    const bm = toMap(ballX, ballY);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(bm.x, bm.y, 2, 0, Math.PI * 2); ctx.fill();

    // Viewport rectangle
    const tl = P.unproject(0, canvasH * 0.18);
    const br = P.unproject(canvasW, canvasH);
    const a = toMap(Math.max(tl.x, -PITCH.halfW), Math.max(tl.y, -PITCH.halfH));
    const b = toMap(Math.min(br.x, PITCH.halfW), Math.min(br.y, PITCH.halfH));
    ctx.strokeStyle = 'rgba(52,211,153,0.9)';
    ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
    ctx.restore();
  }
}
