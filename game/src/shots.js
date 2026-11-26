// The screenshot scenes behind ?shot=start|play|rings|land. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a simple
// autopilot (throttle to hold a cruise speed, pitch toward the next ring or the
// runway's glide slope, flare for touchdown), so the frame is what a short game
// really looks like and the same seed always gives the same frame.
import { STEP } from './config.js';
import { EVENT_RING } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const RINGS_SECONDS = 60;
const LAND_LIMIT_SECONDS = 180;

/** The autopilot's target speed in km/h, slower on final approach. */
const CRUISE_SPEED = 168;
const FINAL_SPEED = 125;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** Throttle and pitch for one step: fly at `target.alt` and `target.speed`. */
function autopilot(state, target) {
  const plane = state.plane;
  const isFinal = target.isFinal;
  // On the runway: full throttle, nose level until there is speed to lift with.
  if (plane.onGround) {
    return { throttle: 1, pitch: plane.speed > 115 ? 1 : 0 };
  }
  // Too slow to climb: level the nose and pour on throttle instead of sinking.
  if (plane.speed < 115) {
    const pitch = plane.pitch > 0.05 ? -1 : 0;
    return { throttle: 1, pitch };
  }
  const speedError = target.speed - plane.speed;
  const throttle = speedError > 6 ? 1 : speedError < -6 ? -1 : 0;
  // On final, fly a vertical speed, not a glide line: sink at the glide path's
  // rate, faster while above it, then flare to a gentle touchdown as the
  // runway gets close. A fixed sink rate cannot follow a path, and a path
  // alone leaves the plane high over the runway.
  let wantedPitch;
  if (isFinal) {
    const speedMs = plane.speed / 3.6;
    const liftTerm = (plane.speed - 150) * 0.18 * (1 / 3.6);
    const groundSpeed = speedMs * Math.cos(plane.pitch) + state.wind + state.gust;
    const distAhead = Math.max(0, target.dist);
    const flare = distAhead < 120 ? 0.5 + 0.5 * (distAhead / 120) : 1;
    const pathSink = Math.max(0, groundSpeed) * 0.16 * flare;
    const error = plane.alt - target.alt;
    // Close to the ground, commit: sink steadily onto the strip instead of
    // floating past it on a flare that never quite touches down.
    const desiredVspeed = plane.alt < 8 ? -3.5 : clamp(-pathSink - error * 0.18, -8.0, 2.5);
    const sinPitch = clamp((desiredVspeed - liftTerm) / speedMs, -0.45, 0.45);
    wantedPitch = Math.asin(sinPitch);
  } else {
    const altError = target.alt - plane.alt;
    wantedPitch = clamp(altError * 0.007, -0.32, 0.42);
  }
  const pitchError = wantedPitch - plane.pitch;
  // The deadband must stay tiny: the world auto-levels the nose whenever there
  // is no pitch input, so a wide deadband lets the pitch decay back to level
  // and the plane never holds the dive it was asked for.
  const pitch = pitchError > 0.005 ? 1 : pitchError < -0.005 ? -1 : 0;
  return { throttle, pitch };
}

function nextTarget(state) {
  const plane = state.plane;
  for (const ring of state.rings) {
    if (!ring.scored && !ring.passed) return { alt: ring.alt, speed: CRUISE_SPEED, isFinal: false };
  }
  // All rings done: glide to the next runway. Slow to approach speed for the
  // whole final, or the wing's lift at cruise speed will not let the plane down.
  // The target is a 16% glide path to the runway's centre, which the autopilot
  // tracks by vertical speed (see autopilot): a fixed sink rate cannot follow
  // a path, and a path alone leaves the plane high over the runway.
  const island = state.islands[state.leg + 1];
  if (island === undefined) return { alt: 120, speed: CRUISE_SPEED, isFinal: false, dist: 0 };
  const centre = island.runwayX + island.runwayLength / 2;
  const distance = centre - plane.x;
  const glideAlt = clamp(distance * 0.16, 0, 190);
  return { alt: glideAlt, speed: FINAL_SPEED, isFinal: true, dist: distance };
}

/**
 * Set `world` to the named scene (start, play, rings or land; any other name is
 * start) and return the screen to draw over it and the score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'rings' && name !== 'land') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) world.step(STEP, 0, 0);
    return { screen: SCREEN_TITLE, score: 0 };
  }
  const limit = name === 'land' ? LAND_LIMIT_SECONDS : name === 'rings' ? RINGS_SECONDS : PLAY_SECONDS;
  let ringsScored = 0;
  for (let index = 0; index < limit / STEP; index += 1) {
    const target = nextTarget(world.state);
    const control = autopilot(world.state, target);
    const events = world.step(STEP, control.throttle, control.pitch);
    if (events & EVENT_RING) ringsScored += 1;
    if (name === 'rings' && ringsScored >= 2) break;
    if (name === 'land' && world.state.status === 'parked' && world.state.leg >= 1) break;
    if (world.state.status === 'crashed' || world.state.status === 'done') break;
  }
  const over = world.state.status === 'crashed' || world.state.status === 'done';
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, score: world.state.score };
}
