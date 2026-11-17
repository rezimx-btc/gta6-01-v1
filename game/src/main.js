// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps, and the renderer paints what is there. The game moves between five screens —
// title, play, paused, busted and game over — and the title screen runs the living city
// behind it.
//
// ?seed=N fixes the city and the traffic. ?shot=chase|drive|mission|start (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { RANKS, STEP } from './config.js';
import { createRandom } from './random.js';
import { buildCity } from './city.js';
import { createPlayer, damagePlayer, drivePlayerCar, enterCar, exitCar, nearestStealableCar, playerKmh, resetPlayer, walkPlayer } from './player.js';
import { createTraffic, makePed, scatterPeds, updateTraffic } from './traffic.js';
import { addHeat, clearPolice, createPolice, updatePolice } from './police.js';
import { shootPlayer, updateCombat } from './combat.js';
import { createMissions, rankOf, updateMissions } from './missions.js';
import { applySave, clearSave, loadGame, saveGame } from './save.js';
import { createAudio, playCash, playCrash, playShot, setEngine, setMuted, setSiren, startAudio } from './audio.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_PAUSE, ACTION_SHOOT, createInput } from './input.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;
const AUTOSAVE_SECONDS = 20;

/** The whole game, built from a seed: city, player, traffic, law, jobs and sound. */
export function createGame(seed) {
  const random = createRandom(seed);
  const city = buildCity(random);
  const player = createPlayer();
  const traffic = createTraffic(city, random);
  return {
    random,
    city,
    player,
    cars: traffic.cars,
    peds: traffic.peds,
    police: createPolice(),
    bullets: [],
    enemies: [],
    pickups: [],
    missions: createMissions(),
    audio: createAudio(),
    time: 0,
    camera: { x: player.x, y: player.y },
    stats: { missionsDone: 0, taxisDone: 0, deliveriesDone: 0, kills: 0, shotsFired: 0, carsStolen: 0 },
    saveSummary: null,
  };
}

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const state = createGame(seed);
const renderer = createRenderer(canvas);

/** The rank a saved amount of earnings buys, for the title screen's welcome back. */
function rankNameFor(earned) {
  let rank = RANKS[0].name;
  for (let i = 0; i < RANKS.length; i += 1) {
    if (earned >= RANKS[i].at) rank = RANKS[i].name;
  }
  return rank;
}

/** One fixed step of the living city behind the title screen: traffic and the camera drift. */
function stepAttract(state, dt) {
  state.time += dt;
  updateTraffic(state, dt);
  const t = state.time * 0.05;
  state.camera.x = 1500 + Math.cos(t) * 420;
  state.camera.y = 1300 + Math.sin(t) * 320;
}

/** Cars running over pedestrians: only Rae's car makes it a crime. Traffic cars just make
 * the walker jump aside — the law does not bill her for what strangers do.
 */
function checkPedHits(state) {
  for (let p = state.peds.length - 1; p >= 0; p -= 1) {
    const ped = state.peds[p];
    for (let c = 0; c < state.cars.length; c += 1) {
      const car = state.cars[c];
      if (car.wrecked || Math.abs(car.speed) < 80) continue;
      if (Math.hypot(car.x - ped.x, car.y - ped.y) < 24) {
        if (car.driver === 'player') {
          addHeat(state, 45);
          playCrash(state.audio);
          scatterPeds(state, ped.x, ped.y, 200);
          state.peds.splice(p, 1);
          const spot = { x: state.camera.x + 700, y: state.camera.y };
          state.peds.push(makePed(state.random, spot.x, spot.y));
        } else {
          ped.state = 'flee';
          ped.angle = Math.atan2(ped.y - car.y, ped.x - car.x);
          ped.wait = 1.5;
        }
        break;
      }
    }
  }
}

/** A moving car clipping Rae on foot: she is hurt and knocked aside. */
function checkPlayerCarHits(state) {
  const player = state.player;
  if (!player.onFoot || player.invuln > 0) return;
  for (let c = 0; c < state.cars.length; c += 1) {
    const car = state.cars[c];
    if (car.wrecked || car.driver === 'player' || Math.abs(car.speed) < 60) continue;
    if (Math.hypot(car.x - player.x, car.y - player.y) < 26) {
      if (damagePlayer(state, 18)) {
        player.x += Math.sign(player.x - car.x) * 30;
        player.y += Math.sign(player.y - car.y) * 30;
        playCrash(state.audio);
      }
      break;
    }
  }
}

/** One fixed step of play: drive or walk, shoot, steal, run the jobs and the law. */
function stepPlay(state, dt, input) {
  const player = state.player;
  state.time += dt;
  if (player.invuln > 0) player.invuln = Math.max(0, player.invuln - dt);

  if (player.onFoot) walkPlayer(state, dt, input);
  else drivePlayerCar(state, dt, input);

  updateTraffic(state, dt);
  updatePolice(state, dt);
  updateCombat(state, dt);
  updateMissions(state, dt);
  checkPedHits(state);
  checkPlayerCarHits(state);

  // The camera follows Rae, easing after her instead of snapping.
  const k = Math.min(1, dt * 6);
  state.camera.x += (player.x - state.camera.x) * k;
  state.camera.y += (player.y - state.camera.y) * k;

  // Sound follows the world: engine by speed, siren by stars.
  setEngine(state.audio, player.car !== null ? player.speed : 0);
  setSiren(state.audio, player.wanted > 0);
}

/** A fresh story in the same city: new player, new traffic, no heat, no jobs. */
function resetGame(state) {
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
  state.stats = { missionsDone: 0, taxisDone: 0, deliveriesDone: 0, kills: 0, shotsFired: 0, carsStolen: 0 };
}

function runShot(name) {
  const scene = stageShot(name, state);
  let painted = 0;
  function paint() {
    renderer.draw(state, scene.screen);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let saveTimer = 0;

  const saved = loadGame();
  if (saved !== null) {
    state.saveSummary = { rank: rankNameFor(saved.earned), cash: saved.cash };
  }

  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyM' && !event.repeat) {
      setMuted(state.audio, !state.audio.muted);
    }
  });

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    startAudio(state.audio);
    resetGame(state);
    if (saved !== null) applySave(state, saved);
    saveTimer = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Rae Vega, Courier of Solmar. Reach the marker for your first job.');
  }

  function recoverFromBust() {
    const player = state.player;
    player.cash = Math.floor(player.cash / 2);
    player.heat = 0;
    player.wanted = 0;
    player.health = 50;
    player.busted = false;
    clearPolice(state);
    saveGame(state);
    screen = SCREEN_PLAY;
    announce('Back on the street. Half the cash gone, all the heat gone.');
  }

  function restartAfterDeath() {
    clearSave();
    resetGame(state);
    state.saveSummary = null;
    screen = SCREEN_PLAY;
    announce('A new story. Rae Vega, Courier of Solmar.');
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM) {
      startAudio(state.audio);
      if (screen === SCREEN_TITLE) startGame();
      else if (screen === SCREEN_BUSTED) recoverFromBust();
      else if (screen === SCREEN_OVER) restartAfterDeath();
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        saveGame(state);
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    if (screen === SCREEN_PLAY && (actions & ACTION_ENTER)) {
      const player = state.player;
      if (player.onFoot) {
        const car = nearestStealableCar(state);
        if (car !== null) {
          enterCar(state, car);
          addHeat(state, 30);
          state.stats.carsStolen += 1;
          announce(`Stole a ${car.kind}. The law noticed.`);
        }
      } else {
        exitCar(state);
      }
    }
    return actions;
  }

  function handleShooting() {
    if (screen !== SCREEN_PLAY) return;
    const player = state.player;
    if (player.dead || player.busted) return;
    const pointer = input.pointer();
    const rect = canvas.getBoundingClientRect();
    const aim = Math.atan2(pointer.y - rect.height / 2, pointer.x - rect.width / 2);
    if (input.shooting()) {
      if (shootPlayer(state, aim)) playShot(state.audio);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    if (screen === SCREEN_TITLE) {
      while (accumulator >= STEP) {
        stepAttract(state, STEP);
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_PLAY) {
      handleShooting();
      if (actions & ACTION_SHOOT) {
        if (shootPlayer(state, state.player.angle)) playShot(state.audio);
      }
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        stepPlay(state, STEP, input);
        accumulator -= STEP;
        if (state.player.dead) {
          screen = SCREEN_OVER;
          announce('Flatlined. Press Space to start over.');
          break;
        }
        if (state.player.busted) {
          screen = SCREEN_BUSTED;
          announce('Busted. Press Space to walk free.');
          break;
        }
      }
      saveTimer += 1 / 60;
      if (saveTimer > AUTOSAVE_SECONDS) {
        saveTimer = 0;
        saveGame(state);
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(state, screen);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      saveGame(state);
      announce('Paused.');
    }
  });

  announce('Solmar, Streets of Gold. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();


