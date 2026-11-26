// All drawing, and no rules: sky, sea and islands in parallax, the plane, the
// rings and storms, the particles, the HUD with its lit instruments, and the
// title, paused and game-over screens. The world is drawn in metres; the camera
// keeps the plane at a fixed screen x while it flies.

import { FIELD, PALETTE, SEA_Y, FONT } from './config.js';
import { PLANE_SCREEN_X, PX_PER_M, VSCALE } from './world.js';
import { createRandom } from './random.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_OVER = 3;
export const SCREEN_DONE = 4;

const TAU = Math.PI * 2;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let width = 0;
  let height = 0;
  let scale = 1;

  // Clouds live across the whole tour so they never pop in: placed once, by seed.
  const cloudRandom = createRandom(20261126);
  const clouds = [];
  for (let index = 0; index < 46; index += 1) {
    clouds.push({
      x: cloudRandom() * 9500,
      alt: 190 + cloudRandom() * 160,
      size: 46 + cloudRandom() * 90,
      speed: 2 + cloudRandom() * 4,
    });
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, Math.floor(rect.width * dpr));
    height = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    scale = Math.min(width / FIELD.width, height / FIELD.height);
    ctx.setTransform(scale, 0, 0, scale, (width - FIELD.width * scale) / 2, (height - FIELD.height * scale) / 2);
  }

  function worldToScreenX(worldX, camX) {
    return (worldX - camX) * PX_PER_M;
  }

  function altToScreenY(alt) {
    return SEA_Y - alt * VSCALE;
  }

  function drawSky(time) {
    const gradient = ctx.createLinearGradient(0, 0, 0, SEA_Y);
    gradient.addColorStop(0, PALETTE.skyTop);
    gradient.addColorStop(0.55, PALETTE.skyMid);
    gradient.addColorStop(1, PALETTE.skyLow);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, FIELD.width, SEA_Y);
    // Low sun, glowing, just ahead of the plane.
    const sunX = 980;
    const sunY = 150 + Math.sin(time * 0.05) * 4;
    const glow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 150);
    glow.addColorStop(0, PALETTE.sunCore);
    glow.addColorStop(0.25, PALETTE.sunGlow);
    glow.addColorStop(1, 'rgba(255, 214, 110, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - 150, sunY - 150, 300, 300);
    ctx.fillStyle = PALETTE.sunCore;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 30, 0, TAU);
    ctx.fill();
  }

  function drawMountains(camX) {
    // Two far ridges, scrolling slower than the world: pure sine silhouettes.
    const layers = [
      { colour: PALETTE.mountainFar, parallax: 0.25, base: 470, amp: 55, freq: 0.0016 },
      { colour: PALETTE.mountainNear, parallax: 0.45, base: 505, amp: 42, freq: 0.0026 },
    ];
    for (const layer of layers) {
      ctx.fillStyle = layer.colour;
      ctx.beginPath();
      ctx.moveTo(0, SEA_Y);
      for (let x = 0; x <= FIELD.width; x += 16) {
        const worldX = x + camX * layer.parallax;
        const y = layer.base
          + Math.sin(worldX * layer.freq) * layer.amp
          + Math.sin(worldX * layer.freq * 2.7 + 1.3) * layer.amp * 0.4;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(FIELD.width, SEA_Y);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawCloud(x, y, size, alpha) {
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.45, 0, TAU);
    ctx.arc(x + size * 0.4, y + size * 0.08, size * 0.36, 0, TAU);
    ctx.arc(x - size * 0.42, y + size * 0.1, size * 0.34, 0, TAU);
    ctx.arc(x + size * 0.08, y - size * 0.18, size * 0.38, 0, TAU);
    ctx.fill();
  }

  function drawSea(time, camX) {
    const gradient = ctx.createLinearGradient(0, SEA_Y, 0, FIELD.height);
    gradient.addColorStop(0, PALETTE.seaShallow);
    gradient.addColorStop(1, PALETTE.seaDeep);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, SEA_Y, FIELD.width, FIELD.height - SEA_Y);
    // Sun glitter and slow waves.
    ctx.strokeStyle = PALETTE.seaGlitter;
    ctx.lineWidth = 2;
    for (let index = 0; index < 26; index += 1) {
      const worldX = ((index * 397 + Math.floor(time * 12)) % 2600) + camX - 300;
      const sx = worldToScreenX(worldX, camX);
      if (sx < -40 || sx > FIELD.width + 40) continue;
      const y = SEA_Y + 18 + ((index * 53) % 120);
      const wobble = Math.sin(time * 1.4 + index) * 6;
      ctx.globalAlpha = 0.25 + 0.2 * Math.sin(time * 2 + index * 1.7);
      ctx.beginPath();
      ctx.moveTo(sx - 22, y + wobble);
      ctx.lineTo(sx + 22, y + wobble);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawPalm(x, groundY, size) {
    ctx.strokeStyle = PALETTE.palmTrunk;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, groundY);
    ctx.quadraticCurveTo(x + 6, groundY - size * 0.6, x + 2, groundY - size);
    ctx.stroke();
    ctx.strokeStyle = PALETTE.palmLeaf;
    ctx.lineWidth = 3;
    const topX = x + 2;
    const topY = groundY - size;
    for (let frond = 0; frond < 5; frond += 1) {
      const angle = -Math.PI * (0.15 + frond * 0.18);
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.quadraticCurveTo(
        topX + Math.cos(angle) * size * 0.5, topY + Math.sin(angle) * size * 0.5 - 4,
        topX + Math.cos(angle) * size * 0.85, topY + Math.sin(angle) * size * 0.85 + 10,
      );
      ctx.stroke();
    }
  }

  function drawHouse(x, groundY, size) {
    ctx.fillStyle = PALETTE.wall;
    ctx.fillRect(x, groundY - size * 0.55, size, size * 0.55);
    ctx.fillStyle = PALETTE.roof;
    ctx.beginPath();
    ctx.moveTo(x - 3, groundY - size * 0.55);
    ctx.lineTo(x + size / 2, groundY - size * 0.95);
    ctx.lineTo(x + size + 3, groundY - size * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(x + size * 0.38, groundY - size * 0.28, size * 0.24, size * 0.28);
  }

  function drawIsland(island, camX, time) {
    const x0 = worldToScreenX(island.x, camX);
    const x1 = worldToScreenX(island.x + island.length, camX);
    if (x1 < -80 || x0 > FIELD.width + 80) return;
    const groundY = SEA_Y;
    // Beach, then the green hill with a palm-lined crest.
    ctx.fillStyle = PALETTE.sand;
    ctx.beginPath();
    ctx.moveTo(x0 - 26, groundY + 26);
    ctx.quadraticCurveTo((x0 + x1) / 2, groundY - 66 - island.hillSeed * 26, x1 + 26, groundY + 26);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.grass;
    ctx.beginPath();
    ctx.moveTo(x0, groundY + 8);
    ctx.quadraticCurveTo((x0 + x1) / 2, groundY - 58 - island.hillSeed * 24, x1, groundY + 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.hill;
    ctx.beginPath();
    ctx.ellipse((x0 + x1) / 2 - island.length * 0.18, groundY - 26, island.length * 0.2, 34, 0, Math.PI, TAU);
    ctx.fill();
    // Palms and houses along the crest.
    const palmRandom = createRandom(Math.floor(island.hillSeed * 100000));
    for (let index = 0; index < island.palms; index += 1) {
      const px = x0 + 60 + palmRandom() * (x1 - x0 - 120);
      drawPalm(px, groundY - 12 - palmRandom() * 22, 26 + palmRandom() * 12);
    }
    for (let index = 0; index < island.houses; index += 1) {
      const hx = x0 + 90 + palmRandom() * (x1 - x0 - 200);
      drawHouse(hx, groundY - 6, 26 + palmRandom() * 8);
    }
    // Runway: dark strip with centre dashes, threshold bars and a windsock.
    const rx0 = worldToScreenX(island.runwayX, camX);
    const rx1 = worldToScreenX(island.runwayX + island.runwayLength, camX);
    ctx.fillStyle = PALETTE.runway;
    ctx.fillRect(rx0, groundY - 4, rx1 - rx0, 10);
    ctx.fillStyle = PALETTE.runwayLine;
    for (let dx = rx0 + 14; dx < rx1 - 10; dx += 30) ctx.fillRect(dx, groundY - 1, 16, 3);
    ctx.fillRect(rx0 + 4, groundY - 4, 6, 10);
    ctx.fillRect(rx1 - 10, groundY - 4, 6, 10);
    // Windsock on a pole at the runway's start.
    const sockX = rx0 - 16;
    ctx.strokeStyle = '#d8d8d8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sockX, groundY - 4);
    ctx.lineTo(sockX, groundY - 34);
    ctx.stroke();
    const wave = Math.sin(time * 3) * 3;
    ctx.fillStyle = '#ff8c42';
    ctx.beginPath();
    ctx.moveTo(sockX, groundY - 34);
    ctx.lineTo(sockX + 22, groundY - 30 + wave);
    ctx.lineTo(sockX, groundY - 26);
    ctx.closePath();
    ctx.fill();
    // Island name on a small sign at the runway.
    ctx.fillStyle = 'rgba(16, 24, 32, 0.72)';
    ctx.fillRect(rx0 + 8, groundY - 58, 132, 22);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '600 13px ' + FONT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(island.name.toUpperCase(), rx0 + 16, groundY - 47);
  }

  function drawRing(ring, camX, time) {
    const x = worldToScreenX(ring.x, camX);
    const y = altToScreenY(ring.alt);
    if (x < -80 || x > FIELD.width + 80) return;
    const radius = ring.radius * VSCALE;
    if (ring.scored) {
      ctx.strokeStyle = 'rgba(125, 220, 138, 0.55)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, TAU);
      ctx.stroke();
      return;
    }
    const pulse = 1 + Math.sin(time * 3 + ring.x) * 0.05;
    const glow = ctx.createRadialGradient(x, y, radius * 0.4, x, y, radius * 1.5);
    glow.addColorStop(0, 'rgba(255, 201, 60, 0.35)');
    glow.addColorStop(1, 'rgba(255, 201, 60, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - radius * 1.6, y - radius * 1.6, radius * 3.2, radius * 3.2);
    ctx.strokeStyle = PALETTE.ring;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(x, y, radius * pulse, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = PALETTE.ringGlow;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, radius * pulse, 0, TAU);
    ctx.stroke();
    // Chevron pointing the way through.
    ctx.fillStyle = PALETTE.ringGlow;
    ctx.beginPath();
    ctx.moveTo(x + radius * 0.45, y);
    ctx.lineTo(x - radius * 0.1, y - radius * 0.28);
    ctx.lineTo(x - radius * 0.1, y + radius * 0.28);
    ctx.closePath();
    ctx.fill();
  }

  function drawStorm(storm, camX, time) {
    const x = worldToScreenX(storm.x, camX);
    const y = altToScreenY(storm.alt);
    if (x < -160 || x > FIELD.width + 160) return;
    const radius = storm.radius * VSCALE;
    ctx.fillStyle = 'rgba(52, 58, 72, 0.88)';
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.55, 0, TAU);
    ctx.arc(x + radius * 0.45, y + radius * 0.1, radius * 0.42, 0, TAU);
    ctx.arc(x - radius * 0.48, y + radius * 0.12, radius * 0.4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(70, 76, 92, 0.9)';
    ctx.beginPath();
    ctx.arc(x, y - radius * 0.28, radius * 0.4, 0, TAU);
    ctx.fill();
    // Rain streaks under the cloud.
    ctx.strokeStyle = 'rgba(160, 190, 220, 0.6)';
    ctx.lineWidth = 2;
    for (let index = 0; index < 7; index += 1) {
      const rx = x - radius * 0.7 + index * radius * 0.22;
      const fall = (time * 160 + index * 47) % (radius * 0.9);
      ctx.beginPath();
      ctx.moveTo(rx, y + radius * 0.4 + fall);
      ctx.lineTo(rx - 4, y + radius * 0.4 + fall + 14);
      ctx.stroke();
    }
    // Occasional lightning flash inside the cloud.
    if (Math.sin(time * 1.7 + storm.x) > 0.93) {
      ctx.strokeStyle = 'rgba(255, 240, 150, 0.95)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y + radius * 0.2);
      ctx.lineTo(x - 8, y + radius * 0.55);
      ctx.lineTo(x + 2, y + radius * 0.55);
      ctx.lineTo(x - 4, y + radius * 0.9);
      ctx.stroke();
    }
  }

  function drawPlane(plane, time) {
    const x = PLANE_SCREEN_X;
    const y = altToScreenY(Math.max(0, plane.alt));
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-plane.pitch);
    // Shadow on the sea when low.
    // Propeller: spinning translucent disc at the nose.
    const propAngle = time * 42;
    ctx.fillStyle = 'rgba(220, 230, 240, 0.35)';
    ctx.save();
    ctx.translate(34, 0);
    ctx.rotate(propAngle);
    ctx.fillRect(-2, -26, 4, 52);
    ctx.restore();
    ctx.fillStyle = '#3a3f46';
    ctx.beginPath();
    ctx.arc(34, 0, 4, 0, TAU);
    ctx.fill();
    // Tail wing and fin.
    ctx.fillStyle = PALETTE.planeWing;
    ctx.beginPath();
    ctx.moveTo(-30, -2);
    ctx.lineTo(-40, -14);
    ctx.lineTo(-32, -14);
    ctx.lineTo(-24, -2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.planeTrim;
    ctx.beginPath();
    ctx.moveTo(-28, -4);
    ctx.lineTo(-36, -24);
    ctx.lineTo(-28, -24);
    ctx.lineTo(-20, -4);
    ctx.closePath();
    ctx.fill();
    // Fuselage: a rounded red body with a cream belly stripe.
    ctx.fillStyle = PALETTE.planeBody;
    ctx.beginPath();
    ctx.moveTo(-32, -4);
    ctx.quadraticCurveTo(-10, -14, 14, -10);
    ctx.quadraticCurveTo(32, -8, 36, 0);
    ctx.quadraticCurveTo(32, 7, 14, 9);
    ctx.quadraticCurveTo(-12, 10, -32, 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.planeWing;
    ctx.beginPath();
    ctx.moveTo(-6, -8);
    ctx.lineTo(6, -8);
    ctx.lineTo(10, 8);
    ctx.lineTo(-2, 8);
    ctx.closePath();
    ctx.fill();
    // Lit cockpit windows.
    ctx.fillStyle = PALETTE.planeGlass;
    ctx.beginPath();
    ctx.moveTo(10, -9);
    ctx.lineTo(24, -7);
    ctx.lineTo(22, -1);
    ctx.lineTo(10, -2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.arc(27, -4, 2.2, 0, TAU);
    ctx.fill();
    // Navigation lights: red on the tail, green on the wing, blinking.
    if (Math.sin(time * 5) > 0) {
      ctx.fillStyle = '#ff5a4e';
      ctx.beginPath();
      ctx.arc(-33, -2, 3, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#54e07a';
    ctx.beginPath();
    ctx.arc(4, 9, 2.5, 0, TAU);
    ctx.fill();
    // Wheels when parked on the runway.
    if (plane.onGround) {
      ctx.fillStyle = '#22262b';
      ctx.beginPath();
      ctx.arc(-12, 12, 5, 0, TAU);
      ctx.arc(14, 12, 5, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawParticles(particles, camX) {
    for (const particle of particles) {
      if (!particle.active) continue;
      const x = worldToScreenX(particle.x, camX);
      const y = altToScreenY(particle.alt);
      const alpha = clamp(particle.life / 0.7, 0, 1);
      if (particle.kind === 0) {
        ctx.fillStyle = `rgba(230, 230, 230, ${alpha * 0.5})`;
        ctx.beginPath();
        ctx.arc(x, y, 5 + (0.7 - particle.life) * 8, 0, TAU);
        ctx.fill();
      } else if (particle.kind === 1) {
        ctx.fillStyle = `rgba(60, 60, 66, ${alpha * 0.75})`;
        ctx.beginPath();
        ctx.arc(x, y, 6 + (0.9 - particle.life) * 10, 0, TAU);
        ctx.fill();
      } else {
        ctx.fillStyle = `rgba(190, 225, 240, ${alpha * 0.8})`;
        ctx.beginPath();
        ctx.arc(x, y, 4 + (0.9 - particle.life) * 12, 0, TAU);
        ctx.fill();
      }
    }
  }

  function bar(x, y, width, height, fraction, colour) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = colour;
    ctx.fillRect(x + 1, y + 1, (width - 2) * clamp(fraction, 0, 1), height - 2);
  }

  function drawGauge(cx, cy, radius, fraction, label, value) {
    ctx.fillStyle = 'rgba(16, 24, 32, 0.78)';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, TAU);
    ctx.stroke();
    // Lit dial: tick marks and a glowing needle.
    ctx.strokeStyle = 'rgba(174, 191, 204, 0.8)';
    ctx.lineWidth = 1.5;
    for (let tick = 0; tick <= 8; tick += 1) {
      const angle = -Math.PI * 0.75 + (tick / 8) * Math.PI * 1.5;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * (radius - 6), cy + Math.sin(angle) * (radius - 6));
      ctx.lineTo(cx + Math.cos(angle) * (radius - 2), cy + Math.sin(angle) * (radius - 2));
      ctx.stroke();
    }
    const needle = -Math.PI * 0.75 + clamp(fraction, 0, 1) * Math.PI * 1.5;
    ctx.strokeStyle = '#ffd66e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(needle) * (radius - 8), cy + Math.sin(needle) * (radius - 8));
    ctx.stroke();
    ctx.fillStyle = PALETTE.text;
    ctx.font = '600 11px ' + FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, cy + radius - 12);
    ctx.font = '700 13px ' + FONT;
    ctx.fillText(value, cx, cy + 2);
  }

  function drawHud(state, screen) {
    const plane = state.plane;
    // Top bar.
    ctx.fillStyle = 'rgba(16, 24, 32, 0.82)';
    ctx.fillRect(0, 0, FIELD.width, 52);
    ctx.fillStyle = PALETTE.panelEdge;
    ctx.fillRect(0, 52, FIELD.width, 2);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '600 11px ' + FONT;
    ctx.fillText('ALT', 18, 16);
    ctx.fillText('SPD', 128, 16);
    ctx.fillText('HDG', 238, 16);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '700 19px ' + FONT;
    ctx.fillText(`${Math.round(plane.alt)} m`, 18, 36);
    ctx.fillText(`${Math.round(plane.speed)} km/h`, 128, 36);
    ctx.fillText('090°', 238, 36);
    // Fuel and hull bars.
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '600 11px ' + FONT;
    ctx.fillText('FUEL', 348, 16);
    ctx.fillText('HULL', 528, 16);
    bar(348, 26, 150, 12, plane.fuel / 100, plane.fuel < 25 ? PALETTE.bad : plane.fuel < 55 ? PALETTE.warn : PALETTE.good);
    bar(528, 26, 150, 12, plane.hull / 100, plane.hull < 30 ? PALETTE.bad : plane.hull < 60 ? PALETTE.warn : PALETTE.good);
    // Score, leg and rings.
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '600 11px ' + FONT;
    ctx.fillText('SCORE', FIELD.width - 268, 16);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '700 19px ' + FONT;
    ctx.fillText(String(state.score), FIELD.width - 268, 36);
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '600 11px ' + FONT;
    const nextIsland = state.islands[state.leg + 1];
    const shortName = (name) => name.replace('Pulau ', '');
    const mission = screen === SCREEN_TITLE
      ? 'Island hop across the archipelago'
      : `LEG ${state.leg + 1}/3 · ${shortName(state.islands[state.leg].name)} → ${nextIsland ? shortName(nextIsland.name) : '—'} · ${state.ringsLeft} ring${state.ringsLeft === 1 ? '' : 's'}`;
    ctx.fillText(mission, 720, 16);
    const windText = `WIND ${state.wind >= 0 ? '+' : ''}${state.wind} m/s ${state.wind >= 0 ? '→ tail' : '← head'}`;
    ctx.fillStyle = PALETTE.text;
    ctx.font = '600 12px ' + FONT;
    ctx.fillText(windText, 720, 36);
    // Lit instruments, bottom left: altimeter and speed.
    drawGauge(64, FIELD.height - 64, 46, plane.alt / 300, 'ALT', `${Math.round(plane.alt)}`);
    drawGauge(168, FIELD.height - 64, 46, plane.speed / PLANE_MAX_FOR_GAUGE, 'SPD', `${Math.round(plane.speed)}`);
  }

  const PLANE_MAX_FOR_GAUGE = 240;

  function panel(x, y, width, height) {
    ctx.fillStyle = 'rgba(16, 24, 32, 0.86)';
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
  }

  function drawTitle(state, best) {
    panel(290, 130, 700, 330);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.sunGlow;
    ctx.font = '700 54px ' + FONT;
    ctx.fillText('NUSANTARA SKIES', 640, 196);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '600 26px ' + FONT;
    ctx.fillText('Island Hopper', 640, 236);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '400 17px ' + FONT;
    ctx.fillText('Fly the little red prop plane across the islands.', 640, 282);
    ctx.fillText('Thread the golden rings, mind your fuel, and land', 640, 308);
    ctx.fillText('gently on each runway to finish the tour.', 640, 334);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '600 16px ' + FONT;
    ctx.fillText('↑ / ↓  pitch      ← / →  throttle      Space  fly      P  pause      M  mute', 640, 382);
    ctx.fillStyle = PALETTE.sunGlow;
    ctx.font = '700 20px ' + FONT;
    ctx.fillText('Press Space or click to fly', 640, 424);
    if (best > 0) {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = '600 15px ' + FONT;
      ctx.fillText(`Best score: ${best}`, 640, 448);
    }
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(10, 14, 20, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    panel(490, 290, 300, 130);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = '700 30px ' + FONT;
    ctx.fillText('Paused', 640, 336);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '400 16px ' + FONT;
    ctx.fillText('Press P or Space to keep flying', 640, 372);
  }

  function drawOver(state, best) {
    const crashed = state.status === 'crashed';
    panel(390, 220, 500, 260);
    ctx.textAlign = 'center';
    ctx.fillStyle = crashed ? PALETTE.bad : PALETTE.good;
    ctx.font = '700 40px ' + FONT;
    ctx.fillText(crashed ? 'Down in the drink!' : 'Tour complete!', 640, 282);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '400 17px ' + FONT;
    if (crashed) {
      ctx.fillText('The little red plane will fly again —', 640, 322);
      ctx.fillText('watch the fuel, the storms and the sea.', 640, 348);
    } else {
      ctx.fillText('Three islands, every ring, every runway.', 640, 322);
      ctx.fillText('The archipelago is yours, pilot.', 640, 348);
    }
    ctx.font = '700 22px ' + FONT;
    ctx.fillText(`Score ${state.score}   ·   Best ${Math.max(best, state.score)}`, 640, 396);
    ctx.fillStyle = PALETTE.sunGlow;
    ctx.font = '700 18px ' + FONT;
    ctx.fillText('Press Space to fly again', 640, 436);
  }

  function draw(state, screen, best) {
    resize();
    const time = state.elapsed;
    const plane = state.plane;
    const camX = plane.x - PLANE_SCREEN_X;
    drawSky(time);
    drawMountains(camX);
    for (const cloud of clouds) {
      const cx = worldToScreenX(cloud.x + time * cloud.speed, camX);
      if (cx < -220 || cx > FIELD.width + 220) continue;
      drawCloud(cx, altToScreenY(cloud.alt), cloud.size, 0.85);
    }
    drawSea(time, camX);
    for (const island of state.islands) drawIsland(island, camX, time);
    for (const storm of state.storms) drawStorm(storm, camX, time);
    for (const ring of state.rings) drawRing(ring, camX, time);
    drawParticles(state.particles, camX);
    drawPlane(plane, time);
    if (screen !== SCREEN_TITLE) drawHud(state, screen);
    if (screen === SCREEN_TITLE) drawTitle(state, best);
    else if (screen === SCREEN_PAUSED) drawPaused();
    else if (screen === SCREEN_OVER || screen === SCREEN_DONE) drawOver(state, best);
  }

  return { draw };
}
