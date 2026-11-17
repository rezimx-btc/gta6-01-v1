// The screenshot scenes behind ?shot=chase|drive|mission|start. Each one plays the real
// rules forward from a fresh world for a few seconds, steered by a scripted driver, so the
// frame is what a short game really looks like — and the same seed always gives the same
// frame. The cover (chase) shows the most systems at once: a pursuit, three wanted stars,
// the minimap and a mission objective on the HUD.

import { STEP } from './config.js';
import { createPlayer, drivePlayerCar, enterCar } from './player.js';
import { createTraffic, makeCar, updateTraffic } from './traffic.js';
import { createPolice, updatePolice } from './police.js';
import { spawnEnemies, updateCombat } from './combat.js';
import { createMissions } from './missions.js';

/** The fake hands on the wheel for a staged drive: full throttle, straight ahead. */
const STRAIGHT = {
  throttle() { return 1; },
  steer() { return 0; },
  running() { return false; },
};

/** A fresh world for a scene: new player, new traffic, no cops, no bullets, no jobs. */
function resetState(state) {
  state.player = createPlayer();
  const traffic = createTraffic(state.city, state.random);
  state.cars = traffic.cars;
  state.peds = traffic.peds;
  state.police = createPolice();
  state.bullets = [];
  state.enemies = [];
  state.pickups = [];
  state.missions = createMissions();
  state.time = 0;
  state.camera = { x: state.player.x, y: state.player.y };
}

/** Run the real rules forward, with the staged driver at the wheel. */
function runSteps(state, seconds, drive) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (drive && state.player.car !== null) drivePlayerCar(state, STEP, drive);
    updateWorld(state, STEP);
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
    state.time += STEP;
  }
}

/** The world without the player: traffic, the law and combat, one step. */
function updateWorld(state, dt) {
  updateTraffic(state, dt);
  updatePolice(state, dt);
  updateCombat(state, dt);
}

/** Give every car in the scene 500 health, so the staging drive cannot wreck it. */
function toughenCars(state) {
  for (let i = 0; i < state.cars.length; i += 1) state.cars[i].health = 500;
}

/** Clear the traffic out of a rectangle, so a staged scene starts on an open road. */
function clearTrafficRect(state, x0, y0, x1, y1) {
  state.cars = state.cars.filter((car) => {
    if (car.driver !== 'traffic' && car.driver !== 'parked') return true;
    return car.x < x0 || car.x > x1 || car.y < y0 || car.y > y1;
  });
}

/**
 * The cover: a police chase down a Downtown avenue. Rae in a sport car at ~152 km/h, two
 * patrol cars on her tail, three wanted stars, and the mission clock on the HUD.
 */
function stageChase(state) {
  resetState(state);
  clearTrafficRect(state, 1300, 1000, 1700, 2150);
  const car = makeCar('sport', 1500, 1850, -Math.PI / 2, 'traffic', state.random);
  state.cars.push(car);
  enterCar(state, car);
  car.speed = 330;
  state.player.wanted = 3;
  state.player.heat = 115;
  const cop1 = makeCar('police', 1470, 2010, -Math.PI / 2, 'police', state.random);
  const cop2 = makeCar('police', 1530, 2080, -Math.PI / 2, 'police', state.random);
  cop1.speed = 300;
  cop2.speed = 290;
  state.cars.push(cop1, cop2);
  state.missions.index = 3;
  state.missions.phase = 'active';
  state.missions.step = 0;
  state.missions.timer = 54;
  toughenCars(state);
  runSteps(state, 2.2, STRAIGHT);
  if (state.player.car !== null) {
    state.player.car.speed = 338;
    state.player.speed = 338;
  }
  state.camera.x = state.player.x;
  state.camera.y = state.player.y;
  return { screen: 'play' };
}

/**
 * The taxi run: an orange cab delivering a package down the Marina Bay beachfront, two
 * stars, traffic ahead, the beach and the sea at the bottom of the frame.
 */
function stageDrive(state) {
  resetState(state);
  clearTrafficRect(state, 1850, 2200, 2950, 2400);
  const cab = makeCar('taxi', 1900, 2300, 0, 'traffic', state.random);
  state.cars.push(cab);
  enterCar(state, cab);
  cab.speed = 170;
  state.player.wanted = 2;
  state.player.heat = 65;
  state.missions.delivery = { active: true, phase: 'dropoff', x: 2750, y: 2300, pay: 120, timer: 60 };
  toughenCars(state);
  runSteps(state, 1.5, STRAIGHT);
  if (state.player.car !== null) {
    state.player.car.speed = 170;
    state.player.speed = 170;
  }
  state.camera.x = state.player.x;
  state.camera.y = state.player.y + 40;
  return { screen: 'play' };
}

/**
 * The firefight: Rae on foot at the Old Port docks, rivals closing in, shots in the air,
 * and the banner of a job just done — The Exchange, +$1200.
 */
function stageMission(state) {
  resetState(state);
  const player = state.player;
  player.x = 600;
  player.y = 1500;
  player.angle = Math.PI / 4;
  player.ammo = 18;
  player.health = 78;
  player.wanted = 2;
  player.heat = 65;
  spawnEnemies(state, 700, 1440, 3);
  state.pickups.push({ x: 560, y: 1560, kind: 'health', amount: 40, t: 0 });
  state.missions.index = 3;
  state.missions.phase = 'idle';
  state.missions.banner = 'Job done: The Exchange +$1200';
  state.missions.bannerT = 4;
  toughenCars(state);
  runSteps(state, 0.3, null);
  // Bullets go in last, so they are still mid-flight when the frame is taken.
  state.bullets.push(
    { x: 640, y: 1480, vx: 500, vy: -300, life: 0.8, from: 'player', damage: 34 },
    { x: 680, y: 1460, vx: -420, vy: 380, life: 0.8, from: 'enemy', damage: 12 },
  );
  state.camera.x = player.x + 60;
  state.camera.y = player.y;
  return { screen: 'play' };
}

/** The title screen: the living city, traffic rolling, the camera drifting over Downtown. */
function stageStart(state) {
  resetState(state);
  state.camera.x = 1500;
  state.camera.y = 1300;
  runSteps(state, 5, null);
  state.camera.x = 1500;
  state.camera.y = 1300;
  return { screen: 'title' };
}

/**
 * Set `state` to the named scene (chase, drive, mission or start; any other name is start)
 * and return the screen to draw over it.
 */
export function stageShot(name, state) {
  if (name === 'chase') return stageChase(state);
  if (name === 'drive') return stageDrive(state);
  if (name === 'mission') return stageMission(state);
  return stageStart(state);
}
