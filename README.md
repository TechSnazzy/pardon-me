# Pardon Me

A comedy walking game. Sean needs to run one simple errand. No matter where Sean walks,
somebody is always about to walk right into them. Six levels across three towns, five difficulty levels,
and cars that will absolutely honk at you.

Built with [three.js](https://threejs.org) (vendored, no build step) and Kenney's CC0 3D kits.

## Play

**▶ Play:** <https://techsnazzy.github.io/pardon-me/>

It works on desktop and phone.

### Run locally

Open `index.html` through any static web server. Double-clicking the file won't work because
browsers block loading 3D models from `file://`. Once it's on GitHub Pages it's just a link.

Local preview:

```bash
cd ~/Projects/pardon-me && python3 -m http.server 8737
```

Then open <http://localhost:8737>.

### Add to your iPhone home screen

Open the game in Safari, tap **Share → Add to Home Screen**. It gets its own icon and opens full-screen
like an app. The icon is rendered from the game's own characters by `tools/make-icon.html`. To
regenerate it, open that page through a local server.

## Controls

| | Keyboard / mouse | Touch |
|---|---|---|
| Walk | WASD or arrow keys (camera-relative) · or click where to go | Drag on the left side · or tap where to go |
| Sprint | Hold Shift (same as Fortnite) · or double-click a spot | Hold the HURRY button · or double-tap |
| Jump | Space (same as Fortnite) | JUMP button |
| Dawdle | Hold C | Push the stick only a little |
| Camera | Q / E · right-drag · scroll wheel to zoom | Drag on the right side |
| Pause | Esc or P | ❚❚ button |
| Music on/off | M | Pause menu |

## Levels

| # | Town | Time of day | Errand |
|---|---|---|---|
| 1 | Pleasant Acres | Morning | Mail Aunt Linda's birthday card (post office) |
| 2 | Pleasant Acres | Noon | Grab a sandwich before the lunch rush |
| 3 | Downtown | Morning | Job interview at Synergy Corp |
| 4 | Riverside | Afternoon | Get ice cream before the stand closes |
| 5 | Downtown | Sunset | Pick up the pizza while it's still hot |
| 6 | Pleasant Acres | Night | Buy milk. Just milk. |

Winning a level unlocks the next one. Difficulty runs from **1 (Sunday Stroll)**, which anyone can finish,
to **5 (Parade Day)**, which is close to impossible. Progress and best stars are saved in the browser.

## Scoring

| | Points |
|---|---|
| Finish the errand | +1,000 |
| Each second left on the clock | +50 |
| Dodge (streak: 1st +150, 2nd +300, 3rd +450…) | +150 × streak |
| Bump a person (resets the streak) | −200 |
| Bump a car | −300 |
| Get honked at | −50 |
| Finish with zero bumps | +500 |

The total is multiplied by difficulty: ×1, ×1.5, ×2, ×3, ×5. The best score for each level is saved, and the
title screen shows the total. Only finished errands count toward high scores. **Reset game** (on the title
screen or in the pause menu) clears unlocked levels, stars and high scores.

## How it works

See [docs/DESIGN.md](docs/DESIGN.md). In short, an **Encounter Director** predicts where you're going
and schedules somebody to arrive at the same spot at the same moment. Between encounters
it enforces some breathing room.

## Credits

- 3D models: [Kenney](https://kenney.nl): Mini Characters, City Kit (Suburban), City Kit (Roads),
  City Kit (Commercial). CC0. See `assets/models/KENNEY-LICENSE.txt`.
- [three.js](https://threejs.org) r169, MIT. See `vendor/THREE-LICENSE.txt`.
- All sound is synthesized in the browser. Voices use the browser's built-in speech synthesis.
