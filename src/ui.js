import * as THREE from 'three';
import { SURF } from './grid.js';
import { CELL } from './config.js';

const $ = (id) => document.getElementById(id);
const fmt = (s) => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export class UI {
  constructor() {
    this.bubbleLayer = $('bubbles');
    this.bubbles = [];
    this.floats = [];
    this.v = new THREE.Vector3();
    this.hintTimer = 0;
    this.minimap = $('minimap');
    this.mctx = this.minimap.getContext('2d');
  }

  show(name) {
    for (const s of document.querySelectorAll('.screen')) s.classList.toggle('hidden', s.id !== `screen-${name}`);
  }
  hideScreens() { for (const s of document.querySelectorAll('.screen')) s.classList.add('hidden'); }
  hud(on) { $('hud').classList.toggle('hidden', !on); }
  touch(on) { $('touch-ui').classList.toggle('hidden', !on); }
  loading(p) { $('load-fill').style.width = `${Math.round(p * 100)}%`; }

  syncToggles(settings) {
    for (const b of document.querySelectorAll('[data-audio]')) b.classList.toggle('off', !settings[b.dataset.audio]);
  }

  setErrand(errand) {
    $('errand-title').textContent = errand.title;
    this.destName = errand.place;
  }
  setDistance(d) { $('errand-dest').textContent = `→ ${this.destName} · ${Math.round(d * 1.7)} m`; }

  setTimer(t) {
    const el = $('timer');
    el.textContent = fmt(t);
    el.classList.toggle('urgent', t <= 10);
  }

  setMeter(v) {
    $('meter-fill').style.width = `${Math.min(100, v)}%`;
    $('meter-face').textContent = v < 20 ? '🙂' : v < 45 ? '😬' : v < 70 ? '😣' : v < 90 ? '😖' : '🫠';
  }
  shakeMeter() { const m = $('meter'); m.classList.remove('shake'); void m.offsetWidth; m.classList.add('shake'); }

  setScore(score, streak) {
    $('score').textContent = Math.round(score).toLocaleString('en-US');
    const s = $('streak');
    s.textContent = streak > 1 ? `🔥 x${streak}` : '';
    s.classList.toggle('hidden', streak <= 1);
    const box = $('score-box'); box.classList.remove('pop'); void box.offsetWidth; box.classList.add('pop');
  }

  setCompass(angle) { $('compass-arrow').style.transform = `rotate(${angle}rad)`; }

  hint(text, secs = 5) {
    const h = $('hint'); h.textContent = text; h.style.opacity = 1; this.hintTimer = secs;
  }

  // ---------- speech bubbles ----------
  bubble(target, text, { cls = '', dur = 2.2, height = 1.55 } = {}) {
    // one bubble per speaker
    for (const b of this.bubbles) if (b.target === target && !b.el.classList.contains('alert')) b.life = 0;
    const el = document.createElement('div');
    el.className = `bubble ${cls}`; el.textContent = text;
    this.bubbleLayer.appendChild(el);
    this.bubbles.push({ el, target, life: dur, height });
  }

  floatText(pos, text, cls = '') {
    const el = document.createElement('div');
    el.className = `float ${cls}`; el.textContent = text;
    this.bubbleLayer.appendChild(el);
    this.floats.push({ el, pos: { x: pos.x, y: pos.y ?? 1.6, z: pos.z }, life: 1.2 });
  }

  clearBubbles() {
    for (const b of [...this.bubbles, ...this.floats]) b.el.remove();
    this.bubbles = []; this.floats = [];
  }

  update(dt, camera) {
    const w = innerWidth, h = innerHeight;
    const place = (el, x, y, z) => {
      this.v.set(x, y, z).project(camera);
      const vis = this.v.z < 1 && this.v.z > -1;
      el.style.display = vis ? '' : 'none';
      el.style.left = `${(this.v.x * 0.5 + 0.5) * w}px`;
      el.style.top = `${(-this.v.y * 0.5 + 0.5) * h}px`;
    };
    this.bubbles = this.bubbles.filter((b) => {
      b.life -= dt;
      const t = b.target;
      if (b.life <= 0 || (t.root && !t.root.visible && t.opacity < 0.05)) { b.el.remove(); return false; }
      place(b.el, t.x, (t.y || 0) + b.height, t.z);
      return true;
    });
    this.floats = this.floats.filter((f) => {
      f.life -= dt;
      if (f.life <= 0) { f.el.remove(); return false; }
      place(f.el, f.pos.x, f.pos.y, f.pos.z);
      return true;
    });
    if (this.hintTimer > 0) { this.hintTimer -= dt; if (this.hintTimer <= 0) $('hint').style.opacity = 0; }
  }

  // ---------- touch stick ----------
  showStick(ox, oy, sx, sy) {
    const s = $('stick'); s.style.display = 'block'; s.style.left = `${ox}px`; s.style.top = `${oy}px`;
    $('stick-knob').style.transform = `translate(${sx * 34}px, ${-sy * 34}px)`;
  }
  hideStick() { $('stick').style.display = 'none'; }

  // ---------- minimap ----------
  buildMinimap(world) {
    const grid = world.grid;
    const inAny = (rects, x, z) => rects.some(([x0, z0, x1, z1]) => x > x0 && x < x1 && z > z0 && z < z1);
    const c = document.createElement('canvas'); c.width = grid.w; c.height = grid.h;
    const g = c.getContext('2d');
    const img = g.createImageData(grid.w, grid.h);
    const col = {
      [SURF.BLOCKED]: [127, 207, 110], [SURF.SIDEWALK]: [236, 232, 244], [SURF.CROSSWALK]: [255, 255, 255],
      [SURF.PARK]: [150, 220, 130], [SURF.PATH]: [232, 216, 176],
    };
    for (let j = 0; j < grid.h; j++) for (let i = 0; i < grid.w; i++) {
      const k = j * grid.w + i, o = k * 4;
      let rgb = col[grid.surf[k]];
      const x = grid.cx(i), z = grid.cz(j);
      if (grid.surf[k] === SURF.BLOCKED) {
        if (inAny(world.roads, x, z)) rgb = [93, 91, 115];
        else if (inAny(world.water, x, z)) rgb = [79, 168, 222];
        else if (world.occluders.some((b) => x > b.min.x && x < b.max.x && z > b.min.z && z < b.max.z)) rgb = [176, 170, 196];
        else rgb = world.map.id === 'downtown' ? [150, 146, 168] : rgb;
      }
      img.data[o] = rgb[0]; img.data[o + 1] = rgb[1]; img.data[o + 2] = rgb[2]; img.data[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    this.mapImg = c; this.grid = grid;
  }

  drawMinimap(player, yaw, goal, home, npcs, cars = []) {
    const ctx = this.mctx, W = this.minimap.width, R = W / 2;
    const scale = 3.2; // px per world unit
    const g = this.grid;
    ctx.save();
    ctx.clearRect(0, 0, W, W);
    ctx.beginPath(); ctx.arc(R, R, R, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#7fcf6e'; ctx.fillRect(0, 0, W, W);
    // world (dx, dz) -> minimap, with the camera's forward pointing up
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    ctx.setTransform(-cy * scale, -sy * scale, sy * scale, -cy * scale, R, R);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.mapImg, g.x0 - player.x, g.z0 - player.z, g.w * CELL, g.h * CELL);
    const dot = (x, z, r, color) => { ctx.beginPath(); ctx.arc(x - player.x, z - player.z, r / scale, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); };
    for (const n of npcs) if (n.c.opacity > 0.3) dot(n.x, n.z, 5, n.kind === 'encounter' ? '#ff6b4a' : '#6b6584');
    for (const c of cars) dot(c.x, c.z, 6, '#ffd23f');
    if (home) dot(home.x, home.z, 8, '#3a6ee8');
    ctx.restore();
    // goal marker (clamped to the rim)
    ctx.save();
    ctx.translate(R, R);
    const dx = goal.x - player.x, dz = goal.z - player.z;
    let u = (-dx * cy + dz * sy) * scale, v = -(dx * sy + dz * cy) * scale;
    const m = Math.hypot(u, v), lim = R - 18;
    if (m > lim) { u *= lim / m; v *= lim / m; }
    ctx.font = '26px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('⭐', u, v);
    // player arrow
    ctx.rotate(yaw - player.heading);
    ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(10, 10); ctx.lineTo(0, 5); ctx.lineTo(-10, 10); ctx.closePath();
    ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#2b2540'; ctx.lineWidth = 3; ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}
