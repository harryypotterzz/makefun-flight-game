// Nusantara Skies — Island Hopper: every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size. Side view: the plane flies
// left to right over a scrolling sea dotted with islands, through golden rings,
// and lands on each island's runway to finish the leg.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Sea level in world Y (the plane's altitude is measured up from here). */
export const SEA_Y = 560;

/** The plane's flight model: speeds are in km/h, altitudes in metres. */
export const PLANE = {
  /** km/h below which the wing stops lifting and the nose drops. */
  stallSpeed: 62,
  /** km/h at full throttle, level flight. */
  maxSpeed: 235,
  /** km/h the engine idles toward with no throttle. */
  idleSpeed: 55,
  /** How fast throttle moves the speed toward its target, per second. */
  accel: 40,
  /** How fast pitch changes while a pitch key is held, radians per second. */
  pitchRate: 1.15,
  /** Steepest climb / dive the pilot can hold, radians. */
  maxPitch: 0.62,
  /** Extra sink, m/s, while stalled. */
  stallSink: 30,
  /** Metres of altitude gained per second per unit of (speed - stall) at level pitch. */
  lift: 0.18,
  /** Fuel burnt per second at full throttle (100 = a full tank). */
  fuelBurn: 2.1,
  /** Fuel a ring gives back. */
  ringFuel: 14,
  /** Hull lost on a hard landing (vertical speed past the soft limit). */
  hardLandingDamage: 26,
  /** Hull lost for flying through a storm cloud. */
  stormDamage: 12,
};

/** Rings per leg, and the legs of one tour. */
export const TOUR = {
  legs: 3,
  ringsPerLeg: [3, 4, 5],
  ringScore: 100,
  landingScore: 250,
  tourScore: 500,
};

/** The legs' islands, in order: name, length of the island in metres, runway strip. */
export const ISLANDS = [
  { name: 'Pulau Merpati', length: 620, runway: 210 },
  { name: 'Pulau Kenari', length: 700, runway: 190 },
  { name: 'Pulau Cendrawasih', length: 780, runway: 170 },
  { name: 'Pulau Senja', length: 860, runway: 200 },
];

/** Metres of sea between one island's shore and the next island's shore. */
export const SEA_GAP = 1500;

/** Storm clouds per leg (they drift slowly and punish a careless pilot). */
export const STORMS_PER_LEG = [1, 2, 3];

export const PALETTE = {
  skyTop: '#2f6fb4',
  skyMid: '#7fb6dd',
  skyLow: '#f7c98b',
  sunCore: '#fff3c4',
  sunGlow: '#ffd66e',
  seaDeep: '#14608f',
  seaShallow: '#2f96b8',
  seaGlitter: '#bfe8f2',
  sand: '#e8d29a',
  grass: '#4d9a4d',
  grassDark: '#35773a',
  hill: '#2f7a44',
  mountainFar: '#6d8fb0',
  mountainNear: '#4d7396',
  palmTrunk: '#7a5230',
  palmLeaf: '#2e8b47',
  roof: '#c65a3c',
  wall: '#f2e7c9',
  runway: '#3a3f46',
  runwayLine: '#f5f0dc',
  ring: '#ffc93c',
  ringGlow: '#ffdf7e',
  planeBody: '#e8543f',
  planeWing: '#f4f1e6',
  planeTrim: '#2b4c7e',
  planeGlass: '#bfe8f2',
  panel: '#101820',
  panelEdge: '#2c3e50',
  text: '#f4f7f9',
  muted: '#aebfcc',
  good: '#7ddc8a',
  warn: '#ffc93c',
  bad: '#ff6b5e',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'nusantara-skies.best';
