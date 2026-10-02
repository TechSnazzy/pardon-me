# STATUS: Pardon Me

_Last updated: 2026-10-01_

## Where things stand
**Published 2026-10-01.**
- Repo: https://github.com/TechSnazzy/pardon-me (public, MIT; Kenney assets CC0)
- Play: https://techsnazzy.github.io/pardon-me/ (GitHub Pages, main branch, root)
- Linked from the seantechguy.com Games menu (repo TechSnazzy/TechSnazzy, `index.html`, "🚶 Pardon Me")
- To update the live game: commit and push to `main`. Pages rebuilds in about a minute.

### Update 2026-10-01 (evening): levels, difficulty, cars
- Hero renamed to **Sean** (`HERO_NAME` in `src/config.js`); in-game text avoids pronouns
- 6 levels / 3 towns: Pleasant Acres, Downtown (new), Riverside (new); morning/noon/afternoon/sunset/night lighting
- Difficulty 1–5 chosen on the title screen; best stars saved per level per difficulty; winning unlocks the next level
- Traffic on all through-streets: queueing, intersection turn-taking, crosswalk yielding, honks, car bumps
- Dog walkers (Riverside), downtown skyline backfill, night lamp lighting
- Verified: all 6 levels reachable and winnable by a route-following bot; traffic soak tests 90s per map with no
  car-on-car overlaps and no permanent jams. Diff 5 downtown has some long (~25s) waits by design.
- Model loading throttled to 8 at a time (~72 GLBs total)

### Update 2026-10-01 (late): scoring + reset
- Points with dodge streaks, a difficulty multiplier, a per-level high score and a total on the title screen. The end screen shows a breakdown.
- Reset game button on the title screen and in the pause menu (asks first; keeps difficulty and sound settings)
- Pause menu "Levels & difficulty" goes back to the title screen to change difficulty mid-game

### Working
- Neighborhood: two streets, crosswalks, park with pond and paths, 24 houses, 15 shops with signs, props
- Sean (Kenney `character-male-e`) with walk / sprint / dawdle / jump; WASD + click-to-move (A*) + touch stick + tap-to-move
- Fortnite-style keys: Shift = sprint, Space = jump (JUMP button on touch). Dawdle moved to C (Ctrl+W would close the browser tab)
- Third-person camera that follows the travel direction and pulls in when a building is in the way; trees between camera and Sean fade
- Encounter Director with cross (house/shop/park incl. stroller), head-on (mirror dance), overtake (phone stopper), door rival ("after you")
- Ambient walkers on a sidewalk graph
- Bumps: speech bubbles + browser speech voices, knockback, freeze, awkwardness meter
- Timer, compass, rotating minimap, destination beacon, win/lose screens, star rating + rank, best stars saved per errand
- Level times at difficulty 3: Post 60s, Lunch 45s, Interview 66s, Ice cream 70s, Pizza 64s, Milk 75s
- Synthesized music / SFX / ambience, toggles for music, sounds, voices
- Phone layout checked at 375×812

### Verified in testing
- Full post-office run completes end to end (click-to-move)
- Sidestepping a head-on walker at about 2–3.5 units dodges it about 85% of the time. Earlier lane changes get mirrored (intended).
- Stopping always avoids a bump but costs time
- About 100 fps on this Mac, about 230 draw calls

## Needs Sean's play-testing
- Difficulty: time limits, cooldown between encounters (`DIRECTOR.cooldown`), NPC tracking (`NPC.steerRate`, `reactionDelay`, `commitDist`)
- Keyboard camera feel (camera-relative WASD with auto-follow)
- Whether the speech voices are funny or annoying (can be turned off)

## Next steps
1. Play-test on a phone and tune difficulty/timers from feedback
2. Ideas: character picker for Sean, online leaderboard (needs a small backend), more towns (see docs/DESIGN.md)

## Notes
- Local preview: `python3 -m http.server 8737` in this folder, then http://localhost:8737
- `_downloads/` holds the original Kenney zips (gitignored)
- Debug handle: `window.__game` in the browser console
