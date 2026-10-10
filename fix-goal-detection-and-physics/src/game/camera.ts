import { CameraPreset } from '../types/game';
import { PITCH, World, getById } from './engine';

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
  height: number;
  dist: number;
}

export interface CameraPresetProfile {
  label: string;
  zoom: number;
  height: number;
  dist: number;
  /** How far ahead of the ball the camera leads, 0..1. */
  lead: number;
  /** Blend between controlled player (0) and ball (1). */
  ballBias: number;
  /** Follow rate in units/second. Lower = slower, more cinematic. */
  rate: number;
}

/**
 * Follow rates are expressed per second so the feel is identical at any frame
 * rate. These are deliberately low: the camera should drift after the player,
 * never snap to them.
 */
/**
 * ballBias is deliberately low: the camera is anchored on the controlled
 * player so they stay near the centre of the screen. The ball is kept in frame
 * by the safe-region tracker below rather than by dragging the centre point.
 */
export const CAMERA_PRESETS: Record<CameraPreset, CameraPresetProfile> = {
  DYNAMIC_WIDE:  { label: 'Dynamic Wide',  zoom: 1.30, height: 840,  dist: 360, lead: 0.11, ballBias: 0.13, rate: 1.70 },
  STADIUM:       { label: 'Stadium',       zoom: 1.05, height: 1020, dist: 300, lead: 0.09, ballBias: 0.18, rate: 1.35 },
  PLAYER_FOLLOW: { label: 'Player Follow', zoom: 1.56, height: 690,  dist: 430, lead: 0.12, ballBias: 0.07, rate: 2.05 },
  CUSTOM:        { label: 'Custom',        zoom: 1.30, height: 840,  dist: 360, lead: 0.10, ballBias: 0.13, rate: 1.70 },
};

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** Frame-rate independent smoothing factor for an exponential approach. */
const smooth = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);

/**
 * Damped-spring follow camera.
 *
 * Position, zoom and the look-at target are all integrated with delta time, so
 * the motion is identical on a 60 Hz or 144 Hz display. The spring is slightly
 * under-damped at the default settings, which produces the gentle acceleration
 * and settle of a broadcast camera rather than a rigid lock to the player.
 */
export class CameraRig {
  state: CameraState;
  private vx = 0;
  private vy = 0;
  private vzoom = 0;
  /** Lagged aim point; the spring chases this, giving a natural follow delay. */
  private aimX = 0;
  private aimY = 0;
  private profile: CameraPresetProfile;
  private baseZoom: number;
  private cinematic = 0;
  /** 1 while framing a long pass, decaying back to normal follow. */
  private tracking = 0;
  /** 0.2 (very slow) .. 2 (snappy). User adjustable. */
  private smoothness = 1;

  constructor(preset: CameraPreset, zoomScale: number, height: number, dist: number, smoothness = 1) {
    this.profile = CAMERA_PRESETS[preset];
    this.baseZoom = this.profile.zoom * zoomScale;
    this.smoothness = smoothness;
    this.state = {
      x: 0, y: 0,
      zoom: this.baseZoom,
      height: preset === 'CUSTOM' ? height : this.profile.height,
      dist: preset === 'CUSTOM' ? dist : this.profile.dist,
    };
  }

  configure(preset: CameraPreset, zoomScale: number, height: number, dist: number, smoothness: number) {
    this.profile = CAMERA_PRESETS[preset];
    this.baseZoom = this.profile.zoom * zoomScale;
    this.smoothness = smoothness;
    this.state.height = preset === 'CUSTOM' ? height : this.profile.height;
    this.state.dist = preset === 'CUSTOM' ? dist : this.profile.dist;
  }

  /** Jump straight to the action (kickoff only), so there is no long pan in. */
  snapTo(x: number, y: number) {
    this.state.x = x; this.state.y = y;
    this.aimX = x; this.aimY = y;
    this.vx = 0; this.vy = 0;
  }

  playCinematic(seconds = 2.2) {
    this.cinematic = seconds;
  }

  update(w: World, dtMs: number, focusOverride?: { x: number; y: number } | null) {
    // Clamp dt so an alt-tab pause cannot fling the camera across the pitch.
    const dt = clamp(dtMs / 1000, 0, 0.05);
    if (dt <= 0) return;

    const p = this.profile;
    const ball = w.ball;
    const player = getById(w, w.controlledId);

    /* ------------------------- target point ------------------------- */
    let tx: number;
    let ty: number;
    let targetZoom = this.baseZoom;

    if (focusOverride) {
      tx = focusOverride.x;
      ty = focusOverride.y;
      targetZoom = this.baseZoom * 1.1;
    } else {
      // Anchor on the controlled player; this is what keeps them centred.
      const px = player ? player.x : ball.x;
      const py = player ? player.y : ball.y;
      const speed = Math.hypot(ball.vx, ball.vy);
      const loose = !ball.ownerId;

      // Predict where a travelling ball will end up, using the same ground
      // friction the physics step applies.
      let landX = ball.x;
      let landY = ball.y;
      if (loose && speed > 3) {
        let vx = ball.vx; let vy = ball.vy;
        for (let i = 0; i < 70; i++) {
          landX += vx; landY += vy;
          vx *= 0.9925; vy *= 0.9925;
          if (Math.hypot(vx, vy) < 2.5) break;
        }
        landX = clamp(landX, -PITCH.halfW, PITCH.halfW);
        landY = clamp(landY, -PITCH.halfH, PITCH.halfH);
      }

      // A long pass is a fast loose ball travelling a real distance.
      const travel = Math.hypot(landX - px, landY - py);
      const longPass = loose && speed > 11 && travel > 430;
      this.tracking = longPass ? 1 : Math.max(0, this.tracking - dt * 1.1);

      // Base framing: the controlled player sits at the centre of the shot,
      // nudged only slightly toward the ball so they never drift to an edge.
      const bias = p.ballBias;
      tx = px + (ball.x - px) * bias;
      ty = py + (ball.y - py) * bias;

      // Lead the player's own run a little so there is space ahead of them.
      if (player) {
        tx += player.vx * 7;
        ty += player.vy * 5;
      }

      // During a long pass, slide the frame toward the midpoint of the flight
      // so both the passer and the landing zone stay on screen.
      if (this.tracking > 0) {
        const midX = (px + landX) / 2;
        const midY = (py + landY) / 2;
        const t = this.tracking;
        tx += (midX - tx) * 0.85 * t;
        ty += (midY - ty) * 0.85 * t;
      } else if (loose && speed > 2) {
        tx += ball.vx * p.lead * 5;
        ty += ball.vy * p.lead * 4;
      }

      /* --------- safe region: never let the ball leave the frame --------- */
      // Half-extents of the comfortable viewing box in world units.
      const safeX = 560 / this.state.zoom;
      const safeY = 300 / this.state.zoom;
      const offX = ball.x - tx;
      const offY = ball.y - ty;
      if (Math.abs(offX) > safeX) tx += offX - Math.sign(offX) * safeX;
      if (Math.abs(offY) > safeY) ty += offY - Math.sign(offY) * safeY;

      /* ------------------------ dynamic zoom ------------------------ */
      const nearGoal = Math.abs(ball.x) > PITCH.halfW - 420;
      const nearTouch = Math.abs(ball.y) > PITCH.halfH - 190;

      let duel = 9999;
      const carrier = getById(w, ball.ownerId);
      if (carrier) {
        w.players.forEach((o) => {
          if (!o.onPitch || o.sentOff || o.side === carrier.side) return;
          duel = Math.min(duel, Math.hypot(o.x - carrier.x, o.y - carrier.y));
        });
      }

      if (w.restart) targetZoom = this.baseZoom * 1.12;
      else if (this.tracking > 0) {
        // Widen just enough to show the flight and the receiving area.
        const need = clamp(travel / 1150, 0, 1);
        targetZoom = this.baseZoom * (1 - 0.22 * need);
      } else if (w.gkHold) targetZoom = this.baseZoom * 1.0;
      else if (nearGoal) targetZoom = this.baseZoom * 1.12;
      else if (duel < 150) targetZoom = this.baseZoom * 1.08;
      else if (speed > 15) targetZoom = this.baseZoom * 0.92;
      else if (nearTouch) targetZoom = this.baseZoom * 0.94;
    }

    if (this.cinematic > 0) {
      this.cinematic -= dt;
      targetZoom = this.baseZoom * 1.28;
    }

    // The camera stays inside the ground so it never clips outside the stadium.
    tx = clamp(tx, -PITCH.halfW * 0.80, PITCH.halfW * 0.80);
    ty = clamp(ty, -PITCH.halfH * 0.58, PITCH.halfH * 0.58);

    /* ---------------- stage 1: lagged aim point ---------------- */
    // Chasing a lagged target is what produces the cinematic follow delay and
    // stops the camera from whipping around when the player cuts back.
    // A ball in flight needs a firmer response so it cannot outrun the frame.
    const urgency = 1 + this.tracking * 1.3;
    const aimRate = p.rate * 1.5 * this.smoothness * urgency;
    const ka = smooth(aimRate, dt);
    this.aimX += (tx - this.aimX) * ka;
    this.aimY += (ty - this.aimY) * ka;

    /* ---------------- stage 2: damped spring ---------------- */
    // Critically damped: zeta = 1 gives smooth acceleration with no overshoot.
    const omega = p.rate * 2.2 * this.smoothness * urgency;
    const ax = (this.aimX - this.state.x) * omega * omega - this.vx * 2 * omega;
    const ay = (this.aimY - this.state.y) * omega * omega - this.vy * 2 * omega;
    this.vx += ax * dt;
    this.vy += ay * dt;

    // Cap camera speed so nothing can ever produce a violent sweep.
    const maxSpeed = 900;
    const sp = Math.hypot(this.vx, this.vy);
    if (sp > maxSpeed) { this.vx = (this.vx / sp) * maxSpeed; this.vy = (this.vy / sp) * maxSpeed; }

    this.state.x += this.vx * dt;
    this.state.y += this.vy * dt;

    /* ---------------- zoom: slow and gentle ---------------- */
    const zOmega = 1.5 * this.smoothness;
    const az = (targetZoom - this.state.zoom) * zOmega * zOmega - this.vzoom * 2 * zOmega;
    this.vzoom += az * dt;
    this.state.zoom += this.vzoom * dt;

    /* ---------------- safety: never lose the ball ---------------- */
    const dx = ball.x - this.state.x;
    const dy = ball.y - this.state.y;
    if (Math.abs(dx) > 820) {
      const pull = smooth(2.5, dt);
      this.state.x += (dx - Math.sign(dx) * 820) * pull;
      this.aimX = this.state.x;
    }
    if (Math.abs(dy) > 420) {
      const pull = smooth(2.5, dt);
      this.state.y += (dy - Math.sign(dy) * 420) * pull;
      this.aimY = this.state.y;
    }
  }
}
