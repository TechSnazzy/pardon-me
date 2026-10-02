import * as THREE from 'three';
import { PLAYER } from './config.js';
import { Character, turnToward, headingOf } from './character.js';

export class Player {
  constructor(modelName, grid) {
    this.c = new Character(modelName);
    this.grid = grid;
    this.path = null;
    this.pathHurry = false;
    this.frozen = 0;
    this.hurrying = false;
    this.camFollow = 0;
    this.onBlocked = null;
    this.trail = [];  // recent positions for NPC reaction delay
    this.roads = [];
    this.marker = null;
    this.jumpY = 0; this.vy = 0; this.groundY = 0;
    this.onJump = null; this.onLand = null;
  }

  get airborne() { return this.jumpY > 0 || this.vy > 0; }

  get x() { return this.c.x; } get z() { return this.c.z; } get y() { return this.c.y; }
  get heading() { return this.c.heading; } get speed() { return this.c.speed; }
  get vx() { return this.c.vx; } get vz() { return this.c.vz; }

  place(x, z, heading) {
    Object.assign(this.c, { x, z, heading, speed: 0, vx: 0, vz: 0 });
    this.c.y = this.groundY = this.grid.heightAt(x, z);
    this.jumpY = 0; this.vy = 0;
    this.path = null; this.frozen = 0; this.trail = [];
  }

  setPath(path, hurry) {
    this.path = path && path.length > 1 ? path.slice(1) : null;
    this.pathHurry = hurry;
  }

  update(dt, input, cam, time) {
    const c = this.c;
    let dirX = 0, dirZ = 0, mag = 0;
    const mv = input.move();
    const mvMag = Math.hypot(mv.x, mv.y);
    this.camFollow = 0;

    if (this.frozen > 0) {
      this.frozen -= dt;
    } else if (mvMag > 0.1) {
      this.path = null;
      const f = cam.forward();
      dirX = f.x * mv.y - f.z * mv.x;
      dirZ = f.z * mv.y + f.x * mv.x;
      const m = Math.hypot(dirX, dirZ); dirX /= m; dirZ /= m;
      mag = Math.min(1, mvMag);
      // forward input swings the camera behind quickly; pure sidesteps swing it slowly; backing up doesn't
      this.camFollow = mv.y < -0.3 ? 0 : 0.3 + 0.7 * Math.max(0, mv.y);
    } else if (this.path) {
      const wp = this.path[0];
      const dx = wp.x - c.x, dz = wp.z - c.z, d = Math.hypot(dx, dz);
      if (d < (this.path.length > 1 ? 0.45 : 0.15)) {
        this.path.shift();
        if (!this.path.length) this.path = null;
      } else {
        dirX = dx / d; dirZ = dz / d;
        mag = this.path.length === 1 ? Math.min(1, d / 0.8 + 0.15) : 1;
        this.camFollow = 0.8;
      }
    }

    const hurry = (input.hurry || (this.path && this.pathHurry)) && !input.dawdle;
    this.hurrying = hurry && mag > 0.5;
    const top = input.dawdle ? PLAYER.dawdleSpeed : hurry ? PLAYER.hurrySpeed : PLAYER.walkSpeed;
    const tvx = dirX * top * mag, tvz = dirZ * top * mag;
    const a = 1 - Math.exp(-PLAYER.accel * dt);
    c.vx += (tvx - c.vx) * a; c.vz += (tvz - c.vz) * a;
    if (this.frozen > 0) { c.vx *= 0.85; c.vz *= 0.85; }

    const res = this.grid.moveSmart(c.x, c.z, c.vx * dt, c.vz * dt, PLAYER.radius);
    const realVx = (res.x - c.x) / Math.max(dt, 1e-4), realVz = (res.z - c.z) / Math.max(dt, 1e-4);
    if (res.blocked && mvMag > 0.3 && !this.path && Math.hypot(realVx, realVz) < top * mag * 0.35 && this.onBlocked) {
      const px = c.x + dirX * 0.6, pz = c.z + dirZ * 0.6;
      this.onBlocked(this.roads.some(([x0, z0, x1, z1]) => px > x0 && px < x1 && pz > z0 && pz < z1) ? 'road' : 'other');
    }
    c.x = res.x; c.z = res.z;
    c.speed = Math.hypot(realVx, realVz);
    if (res.blocked) { c.vx = realVx; c.vz = realVz; }

    const faceX = mag > 0.1 ? dirX : c.vx, faceZ = mag > 0.1 ? dirZ : c.vz;
    if (Math.hypot(faceX, faceZ) > 0.05 && this.frozen <= 0) {
      c.heading = turnToward(c.heading, headingOf(faceX, faceZ), PLAYER.turnRate * dt);
    }
    // jumping
    if (input.consumeJump() && !this.airborne && this.frozen <= 0) {
      this.vy = PLAYER.jumpSpeed;
      c.playOnce('jump');
      this.onJump?.();
    }
    if (this.airborne) {
      this.vy -= PLAYER.gravity * dt;
      this.jumpY += this.vy * dt;
      if (this.jumpY <= 0) { this.jumpY = 0; this.vy = 0; this.onLand?.(); }
    }
    const gy = this.grid.heightAt(c.x, c.z);
    this.groundY += (gy - this.groundY) * (1 - Math.exp(-18 * dt));
    c.y = this.groundY + this.jumpY;

    if (this.frozen <= 0 && !this.airborne) c.animateLocomotion(dt, { hurry: this.hurrying });
    c.sync(dt);

    this.trail.push({ t: time, x: c.x, z: c.z });
    while (this.trail.length > 2 && this.trail[1].t < time - 1) this.trail.shift();

    if (this.marker) {
      const end = this.path?.[this.path.length - 1];
      this.marker.visible = !!end;
      if (end) { this.marker.position.set(end.x, this.grid.heightAt(end.x, end.z) + 0.03, end.z); this.marker.rotation.z += dt * 2; }
    }
  }

  // Where was the player `delay` seconds ago?
  past(time, delay) {
    const t = time - delay;
    for (let i = this.trail.length - 1; i >= 0; i--) if (this.trail[i].t <= t) return this.trail[i];
    return this.trail[0] || { x: this.x, z: this.z };
  }

  // Predict future positions: [{x,z,t}], or null if standing still with no plan.
  predict(T, step) {
    const c = this.c;
    const moving = c.speed > 0.6;
    const sp = Math.max(c.speed, PLAYER.walkSpeed * 0.85);
    const out = [{ x: c.x, z: c.z, t: 0 }];
    if (this.path) {
      let x = c.x, z = c.z, t = 0, i = 0;
      while (t < T && i < this.path.length) {
        const wp = this.path[i];
        const dx = wp.x - x, dz = wp.z - z, d = Math.hypot(dx, dz);
        const s = sp * step;
        if (d <= s) { x = wp.x; z = wp.z; i++; t += d / sp; out.push({ x, z, t }); continue; }
        x += dx / d * s; z += dz / d * s; t += step; out.push({ x, z, t });
      }
      return out;
    }
    if (!moving) return null;
    let x = c.x, z = c.z;
    const dx = c.vx / c.speed, dz = c.vz / c.speed;
    for (let t = step; t <= T; t += step) {
      const r = this.grid.moveSmart(x, z, dx * sp * step, dz * sp * step, PLAYER.radius);
      if (Math.hypot(r.x - x, r.z - z) < sp * step * 0.3) break; // walked into a wall
      x = r.x; z = r.z; out.push({ x, z, t });
    }
    return out;
  }
}

export function makeMoveMarker() {
  const m = new THREE.Mesh(
    new THREE.RingGeometry(0.28, 0.42, 24, 1, 0, Math.PI * 1.6),
    new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.9, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.visible = false;
  return m;
}
