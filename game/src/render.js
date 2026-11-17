// Drawing only: the city, the cars, Rae, the cops, the HUD and the screens — pixels out.
// The 1280x720 view is scaled to the window and centred; the camera follows Rae through
// the world. Nothing here moves the game; it paints what is there.

import { DISTRICTS, FONT, PALETTE, ROADS, VIEW, WORLD } from './config.js';
import { districtAt, isSand, isWater } from './city.js';
import { currentMarker, currentObjective, rankOf } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_OVER = 'over';

const MINIMAP = { x: 1052, y: 556, width: 204, height: 148 };

function cachedText(prefix) {
  let value = null;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();
  const cashLabel = cachedText('$');
  const ammoLabel = cachedText('Ammo ');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align ?? 'left';
    context.textBaseline = baseline ?? 'alphabetic';
    context.fillText(value, x, y);
  }

  function plainText(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    context.font = fonts.get(size).replace('bold ', '');
    context.fillStyle = color;
    context.textAlign = align ?? 'left';
    context.textBaseline = baseline ?? 'alphabetic';
    context.fillText(value, x, y);
  }

  /** The camera's top-left corner in world pixels, from the state. */
  function cameraOf(state) {
    return {
      x: state.camera.x - VIEW.width / 2,
      y: state.camera.y - VIEW.height / 2,
    };
  }

  /** Draw the ground: grass, districts, beach, sea, roads and lane paint. */
  function drawGround(state, cam) {
    context.fillStyle = PALETTE.grass;
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    // District tints, faint, so each part of town reads at a glance.
    for (const d of DISTRICTS) {
      context.fillStyle = d.tint;
      context.globalAlpha = 0.16;
      context.fillRect(d.x - cam.x, d.y - cam.y, d.width, d.height);
    }
    context.globalAlpha = 1;
    // Beach and sea along the south edge.
    context.fillStyle = PALETTE.sand;
    context.fillRect(0, state.city.beachTop - cam.y, WORLD.width, state.city.waterTop - state.city.beachTop);
    context.fillStyle = PALETTE.water;
    context.fillRect(0, state.city.waterTop - cam.y, WORLD.width, WORLD.height - state.city.waterTop);
    context.fillStyle = PALETTE.waterDeep;
    for (let x = 100; x < WORLD.width; x += 420) {
      context.fillRect(x - cam.x, state.city.waterTop + 40 - cam.y, 180, 4);
    }
    // Roads: dark tarmac with pale edges and dashed centre lines.
    context.fillStyle = PALETTE.road;
    for (const vx of ROADS.vertical) context.fillRect(vx - ROADS.width / 2 - cam.x, -cam.y, ROADS.width, WORLD.height);
    for (const hy of ROADS.horizontal) context.fillRect(-cam.x, hy - ROADS.width / 2 - cam.y, WORLD.width, ROADS.width);
    context.fillStyle = PALETTE.lane;
    for (const vx of ROADS.vertical) {
      for (let y = 0; y < WORLD.height; y += ROADS.laneDash * 2) {
        context.fillRect(vx - 2 - cam.x, y - cam.y, 4, ROADS.laneDash);
      }
    }
    for (const hy of ROADS.horizontal) {
      for (let x = 0; x < WORLD.width; x += ROADS.laneDash * 2) {
        context.fillRect(x - cam.x, hy - 2 - cam.y, ROADS.laneDash, 4);
      }
    }
  }

  /** Buildings with a fake 3D lift, plus trees, palms, cranes and containers. */
  function drawBuildings(state, cam) {
    const city = state.city;
    for (let i = 0; i < city.buildings.length; i += 1) {
      const b = city.buildings[i];
      const x = b.x - cam.x;
      const y = b.y - cam.y;
      if (x > VIEW.width || y > VIEW.height || x + b.width < 0 || y + b.height < 0) continue;
      context.fillStyle = PALETTE.buildingEdge;
      context.fillRect(x - 4, y - 4 - b.tall * 0.4, b.width + 8, b.height + 8);
      context.fillStyle = b.color;
      context.fillRect(x, y - b.tall * 0.4, b.width, b.height);
      context.fillStyle = 'rgba(255,255,255,0.14)';
      context.fillRect(x + 6, y - b.tall * 0.4 + 6, b.width - 12, 5);
    }
    for (let i = 0; i < city.decorations.length; i += 1) {
      const d = city.decorations[i];
      const x = d.x - cam.x;
      const y = d.y - cam.y;
      if (x < -80 || y < -80 || x > VIEW.width + 80 || y > VIEW.height + 80) continue;
      if (d.kind === 'tree' || d.kind === 'palm') {
        context.fillStyle = d.kind === 'palm' ? '#c9a86a' : '#5d9150';
        context.beginPath();
        context.arc(x, y, d.size, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = 'rgba(0,0,0,0.18)';
        context.beginPath();
        context.arc(x - 3, y - 3, d.size * 0.6, 0, Math.PI * 2);
        context.fill();
      } else if (d.kind === 'crane') {
        context.strokeStyle = '#d8c94a';
        context.lineWidth = 5;
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x, y - d.size);
        context.lineTo(x + d.size, y - d.size);
        context.stroke();
        context.fillStyle = '#d8c94a';
        context.fillRect(x - 8, y - 4, 16, 4);
      } else if (d.kind === 'container') {
        context.fillStyle = d.color;
        context.fillRect(x - d.size / 2, y - d.size / 3, d.size, (d.size / 3) * 2);
      }
    }
  }

  /** One car, nose along its angle: body, windows, wheels, and its livery. */
  function drawCar(car, cam, highlight) {
    const x = car.x - cam.x;
    const y = car.y - cam.y;
    if (x < -90 || y < -90 || x > VIEW.width + 90 || y > VIEW.height + 90) return;
    const spec = { length: 52, width: 26 };
    const len = car.kind === 'truck' ? 66 : car.kind === 'van' ? 60 : car.kind === 'sport' ? 54 : 52;
    const wid = car.kind === 'truck' ? 30 : car.kind === 'van' ? 28 : 26;
    context.save();
    context.translate(x, y);
    context.rotate(car.angle);
    if (car.wrecked) {
      context.fillStyle = 'rgba(60,60,60,0.35)';
      context.beginPath();
      context.arc(-len / 4, -wid / 2, 16, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = '#14161c';
    context.fillRect(-len / 2 + 4, -wid / 2 - 3, 12, 6);
    context.fillRect(-len / 2 + 4, wid / 2 - 3, 12, 6);
    context.fillRect(len / 2 - 16, -wid / 2 - 3, 12, 6);
    context.fillRect(len / 2 - 16, wid / 2 - 3, 12, 6);
    context.fillStyle = car.wrecked ? '#3c3f46' : car.color;
    context.fillRect(-len / 2, -wid / 2, len, wid);
    context.fillStyle = 'rgba(20,30,45,0.85)';
    context.fillRect(-len / 6, -wid / 2 + 4, len / 3, wid - 8);
    if (car.kind === 'police') {
      context.fillStyle = '#f5efe0';
      context.fillRect(-len / 2 + 8, -wid / 2, len - 16, 6);
      context.fillStyle = '#e5534b';
      context.fillRect(-2, -wid / 2 - 2, 8, 5);
      context.fillStyle = '#4fc3f7';
      context.fillRect(6, -wid / 2 - 2, 8, 5);
    } else if (car.kind === 'taxi') {
      context.fillStyle = '#14161c';
      context.fillRect(-6, -wid / 2 - 2, 12, 5);
      context.fillStyle = '#f2c94c';
      context.font = 'bold 7px sans-serif';
      context.textAlign = 'center';
      context.fillText('TAXI', 0, -wid / 2 - 4);
    }
    if (car.convoy) {
      context.fillStyle = '#f2c94c';
      context.font = 'bold 9px sans-serif';
      context.textAlign = 'center';
      context.fillText('★', 0, -wid / 2 - 6);
    }
    if (highlight) {
      context.strokeStyle = '#f2c94c';
      context.lineWidth = 2;
      context.strokeRect(-len / 2 - 4, -wid / 2 - 4, len + 8, wid + 8);
    }
    context.restore();
    if (car.health < 50 && !car.wrecked) {
      context.fillStyle = 'rgba(80,80,80,0.5)';
      context.beginPath();
      context.arc(x - 10, y - 12, 8 + ((Date.now() / 300) % 6), 0, Math.PI * 2);
      context.fill();
    }
  }

  /** Pedestrians, rivals, bullets and pickups. */
  function drawActors(state, cam) {
    for (let i = 0; i < state.peds.length; i += 1) {
      const ped = state.peds[i];
      const x = ped.x - cam.x;
      const y = ped.y - cam.y;
      if (x < -20 || y < -20 || x > VIEW.width + 20 || y > VIEW.height + 20) continue;
      context.fillStyle = ped.color;
      context.beginPath();
      context.arc(x, y, 7, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#2b2118';
      context.beginPath();
      context.arc(x, y - 2, 3.5, 0, Math.PI * 2);
      context.fill();
    }
    for (let i = 0; i < state.pickups.length; i += 1) {
      const p = state.pickups[i];
      const x = p.x - cam.x;
      const y = p.y - cam.y + Math.sin(p.t * 4) * 2;
      context.fillStyle = p.kind === 'health' ? '#58d68d' : p.kind === 'ammo' ? '#f2c94c' : '#4fc3f7';
      context.beginPath();
      context.arc(x, y, 9, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#14161c';
      context.font = 'bold 11px sans-serif';
      context.textAlign = 'center';
      context.fillText(p.kind === 'health' ? '+' : p.kind === 'ammo' ? 'A' : '$', x, y + 4);
    }
    for (let i = 0; i < state.enemies.length; i += 1) {
      const e = state.enemies[i];
      const x = e.x - cam.x;
      const y = e.y - cam.y;
      context.fillStyle = '#e5534b';
      context.beginPath();
      context.arc(x, y, 11, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#f5efe0';
      context.fillRect(x - 8, y - 18, 16, 3);
      context.fillStyle = '#e5534b';
      context.fillRect(x - 8, y - 18, 16 * Math.max(0, e.health / 50), 3);
      context.strokeStyle = '#14161c';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + Math.cos(e.angle) * 18, y + Math.sin(e.angle) * 18);
      context.stroke();
    }
    for (let i = 0; i < state.bullets.length; i += 1) {
      const b = state.bullets[i];
      context.strokeStyle = b.from === 'player' ? '#f2c94c' : '#ff8a7a';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(b.x - cam.x, b.y - cam.y);
      context.lineTo(b.x - cam.x - b.vx * 0.03, b.y - cam.y - b.vy * 0.03);
      context.stroke();
    }
  }

  /** Rae on foot: a figure with a jacket, a direction, and a blink while invulnerable. */
  function drawPlayer(state, cam) {
    const player = state.player;
    if (player.onFoot) {
      const x = player.x - cam.x;
      const y = player.y - cam.y;
      if (player.invuln > 0 && Math.floor(player.invuln * 10) % 2 === 0) return;
      context.fillStyle = '#e8b04b';
      context.beginPath();
      context.arc(x, y, 13, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#2b2118';
      context.beginPath();
      context.arc(x + Math.cos(player.angle) * 5, y + Math.sin(player.angle) * 5, 5, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#f5efe0';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + Math.cos(player.angle) * 20, y + Math.sin(player.angle) * 20);
      context.stroke();
    }
  }

  /** The pulsing mission marker, the taxi and delivery flags, and the route line to them. */
  function drawMarkers(state, cam) {
    const player = state.player;
    const marker = currentMarker(state);
    const pulse = 1 + Math.sin(Date.now() / 240) * 0.15;
    function diamond(x, y, size, color, label) {
      context.save();
      context.translate(x - cam.x, y - cam.y);
      context.scale(pulse, pulse);
      context.fillStyle = color;
      context.beginPath();
      context.moveTo(0, -size);
      context.lineTo(size, 0);
      context.lineTo(0, size);
      context.lineTo(-size, 0);
      context.closePath();
      context.fill();
      context.restore();
      if (label) {
        context.font = 'bold 13px sans-serif';
        context.textAlign = 'center';
        context.fillStyle = color;
        context.fillText(label, x - cam.x, y - cam.y - size - 8);
      }
    }
    if (marker !== null) {
      context.strokeStyle = 'rgba(242,201,76,0.55)';
      context.lineWidth = 2;
      context.setLineDash([10, 8]);
      context.beginPath();
      context.moveTo(player.x - cam.x, player.y - cam.y);
      context.lineTo(marker.x - cam.x, marker.y - cam.y);
      context.stroke();
      context.setLineDash([]);
      diamond(marker.x, marker.y, 16, '#f2c94c', marker.label);
    }
    const taxi = state.missions.taxi;
    if (taxi.active) diamond(taxi.x, taxi.y, 12, taxi.phase === 'pickup' ? '#f2a71b' : '#58d68d', taxi.phase === 'pickup' ? 'FARE' : 'DROP OFF');
    const del = state.missions.delivery;
    if (del.active) diamond(del.x, del.y, 12, del.phase === 'pickup' ? '#4fc3f7' : '#58d68d', del.phase === 'pickup' ? 'BOX' : 'DELIVER');
    for (let i = 0; i < state.police.foot.length; i += 1) {
      const cop = state.police.foot[i];
      const x = cop.x - cam.x;
      const y = cop.y - cam.y;
      context.fillStyle = '#20242e';
      context.beginPath();
      context.arc(x, y, 11, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#4fc3f7';
      context.beginPath();
      context.arc(x, y - 2, 4, 0, Math.PI * 2);
      context.fill();
    }
  }

  /** The HUD: cash, rank, wanted stars, health, ammo, objective, speed and the minimap. */
  function drawHud(state) {
    const player = state.player;
    context.textBaseline = 'top';
    // Cash and rank, top left.
    text(cashLabel(player.cash), 24, 18, 30, PALETTE.gold, 'left');
    plainText(`Rae Vega — ${rankOf(state)}`, 24, 52, 16, PALETTE.text, 'left');
    plainText(districtAt(player.x, player.y), 24, 74, 14, PALETTE.muted, 'left');
    // Wanted stars, top right.
    let stars = '';
    for (let s = 0; s < 5; s += 1) stars += s < player.wanted ? '★' : '☆';
    text(stars, VIEW.width - 24, 16, 30, player.wanted > 0 ? PALETTE.star : 'rgba(245,239,224,0.35)', 'right');
    plainText('WANTED', VIEW.width - 24, 52, 13, PALETTE.muted, 'right');
    // Health bar and ammo, under the stars.
    const hw = 180;
    const hx = VIEW.width - 24 - hw;
    context.fillStyle = 'rgba(20,26,38,0.8)';
    context.fillRect(hx, 74, hw, 12);
    context.fillStyle = player.health > 30 ? PALETTE.health : PALETTE.healthLow;
    context.fillRect(hx, 74, hw * Math.max(0, player.health / 100), 12);
    text(ammoLabel(player.ammo), VIEW.width - 24, 96, 18, PALETTE.text, 'right', 'top');
    // Objective, top centre.
    const objective = currentObjective(state);
    plainText(objective, VIEW.width / 2, 20, 17, PALETTE.text, 'center');
    // Banner, centre, while it lasts.
    if (state.missions.bannerT > 0 && state.missions.banner !== '') {
      context.fillStyle = 'rgba(20,26,38,0.82)';
      const bw = Math.min(760, 40 + state.missions.banner.length * 11);
      context.fillRect((VIEW.width - bw) / 2, 120, bw, 42);
      text(state.missions.banner, VIEW.width / 2, 132, 22, PALETTE.gold, 'center');
    }
    // Speed, bottom left, when driving.
    if (player.car !== null) {
      const kmh = Math.round(Math.abs(player.speed) * 0.45);
      text(`${kmh}`, 30, VIEW.height - 92, 54, PALETTE.text, 'left');
      plainText('km/h', 118, VIEW.height - 58, 16, PALETTE.muted, 'left');
      plainText(`${player.car.kind.toUpperCase()} — E to step out`, 30, VIEW.height - 34, 14, PALETTE.muted, 'left');
    } else {
      plainText('WASD move · Shift run · E enter car · F / click shoot · P pause', 24, VIEW.height - 34, 14, PALETTE.muted, 'left');
    }
    drawMinimap(state);
  }

  /** The minimap: the whole city, small, with Rae, the law and the markers on it. */
  function drawMinimap(state) {
    const sx = MINIMAP.width / WORLD.width;
    const sy = MINIMAP.height / WORLD.height;
    context.fillStyle = PALETTE.minimap;
    context.fillRect(MINIMAP.x, MINIMAP.y, MINIMAP.width, MINIMAP.height);
    context.fillStyle = PALETTE.minimapWater;
    context.fillRect(MINIMAP.x, MINIMAP.y + state.city.waterTop * sy, MINIMAP.width, (WORLD.height - state.city.waterTop) * sy);
    context.strokeStyle = PALETTE.minimapRoad;
    context.lineWidth = 1;
    for (const vx of ROADS.vertical) {
      context.beginPath();
      context.moveTo(MINIMAP.x + vx * sx, MINIMAP.y);
      context.lineTo(MINIMAP.x + vx * sx, MINIMAP.y + MINIMAP.height);
      context.stroke();
    }
    for (const hy of ROADS.horizontal) {
      context.beginPath();
      context.moveTo(MINIMAP.x, MINIMAP.y + hy * sy);
      context.lineTo(MINIMAP.x + MINIMAP.width, MINIMAP.y + hy * sy);
      context.stroke();
    }
    const marker = currentMarker(state);
    if (marker !== null) {
      context.fillStyle = '#f2c94c';
      context.fillRect(MINIMAP.x + marker.x * sx - 3, MINIMAP.y + marker.y * sy - 3, 6, 6);
    }
    for (let i = 0; i < state.cars.length; i += 1) {
      const car = state.cars[i];
      if (car.driver !== 'police' || car.wrecked) continue;
      context.fillStyle = '#e5534b';
      context.fillRect(MINIMAP.x + car.x * sx - 2, MINIMAP.y + car.y * sy - 2, 4, 4);
    }
    const player = state.player;
    context.fillStyle = '#f5efe0';
    context.beginPath();
    context.arc(MINIMAP.x + player.x * sx, MINIMAP.y + player.y * sy, 4, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = 'rgba(245,239,224,0.5)';
    context.strokeRect(MINIMAP.x - 1, MINIMAP.y - 1, MINIMAP.width + 2, MINIMAP.height + 2);
  }

  /** A centred panel: title, lines, and the prompt at the bottom. */
  function drawPanel(title, lines, prompt) {
    const width = 640;
    const height = 150 + lines.length * 34;
    const x = (VIEW.width - width) / 2;
    const y = (VIEW.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, width, height);
    text(title, VIEW.width / 2, y + 58, 46, PALETTE.text, 'center');
    for (let i = 0; i < lines.length; i += 1) {
      plainText(lines[i], VIEW.width / 2, y + 108 + i * 34, 19, PALETTE.muted, 'center');
    }
    text(prompt, VIEW.width / 2, y + height - 36, 22, PALETTE.gold, 'center');
  }

  /** Paint one frame: the world, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    const cam = cameraOf(state);
    drawGround(state, cam);
    drawBuildings(state, cam);
    drawMarkers(state, cam);
    drawActors(state, cam);
    for (let i = 0; i < state.cars.length; i += 1) {
      drawCar(state.cars[i], cam, state.player.car === state.cars[i]);
    }
    drawPlayer(state, cam);
    if (screen === SCREEN_TITLE) {
      context.fillStyle = 'rgba(10,14,22,0.45)';
      context.fillRect(0, 0, VIEW.width, VIEW.height);
      text('SOLMAR', VIEW.width / 2, 168, 92, PALETTE.gold, 'center');
      text('STREETS OF GOLD', VIEW.width / 2, 268, 40, PALETTE.text, 'center');
      plainText('Rae Vega · 6 jobs · 3 acts · 5 districts · one city that never sleeps', VIEW.width / 2, 322, 19, PALETTE.muted, 'center');
      plainText('WASD drive & walk · E steal a car · F shoot · P pause · M mute', VIEW.width / 2, 356, 17, PALETTE.text, 'center');
      const save = state.saveSummary;
      if (save) plainText(`Welcome back — ${save.rank}, $${save.cash} in the pocket`, VIEW.width / 2, 392, 17, PALETTE.gold, 'center');
      text('Press SPACE or click to start', VIEW.width / 2, 470, 26, PALETTE.gold, 'center');
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The city waits for no one — except right now.', ''], 'Press P to keep playing');
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('Busted', ['The Solmar PD has you. The bail is steep.', `Cash kept: $${Math.floor(state.player.cash / 2)}`], 'Press SPACE to walk free');
    } else if (screen === SCREEN_OVER) {
      drawPanel('Flatlined', ['Rae Vega went out the way she lived: loud.', `Missions done: ${state.stats.missionsDone} · Rank: ${rankOf(state)}`], 'Press SPACE to start over');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}

