# gta6-01-v1

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/rezimx-btc/gta6-01-v1/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard)
[![reward](https://make.fun/badge/gta6-01/rezimx-btc/gta6-01-v1/reward.svg)](https://make.fun/bounty/gta6-01)

## SOLMAR — Streets of Gold

An original open-world crime game in a sun-soaked fictional city. Rae Vega starts as a
courier with a pistol and a grudge, and rises through six missions in three acts — from
First Delivery to The Gold Run — to become Kingpin of Solmar.

**The city:** five districts (The Hills, Downtown, Old Port, Barrio Sol, Marina Bay)
with a beach and a sea, explored on foot and by car. Traffic follows the road grid,
pedestrians stroll the sidewalks and scatter when shots ring out.

**The life:** steal any car and drive it (E to enter, E to step out), outrun patrol cars
and foot cops as the wanted level climbs from 0 to 5 stars, take taxi fares and package
runs between jobs, fight rival crews, and watch the cash and the rank climb from Courier
to Kingpin.

**The systems:** wanted heat that cools when the law loses sight of you, busted and
flatlined screens, a HUD with cash, rank, health, ammo, wanted stars, objective and a
live minimap, a start screen over the living city, and a localStorage save. Every name,
character, place and story beat is original — nothing from any commercial game.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. Keyboard and mouse: WASD to move
and drive, Shift to run, E to enter or leave a car, F or click to shoot, P to pause,
M to mute. Sound is synthesized live with WebAudio — no audio files, no network.

## How it is built

Vanilla Canvas 2D, no vendored library. Static files under `game/` with no build step:
`game/index.html` plus one clear module per job under `game/src/` — `config.js` (tuning),
`random.js` (seeded RNG), `city.js` (layout and geometry), `input.js`, `player.js`,
`traffic.js`, `police.js`, `combat.js`, `missions.js`, `save.js`, `audio.js`,
`render.js`, `shots.js` (the four screenshot scenes), `main.js` (boot and loop).
`main.ts` at the root hands the game in; `screenshots/` holds four real renders of the
game's own code, the first by name the cover.

---

<sub>Entered on [make.fun](https://make.fun/?ref=rezimx01&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
