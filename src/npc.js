import * as THREE from 'three';
import { NPC, CHAR_SCALE } from './config.js';
import { Character, turnToward, headingOf } from './character.js';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

export const LINES = {
  generic: ['Watch it!', 'Oh! Sorry!', 'Ope! Sorry!', 'Excuse YOU.', 'Do you mind?', "I'm walking here!", 'Rude.', 'Whoa there, buddy.', 'Hey!', 'Sorry, sorry, sorry.', 'Unbelievable.', 'Every. Single. Day.', 'Seriously?', 'Oof.'],
  stroller: ['The BABY!', 'She JUST fell asleep!', 'Mind the stroller!', 'Do you know how long it took to get him down?'],
  phone: ['Hang on, some guy just walked into me.', "Can't you see I'm on the phone?", "I'll call you back.", 'No, not you, Karen. Him.'],
  jogger: ['On your left! ...too late.', 'Ugh, my pace!', 'You broke my streak!', 'My watch is gonna think I died.'],
  stopper: ['Oh, hang on.', 'Wait. Where was I going?', 'Ooh, a text.', 'Huh. Interesting.', 'Hold on, gotta check this.'],
  door: ['No, after YOU.', 'Please, I insist!', 'No no no, you first.', 'After you!'],
  dog: ['Biscuit, NO!', "He's friendly! ...Mostly.", 'Sorry, he just loves people.', 'Pickles! SIT!', 'He thinks you have treats.'],
};

// Tiny stroller built from boxes, pushed in front of the character.
function makeStroller() {
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: pick(['#e86f9a', '#5aa9e6', '#f2c14e', '#7bc67b']), roughness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: '#2d2b3a', roughness: 0.8 });
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  add(new THREE.BoxGeometry(0.5, 0.3, 0.6), body, 0, 0.45, 0);
  const hood = add(new THREE.SphereGeometry(0.32, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), body, 0, 0.58, -0.12);
  hood.scale.set(0.8, 0.9, 1); hood.rotation.x = -0.5;
  for (const sx of [-0.24, 0.24]) for (const sz of [-0.22, 0.22]) {
    const w = add(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 12), dark, sx, 0.1, sz); w.rotation.z = Math.PI / 2;
  }
  add(new THREE.BoxGeometry(0.04, 0.45, 0.04), dark, -0.22, 0.4, -0.35);
  add(new THREE.BoxGeometry(0.04, 0.45, 0.04), dark, 0.22, 0.4, -0.35);
  add(new THREE.BoxGeometry(0.5, 0.04, 0.04), dark, 0, 0.62, -0.38);
  g.position.set(0, 0, 0.62);
  return g;
}

// A small boxy dog on a leash, trotting ahead and to one side.
function makeDog() {
  const g = new THREE.Group();
  const fur = new THREE.MeshStandardMaterial({ color: pick(['#c8894f', '#f1e3c8', '#3b3330', '#a0a0a8', '#e0b070']), roughness: 0.9 });
  const dark = new THREE.MeshStandardMaterial({ color: '#2d2b3a', roughness: 0.8 });
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  add(new THREE.BoxGeometry(0.3, 0.26, 0.55), fur, 0, 0.36, 0);
  add(new THREE.BoxGeometry(0.26, 0.24, 0.26), fur, 0, 0.55, 0.32);
  add(new THREE.BoxGeometry(0.12, 0.1, 0.12), dark, 0, 0.5, 0.48);
  for (const sx of [-0.09, 0.09]) add(new THREE.BoxGeometry(0.06, 0.12, 0.06), dark, sx, 0.72, 0.28);
  const tail = add(new THREE.BoxGeometry(0.06, 0.06, 0.25), fur, 0, 0.5, -0.33); tail.rotation.x = 0.7;
  const legs = [];
  for (const sx of [-0.1, 0.1]) for (const sz of [-0.18, 0.18]) legs.push(add(new THREE.BoxGeometry(0.08, 0.24, 0.08), fur, sx, 0.12, sz));
  g.position.set(0.45, 0, 0.75);
  g.userData = { tail, legs };
  // leash from hand to collar
  const leash = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1, 4), new THREE.MeshBasicMaterial({ color: '#d0302a' }));
  const a = new THREE.Vector3(0.28, 0.75, 0.25), b = new THREE.Vector3(0.45, 0.55, 1.0);
  leash.position.copy(a).lerp(b, 0.5); leash.scale.y = a.distanceTo(b);
  leash.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return { dog: g, leash };
}

let nextId = 1;

export class Npc {
  constructor(modelName, opts = {}) {
    this.id = nextId++;
    this.c = new Character(modelName, { scale: CHAR_SCALE * (opts.scale || 1) });
    this.kind = opts.kind || 'ambient';      // ambient | encounter
    this.role = opts.role || null;          // cross | headon | overtake | door
    this.variant = opts.variant || null;    // stroller | phone | jogger
    this.state = 'pending';
    this.delay = opts.delay || 0;
    this.route = opts.route || null;
    this.routeIdx = 1;
    this.lane = opts.lane ?? 0;
    this.baseSpeed = opts.speed || NPC.walkSpeed * rand(0.9, 1.08);
    this.bumpable = true;
    this.bumped = false;
    this.ghost = 0;
    this.patience = rand(...NPC.patience);
    this.age = 0;
    this.fade = 0;
    this.outcome = null;     // 'bumped' | 'dodged' | 'fizzled'
    this.alert = false;
    this.stopTimer = 0;
    this.radius = NPC.radius;
    this.armsBusy = false;
    this.graphTarget = null;
    this.graphPrev = null;
    this.side = Math.random() < 0.5 ? -1 : 1;
    this.engageT = 0;
    this.sayCooldown = 0;
    if (this.variant === 'stroller') {
      this.stroller = makeStroller();
      this.c.root.add(this.stroller);
      this.c.setOverlay('holding-both');
      this.armsBusy = true;
      this.baseSpeed = NPC.walkSpeed * 0.85;
      this.radius = 0.5;
    } else if (this.variant === 'phone') {
      this.c.setOverlay('holding-right');
      this.armsBusy = true;
      this.baseSpeed = NPC.walkSpeed * 0.85;
    } else if (this.variant === 'dog') {
      const { dog, leash } = makeDog();
      this.dog = dog; this.c.root.add(dog, leash);
      this.radius = 0.5;
      this.baseSpeed = NPC.walkSpeed * 1.0;
    } else if (this.variant === 'jogger') {
      this.baseSpeed = NPC.walkSpeed * 1.55;
    }
    this.speedNow = 0;
    this.c.setOpacity(0);
  }

  get x() { return this.c.x; } get z() { return this.c.z; }

  // Collision centre (the stroller sticks out in front).
  hitPoint() {
    if (!this.stroller && !this.dog) return { x: this.c.x, z: this.c.z };
    return { x: this.c.x + Math.sin(this.c.heading) * 0.5, z: this.c.z + Math.cos(this.c.heading) * 0.5 };
  }

  spawnAt(x, z, heading) {
    Object.assign(this.c, { x, z, heading, speed: 0 });
  }

  lines() {
    return LINES[this.variant] && Math.random() < 0.75 ? LINES[this.variant] : LINES.generic;
  }

  // Steering primitive: turn toward (tx,tz) and move at `speed`.
  steer(ctx, tx, tz, speed, turnRate, dt) {
    const c = this.c;
    const dx = tx - c.x, dz = tz - c.z;
    if (Math.hypot(dx, dz) > 0.05) c.heading = turnToward(c.heading, headingOf(dx, dz), turnRate * dt);
    this.speedNow += (speed - this.speedNow) * (1 - Math.exp(-NPC.accel * dt));
    const vx = Math.sin(c.heading) * this.speedNow, vz = Math.cos(c.heading) * this.speedNow;
    // wait at the curb rather than walk into a passing car
    if (ctx.carBlocks && this.speedNow > 0.1 && ctx.carBlocks(c.x + vx * 0.5, c.z + vz * 0.5)) { this.speedNow = 0; c.speed = 0; return true; }
    const r = ctx.grid.moveSmart(c.x, c.z, vx * dt, vz * dt, 0.28);
    c.speed = Math.hypot(r.x - c.x, r.z - c.z) / Math.max(dt, 1e-4);
    c.x = r.x; c.z = r.z;
    return r.blocked;
  }

  update(dt, ctx) {
    const c = this.c, p = ctx.player;
    this.age += dt;
    this.sayCooldown -= dt;
    if (this.ghost > 0) this.ghost -= dt;

    if (this.state === 'pending') {
      this.delay -= dt;
      if (this.delay > 0) return;
      this.state = this.role === 'headon' ? 'headon' : this.role === 'overtake' ? 'overtake' : this.route ? 'route' : 'wander';
    }
    // fade in / out
    if (this.state === 'gone') return;
    if (this.state === 'despawn') {
      this.fade -= dt * 2.5;
      c.setOpacity(Math.max(0, this.fade));
      if (this.fade <= 0) this.state = 'gone';
    } else if (this.fade < 1) {
      this.fade = Math.min(1, this.fade + dt * 2.2);
      c.setOpacity(this.fade);
    }

    const toPx = p.x - c.x, toPz = p.z - c.z, distP = Math.hypot(toPx, toPz);
    const fwdX = Math.sin(c.heading), fwdZ = Math.cos(c.heading);
    const playerAhead = (toPx * fwdX + toPz * fwdZ) / Math.max(distP, 1e-4);

    switch (this.state) {
      case 'route': this.doRoute(dt, ctx, distP, playerAhead); break;
      case 'loiter': this.doLoiter(dt, ctx); break;
      case 'headon': this.doHeadOn(dt, ctx, distP, playerAhead); break;
      case 'engage': this.doEngage(dt, ctx, distP, playerAhead); break;
      case 'overtake': this.doOvertake(dt, ctx); break;
      case 'stopped': this.doStopped(dt, ctx); break;
      case 'frozen': this.stopTimer -= dt; this.steer(ctx, c.x, c.z, 0, 0, dt); if (this.stopTimer <= 0) this.leave(ctx); break;
      case 'enter': this.doEnter(dt, ctx); break;
      case 'wander': this.doWander(dt, ctx, distP, playerAhead); break;
      case 'despawn': this.steer(ctx, c.x + fwdX, c.z + fwdZ, this.baseSpeed * 0.6, 3, dt); break;
      default: break;
    }

    c.y += (ctx.grid.heightAt(c.x, c.z) - c.y) * (1 - Math.exp(-18 * dt));
    if (this.dog) {
      const t = this.age * 14 * Math.min(1, c.speed / 2);
      const u = this.dog.userData;
      u.tail.rotation.y = Math.sin(this.age * 12) * 0.6;
      u.legs.forEach((l, i) => { l.rotation.x = Math.sin(t + (i % 2 ? Math.PI : 0)) * 0.6; });
      this.dog.position.y = Math.abs(Math.sin(t)) * 0.04;
    }
    if (!c.oneShot) c.animateLocomotion(dt, { hurry: this.variant === 'jogger', armsBusy: this.armsBusy });
    c.sync(dt);
  }

  // ---------- behaviours ----------

  doRoute(dt, ctx, distP, playerAhead) {
    const c = this.c;
    const wp = this.route[this.routeIdx];
    const d = Math.hypot(wp.x - c.x, wp.z - c.z);
    if (d < 0.35) {
      this.routeIdx++;
      if (this.routeIdx >= this.route.length) {
        if (this.role === 'door' && this.enterDoor) { this.state = 'enter'; return; }
        if (this.kind === 'encounter' && distP < NPC.engageDist + 1 && ctx.player.speed > 0.4) this.startEngage(ctx);
        else this.leave(ctx);
        return;
      }
    }
    // timing: arrive at the meeting point when the player does
    let speed = this.baseSpeed;
    if (this.meet && this.routeIdx <= this.meetIdx) {
      const remaining = this.remainingTo(this.meetIdx);
      const tp = ctx.arrival(this.meet);
      if (Number.isFinite(tp)) {
        speed = THREE.MathUtils.clamp(remaining / Math.max(0.15, tp), remaining > 3.2 ? 0.9 : 0, NPC.maxSpeed * (this.variant === 'stroller' ? 0.85 : 1));
        if (speed < 0.6 && remaining < 3.2 && remaining > 0.8) { this.state = 'loiter'; this.loiterT = 0; return; }
      }
    }
    if (this.kind === 'encounter' && this.role !== 'door' && distP < NPC.engageDist * 0.8 && playerAhead > 0.5 && ctx.player.speed > 0.4) {
      this.startEngage(ctx); return;
    }
    this.steer(ctx, wp.x, wp.z, speed, 7, dt);
  }

  remainingTo(idx) {
    const c = this.c;
    let L = 0, px = c.x, pz = c.z;
    for (let i = this.routeIdx; i <= idx && i < this.route.length; i++) {
      L += Math.hypot(this.route[i].x - px, this.route[i].z - pz); px = this.route[i].x; pz = this.route[i].z;
    }
    return L;
  }

  // Waiting for the player, pretending to look at a phone.
  doLoiter(dt, ctx) {
    this.loiterT += dt;
    this.steer(ctx, this.c.x, this.c.z, 0, 0, dt);
    if (this.loiterT > 0.3 && !this.armsBusy) this.c.setOverlay('holding-right');
    const tp = ctx.arrival(this.meet);
    const remaining = this.remainingTo(this.meetIdx);
    const need = Number.isFinite(tp) ? remaining / Math.max(0.15, tp) : 0;
    if (need > 1.0 || this.loiterT > this.patience) {
      if (!this.armsBusy) this.c.setOverlay(null);
      if (this.loiterT > this.patience) this.meet = null; // gave up waiting, just go
      this.state = 'route';
    }
  }

  // Walk straight at the player along the sidewalk.
  doHeadOn(dt, ctx, distP, playerAhead) {
    const p = ctx.player;
    if (distP < NPC.engageDist) { this.startEngage(ctx); return; }
    const tgt = p.past(ctx.time, NPC.reactionDelay);
    this.steer(ctx, tgt.x, tgt.z, this.baseSpeed, 1.2, dt);
    if (this.age > 12) this.leave(ctx);
  }

  startEngage(ctx) {
    this.state = 'engage';
    this.engageT = 0;
    if (!this.alert && this.kind === 'encounter') { this.alert = true; ctx.onAlert?.(this); }
  }

  // Close range: home in on the player with a reaction delay. Inside commitDist, no more corrections.
  doEngage(dt, ctx, distP, playerAhead) {
    const p = ctx.player, c = this.c;
    this.engageT += dt;
    if (playerAhead < -0.1 || this.engageT > 4.5 || distP > NPC.engageDist + 3) {
      if (!this.bumped && this.kind === 'encounter' && !this.outcome) this.outcome = playerAhead < 0 && distP < 3 ? 'dodged' : 'fizzled';
      this.leave(ctx); return;
    }
    let tx, tz;
    if (p.speed < 0.35) {
      // player is standing still: politely walk around them (costs the player time, not dignity)
      const fx = Math.sin(c.heading), fz = Math.cos(c.heading);
      tx = p.x + -fz * this.side * 1.3 + fx * 1.5; tz = p.z + fx * this.side * 1.3 + fz * 1.5;
      this.steer(ctx, tx, tz, this.baseSpeed * 0.8, 3, dt);
      return;
    }
    if (distP > NPC.commitDist) {
      const past = p.past(ctx.time, NPC.reactionDelay);
      const lead = 0.35;
      tx = past.x + p.vx * lead; tz = past.z + p.vz * lead;
      this.lastAim = { x: tx, z: tz };
    } else {
      tx = c.x + Math.sin(c.heading); tz = c.z + Math.cos(c.heading);
    }
    const sp = Math.max(this.baseSpeed, NPC.walkSpeed);
    this.steer(ctx, tx, tz, sp, NPC.steerRate * (this.variant === 'stroller' ? 0.7 : 1), dt);
  }

  // Come up from behind, pass on one side, cut in front and stop dead.
  doOvertake(dt, ctx) {
    const p = ctx.player, c = this.c;
    const ph = p.speed > 0.5 ? Math.atan2(p.vx, p.vz) : p.heading;
    const fx = Math.sin(ph), fz = Math.cos(ph);
    const rx = -fz, rz = fx;
    const rel = (c.x - p.x) * fx + (c.z - p.z) * fz;       // how far ahead of the player
    this.ghost = rel < 0.9 ? 0.2 : 0;                        // can't be bumped while passing from behind
    const lat = rel < 1.0 ? 1.0 * this.side : rel < 2.2 ? this.side * (2.2 - rel) / 1.2 : 0;
    const ahead = Math.max(rel + 2, 2.4);
    const tx = p.x + fx * ahead + rx * lat, tz = p.z + fz * ahead + rz * lat;
    const sp = Math.max(p.speed + 2.2, NPC.maxSpeed * (this.variant === 'jogger' ? 1.3 : 1));
    this.steer(ctx, tx, tz, sp, 5, dt);
    const actualLat = (c.x - p.x) * rx + (c.z - p.z) * rz;
    if (rel > 2.0 && Math.abs(lat) < 0.2 && (Math.abs(actualLat) < 0.3 || rel > 3.2)) {
      this.state = 'stopped';
      this.stopTimer = rand(2.2, 3.4);
      this.c.setOverlay('holding-right'); this.armsBusy = true;
      ctx.say(this, pick(LINES.stopper));
      if (!this.alert) { this.alert = true; ctx.onAlert?.(this); }
    }
    if (this.age > 10) this.leave(ctx);
  }

  doStopped(dt, ctx) {
    this.stopTimer -= dt;
    this.steer(ctx, this.c.x, this.c.z, 0, 0, dt);
    if (this.stopTimer <= 0) {
      if (!this.outcome) this.outcome = 'dodged';
      this.c.setOverlay(null); this.armsBusy = false;
      this.leave(ctx);
    }
  }

  doEnter(dt, ctx) {
    const d = ctx.doorPoint;
    this.steer(ctx, d.x - d.f.x * 1.0, d.z - d.f.z * 1.0, NPC.walkSpeed * 0.8, 6, dt);
    if (Math.hypot(this.c.x - d.x, this.c.z - d.z) < 0.5 || this.age > 20) { this.bumpable = false; this.fade = Math.min(this.fade, 1); this.state = 'despawn'; }
  }

  // Wander the sidewalk graph (ambient walkers, and encounter NPCs after they're done).
  doWander(dt, ctx, distP, playerAhead) {
    const c = this.c;
    if (!this.graphTarget) this.pickGraphTarget(ctx);
    if (!this.graphTarget) { this.despawn(); return; }
    const t = this.graphTarget;
    const dx = t.x - (this.graphPrev?.x ?? c.x), dz = t.z - (this.graphPrev?.z ?? c.z);
    const dl = Math.hypot(dx, dz) || 1;
    // walk in a lane offset to the right of travel
    const lx = -dz / dl * this.lane, lz = dx / dl * this.lane;
    let tx = t.x + lx, tz = t.z + lz;
    // ambient folks make a small effort to not walk into the player
    if (this.kind === 'ambient' && distP < 2.6 && playerAhead > 0.6) {
      const sx = -Math.cos(c.heading), sz = Math.sin(c.heading);
      tx = c.x + Math.sin(c.heading) * 2 + sx * 1.2 * this.side; tz = c.z + Math.cos(c.heading) * 2 + sz * 1.2 * this.side;
    }
    const blocked = this.steer(ctx, tx, tz, this.baseSpeed, 5, dt);
    if (Math.hypot(t.x + lx - c.x, t.z + lz - c.z) < 0.8 || (blocked && Math.hypot(t.x - c.x, t.z - c.z) < 2)) {
      const prev = this.graphPrev; this.graphPrev = t;
      const opts = t.links.filter((n) => n !== prev);
      this.graphTarget = opts.length ? pick(opts) : prev;
    }
    if (this.leaving && (distP > 26 || this.age > 40) && !ctx.inView(c.x, c.z)) this.despawn();
  }

  pickGraphTarget(ctx) {
    const c = this.c;
    const fx = Math.sin(c.heading), fz = Math.cos(c.heading);
    let best = null, bs = -Infinity;
    for (const n of ctx.graph) {
      const dx = n.x - c.x, dz = n.z - c.z, d = Math.hypot(dx, dz);
      if (d < 1.5 || d > 40) continue;
      if (!ctx.grid.lineFree(c.x, c.z, n.x, n.z, 0.2)) continue;
      const s = (dx * fx + dz * fz) / d * 2 - d * 0.05;
      if (s > bs) { bs = s; best = n; }
    }
    this.graphTarget = best;
    this.graphPrev = null;
  }

  leave(ctx) {
    this.state = 'wander';
    this.leaving = true;
    this.graphTarget = null;
    this.lane = (Math.random() - 0.5) * 1.2;
    if (this.variant !== 'stroller' && this.variant !== 'phone') { this.armsBusy = false; this.c.setOverlay(null); }
  }

  despawn() {
    if (this.state === 'despawn' || this.state === 'gone') return;
    this.state = 'despawn'; this.bumpable = false;
  }
}
