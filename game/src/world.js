// The game's rules and state, with no drawing and no browser in it: the plane's
// flight model, the islands and runways, the rings, the storm clouds, fuel and
// hull, the three legs of the tour and the score. step() advances one fixed step
// and returns what happened as bit flags, so the caller can react without the
// world knowing about screens or sound. Nothing here allocates after createWorld
// returns, except the small particle pool the renderer reads.

import { FIELD, ISLANDS, PLANE, SEA_GAP, SEA_Y, STORMS_PER_LEG, TOUR } from './config.js';

export const EVENT_RING = 1;
export const EVENT_LAND = 2;
export const EVENT_CRASH = 4;
export const EVENT_OVER = 8;
export const EVENT_STORM = 16;

const KMH_TO_MS = 1 / 3.6;
/** Screen pixels per metre, horizontally and vertically. */
export const PX_PER_M = 1.0;
export const VSCALE = 1.15;
/** Screen x of the plane while flying. */
export const PLANE_SCREEN_X = 300;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function createWorld(random) {
  const plane = {
    x: 0, alt: 0, speed: 0, pitch: 0, throttle: 0,
    fuel: 100, hull: 100, onGround: true, stalled: false,
  };
  const particles = [];
  for (let index = 0; index < 120; index += 1) {
    particles.push({ active: false, x: 0, alt: 0, vx: 0, valt: 0, life: 0, kind: 0 });
  }
  const state = {
    plane, particles,
    score: 0, leg: 0, ringsLeft: 0, status: 'parked',
    elapsed: 0, wind: 0, gust: 0, best: 0,
    islands: [], rings: [], storms: [],
  };

  function buildIslands() {
    state.islands = [];
    let x = 0;
    for (let index = 0; index < ISLANDS.length; index += 1) {
      const def = ISLANDS[index];
      const runwayX = x + (def.length - def.runway) / 2;
      state.islands.push({
        name: def.name, x, length: def.length,
        runwayX, runwayLength: def.runway,
        palms: Math.floor(3 + random() * 4),
        houses: Math.floor(2 + random() * 3),
        hillSeed: random(),
      });
      x += def.length + SEA_GAP;
    }
  }

  function buildLeg(leg) {
    const from = state.islands[leg];
    const to = state.islands[leg + 1];
    const startX = from.x + from.length;
    const endX = to.runwayX + to.runwayLength / 2;
    const count = TOUR.ringsPerLeg[leg];
    state.rings = [];
    for (let index = 0; index < count; index += 1) {
      // Rings sit in the first two thirds of the crossing, low enough that the
      // glide to the runway after the last one stays gentle: the last ring
      // leaves at least ~500 m of sky to lose its altitude in.
      const t = (index + 1) / (count + 4);
      state.rings.push({
        x: startX + (endX - startX) * t + (random() - 0.5) * 120,
        alt: 70 + random() * 60,
        radius: 26,
        scored: false, passed: false,
      });
    }
    state.ringsLeft = count;
    state.storms = [];
    const stormCount = STORMS_PER_LEG[leg];
    for (let index = 0; index < stormCount; index += 1) {
      state.storms.push({
        x: startX + (random() * (endX - startX)),
        alt: 150 + random() * 90,
        radius: 55 + random() * 25,
        drift: (random() - 0.5) * 6,
        inside: false,
      });
    }
    state.wind = Math.round((random() - 0.5) * 16);
  }

  function placeOnRunway(leg) {
    const island = state.islands[leg];
    plane.x = island.runwayX + 30;
    plane.alt = 0;
    plane.speed = 0;
    plane.pitch = 0;
    plane.throttle = 0;
    plane.onGround = true;
    plane.stalled = false;
  }

  function reset() {
    buildIslands();
    plane.fuel = 100;
    plane.hull = 100;
    state.score = 0;
    state.leg = 0;
    state.status = 'parked';
    state.elapsed = 0;
    for (const particle of particles) particle.active = false;
    buildLeg(0);
    placeOnRunway(0);
  }

  function freeParticle() {
    for (let index = 0; index < particles.length; index += 1) {
      if (!particles[index].active) return particles[index];
    }
    return null;
  }

  function puff(kind) {
    const particle = freeParticle();
    if (particle === null) return;
    particle.active = true;
    particle.x = plane.x - 26;
    particle.alt = plane.alt + 2;
    particle.vx = -14 - Math.random() * 10;
    particle.valt = (Math.random() - 0.5) * 6;
    particle.life = 0.7;
    particle.kind = kind;
  }

  /** One fixed step. throttleInput and pitchInput are -1, 0 or 1. */
  function step(dt, throttleInput, pitchInput) {
    let events = 0;
    if (state.status === 'crashed' || state.status === 'done') {
      updateParticles(dt);
      return events;
    }
    state.elapsed += dt;
    state.gust = Math.sin(state.elapsed * 0.9) * 3 + Math.sin(state.elapsed * 2.3) * 1.5;

    // Throttle: the lever moves while a key is held, and stays where it is left.
    plane.throttle = clamp(plane.throttle + throttleInput * dt * 0.9, 0, 1);
    if (plane.fuel <= 0) plane.throttle = 0;

    // Speed chases the throttle's target; pitch steers the nose.
    const targetSpeed = PLANE.idleSpeed + plane.throttle * (PLANE.maxSpeed - PLANE.idleSpeed);
    const accel = plane.onGround ? PLANE.accel * 1.4 : PLANE.accel;
    plane.speed += clamp(targetSpeed - plane.speed, -accel * dt, accel * dt);
    plane.pitch += pitchInput * PLANE.pitchRate * dt;
    plane.pitch = clamp(plane.pitch, -PLANE.maxPitch, PLANE.maxPitch);
    if (pitchInput === 0) plane.pitch *= Math.max(0, 1 - 0.5 * dt);

    const speedMs = plane.speed * KMH_TO_MS;
    plane.stalled = !plane.onGround && plane.speed < PLANE.stallSpeed;
    if (plane.stalled) plane.pitch = Math.max(plane.pitch - 0.8 * dt, -0.35);

    // Vertical speed: pitch and speed lift the plane; a stall sinks it.
    let verticalSpeed = Math.sin(plane.pitch) * speedMs;
    if (!plane.onGround) {
      if (plane.stalled) verticalSpeed -= PLANE.stallSink;
      else verticalSpeed += (plane.speed - 150) * PLANE.lift * 0.2778;
    }
    // Storm turbulence shakes the plane while it is inside a cloud.
    let inStorm = false;
    for (const storm of state.storms) {
      const dx = plane.x - storm.x;
      const dy = plane.alt - storm.alt;
      const inside = dx * dx + dy * dy < storm.radius * storm.radius;
      if (inside) {
        inStorm = true;
        verticalSpeed += (random() - 0.5) * 14;
        if (!storm.inside) {
          storm.inside = true;
          plane.hull -= PLANE.stormDamage;
          events |= EVENT_STORM;
        }
      } else {
        storm.inside = false;
      }
    }
    void inStorm;

    // Move, with the wind pushing the plane along or holding it back.
    const groundSpeed = speedMs * Math.cos(plane.pitch) + state.wind + state.gust;
    plane.x += groundSpeed * dt;
    if (!plane.onGround) plane.alt += verticalSpeed * dt;

    // Fuel burns with the throttle; rings and landings give it back.
    if (!plane.onGround || plane.throttle > 0.05) {
      plane.fuel = Math.max(0, plane.fuel - PLANE.fuelBurn * plane.throttle * dt);
    }

    // Liftoff: fast enough, nose up, and past the runway's end or not — the wing decides.
    // The speed bar is well above the stall so the plane climbs away instead of sinking.
    if (plane.onGround && plane.speed > 100 && plane.pitch > 0.06) {
      plane.onGround = false;
      plane.alt = 0.5;
      state.status = 'flying';
    }

    // Rings: fly through the middle and the ring is yours.
    for (const ring of state.rings) {
      if (ring.scored || ring.passed) continue;
      const dx = plane.x - ring.x;
      const dy = plane.alt - ring.alt;
      if (dx * dx + dy * dy < ring.radius * ring.radius) {
        ring.scored = true;
        state.ringsLeft -= 1;
        state.score += TOUR.ringScore;
        plane.fuel = Math.min(100, plane.fuel + PLANE.ringFuel);
        events |= EVENT_RING;
      } else if (plane.x > ring.x + ring.radius) {
        ring.passed = true;
        state.ringsLeft -= 1;
      }
    }

    // Storms drift with the wind.
    for (const storm of state.storms) storm.x += storm.drift * dt;

    // Exhaust puffs, and smoke when the hull is hurting.
    if (plane.throttle > 0.4 && !plane.onGround && Math.random() < 0.5) puff(0);
    if (plane.hull < 50 && Math.random() < 0.3) puff(1);

    // The ground: a runway landing, a hard landing, or a crash.
    if (!plane.onGround && plane.alt <= 0) {
      const targetIsland = state.islands[state.leg + 1];
      const onTargetRunway = targetIsland !== undefined
        && plane.x >= targetIsland.runwayX
        && plane.x <= targetIsland.runwayX + targetIsland.runwayLength;
      if (onTargetRunway && verticalSpeed > -9 && plane.speed < 195) {
        plane.alt = 0;
        plane.onGround = true;
        plane.pitch = 0;
        state.score += TOUR.landingScore + Math.round(plane.fuel);
        plane.fuel = 100;
        events |= EVENT_LAND;
        if (state.leg >= TOUR.legs - 1) {
          state.score += TOUR.tourScore;
          state.status = 'done';
          events |= EVENT_OVER;
        } else {
          state.leg += 1;
          buildLeg(state.leg);
          placeOnRunway(state.leg);
          state.status = 'parked';
        }
      } else if (onTargetRunway) {
        // Too fast or too steep for the strip: a hard landing.
        plane.hull -= PLANE.hardLandingDamage;
        plane.alt = 4;
        plane.speed *= 0.6;
        if (plane.hull <= 0) {
          crash();
          events |= EVENT_CRASH | EVENT_OVER;
        }
      } else {
        crash();
        events |= EVENT_CRASH | EVENT_OVER;
      }
    }

    if (plane.hull <= 0 && state.status !== 'crashed' && state.status !== 'done') {
      crash();
      events |= EVENT_CRASH | EVENT_OVER;
    }

    updateParticles(dt);
    return events;
  }

  function crash() {
    state.status = 'crashed';
    plane.alt = Math.max(0, plane.alt);
    for (let index = 0; index < 14; index += 1) {
      const particle = freeParticle();
      if (particle === null) break;
      particle.active = true;
      particle.x = plane.x + (Math.random() - 0.5) * 30;
      particle.alt = Math.max(1, plane.alt + Math.random() * 8);
      particle.vx = (Math.random() - 0.5) * 40;
      particle.valt = 10 + Math.random() * 30;
      particle.life = 0.9;
      particle.kind = plane.alt <= 1 ? 2 : 1;
    }
  }

  function updateParticles(dt) {
    for (const particle of particles) {
      if (!particle.active) continue;
      particle.life -= dt;
      if (particle.life <= 0) {
        particle.active = false;
        continue;
      }
      particle.x += particle.vx * dt;
      particle.alt += particle.valt * dt;
      particle.valt -= 12 * dt;
    }
  }

  reset();
  return { state, reset, step };
}
