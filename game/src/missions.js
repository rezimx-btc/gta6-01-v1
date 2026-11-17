// Missions and side work: six jobs in three acts, from courier to kingpin, plus the taxi
// fares and package runs that pay the rent between them. Each mission is a short list of
// steps — go here, pick this up, lose those men, survive the heat — and each step puts one
// marker on the map and one line on the HUD.

import { RANKS } from './config.js';
import { randomRoadPoint } from './city.js';
import { makeCar } from './traffic.js';
import { spawnEnemies, spawnPickup } from './combat.js';
import { addHeat } from './police.js';

/** The story: six jobs, three acts, one rise through Solmar. */
export const MISSIONS = [
  {
    act: 1, name: 'First Delivery', giver: 'Mama Luz', payout: 300,
    brief: 'A package for the marina. No questions, no stops, no cops.',
    steps: [
      { type: 'goto', x: 300, y: 1300, label: 'Pick up the package — Old Port depot' },
      { type: 'dropoff', x: 2700, y: 2300, label: 'Deliver the package — Marina Bay' },
    ],
  },
  {
    act: 1, name: 'Cab Fare', giver: 'Mama Luz', payout: 450,
    brief: 'Three fares across town. A cab pays double — borrow one.',
    steps: [
      { type: 'fare', x: 900, y: 800, label: 'Fare 1: pick up at Downtown' },
      { type: 'fare', x: 2100, y: 1300, label: 'Fare 1: drop off at Barrio Sol' },
      { type: 'fare', x: 1500, y: 1800, label: 'Fare 2: pick up at the market' },
      { type: 'fare', x: 300, y: 300, label: 'Fare 2: drop off at The Hills' },
      { type: 'fare', x: 2700, y: 800, label: 'Fare 3: pick up at Barrio Sol' },
      { type: 'fare', x: 1500, y: 2300, label: 'Fare 3: drop off at Marina Bay' },
    ],
  },
  {
    act: 2, name: 'The Exchange', giver: 'Dario', payout: 1200,
    brief: 'The Port crew wants the money and the merchandise. Give them neither.',
    steps: [
      { type: 'goto', x: 600, y: 1500, label: 'Meet the crew — Old Port docks' },
      { type: 'kill', x: 600, y: 1500, count: 4, label: 'Deal with the crew — 4 left' },
      { type: 'goto', x: 1500, y: 2300, label: 'Walk away clean — Marina Bay' },
    ],
  },
  {
    act: 2, name: 'Lose the Heat', giver: 'Dario', payout: 800,
    brief: 'Three stars and the whole city watching. Stay free for 54 seconds.',
    steps: [
      { type: 'survive', seconds: 54, wanted: 3, label: 'Lose the heat — survive 54 seconds' },
      { type: 'goto', x: 900, y: 300, label: 'Reach the safehouse — The Hills' },
    ],
  },
  {
    act: 3, name: 'Convoy Hit', giver: 'The Broker', payout: 2000,
    brief: 'Three vans, one shipment, no witnesses. Wreck them all.',
    steps: [
      { type: 'ram', count: 3, label: 'Wreck the convoy vans — 3 left' },
      { type: 'goto', x: 2100, y: 1800, label: 'Lay low — Barrio Sol' },
    ],
  },
  {
    act: 3, name: 'The Gold Run', giver: 'The Broker', payout: 5000,
    brief: 'Gold from the Hills to the marina. Five stars the whole way. Do not stop.',
    steps: [
      { type: 'goto', x: 1500, y: 300, label: 'Collect the gold — The Hills' },
      { type: 'dropoff', x: 3300, y: 2300, label: 'Deliver the gold — Marina Bay', timer: 120, wanted: 5 },
    ],
  },
];

/** A fresh mission book: nothing started, the first job waiting at the depot. */
export function createMissions() {
  return {
    index: 0,
    phase: 'idle',
    step: 0,
    timer: 0,
    banner: '',
    bannerT: 0,
    carrying: false,
    taxi: { active: false, phase: 'pickup', x: 0, y: 0, fare: 0, timer: 0 },
    delivery: { active: false, phase: 'pickup', x: 0, y: 0, pay: 0, timer: 0 },
    storyDone: false,
  };
}

/** The marker the HUD and the minimap point at right now, or null. */
export function currentMarker(state) {
  const m = state.missions;
  if (m.phase !== 'active') return null;
  const def = MISSIONS[m.index];
  if (!def) return null;
  const step = def.steps[m.step];
  if (!step) return null;
  if (step.type === 'survive') return null;
  return { x: step.x, y: step.y, label: step.label };
}

/** The objective line the HUD shows right now. */
export function currentObjective(state) {
  const m = state.missions;
  if (m.phase === 'idle') {
    if (m.delivery.active) return m.delivery.phase === 'pickup' ? 'Package run — collect the box' : 'Package run — deliver to Marina Bay';
    if (m.taxi.active) return m.taxi.phase === 'pickup' ? 'Taxi job — pick up the fare' : 'Taxi job — drop off the fare';
    if (m.index >= MISSIONS.length) return 'Story complete — Solmar is yours.';
    return `Next job: ${MISSIONS[m.index].name} — go to the marker`;
  }
  const def = MISSIONS[m.index];
  if (!def) return 'Story complete — Solmar is yours.';
  const step = def.steps[m.step];
  if (!step) return def.brief;
  if (step.type === 'kill') return `Deal with the crew — ${state.enemies.length} left`;
  if (step.type === 'ram') return `Wreck the convoy vans — ${convoyLeft(state)} left`;
  if (step.type === 'survive') return `Lose the heat — survive ${Math.ceil(m.timer)} seconds`;
  return step.label;
}

/** How many convoy vans are still rolling. */
export function convoyLeft(state) {
  let n = 0;
  for (let i = 0; i < state.cars.length; i += 1) {
    if (state.cars[i].convoy && !state.cars[i].wrecked) n += 1;
  }
  return n;
}

/** Start the next mission: set its first step up, and stage whatever it needs. */
export function startMission(state, index) {
  const m = state.missions;
  const def = MISSIONS[index];
  if (!def) return;
  m.index = index;
  m.phase = 'active';
  m.step = 0;
  m.timer = 0;
  m.carrying = false;
  m.banner = `Job: ${def.name} — ${def.giver}`;
  m.bannerT = 3.5;
  enterStep(state);
}

/** Stage the current step: spawn its enemies, vans or heat. */
function enterStep(state) {
  const m = state.missions;
  const def = MISSIONS[m.index];
  const step = def.steps[m.step];
  if (!step) return;
  if (step.type === 'kill') {
    spawnEnemies(state, step.x, step.y, step.count);
  } else if (step.type === 'survive') {
    m.timer = step.seconds;
    addHeat(state, 115);
  } else if (step.type === 'ram') {
    for (let i = 0; i < step.count; i += 1) {
      const spot = randomRoadPoint(state.random);
      const van = makeCar('van', spot.x, spot.y, spot.angle, 'traffic', state.random);
      van.convoy = true;
      van.health = 500;
      van.cruise = 190;
      state.cars.push(van);
    }
  } else if (step.type === 'dropoff' && step.wanted) {
    addHeat(state, 265);
    m.timer = step.timer;
  }
}

/** Advance one step, or finish the mission when the list runs out. */
function advanceStep(state) {
  const m = state.missions;
  const def = MISSIONS[m.index];
  m.step += 1;
  if (m.step >= def.steps.length) {
    finishMission(state);
    return;
  }
  enterStep(state);
}

/** Pay out, celebrate, and open the next job. */
function finishMission(state) {
  const m = state.missions;
  const def = MISSIONS[m.index];
  const player = state.player;
  let pay = def.payout;
  if (player.car !== null && player.car.kind === 'taxi') pay = Math.round(pay * 1.25);
  player.cash += pay;
  player.earned += pay;
  state.stats.missionsDone += 1;
  m.banner = `Job done: ${def.name} +$${pay}`;
  m.bannerT = 4;
  m.phase = 'idle';
  m.index += 1;
  m.carrying = false;
  spawnPickup(state, player.x + 30, player.y, 'health', 40);
  if (m.index >= MISSIONS.length) {
    m.storyDone = true;
    m.banner = 'KINGPIN — Solmar is yours. Story complete.';
    m.bannerT = 6;
  }
}

/** Rae's rank, from everything she has ever earned. */
export function rankOf(state) {
  let rank = RANKS[0].name;
  for (let i = 0; i < RANKS.length; i += 1) {
    if (state.player.earned >= RANKS[i].at) rank = RANKS[i].name;
  }
  return rank;
}

/** One step of the mission book and the side jobs. */
export function updateMissions(state, dt) {
  const m = state.missions;
  const player = state.player;
  if (m.bannerT > 0) m.bannerT -= dt;

  if (m.phase === 'active') {
    const def = MISSIONS[m.index];
    const step = def.steps[m.step];
    if (step) {
      if (step.type === 'goto' || step.type === 'dropoff' || step.type === 'fare') {
        if (Math.hypot(player.x - step.x, player.y - step.y) < 70) {
          if (step.type === 'goto' && m.step === 0 && def.steps[1] && def.steps[1].type === 'dropoff') m.carrying = true;
          if (step.type === 'dropoff' && step.timer) {
            // The Gold Run pays on delivery, but the clock never stops ticking.
          }
          advanceStep(state);
        }
        if (step.type === 'dropoff' && step.timer) {
          m.timer -= dt;
          if (m.timer <= 0) {
            m.banner = 'Too slow — the gold went cold. Job failed.';
            m.bannerT = 4;
            m.phase = 'idle';
            m.carrying = false;
          }
        }
      } else if (step.type === 'kill') {
        if (state.enemies.length === 0) advanceStep(state);
      } else if (step.type === 'survive') {
        m.timer -= dt;
        if (player.wanted < step.wanted) addHeat(state, 30 * dt);
        if (m.timer <= 0) advanceStep(state);
      } else if (step.type === 'ram') {
        if (convoyLeft(state) === 0) advanceStep(state);
      }
    }
  } else if (m.phase === 'idle' && !m.storyDone) {
    // The next job starts at its first marker: walk or drive into it.
    const def = MISSIONS[m.index];
    if (def) {
      const first = def.steps[0];
      if (first && first.x !== undefined && Math.hypot(player.x - first.x, player.y - first.y) < 80) {
        startMission(state, m.index);
      }
    }
  }

  updateTaxiJob(state, dt);
  updateDeliveryJob(state, dt);
}

/** A taxi fare: flag a cab down by driving one, or take the stand in Downtown. */
function updateTaxiJob(state, dt) {
  const m = state.missions;
  const player = state.player;
  const job = m.taxi;
  if (!job.active) {
    const inTaxi = player.car !== null && player.car.kind === 'taxi';
    const atStand = Math.hypot(player.x - 1500, player.y - 800) < 80;
    if (inTaxi || atStand) {
      const spot = randomRoadPoint(state.random);
      job.active = true;
      job.phase = 'pickup';
      job.x = spot.x;
      job.y = spot.y;
      job.fare = 60 + Math.floor(state.random() * 90);
      job.timer = 75;
      m.banner = 'Taxi job — pick up the fare';
      m.bannerT = 3;
    }
    return;
  }
  job.timer -= dt;
  if (job.timer <= 0) {
    job.active = false;
    m.banner = 'Fare cancelled — too slow.';
    m.bannerT = 3;
    return;
  }
  if (Math.hypot(player.x - job.x, player.y - job.y) < 70) {
    if (job.phase === 'pickup') {
      const spot = randomRoadPoint(state.random);
      job.phase = 'dropoff';
      job.x = spot.x;
      job.y = spot.y;
      job.timer = 75;
    } else {
      const pay = player.car !== null && player.car.kind === 'taxi' ? job.fare * 2 : job.fare;
      player.cash += pay;
      player.earned += pay;
      state.stats.taxisDone += 1;
      job.active = false;
      m.banner = `Fare paid +$${pay}`;
      m.bannerT = 3;
    }
  }
}

/** A package run: the depot at Old Port always has one more box. */
function updateDeliveryJob(state, dt) {
  const m = state.missions;
  const player = state.player;
  const job = m.delivery;
  if (!job.active) {
    if (Math.hypot(player.x - 300, player.y - 1300) < 80) {
      const spot = randomRoadPoint(state.random);
      job.active = true;
      job.phase = 'pickup';
      job.x = spot.x;
      job.y = spot.y;
      job.pay = 120;
      job.timer = 90;
      m.banner = 'Package run — collect the box';
      m.bannerT = 3;
    }
    return;
  }
  job.timer -= dt;
  if (job.timer <= 0) {
    job.active = false;
    m.banner = 'Package run expired.';
    m.bannerT = 3;
    return;
  }
  if (Math.hypot(player.x - job.x, player.y - job.y) < 70) {
    if (job.phase === 'pickup') {
      const spot = randomRoadPoint(state.random);
      job.phase = 'dropoff';
      job.x = spot.x;
      job.y = spot.y;
      job.timer = 90;
    } else {
      player.cash += job.pay;
      player.earned += job.pay;
      state.stats.deliveriesDone += 1;
      job.active = false;
      m.banner = `Package delivered +$${job.pay}`;
      m.bannerT = 3;
    }
  }
}
