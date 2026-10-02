// Cars: drive straight along through-streets, keep their distance, take turns at
// intersections, stop for anyone in a crosswalk, and honk when someone makes them slam the brakes.
import * as THREE from 'three';
import { RoundedBoxGeometry } from '../vendor/addons/utils/RoundedBoxGeometry.js';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const inRect = ([x0, z0, x1, z1], x, z, pad = 0) => x > x0 - pad && x < x1 + pad && z > z0 - pad && z < z1 + pad;

const COLORS = ['#e2504c', '#3f7fd9', '#f2c14e', '#6cc070', '#f4f1ea', '#5b5f73', '#9b5de5', '#ff8c42', '#4ecdc4'];

// ---------- car models (built once per type, then cloned) ----------
const geo = {};
const G = (k, f) => (geo[k] ||= f());
const mats = {};
const M = (color, opts = {}) => (mats[color + JSON.stringify(opts)] ||= new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, ...opts }));
const glass = () => M('#2f3b52', { roughness: 0.2 });
const headMat = new THREE.MeshStandardMaterial({ color: '#fff6d0', emissive: '#fff2b0', emissiveIntensity: 0.3 });
const tailMat = new THREE.MeshStandardMaterial({ color: '#d0302a', emissive: '#ff2a2a', emissiveIntensity: 0.3 });

function part(g, geometry, material, x, y, z) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
}

function makeCar(type) {
  const g = new THREE.Group();
  let len = 3.4, w = 1.7;
  const color = type === 'taxi' ? '#f6c63c' : type === 'icecream' ? '#fdf6f0' : pick(COLORS);
  const body = M(color);
  if (type === 'van' || type === 'icecream') {
    len = 3.8; w = 1.8;
    part(g, G('vanBody', () => new RoundedBoxGeometry(1.8, 1.3, 3.8, 2, 0.18)), body, 0, 0.95, 0);
    part(g, G('vanWind', () => new THREE.BoxGeometry(1.6, 0.55, 0.06)), glass(), 0, 1.25, 1.9);
    for (const sx of [-0.91, 0.91]) part(g, G('vanSide', () => new THREE.BoxGeometry(0.04, 0.45, 1.6)), glass(), sx, 1.3, 0.6);
    if (type === 'icecream') {
      part(g, G('stripe', () => new THREE.BoxGeometry(1.84, 0.22, 3.6)), M('#ff6fa8'), 0, 0.75, 0);
      const cone = part(g, G('cone', () => new THREE.ConeGeometry(0.35, 0.9, 10)), M('#e0a35a'), 0, 1.95, -0.6); cone.rotation.x = Math.PI;
      part(g, G('scoop', () => new THREE.SphereGeometry(0.38, 12, 8)), M('#ff9fc8'), 0, 2.45, -0.6);
    }
  } else {
    if (type === 'hatch') len = 3.0;
    part(g, G(`body${len}`, () => new RoundedBoxGeometry(1.7, 0.6, len, 2, 0.22)), body, 0, 0.6, 0);
    part(g, G(`cabin${len}`, () => new RoundedBoxGeometry(1.48, 0.5, len * 0.5, 2, 0.12)), glass(), 0, 1.1, type === 'hatch' ? -0.25 : -0.15);
    part(g, G(`roof${len}`, () => new THREE.BoxGeometry(1.52, 0.08, len * 0.46)), body, 0, 1.37, type === 'hatch' ? -0.25 : -0.15);
    if (type === 'taxi') {
      part(g, G('taxiSign', () => new THREE.BoxGeometry(0.7, 0.22, 0.3)), M('#ffffff', { emissive: '#ffe680', emissiveIntensity: 0.3 }), 0, 1.52, -0.2);
      part(g, G('checker', () => new THREE.BoxGeometry(1.72, 0.1, len * 0.6)), M('#222222'), 0, 0.72, 0);
    }
  }
  const wheel = G('wheel', () => new THREE.CylinderGeometry(0.33, 0.33, 0.24, 14));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const wm = part(g, wheel, M('#26242e'), sx * (w / 2 - 0.05), 0.33, sz * (len / 2 - 0.65)); wm.rotation.z = Math.PI / 2;
  }
  const light = G('light', () => new THREE.BoxGeometry(0.34, 0.15, 0.05));
  for (const sx of [-0.55, 0.55]) {
    part(g, light, headMat, sx, type === 'van' || type === 'icecream' ? 0.75 : 0.62, len / 2 + 0.01);
    part(g, light, tailMat, sx, type === 'van' || type === 'icecream' ? 0.75 : 0.62, -len / 2 - 0.01);
  }
  return { g, len, w };
}

const HONKS = ["Hey! I'm drivin' here!", 'HONK HONK!', 'Use the crosswalk, buddy!', 'Look both ways!', 'Some of us have places to be!', 'BEEEEP!'];

export class Traffic {
  constructor(scene, world, { rate = 1, speed = 6.5, types = ['sedan', 'hatch', 'van'] } = {}) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.cars = [];
    this.types = types;
    this.rate = rate;
    this.speed = speed;
    this.onHonk = null;
    const L = world.layout;
    this.crosswalks = L.crosswalks;
    this.intersections = L.intersections;
    for (const it of this.intersections) { it.owner = null; it.cars = new Set(); it.wait = { x: 0, z: 0 }; }
    this.lanes = L.lanes.map((ln) => {
      const along = (r) => (ln.axis === 'x' ? [r[0], r[2]] : [r[1], r[3]]);
      const perpIn = (r) => (ln.axis === 'x' ? ln.perp > r[1] && ln.perp < r[3] : ln.perp > r[0] && ln.perp < r[2]);
      const cws = this.crosswalks.filter((c) => perpIn(c.rect)).map((c) => ({ c, a: along(c.rect) }));
      const its = this.intersections.filter((it) => perpIn(it.rect)).map((it) => ({ it, a: along(it.rect), sw: (ln.axis === 'x' ? it.zs.sw : it.xs.sw) || 3 }));
      return { ...ln, cws, its, timer: rand(0, 3) };
    });
    // a few cars already on the road
    for (const ln of this.lanes) for (let i = 0; i < 2; i++) if (Math.random() < 0.6 * Math.min(1.5, rate)) this.spawn(ln, rand(0.15, 0.85));
  }

  interval() { return rand(4.5, 9) / this.rate; }

  spawn(ln, frac = 0) {
    const { g, len, w } = makeCar(pick(this.types));
    const s = ln.start + (ln.end - ln.start) * frac;
    if (this.cars.some((c) => c.lane === ln && Math.abs(c.s - s) < 9)) { g.clear(); return; }
    const car = { lane: ln, s, speed: this.speed * 0.8, vmax: this.speed * rand(0.85, 1.15), len, w, g, reserved: new Set(), honkCd: 0, y: 1.3 };
    g.rotation.y = ln.axis === 'x' ? (ln.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (ln.dir > 0 ? 0 : Math.PI);
    this.group.add(g);
    this.cars.push(car);
    this.place(car);
  }

  place(c) {
    const ln = c.lane;
    if (ln.axis === 'x') { c.x = c.s; c.z = ln.perp; } else { c.x = ln.perp; c.z = c.s; }
    c.g.position.set(c.x, 0, c.z);
  }

  occupied(cw, peds) {
    return peds.some((p) => inRect(cw.c.rect, p.x, p.z, 0.15));
  }

  update(dt, peds, player) {
    for (const ln of this.lanes) {
      ln.timer -= dt;
      if (ln.timer <= 0) { if (this.cars.length < 8 + 3 * this.lanes.length * Math.min(1, this.rate)) this.spawn(ln); ln.timer = this.interval(); }
    }
    for (const it of this.intersections) { it.wait.x = Math.max(0, it.wait.x - dt); it.wait.z = Math.max(0, it.wait.z - dt); }

    for (const c of this.cars) {
      const ln = c.lane, dir = ln.dir;
      const front = c.s + dir * c.len / 2;
      const ahead = (v) => (v - front) * dir;
      let limit = Infinity, cause = null;
      // car in front
      let lead = null;
      for (const o of this.cars) {
        if (o === c || o.lane !== ln) continue;
        const gap = (o.s - c.s) * dir;
        if (gap > 0 && (!lead || gap < (lead.s - c.s) * dir)) lead = o;
        if (gap > 0) limit = Math.min(limit, gap - (c.len + o.len) / 2 - 1.3);
      }
      // crosswalks
      for (const cw of ln.cws) {
        const near = dir > 0 ? cw.a[0] : cw.a[1];
        const d = ahead(near);
        if (d > -0.2 && d < 25 && this.occupied(cw, peds)) {
          if (d - 0.7 < limit) { limit = d - 0.7; cause = peds.includes(player) && inRect(cw.c.rect, player.x, player.z, 0.15) ? 'player' : 'ped'; }
        }
      }
      // intersections: take turns
      for (const ix of ln.its) {
        const it = ix.it;
        const near = dir > 0 ? ix.a[0] : ix.a[1], far = dir > 0 ? ix.a[1] : ix.a[0];
        if (c.reserved.has(it)) {
          if (ahead(far) < -c.len - 0.5) { c.reserved.delete(it); it.cars.delete(c); if (!it.cars.size) it.owner = null; }
          continue;
        }
        const stop = ahead(near) - ix.sw - 0.8;
        if (stop < -0.5 || stop > 30) continue;
        const other = ln.axis === 'x' ? 'z' : 'x';
        // take turns: keep the flow going unless the other direction has waited a while;
        // when the box is free, whoever has waited longest goes first
        // don't block the box: only go if there's room on the far side
        const room = !lead || lead.speed > 2 || ((lead.s - far) * dir - lead.len / 2) > ix.sw + c.len + 1.5;
        const mayGo = room && (it.owner === ln.axis ? it.wait[other] <= 2.5
          : it.owner === null ? it.wait[ln.axis] >= it.wait[other] - 0.3 : false);
        if (mayGo && stop < 14) { it.owner = ln.axis; it.cars.add(c); c.reserved.add(it); it.wait[ln.axis] = 0; }
        else if (!mayGo) {
          if (stop < limit) { limit = stop; cause = 'light'; }
          if (stop < 3 && room) it.wait[ln.axis] += dt * 1.5;
        }
      }

      // speed control
      const brake = 16, accel = 5;
      const target = limit <= 0.05 ? 0 : Math.min(c.vmax, Math.sqrt(2 * brake * 0.7 * limit));
      const before = c.speed;
      if (target > c.speed) c.speed = Math.min(target, c.speed + accel * dt);
      else c.speed = Math.max(target, c.speed - brake * 1.6 * dt);
      c.honkCd -= dt;
      if (cause === 'player' && before > 3.2 && limit < 6 && c.honkCd <= 0) { c.honkCd = 5; this.onHonk?.(c, pick(HONKS)); }
      c.s += dir * c.speed * dt;
      this.place(c);
      // wheels spin
      c.spin = (c.spin || 0) + c.speed * dt / 0.33;
    }
    // despawn
    this.cars = this.cars.filter((c) => {
      if ((c.s - c.lane.end) * c.lane.dir > 0) {
        for (const it of c.reserved) { it.cars.delete(c); if (!it.cars.size) it.owner = null; }
        this.group.remove(c.g); return false;
      }
      return true;
    });
  }

  // Is the circle (x,z,r) overlapping a car? Returns the car and how to push out.
  hit(x, z, r) {
    for (const c of this.cars) {
      const ln = c.lane;
      const da = (ln.axis === 'x' ? x : z) - c.s, dp = (ln.axis === 'x' ? z : x) - ln.perp;
      if (Math.abs(da) < c.len / 2 + r && Math.abs(dp) < c.w / 2 + r) {
        // push out the short way
        const outA = (c.len / 2 + r + 0.05) - Math.abs(da), outP = (c.w / 2 + r + 0.05) - Math.abs(dp);
        let px = 0, pz = 0;
        if (outP <= outA) { const sgn = Math.sign(dp) || 1; if (ln.axis === 'x') pz = sgn * outP; else px = sgn * outP; }
        else { const sgn = Math.sign(da) || 1; if (ln.axis === 'x') px = sgn * outA; else pz = sgn * outA; }
        return { car: c, px, pz, moving: c.speed > 0.5 };
      }
    }
    return null;
  }

  // pedestrians only wait for cars that are actually moving (a car stopped for them is waiting too)
  blocks(x, z, r = 0.6) { const h = this.hit(x, z, r); return !!h && h.car.speed > 0.3; }

  setNight(on) {
    headMat.emissiveIntensity = on ? 2.2 : 0.3;
    tailMat.emissiveIntensity = on ? 1.6 : 0.3;
  }

  dispose() {
    this.scene.remove(this.group);
    this.cars = [];
  }
}
