# Pardon Me: Design Notes

## Premise
Sean (the hero, named after the creator) walks to a destination before a timer runs out.
The neighborhood conspires against Sean: whatever path Sean takes, someone is on a collision course.
It's comedy. The player should feel picked on, but fairly.

## Progression
Six levels across three towns (`src/levels.js`). Winning a level unlocks the next one. Each level picks a
town, a time of day (morning, noon, afternoon, sunset or night, which sets the lighting and lamp lights),
a start point, a goal door and a base time limit.

## Difficulty (1–5)
One table in `src/levels.js` (`DIFFICULTIES`) scales everything:

| | 1 Sunday Stroll | 2 Easy Tuesday | 3 Rush Hour | 4 Black Friday | 5 Parade Day |
|---|---|---|---|---|---|
| Time limit | ×1.7 | ×1.35 | ×1.0 | ×0.82 | ×0.72 |
| Gap between encounters | 7–10s | 5–7.5s | 3.6–6s | 2–3.4s | 1–2s |
| Encounters at once | 1 | 1 | 1 | 2 | 3 |
| NPC tracking | sluggish | relaxed | baseline | sharp | relentless |
| Awkwardness per bump | ×0.5 | ×0.75 | ×1 | ×1.4 | ×1.5 |
| Traffic | light & slow | | moderate | | heavy & fast |

Bot tests (walks the route, never dodges): it wins easily on 1, wins with a few bumps on 3, and loses on 5.

## Traffic (`src/traffic.js`)
Cars drive straight through on every through-street (right-hand traffic) and keep their following distance.
At intersections they take turns: whoever has waited longest goes first, and nobody enters unless there's
room to exit ("don't block the box"). They stop for anyone in a crosswalk. If Sean steps out and makes
a car brake hard, it honks (+awkwardness). Walking into a car that's already passing is a bump.

## Maps (`src/maps/*.js`, `src/layout.js`)
Maps list streets (axis, position, extent, sidewalk width). `layout.js` derives roads, sidewalks,
crosswalks, sidewalk ends, the walking graph, car lanes and intersections from those. Buildings are either
named shops (`shops`) or auto-filled rows (`rows`). Downtown backfills its block interiors with Kenney's
low-detail buildings to make a skyline. Riverside adds water, bridges, kiosks and park paths.

## Win / lose
- **Win:** reach the destination door before the timer runs out.
- **Lose (time):** the timer hits 0.
- **Lose (awkward):** the Awkwardness meter hits 100. Each bump adds to it (more if hurrying) and it slowly decays.
- **Stars:** 3 = at most 1 bump and at least 20% of the time left. 2 = at most 3 bumps or at least 12% time left. 1 = otherwise.

## The Encounter Director (`src/director.js`)
Every frame it predicts Sean's next ~7 seconds of movement (`Player.predict`). It follows the
click-to-move path if there is one, otherwise it extrapolates the current direction with wall sliding.
When the cooldown has expired it picks one encounter type at random by weight, out of the ones that fit:

| Type | Setup | How to beat it |
|---|---|---|
| **Cross** | Someone steps out of a house door, a shop door or the park (often with a stroller) and is timed to reach the sidewalk exactly when Sean does. While they approach they adjust their speed to keep the appointment. If Sean stops, they loiter "checking their phone" until their patience runs out. | Hurry past before they arrive, or wait them out |
| **Head-on** | Someone appears ~15 units ahead walking straight at Sean. They mirror the sidesteps after a 0.5s delay (the classic sidewalk dance). | Sidestep late (about 2–3.5 units away), or stop and let them walk around you |
| **Overtake** | A jogger comes up from behind, passes, cuts into Sean's lane and stops dead to check their phone. | Steer around or slow down |
| **Dog walker** (park) | A dog on a leash pulls out ahead of its owner. The bump zone is bigger, like the stroller's. | Same as cross |
| **Door rival** | Near the destination, someone arrives at the same door at the same moment, or walks out of it. Bumping triggers the "After you." / "No, after YOU." standoff. | Get there first |

Fairness rules:
- A grace period at the start, then a cooldown after each encounter (both set by difficulty).
- Only one targeted encounter at a time on difficulties 1–3 (2 on 4, 3 on 5).
- NPC speed is capped (`NPC.maxSpeed`), so a committed hurry can outrun an appointment.
- Inside `commitDist` the NPC stops correcting, which is the last-second dodge window.
- Standing still never causes a bump. NPCs walk around a stationary Sean. That costs time, not dignity.
- Bumps only count when the two people are actually closing on each other.

All tuning lives in `src/config.js`.

## World (`src/maps/`, `src/world.js`)
Hand-built: Maple Ave (east-west) crosses Elm St (north-south). Home is on Elm St, south of the park.
The shops are along Maple Ave's north side, including the post office, café and grocery.
Roads are off-limits except at crosswalks ("Sean does not jaywalk."). Lawns are off-limits.
The park is open to walk through. Walkability comes from a 0.5-unit grid (`src/grid.js`), which also runs A* for click-to-move.

## Files
- `src/game.js`: game states, loop, bumps, HUD wiring, win/lose
- `src/director.js`: encounter scheduling
- `src/npc.js`: NPC behaviors (route timing, loitering, engage/mirroring, overtake, wandering)
- `src/player.js`: input to movement, click-to-move paths, prediction
- `src/cameraRig.js`: third-person follow camera with building occlusion pull-in
- `src/world.js`: builds the scene from the map data, plus portals (doors and park entrances) the director uses
- `src/audio.js`: synthesized music, sound effects, ambience, speech
- `src/ui.js`: HUD, speech bubbles, minimap, screens

## Ideas for later
- More towns (beach boardwalk, mall, airport), weather (rain = umbrellas = wider people)
- Group of 3 walking abreast, delivery hand truck, leash "clothesline" across the path
- Walk signals at crosswalks, a bus that stops at the bus stop
- Character picker / outfits for Sean
