import { PitchPlayer, Team } from '../types/game';

export function drawPlayer3D(
  ctx: CanvasRenderingContext2D,
  player: PitchPlayer,
  team: Team,
  screenX: number,
  screenY: number,
  scale: number,
  isControlled: boolean,
  isPassTarget: boolean
) {
  ctx.save();
  ctx.translate(screenX, screenY);

  const hScale = player.appearance.heightScale * scale;
  const wScale = player.appearance.buildWidth * scale;

  // Height offset off ground (e.g. jump or celebrate)
  const jumpOffset = -player.z * scale;

  // 1. TURF SHADOW (Realistic soft stadium lighting shadow)
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.36)';
  ctx.beginPath();
  ctx.ellipse(3 * scale, 4 * scale, 15 * wScale, 7 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 2. USER CONTROLLED RING OR PASS TARGET RING ON GRASS
  if (isControlled) {
    ctx.save();
    // Glowing emerald EA FC style ring
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 3 * scale;
    ctx.shadowColor = '#10B981';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.ellipse(0, 2 * scale, 22 * scale, 10 * scale, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Facing direction arrow on the ring
    const arrowDist = 25 * scale;
    const ax = Math.cos(player.facingAngle) * arrowDist;
    const ay = Math.sin(player.facingAngle) * arrowDist * 0.5 + 2 * scale;
    ctx.fillStyle = '#10B981';
    ctx.beginPath();
    ctx.arc(ax, ay, 4 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (isPassTarget) {
    ctx.save();
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2 * scale;
    ctx.setLineDash([4 * scale, 4 * scale]);
    ctx.beginPath();
    ctx.ellipse(0, 2 * scale, 20 * scale, 9 * scale, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Apply jump/dive vertical offset
  ctx.translate(0, jumpOffset);

  // Determine animation phase
  const speed = Math.hypot(player.vx, player.vy);
  const isMoving = speed > 0.25;
  const phase = player.animFrame;

  // Leg & arm swing angles
  let leftLegSwing = 0;
  let rightLegSwing = 0;
  let leftArmSwing = 0;
  let rightArmSwing = 0;
  let bodyTilt = 0;
  let diveRotation = 0;

  if (player.actionState === 'shoot') {
    // Wind up and strike follow-through
    leftLegSwing = -0.35;
    rightLegSwing = 0.85; // Kicking leg swings forward
    leftArmSwing = 0.6;
    rightArmSwing = -0.5;
    bodyTilt = -0.12;
  } else if (player.actionState === 'pass') {
    leftLegSwing = -0.2;
    rightLegSwing = 0.55;
    leftArmSwing = 0.4;
    rightArmSwing = -0.3;
  } else if (player.actionState === 'tackle') {
    // Sliding lunge
    leftLegSwing = -0.4;
    rightLegSwing = 0.95;
    bodyTilt = 0.25;
  } else if (player.actionState === 'dive_save') {
    // Goalkeeper horizontal dive
    diveRotation = player.vy >= 0 ? 0.85 : -0.85;
    leftArmSwing = -1.2;
    rightArmSwing = -1.2;
  } else if (player.actionState === 'celebrate') {
    leftArmSwing = -1.4 + Math.sin(phase * 2) * 0.3;
    rightArmSwing = -1.4 + Math.cos(phase * 2) * 0.3;
    leftLegSwing = Math.sin(phase * 2) * 0.3;
    rightLegSwing = -Math.sin(phase * 2) * 0.3;
  } else if (isMoving) {
    const strideAmp = player.actionState === 'sprint' ? 0.72 : 0.48;
    leftLegSwing = Math.sin(phase) * strideAmp;
    rightLegSwing = -Math.sin(phase) * strideAmp;
    leftArmSwing = -Math.sin(phase) * (strideAmp * 0.85);
    rightArmSwing = Math.sin(phase) * (strideAmp * 0.85);
    bodyTilt = player.actionState === 'sprint' ? 0.14 : 0.06;
  }

  // Rotate body slightly if diving
  if (diveRotation !== 0) {
    ctx.rotate(diveRotation);
  }

  // Facing direction cos/sin for subtle 3D torso/face turning
  const dirX = Math.cos(player.facingAngle);
  const dirY = Math.sin(player.facingAngle);

  // Kit Colors
  const shirtColor = player.isGK ? team.gkColor : team.primaryColor;
  const secondaryColor = team.secondaryColor;
  const shortsColor = player.isGK ? '#111827' : team.shortsColor;
  const socksColor = player.isGK ? team.gkColor : team.socksColor;
  const skinColor = player.appearance.skinTone;
  const bootColor = player.appearance.bootColor;

  // ==========================================
  // 3. LEGS, SOCKS, AND FOOTBALL BOOTS
  // ==========================================
  const drawLeg = (side: -1 | 1, swing: number) => {
    ctx.save();
    const hipX = side * 4.2 * wScale + dirX * 1.5 * scale;
    const hipY = -12 * hScale;

    // Upper leg (thigh with shorts)
    const kneeX = hipX + Math.sin(swing) * 7 * scale + dirX * 2 * scale;
    const kneeY = hipY + 7 * hScale - Math.abs(swing) * 2 * scale;

    // Lower leg (shin with sock)
    const footX = kneeX + Math.sin(swing * 1.15) * 6 * scale + dirX * 3 * scale;
    const footY = kneeY + 7 * hScale;

    // Thigh (Shorts)
    ctx.strokeStyle = shortsColor;
    ctx.lineWidth = 5.2 * wScale;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(kneeX, kneeY);
    ctx.stroke();

    // Knee skin exposed between shorts and sock
    ctx.strokeStyle = skinColor;
    ctx.lineWidth = 3.8 * wScale;
    ctx.beginPath();
    ctx.moveTo(kneeX, kneeY);
    ctx.lineTo((kneeX + footX) * 0.5, (kneeY + footY) * 0.5);
    ctx.stroke();

    // Football Sock
    ctx.strokeStyle = socksColor;
    ctx.lineWidth = 4.1 * wScale;
    ctx.beginPath();
    ctx.moveTo((kneeX + footX) * 0.5, (kneeY + footY) * 0.5);
    ctx.lineTo(footX, footY);
    ctx.stroke();

    // Football Boot
    ctx.fillStyle = bootColor;
    ctx.beginPath();
    ctx.ellipse(
      footX + dirX * 2.5 * scale,
      footY + 1 * scale,
      4.5 * scale,
      2.3 * scale,
      player.facingAngle * 0.25,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.restore();
  };

  // Draw back leg first for depth sorting
  if (dirY >= 0) {
    drawLeg(-1, leftLegSwing);
    drawLeg(1, rightLegSwing);
  } else {
    drawLeg(1, rightLegSwing);
    drawLeg(-1, leftLegSwing);
  }

  // ==========================================
  // 4. SHORTS WAISTBAND
  // ==========================================
  ctx.fillStyle = shortsColor;
  ctx.beginPath();
  ctx.roundRect(-7 * wScale, -16 * hScale, 14 * wScale, 6.5 * hScale, 2 * scale);
  ctx.fill();

  // ==========================================
  // 5. TORSO (3D FOOTBALL JERSEY / SHIRT)
  // ==========================================
  ctx.save();
  ctx.translate(dirX * 1.5 * scale, bodyTilt * 5 * scale);

  // Main torso shape with 3D gradient shading
  const torsoGrad = ctx.createLinearGradient(-8 * wScale, -32 * hScale, 8 * wScale, -15 * hScale);
  torsoGrad.addColorStop(0, shirtColor);
  torsoGrad.addColorStop(0.55, shirtColor);
  torsoGrad.addColorStop(1, '#111827'); // subtle shadow edge

  ctx.fillStyle = torsoGrad;
  ctx.beginPath();
  ctx.roundRect(-8.5 * wScale, -32 * hScale, 17 * wScale, 17 * hScale, [4 * scale, 4 * scale, 2 * scale, 2 * scale]);
  ctx.fill();

  // Kit Pattern (Stripes or Sash)
  if (!player.isGK && team.pattern === 'stripes') {
    ctx.fillStyle = secondaryColor;
    ctx.fillRect(-4.5 * wScale, -32 * hScale, 3 * wScale, 17 * hScale);
    ctx.fillRect(1.5 * wScale, -32 * hScale, 3 * wScale, 17 * hScale);
  } else if (!player.isGK && team.pattern === 'sash') {
    ctx.strokeStyle = secondaryColor;
    ctx.lineWidth = 3 * wScale;
    ctx.beginPath();
    ctx.moveTo(-7 * wScale, -31 * hScale);
    ctx.lineTo(7 * wScale, -17 * hScale);
    ctx.stroke();
  }

  // Collar trim
  ctx.strokeStyle = secondaryColor;
  ctx.lineWidth = 1.6 * scale;
  ctx.beginPath();
  ctx.arc(0, -32 * hScale, 3.8 * wScale, 0.2, Math.PI - 0.2);
  ctx.stroke();

  // SHIRT NUMBER ON KIT (Visible and crisp!)
  ctx.fillStyle =
    shirtColor.toUpperCase() === '#FFFFFF' || shirtColor.toUpperCase() === '#FACC15'
      ? '#0F172A'
      : '#FFFFFF';
  ctx.font = `900 ${Math.round(9.5 * scale)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(player.number), -dirX * 1.2 * scale, -23.5 * hScale);

  ctx.restore();

  // ==========================================
  // 6. SHOULDERS, ARMS, AND HANDS / GK GLOVES
  // ==========================================
  const drawArm = (side: -1 | 1, swing: number) => {
    ctx.save();
    const shoulderX = side * 9.5 * wScale;
    const shoulderY = -30 * hScale;

    const handX = shoulderX + Math.sin(swing) * 7 * scale + dirX * 2 * scale;
    const handY = shoulderY + 11 * hScale + Math.cos(swing) * 2 * scale;

    // Short Sleeve
    ctx.strokeStyle = shirtColor;
    ctx.lineWidth = 4.4 * wScale;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo((shoulderX + handX) * 0.45, (shoulderY + handY) * 0.45);
    ctx.stroke();

    // Forearm skin
    ctx.strokeStyle = skinColor;
    ctx.lineWidth = 3.2 * wScale;
    ctx.beginPath();
    ctx.moveTo((shoulderX + handX) * 0.45, (shoulderY + handY) * 0.45);
    ctx.lineTo(handX, handY);
    ctx.stroke();

    // Hand or Goalkeeper Glove
    if (player.isGK) {
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 1.2 * scale;
      ctx.beginPath();
      ctx.arc(handX, handY, 3.3 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillStyle = skinColor;
      ctx.beginPath();
      ctx.arc(handX, handY, 2.2 * scale, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  };

  drawArm(-1, leftArmSwing);
  drawArm(1, rightArmSwing);

  // ==========================================
  // 7. NECK, HEAD, ORIGINAL FACE & 3D HAIRSTYLE
  // ==========================================
  ctx.save();
  // Neck
  ctx.fillStyle = skinColor;
  ctx.fillRect(-2.5 * wScale, -35 * hScale, 5 * wScale, 4 * hScale);

  // Head 3D sphere
  const headX = dirX * 1.8 * scale;
  const headY = -40.5 * hScale;
  const headRadius = 6.2 * scale;

  const headGrad = ctx.createRadialGradient(
    headX - 2 * scale,
    headY - 2 * scale,
    1 * scale,
    headX,
    headY,
    headRadius
  );
  headGrad.addColorStop(0, skinColor);
  headGrad.addColorStop(1, '#7C4722'); // natural jaw contour shadow

  ctx.fillStyle = headGrad;
  ctx.beginPath();
  ctx.arc(headX, headY, headRadius, 0, Math.PI * 2);
  ctx.fill();

  // Facial features (eyes, eyebrows, mouth when facing forward/side)
  if (dirY > -0.35) {
    const faceOffsetX = dirX * 2.8 * scale;
    const faceOffsetY = headY + 0.5 * scale;

    // Eyes
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(headX + faceOffsetX - 1.8 * scale, faceOffsetY - 0.8 * scale, 0.85 * scale, 0, Math.PI * 2);
    ctx.arc(headX + faceOffsetX + 1.8 * scale, faceOffsetY - 0.8 * scale, 0.85 * scale, 0, Math.PI * 2);
    ctx.fill();

    // Eyebrows
    ctx.strokeStyle = player.appearance.hairColor;
    ctx.lineWidth = 0.9 * scale;
    ctx.beginPath();
    ctx.moveTo(headX + faceOffsetX - 2.8 * scale, faceOffsetY - 2.1 * scale);
    ctx.lineTo(headX + faceOffsetX - 0.9 * scale, faceOffsetY - 2.1 * scale);
    ctx.moveTo(headX + faceOffsetX + 0.9 * scale, faceOffsetY - 2.1 * scale);
    ctx.lineTo(headX + faceOffsetX + 2.8 * scale, faceOffsetY - 2.1 * scale);
    ctx.stroke();
  }

  // 3D HAIRSTYLE
  ctx.fillStyle = player.appearance.hairColor;
  const style = player.appearance.hairStyle;

  if (style === 'afro_curls') {
    ctx.beginPath();
    ctx.arc(headX, headY - 2.2 * scale, headRadius * 1.12, Math.PI * 0.85, Math.PI * 2.15);
    ctx.fill();
  } else if (style === 'mohawk_fade') {
    ctx.beginPath();
    ctx.roundRect(headX - 2.2 * scale, headY - headRadius - 2.5 * scale, 4.4 * scale, 7 * scale, 2 * scale);
    ctx.fill();
  } else if (style === 'braids') {
    ctx.beginPath();
    ctx.arc(headX, headY - 1.5 * scale, headRadius * 1.04, Math.PI, Math.PI * 2);
    ctx.fill();
    // Braid lines
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 0.9 * scale;
    for (let b = -3; b <= 3; b += 2) {
      ctx.beginPath();
      ctx.moveTo(headX + b * scale, headY - headRadius);
      ctx.lineTo(headX + b * scale, headY - 1 * scale);
      ctx.stroke();
    }
  } else if (style === 'slick_back' || style === 'wavy_top') {
    ctx.beginPath();
    ctx.ellipse(headX, headY - 3 * scale, headRadius * 1.05, 4.2 * scale, 0, Math.PI, Math.PI * 2);
    ctx.fill();
  } else {
    // Classic crop / fade / buzz
    ctx.beginPath();
    ctx.arc(headX, headY - 1.2 * scale, headRadius * 1.02, Math.PI * 0.95, Math.PI * 2.05);
    ctx.fill();
  }

  ctx.restore();

  // ==========================================
  // 8. OVERHEAD BROADCAST NAMEPLATE & STAMINA
  // ==========================================
  const tagY = -53 * hScale;

  // Nameplate background pill
  ctx.font = `700 ${Math.round(9 * scale)}px sans-serif`;
  const labelText = `${player.number} ${player.name}`;
  const textWidth = ctx.measureText(labelText).width;
  const pillW = textWidth + 10 * scale;
  const pillH = 13 * scale;

  ctx.fillStyle = isControlled ? 'rgba(16, 185, 129, 0.92)' : 'rgba(15, 23, 42, 0.82)';
  ctx.beginPath();
  ctx.roundRect(-pillW / 2, tagY - pillH / 2, pillW, pillH, 4 * scale);
  ctx.fill();

  // Name text
  ctx.fillStyle = isControlled ? '#042F2E' : '#F8FAFC';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(labelText, 0, tagY);

  // Controlled chevron marker above pill
  if (isControlled) {
    ctx.fillStyle = '#10B981';
    ctx.beginPath();
    ctx.moveTo(0, tagY - pillH / 2 - 2 * scale);
    ctx.lineTo(-4.5 * scale, tagY - pillH / 2 - 8 * scale);
    ctx.lineTo(4.5 * scale, tagY - pillH / 2 - 8 * scale);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}
