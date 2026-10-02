import * as THREE from 'three';
import { CHAR_SCALE } from './config.js';
import * as A from './assets.js';

const ARM_TRACK = /^arm-(left|right)\./;
let clipSet = null;

function buildClips() {
  const src = A.animationClips();
  const byName = Object.fromEntries(src.map((c) => [c.name, c]));
  const noArms = (c, name) => new THREE.AnimationClip(name, c.duration, c.tracks.filter((t) => !ARM_TRACK.test(t.name)));
  clipSet = {
    ...byName,
    'walk-legs': noArms(byName.walk, 'walk-legs'),
    'idle-legs': noArms(byName.idle, 'idle-legs'),
    'sprint-legs': noArms(byName.sprint, 'sprint-legs'),
  };
}

const ONCE = new Set(['emote-no', 'emote-yes', 'pick-up', 'interact-right', 'interact-left', 'fall', 'die', 'jump']);
// Stride length per walk-cycle, used to keep feet from sliding.
const STRIDE = { walk: 1.7, 'walk-legs': 1.7, sprint: 2.6, 'sprint-legs': 2.6 };

export class Character {
  constructor(modelName, { scale = CHAR_SCALE } = {}) {
    if (!clipSet) buildClips();
    this.modelName = modelName;
    this.root = new THREE.Group();
    this.model = A.character(modelName);
    this.model.scale.setScalar(scale);
    this.root.add(this.model);
    // per-instance materials so we can fade characters individually
    this.materials = [];
    this.model.traverse((o) => {
      if (o.isMesh) { o.material = o.material.clone(); this.materials.push(o.material); o.frustumCulled = false; }
    });
    this.mixer = new THREE.AnimationMixer(this.model);
    this.actions = {};
    this.base = null;    // looping locomotion action
    this.overlay = null; // arms-only pose (stroller, phone)
    this.oneShot = null;
    this.x = 0; this.z = 0; this.y = 0;
    this.heading = 0;    // radians, 0 = facing +z
    this.speed = 0;
    this.vx = 0; this.vz = 0;
    this.opacity = 1;
    this.mixer.addEventListener('finished', (e) => {
      if (this.oneShot && e.action === this.oneShot) {
        this.oneShot.fadeOut(0.2); this.oneShot = null;
        this.base?.reset().fadeIn(0.2).play();
        this.overlay?.reset().fadeIn(0.2).play();
      }
    });
  }

  action(name) {
    if (!this.actions[name]) {
      const clip = clipSet[name];
      if (!clip) return null;
      const a = this.mixer.clipAction(clip);
      if (ONCE.has(name)) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
      this.actions[name] = a;
    }
    return this.actions[name];
  }

  setBase(name, fade = 0.2) {
    if (this.base?._clip.name === name) return;
    const next = this.action(name);
    if (!next) return;
    if (this.oneShot) { this.base?.stop(); this.base = next; return; }
    next.reset().play();
    if (this.base) next.crossFadeFrom(this.base, fade, false);
    this.base = next;
  }

  setOverlay(name) {
    if ((this.overlay?._clip.name || null) === (name || null)) return;
    this.overlay?.fadeOut(0.2);
    this.overlay = name ? this.action(name) : null;
    this.overlay?.reset().fadeIn(0.2).play();
  }

  playOnce(name) {
    const a = this.action(name);
    if (!a) return;
    this.oneShot?.stop();
    this.base?.fadeOut(0.15);
    this.overlay?.fadeOut(0.15);
    a.reset().fadeIn(0.1).play();
    this.oneShot = a;
  }

  // Choose a locomotion clip from current speed.
  animateLocomotion(dt, { hurry = false, armsBusy = false } = {}) {
    const s = this.speed;
    const legs = armsBusy ? '-legs' : '';
    if (s < 0.25) this.setBase(armsBusy ? 'idle-legs' : 'idle');
    else if (hurry && s > 3.6) this.setBase(`sprint${legs}`);
    else this.setBase(`walk${legs}`);
    const b = this.base;
    if (b) {
      const stride = STRIDE[b._clip.name];
      b.timeScale = stride ? Math.max(0.35, s / stride * b._clip.duration * 1.2) : 1;
    }
  }

  setOpacity(o) {
    if (o === this.opacity) return;
    this.opacity = o;
    for (const m of this.materials) { m.transparent = o < 1; m.opacity = o; m.depthWrite = o >= 1; }
    this.root.visible = o > 0.01;
  }

  sync(dt) {
    this.mixer.update(dt);
    this.root.position.set(this.x, this.y, this.z);
    this.root.rotation.y = this.heading;
  }

  dispose() {
    this.mixer.stopAllAction();
    this.root.removeFromParent();
    for (const m of this.materials) m.dispose();
  }
}

export function turnToward(cur, target, maxStep) {
  let d = target - cur;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return cur + Math.max(-maxStep, Math.min(maxStep, d));
}

export function headingOf(dx, dz) { return Math.atan2(dx, dz); }
