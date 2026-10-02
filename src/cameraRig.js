import * as THREE from 'three';
import { CAMERA } from './config.js';

// Third-person camera that trails behind the player and pulls in when a building is in the way.
export class CameraRig {
  constructor(camera, occluders) {
    this.camera = camera;
    this.occluders = occluders;
    this.yaw = 0;          // camera sits at -forward(yaw) from the player
    this.dist = CAMERA.distance;
    this.curDist = CAMERA.distance;
    this.manualHold = 0;
    this.pos = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.ray = new THREE.Ray();
    this.tmp = new THREE.Vector3();
    this.shake = 0;
  }

  forward() { return { x: Math.sin(this.yaw), z: Math.cos(this.yaw) }; }

  snap(player) {
    this.yaw = player.heading;
    this.update(0, player, 0, true);
  }

  // followWeight 0..1: how strongly to swing behind the player's heading this frame.
  update(dt, player, followWeight, snap = false) {
    if (this.manualHold > 0) this.manualHold -= dt;
    else if (followWeight > 0 && player.speed > 0.4) {
      // follow the direction actually travelled (so sliding along a curb lines the camera up with the sidewalk)
      let d = Math.atan2(player.vx, player.vz) - this.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.yaw += d * Math.min(1, CAMERA.followRate * followWeight * dt);
    }
    const f = this.forward();
    const target = this.tmp.set(player.x + f.x * CAMERA.lookAhead * 0.5, player.y + CAMERA.lookHeight, player.z + f.z * CAMERA.lookAhead * 0.5);

    // pull in if a building blocks the view
    let want = this.dist;
    const dir = new THREE.Vector3(-f.x * this.dist, CAMERA.height * this.dist / CAMERA.distance, -f.z * this.dist);
    const len = dir.length(); dir.normalize();
    this.ray.set(target, dir);
    const hit = new THREE.Vector3();
    for (const b of this.occluders) {
      if (this.ray.intersectBox(b, hit)) {
        const d = hit.distanceTo(target);
        if (d < len) want = Math.min(want, Math.max(CAMERA.minDist, d / len * this.dist - 0.6));
      }
    }
    this.curDist = snap ? want : THREE.MathUtils.lerp(this.curDist, want, 1 - Math.exp(-(want < this.curDist ? 14 : 3) * dt));

    const k = this.curDist / CAMERA.distance;
    const desired = new THREE.Vector3(player.x - f.x * this.curDist, player.y + CAMERA.height * Math.max(k, 0.75) + 0.4, player.z - f.z * this.curDist);
    if (snap) { this.pos.copy(desired); this.look.copy(target); }
    else {
      this.pos.lerp(desired, 1 - Math.exp(-10 * dt));
      this.look.lerp(target, 1 - Math.exp(-12 * dt));
    }
    this.camera.position.copy(this.pos);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 3);
      const s = this.shake * 0.15;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
    }
    this.camera.lookAt(this.look);
  }

  rotate(delta) { this.yaw += delta; if (delta) this.manualHold = 1.2; }
  zoom(steps) { this.dist = THREE.MathUtils.clamp(this.dist + steps * 0.8, CAMERA.minDist + 1, CAMERA.maxDist); }
}
