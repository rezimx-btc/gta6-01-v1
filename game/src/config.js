// SOLMAR — Streets of Gold. Every tuning number, colour and place name in one place.
// The game renders a 1280x720 view over a much bigger city; no rule below depends on the
// window size, only on the world the camera moves through.

/** The logical view the renderer scales to the window. */
export const VIEW = { width: 1280, height: 720 };

/** The whole city, in world pixels. Roads run inside it; the sea borders the south. */
export const WORLD = { width: 3600, height: 2600 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Roads: wide avenues with lane paint. Vertical avenues at these x, horizontal at these y. */
export const ROADS = {
  width: 110,
  vertical: [300, 900, 1500, 2100, 2700, 3300],
  horizontal: [300, 800, 1300, 1800, 2300],
  laneDash: 26,
};

/** The five districts of Solmar, each with its own palette and flavour. */
export const DISTRICTS = [
  { name: 'The Hills', x: 0, y: 0, width: 3600, height: 300, tint: '#8fae7a', blurb: 'Mansions above the smog.' },
  { name: 'Downtown', x: 1200, y: 300, width: 1200, height: 1000, tint: '#c9b458', blurb: 'Glass towers and gold.' },
  { name: 'Old Port', x: 0, y: 300, width: 1200, height: 2000, tint: '#7a8fae', blurb: 'Cranes, crates and old debts.' },
  { name: 'Barrio Sol', x: 2400, y: 300, width: 1200, height: 2000, tint: '#d08a4e', blurb: 'Neon, music and markets.' },
  { name: 'Marina Bay', x: 0, y: 2300, width: 3600, height: 300, tint: '#4e9fb0', blurb: 'Sand, sea and fast boats.' },
];

/** Sun-soaked palette: hot light, warm tarmac, pastel blocks, blue water. */
export const PALETTE = {
  backdrop: '#10141c',
  grass: '#7fae5a',
  sand: '#e8d29a',
  water: '#2e7f9e',
  waterDeep: '#22627e',
  road: '#3a3f4a',
  roadEdge: '#565c68',
  lane: '#e8d98a',
  sidewalk: '#b8a88f',
  buildingRoof: '#8a6f5c',
  buildingEdge: '#5c4a3e',
  park: '#5d9150',
  text: '#f5efe0',
  muted: '#b9b09a',
  gold: '#f2c94c',
  red: '#e5534b',
  blue: '#4fc3f7',
  panel: '#1c2230',
  panelEdge: '#3a4356',
  minimap: '#141a26',
  minimapRoad: '#7d8390',
  minimapWater: '#2e7f9e',
  star: '#ffd94a',
  health: '#58d68d',
  healthLow: '#e5534b',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Rae Vega on foot: walk speed, health, and how long a hit leaves her untouchable. */
export const PLAYER = {
  radius: 13,
  walkSpeed: 175,
  runSpeed: 265,
  health: 100,
  invulnerable: 1.2,
  startAmmo: 24,
  maxAmmo: 120,
};

/** Car kinds: size, top speed, acceleration and how much punishment they take. */
export const CAR_KINDS = {
  sedan: { length: 52, width: 26, topSpeed: 310, accel: 330, brake: 520, health: 100, colors: ['#c94f4f', '#4f7ec9', '#c9c9c9', '#5a6b7d'] },
  taxi: { length: 52, width: 26, topSpeed: 330, accel: 350, brake: 540, health: 100, colors: ['#f2a71b'] },
  sport: { length: 54, width: 26, topSpeed: 440, accel: 470, brake: 600, health: 90, colors: ['#e5534b', '#f2c94c', '#2ecc71'] },
  truck: { length: 66, width: 30, topSpeed: 240, accel: 240, brake: 420, health: 220, colors: ['#8a6f5c', '#6b7d5a'] },
  police: { length: 54, width: 26, topSpeed: 390, accel: 430, brake: 620, health: 160, colors: ['#20242e'] },
  van: { length: 60, width: 28, topSpeed: 270, accel: 280, brake: 460, health: 180, colors: ['#7a8fae', '#c9b458'] },
};

/** Traffic: how many cars and pedestrians the city keeps near the camera. */
export const TRAFFIC = {
  cars: 26,
  parked: 14,
  peds: 34,
  carSpeed: 150,
  carSpeedJitter: 45,
  pedSpeed: 42,
  pedSpeedJitter: 18,
  despawn: 1500,
  spawn: 1150,
};

/** Wanted levels 0-5: heat thresholds, how many police hunt, and how fast heat cools. */
export const WANTED = {
  max: 5,
  thresholds: [0, 25, 60, 110, 175, 260],
  policeCars: [0, 1, 2, 3, 4, 6],
  policeFoot: [0, 0, 1, 2, 3, 4],
  heatDecay: 4.5,
  heatDecayHidden: 9,
  crimeSteal: 30,
  crimeHitPed: 45,
  crimeShoot: 35,
  crimeRam: 12,
  bustRadius: 26,
};

/** Rank ladder: money earned total unlocks the next name. */
export const RANKS = [
  { name: 'Courier', at: 0 },
  { name: 'Runner', at: 750 },
  { name: 'Fixer', at: 2000 },
  { name: 'Lieutenant', at: 4000 },
  { name: 'Boss', at: 7000 },
  { name: 'Kingpin', at: 12000 },
];

/** World speed in px/s shown as km/h on the HUD. */
export const KMH = 0.45;

/** Where the save is kept between visits (this browser only). */
export const SAVE_KEY = 'solmar-streets-of-gold.save.v1';
