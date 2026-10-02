// The Encounter Director: watches where the player is going and arranges for
// somebody to be there at exactly the wrong moment. With cooldowns, so it's playable.
import { DIRECTOR, NPC } from './config.js';
import { SURF } from './grid.js';

const rand = (a, b) => a + Math.random() * (b - a);

function weighted(options) {
  const total = options.reduce((s, o) => s + o.w, 0);
  let r = Math.random() * total;
  for (const o of options) { r -= o.w; if (r <= 0) return o; }
  return options[options.length - 1];
}

function pathLen(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
  return L;
}

// Drop the first `cut` units of a polyline.
function trimRoute(pts, cut) {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], seg = Math.hypot(b.x - a.x, b.z - a.z);
    if (cut < seg) {
      const t = cut / seg;
      return [{ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }, ...pts.slice(i)];
    }
    cut -= seg;
  }
  return pts.slice(-2);
}

export class Director {
  constructor(game) {
    this.game = game;
    this.reset();
  }

  reset() {
    this.cooldown = DIRECTOR.startGrace;
    this.actives = [];
    this.pred = null;
    this.doorUsed = false;
    this.portalUsed = new Map();
    this.sinceResolve = 99;
    this.tryTimer = 0;
    this.stats = { encounters: 0, dodged: 0 };
  }

  // Seconds until the player reaches `pt`, Infinity if they're not headed there.
  arrival(pt, tol = 1.6) {
    const p = this.game.player;
    if (!this.pred) return p.speed < 0.6 ? 60 : Infinity;
    let best = Infinity, bt = Infinity;
    for (const s of this.pred) {
      const d = Math.hypot(s.x - pt.x, s.z - pt.z);
      if (d < best) { best = d; bt = s.t; }
    }
    return best < tol ? bt : Infinity;
  }

  update(dt) {
    const g = this.game, p = g.player;
    this.pred = p.predict(DIRECTOR.lookahead, 0.1);
    this.sinceResolve += dt;

    for (const a of this.actives) {
      const n = a.npc;
      a.age += dt;
      const done = n.bumped || n.outcome || n.leaving || n.state === 'despawn' || n.state === 'gone' || a.age > DIRECTOR.encounterTimeout;
      if (!done) continue;
      a.done = true;
      const outcome = n.bumped ? 'bumped' : n.outcome || 'fizzled';
      if (outcome === 'dodged') { this.stats.dodged++; g.onDodge(n); }
      if (a.age > DIRECTOR.encounterTimeout && !n.leaving) n.leave(g.ctx);
      this.sinceResolve = 0;
      this.cooldown = Math.max(this.cooldown, rand(...DIRECTOR.cooldown) * (outcome === 'fizzled' ? 0.5 : 1) * g.cooldownScale);
    }
    this.actives = this.actives.filter((a) => !a.done);
    const full = this.actives.length >= DIRECTOR.maxActive;
    if (!full) this.cooldown -= dt;

    if (!this.doorUsed && this.sinceResolve > 1.2 && !full) this.tryDoorRival();
    if (full || this.cooldown > 0 || !this.pred || p.speed < 0.6) return;
    this.tryTimer -= dt;
    if (this.tryTimer > 0) return;
    this.tryTimer = 0.25;
    this.tryStart();
  }

  tryStart() {
    const g = this.game;
    const W = DIRECTOR.weights;
    const options = [];

    const cross = this.planCross();
    if (cross) options.push({ w: W.cross, plan: cross });
    const head = this.planHeadOn();
    if (head) options.push({ w: W.headon, plan: head });
    const over = this.planOvertake();
    if (over) options.push({ w: W.overtake, plan: over });
    if (!options.length) return;
    const { plan } = weighted(options);
    const npc = g.spawnNpc(plan);
    if (!npc) return;
    this.actives.push({ npc, type: plan.role, age: 0 });
    this.stats.encounters++;
    // with several allowed at once, space out the starts too
    if (DIRECTOR.maxActive > 1) this.cooldown = rand(...DIRECTOR.cooldown) * g.cooldownScale;
  }

  get active() { return this.actives[0] || null; }

  planCross() {
    const g = this.game, p = g.player, t = g.time;
    const cands = [];
    for (const portal of g.world.portals) {
      if ((this.portalUsed.get(portal) ?? -99) > t - 12) continue;
      if (portal.id && portal.id === g.level.goal) continue;
      if (this.actives.some((a) => a.portal === portal)) continue;
      const tp = this.arrival(portal.entry, 1.4);
      if (!(tp >= DIRECTOR.minMeetTime && tp <= DIRECTOR.maxMeetTime)) continue;
      if (Math.hypot(portal.spawn.x - p.x, portal.spawn.z - p.z) < 3) continue;
      let route = portal.route.map((q) => ({ ...q }));
      let L = pathLen(route);
      // park paths are long: let the walker "already be on the path" (appearing from behind the hedges)
      if (portal.kind === 'park' && L / tp > NPC.walkSpeed * 0.8) {
        route = trimRoute(route, L - tp * NPC.walkSpeed * 0.8);
        L = pathLen(route);
      }
      if (L / tp > NPC.maxSpeed * 0.9) continue;
      cands.push({ portal, tp, L, route });
    }
    if (!cands.length) return null;
    const { portal, tp, L, route } = cands[(Math.random() * cands.length) | 0];
    this.portalUsed.set(portal, t);
    const kinds = [portal.stroller && 'stroller', portal.dog && 'dog', portal.jogger && 'jogger'].filter(Boolean);
    const variant = portal.kind === 'park' && kinds.length && Math.random() < 0.7 ? kinds[(Math.random() * kinds.length) | 0]
      : Math.random() < 0.3 ? 'phone' : null;
    const walk = NPC.walkSpeed * (variant ? 0.85 : 1);
    return {
      role: 'cross', variant, route,
      meet: portal.entry, meetIdx: route.length - 1,
      delay: Math.max(0, tp - L / walk - 0.2),
      x: route[0].x, z: route[0].z,
      heading: Math.atan2(route[1].x - route[0].x, route[1].z - route[0].z),
    };
  }

  planHeadOn() {
    const g = this.game, p = g.player, pred = this.pred, grid = g.world.grid;
    let L = 0;
    for (let i = 1; i < pred.length; i++) {
      L += Math.hypot(pred[i].x - pred[i - 1].x, pred[i].z - pred[i - 1].z);
      if (L < 14) continue;
      const s = pred[i];
      if (L > 21) break;
      const surf = grid.surfAt(s.x, s.z);
      if (surf !== SURF.SIDEWALK && surf !== SURF.PATH && surf !== SURF.PARK) continue;
      if (!grid.lineFree(p.x, p.z, s.x, s.z, 0.3)) return null;
      const r = Math.random();
      const variant = r < 0.3 ? 'jogger' : r < 0.55 ? 'phone' : null;
      return { role: 'headon', variant, x: s.x, z: s.z, heading: Math.atan2(p.x - s.x, p.z - s.z) };
    }
    return null;
  }

  planOvertake() {
    const g = this.game, p = g.player, grid = g.world.grid;
    if (p.speed < 1.5 || p.hurrying || p.path?.length > 1) return null;
    const fx = p.vx / p.speed, fz = p.vz / p.speed;
    const bx = p.x - fx * 7, bz = p.z - fz * 7;
    const ax = p.x + fx * 7, az = p.z + fz * 7;
    if (!grid.lineFree(p.x, p.z, bx, bz, 0.35) || !grid.lineFree(p.x, p.z, ax, az, 0.35)) return null;
    if (g.inView(bx, bz)) return null;
    const variant = Math.random() < 0.6 ? 'jogger' : null;
    return { role: 'overtake', variant, x: bx, z: bz, heading: Math.atan2(fx, fz) };
  }

  tryDoorRival() {
    const g = this.game, p = g.player, grid = g.world.grid;
    const door = g.goalDoor;
    const E = door.entry;
    const dist = Math.hypot(p.x - E.x, p.z - E.z);
    if (dist > DIRECTOR.doorRivalRange || dist < 4 || p.speed < 0.6) return;
    let tp = this.arrival(E, 2.2);
    if (!Number.isFinite(tp) || tp > 60) tp = dist / Math.max(p.speed, 2.5);
    this.doorUsed = true;
    const lat = { x: -door.f.z, z: door.f.x };
    const side = Math.sign((p.x - E.x) * lat.x + (p.z - E.z) * lat.z) || 1;
    const sx = E.x - lat.x * side * 12, sz = E.z - lat.z * side * 12;
    const doorPt = { x: door.x, z: door.z };
    let plan;
    if (Math.random() < 0.6 && grid.walkable(sx, sz) && grid.lineFree(sx, sz, E.x, E.z, 0.3)) {
      const route = [{ x: sx, z: sz }, { ...E }, doorPt];
      plan = { role: 'door', route, meet: E, meetIdx: 1, enterDoor: true, delay: Math.max(0, tp - 12 / NPC.walkSpeed - 0.6), x: sx, z: sz, heading: Math.atan2(E.x - sx, E.z - sz) };
    } else {
      // someone strolls out of the very door you want, just before you get there
      const route = [doorPt, { ...E }];
      plan = { role: 'door', route, delay: Math.max(0, tp - 1.5 / NPC.walkSpeed - 1.0), x: doorPt.x, z: doorPt.z, heading: Math.atan2(door.f.x, door.f.z) };
    }
    const npc = g.spawnNpc(plan);
    if (npc) { this.actives.push({ npc, type: 'door', age: 0 }); this.stats.encounters++; }
  }
}
