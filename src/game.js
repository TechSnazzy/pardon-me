import * as THREE from 'three';
import { HERO_NAME, BUMP, NPC as NPCCFG, DIRECTOR } from './config.js';
import * as A from './assets.js';
import { buildWorld, WORLD_MODELS } from './world.js';
import { Player, makeMoveMarker } from './player.js';
import { Npc, LINES } from './npc.js';
import { Director } from './director.js';
import { CameraRig } from './cameraRig.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { Sound } from './audio.js';
import { Traffic } from './traffic.js';
import { LEVELS, DIFFICULTIES, TIME_OF_DAY, MAPS } from './levels.js';

const PLAYER_MODEL = 'character-male-e';
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const fmt = (n) => Math.round(n).toLocaleString('en-US');

// Points (before the difficulty multiplier)
const PTS = { finish: 1000, perSecond: 50, clean: 500, dodge: 150, bump: -200, car: -300, honk: -50 };
export const DIFF_MULT = [1, 1.5, 2, 3, 5];

const HERO_BUMP = ['Pardon me!', 'Oh! Pardon me.', 'Sorry! Pardon!', 'Pardon me…', 'Excuse me!', 'My fault! Pardon!', 'PARDON ME.', 'Oop, pardon!'];
const HERO_HURRY_BUMP = ['WHOA, sorry!', 'Pardon me, coming through! …Too late.', 'Sorry sorry sorry!'];
const HERO_DODGE = ['Close one.', 'Not today.', 'Phew.', 'Ha!', 'Smooth.'];
const HERO_DOOR = ['After you.', 'Oh, no, please, after you.', 'I insist.', '…Okay, I\'ll go.'];
const HERO_CAR = ['WHOA! Sorry!', 'My bad! My bad!', 'Sorry! Didn\'t see you there!', 'Eek!'];
const JAYWALK = [`${HERO_NAME} does not jaywalk.`, 'Crosswalks exist for a reason.', 'Not without a crosswalk.'];
const LAWN = ['Not on the lawn.', "That's somebody's yard.", 'Nope.'];
const CAR_TYPES = {
  suburb: ['sedan', 'hatch', 'sedan', 'van'],
  downtown: ['taxi', 'sedan', 'taxi', 'van', 'hatch'],
  riverside: ['sedan', 'hatch', 'van', 'icecream'],
};

// config values a difficulty overrides; keep the originals to rebuild from
const NPC_BASE = { ...NPCCFG };
const BUMP_BASE = { ...BUMP };

export class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.ui = new UI();
    this.sound = new Sound();
    this.ui.syncToggles(this.sound.settings);
    this.state = 'loading';
    this.time = 0;
    this.npcs = [];
    this.timers = [];
    this.progress = { unlocked: 0, best: {}, scores: {}, diff: 3 };
    try { Object.assign(this.progress, JSON.parse(localStorage.getItem('pardon-me-progress') || '{}')); } catch { /* storage unavailable */ }
    this.progress.scores ||= {};
  }

  saveProgress() { try { localStorage.setItem('pardon-me-progress', JSON.stringify(this.progress)); } catch { /* ignore */ } }

  async init() {
    const r = this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.outputColorSpace = THREE.SRGBColorSpace;

    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color('#9fd6f4');
    scene.fog = new THREE.Fog('#9fd6f4', 45, 120);
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 300);
    this.hemi = new THREE.HemisphereLight('#e8f4ff', '#6f8a5e', 1.5);
    scene.add(this.hemi);
    const sun = this.sun = new THREE.DirectionalLight('#fff3dc', 2.4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 140 });
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
    scene.add(sun, sun.target);
    // street-lamp glow pool for night levels
    this.lampLights = [];
    for (let i = 0; i < 6; i++) {
      const l = new THREE.PointLight('#ffd890', 0, 16, 1.4);
      scene.add(l); this.lampLights.push(l);
    }

    addEventListener('resize', () => this.resize());
    this.resize();

    const chars = A.CHARACTER_MODELS.map((m) => `characters/${m}`);
    await A.loadAll([...chars, ...WORLD_MODELS], (p) => this.ui.loading(p));

    this.player = new Player(PLAYER_MODEL, null);
    scene.add(this.player.c.root);
    this.player.marker = makeMoveMarker();
    scene.add(this.player.marker);
    this.player.onBlocked = (what) => this.onBlocked(what);
    this.player.onJump = () => this.sound.jump();
    this.player.onLand = () => this.sound.footstep(true);
    this.rig = new CameraRig(this.camera, []);
    this.input = new Input(this.canvas, this.ui);
    this.director = new Director(this);
    this.makeBeacon();
    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.1);
    this.frustum = new THREE.Frustum();
    this.projM = new THREE.Matrix4();

    this.ctx = {
      grid: null,
      graph: null,
      player: this.player,
      time: 0,
      arrival: (pt) => this.director.arrival(pt),
      say: (npc, text) => this.say(npc, text),
      onAlert: (npc) => this.onAlert(npc),
      inView: (x, z) => this.inView(x, z),
      carBlocks: (x, z) => !!this.traffic?.blocks(x, z, 0.55),
      doorPoint: null,
    };

    this.bindUI();
    this.showTitle();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 68 : 55;
    this.camera.updateProjectionMatrix();
  }

  get diff() { return DIFFICULTIES[this.progress.diff - 1]; }

  // ---------- world / settings ----------
  loadMap(mapId) {
    if (this.world?.map.id === mapId) return;
    this.clearNpcs();
    this.traffic?.dispose(); this.traffic = null;
    this.world?.dispose();
    this.world = buildWorld(this.scene, mapId);
    this.ui.buildMinimap(this.world);
    this.rig.occluders = this.world.occluders;
    this.player.grid = this.world.grid;
    this.player.roads = this.world.roads;
    this.ctx.grid = this.world.grid;
    this.ctx.graph = this.world.graph;
  }

  applyTimeOfDay(tod) {
    const t = TIME_OF_DAY[tod];
    this.tod = t;
    this.scene.background.set(t.sky);
    this.scene.fog.color.set(t.sky);
    [this.scene.fog.near, this.scene.fog.far] = t.fog;
    this.hemi.color.set(t.hemi[0]); this.hemi.groundColor.set(t.hemi[1]); this.hemi.intensity = t.hemi[2];
    this.sun.color.set(t.sun[0]); this.sun.intensity = t.sun[1];
    for (const l of this.lampLights) l.intensity = t.night ? 26 : 0;
    this.traffic?.setNight(t.night);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.sky);
  }

  applyDifficulty() {
    const d = this.diff;
    Object.assign(NPCCFG, NPC_BASE, { steerRate: d.steerRate, reactionDelay: d.reactionDelay, commitDist: d.commitDist, maxSpeed: d.maxSpeed });
    Object.assign(BUMP, BUMP_BASE, { awkwardDecay: d.decay });
    DIRECTOR.cooldown = d.cooldown;
    DIRECTOR.maxActive = d.maxActive;
    DIRECTOR.startGrace = d.grace;
    this.cooldownScale = 1;
    this.awkMul = d.awk;
  }

  // ---------- menus ----------
  bindUI() {
    const $ = (id) => document.getElementById(id);
    for (const b of document.querySelectorAll('[data-audio]')) {
      b.addEventListener('click', () => { this.sound.init(); this.sound.toggle(b.dataset.audio); this.ui.syncToggles(this.sound.settings); this.sound.ui(); });
    }
    $('go-btn').addEventListener('click', () => this.begin());
    $('resume-btn').addEventListener('click', () => this.resume());
    $('restart-btn').addEventListener('click', () => this.startLevel(this.levelIndex));
    $('quit-btn').addEventListener('click', () => this.showTitle());
    $('again-btn').addEventListener('click', () => this.startLevel(this.levelIndex));
    $('next-btn').addEventListener('click', () => this.startLevel(this.levelIndex + 1));
    $('menu-btn').addEventListener('click', () => this.showTitle());
    $('pause-btn').addEventListener('click', () => this.pause());
    $('reset-btn').addEventListener('click', () => this.resetGame());
    $('reset-btn-2').addEventListener('click', () => this.resetGame());
    const hb = $('hurry-btn');
    const setH = (on) => { this.input.touchHurry = on; hb.classList.toggle('on', on); };
    hb.addEventListener('touchstart', (e) => { e.preventDefault(); setH(true); }, { passive: false });
    hb.addEventListener('touchend', () => setH(false));
    hb.addEventListener('touchcancel', () => setH(false));
    hb.addEventListener('mousedown', () => setH(true));
    hb.addEventListener('mouseup', () => setH(false));
    const jb = $('jump-btn');
    const jump = (e) => { e.preventDefault(); if (this.state === 'play') this.input.jumpQueued = true; };
    jb.addEventListener('touchstart', jump, { passive: false });
    jb.addEventListener('mousedown', jump);
    this.input.on('touch', () => { if (this.state === 'play') this.ui.touch(true); });
    this.input.on('key', (k) => {
      if ((k === 'escape' || k === 'p') && this.state === 'play') this.pause();
      else if ((k === 'escape' || k === 'p') && this.state === 'paused') this.resume();
      else if (k === 'm') { this.sound.init(); this.sound.toggle('music'); this.ui.syncToggles(this.sound.settings); }
      else if (k === 'enter' && this.state === 'intro') this.begin();
      else if (k === 'enter' && this.state === 'end' && this.endReady) {
        if (this.lastWon && this.levelIndex + 1 < LEVELS.length) this.startLevel(this.levelIndex + 1);
        else this.startLevel(this.levelIndex);
      }
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'play') this.pause(); });
  }

  showTitle() {
    this.state = 'title';
    this.sound.stopMusic();
    this.ui.hud(false); this.ui.touch(false);
    this.ui.clearBubbles();
    this.renderTitle();
    this.ui.show('title');
    // the neighborhood drifts by behind the menu
    this.levelIndex = Math.min(this.progress.unlocked, LEVELS.length - 1);
    this.prepareLevel(LEVELS[this.levelIndex]);
    this.titleOrbit = 0;
  }

  renderTitle() {
    const $ = (id) => document.getElementById(id);
    const row = $('diff-row');
    row.innerHTML = '';
    for (const d of DIFFICULTIES) {
      const b = document.createElement('button');
      b.className = `diff-btn${d.n === this.progress.diff ? ' on' : ''}`;
      b.textContent = d.n;
      b.title = d.name;
      b.addEventListener('click', () => { this.sound.init(); this.sound.ui(); this.progress.diff = d.n; this.saveProgress(); this.renderTitle(); });
      row.appendChild(b);
    }
    $('diff-name').textContent = this.diff.name;
    $('diff-blurb').textContent = `${this.diff.blurb} (Score ×${DIFF_MULT[this.diff.n - 1]})`;
    const total = Object.values(this.progress.scores).reduce((a, b) => a + b, 0);
    $('score-total').textContent = total ? `High score total: ${fmt(total)}` : 'Finish errands to post high scores.';
    const list = $('level-list');
    list.innerHTML = '';
    LEVELS.forEach((lv, i) => {
      const locked = i > this.progress.unlocked;
      const b = document.createElement('button');
      b.className = `errand-btn${locked ? ' locked' : ''}`;
      b.disabled = locked;
      const stars = this.progress.best[lv.id]?.[this.progress.diff] || 0;
      b.innerHTML = `<span class="num">${i + 1}</span><span class="emoji">${locked ? '🔒' : lv.emoji}</span><span><div class="t"></div><div class="s"></div></span><span class="stars">${locked ? '' : '★'.repeat(stars) + '☆'.repeat(3 - stars)}</span>`;
      b.querySelector('.t').textContent = locked ? 'Locked' : lv.title;
      const hi = this.progress.scores[lv.id];
      b.querySelector('.s').textContent = `${MAPS[lv.map].name} · ${TIME_OF_DAY[lv.tod].label}${hi ? ` · Best ${fmt(hi)}` : ''}`;
      if (!locked) b.addEventListener('click', () => { this.sound.init(); this.sound.ui(); this.startLevel(i); });
      list.appendChild(b);
    });
  }

  // Wipe unlocked levels, stars and high scores (keeps the difficulty and sound settings).
  resetGame() {
    if (!confirm('Reset the whole game? This locks every level again and clears all stars and high scores.')) return;
    this.progress = { unlocked: 0, best: {}, scores: {}, diff: this.progress.diff };
    this.saveProgress();
    speechSynthesis?.cancel();
    this.showTitle();
  }

  // Build the town and set the scene for a level (no intro card).
  prepareLevel(level) {
    this.level = level;
    this.loadMap(level.map);
    this.applyDifficulty();
    this.applyTimeOfDay(level.tod);
    this.resetLevel();
  }

  startLevel(i) {
    if (i >= LEVELS.length) { this.showTitle(); return; }
    this.levelIndex = i;
    const level = LEVELS[i];
    this.prepareLevel(level);
    this.state = 'intro';
    const $ = (id) => document.getElementById(id);
    $('intro-label').textContent = `LEVEL ${i + 1} · ${MAPS[level.map].name.toUpperCase()} · ${TIME_OF_DAY[level.tod].label.toUpperCase()}`;
    $('intro-title').textContent = level.title;
    $('intro-blurb').textContent = level.blurb;
    $('intro-place').textContent = level.place;
    $('intro-time').textContent = `${this.timeLimit} seconds`;
    $('intro-diff').textContent = `Difficulty ${this.diff.n}: ${this.diff.name}`;
    this.ui.show('intro');
    this.ui.hud(false);
  }

  clearNpcs() {
    for (const n of this.npcs) n.c.dispose();
    this.npcs = [];
  }

  resetLevel() {
    const level = this.level, map = MAPS[level.map];
    this.clearNpcs();
    this.timers = [];
    this.ui.clearBubbles();
    this.goalDoor = this.world.doors[level.goal];
    this.ctx.doorPoint = this.goalDoor;
    // where we start
    const st = map.starts[level.start];
    if (st.door) {
      const d = this.world.doors[st.door];
      this.player.place(d.x + d.f.x * 2.2, d.z + d.f.z * 2.2, Math.atan2(d.f.x, d.f.z));
    } else this.player.place(st.x, st.z, st.heading);
    this.startPoint = { x: this.player.x, z: this.player.z };
    this.player.c.setBase('idle');
    this.player.c.setOpacity(1);
    this.player.c.sync(0);
    this.rig.dist = 6.2;
    this.rig.snap(this.player);
    this.director.reset();
    // fresh traffic
    this.traffic?.dispose();
    this.traffic = new Traffic(this.scene, this.world, { rate: this.diff.carRate, speed: this.diff.carSpeed, types: CAR_TYPES[map.id] });
    this.traffic.onHonk = (car, line) => this.onHonk(car, line);
    this.traffic.setNight(this.tod.night);
    this.timeLimit = Math.round(level.time * this.diff.time);
    this.timeLeft = this.timeLimit;
    this.awkward = 0;
    this.points = 0;
    this.streak = 0;
    this.mult = DIFF_MULT[this.diff.n - 1];
    this.ui.setScore(0, 0);
    this.bumps = 0;
    this.carBumps = 0;
    this.walked = 0;
    this.stepAcc = 0;
    this.blockSay = 0;
    this.carHitCd = 0;
    this.lastTick = 99;
    this.firstAlertHint = false;
    this.lampTimer = 0;
    this.placeBeacon();
    this.ambientTarget = Math.max(1, (map.ambient || 6) + (level.ambient || 0) + this.diff.ambient);
    for (let i = 0; i < this.ambientTarget; i++) this.spawnAmbient(true);
    // run the cars for a moment so the streets look lived-in
    for (let i = 0; i < 30; i++) this.traffic.update(0.1, [], this.player);
  }

  begin() {
    this.sound.init();
    this.ui.hideScreens();
    this.ui.hud(true);
    this.ui.setErrand(this.level);
    this.ui.touch(this.input.usedTouch || matchMedia('(pointer: coarse)').matches);
    this.state = 'play';
    this.input.enabled = true;
    this.rig.snap(this.player);
    this.sound.urgent = false;
    this.sound.startMusic();
    const touch = this.input.usedTouch || matchMedia('(pointer: coarse)').matches;
    this.ui.hint(touch
      ? 'Drag on the left to walk · tap somewhere to walk there · hold HURRY · tap JUMP'
      : 'WASD / arrows to walk · Shift to sprint · Space to jump · C to dawdle · or click where to go', 7);
    this.later(0.6, () => this.say(this.player, pick(['Quick trip. In and out.', 'Easy. Piece of cake.', 'What could possibly go wrong?', 'Just walk normally. Like a normal person.']), 'thought'));
  }

  pause() {
    if (this.state !== 'play') return;
    this.state = 'paused';
    this.input.enabled = false;
    this.sound.stopMusic();
    speechSynthesis?.cancel();
    this.ui.show('pause');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.ui.hideScreens();
    this.state = 'play';
    this.input.enabled = true;
    this.sound.startMusic();
  }

  // ---------- beacon over the destination ----------
  makeBeacon() {
    const g = this.beacon = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.25, 40), new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.85, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.17;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 30, 24, 1, true), new THREE.MeshBasicMaterial({ color: '#ffe680', transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.y = 15;
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.8, 4), new THREE.MeshStandardMaterial({ color: '#ff6b4a', emissive: '#7a2010' }));
    arrow.rotation.x = Math.PI; arrow.position.y = 3.6;
    g.add(ring, beam, arrow);
    this.beaconArrow = arrow; this.beaconRing = ring;
    this.scene.add(g);
  }
  placeBeacon() {
    const d = this.goalDoor;
    this.beacon.position.set(d.x + d.f.x * 0.9, this.world.grid.heightAt(d.x + d.f.x * 0.9, d.z + d.f.z * 0.9), d.z + d.f.z * 0.9);
  }

  // ---------- NPCs ----------
  randomModel() {
    return pick(A.CHARACTER_MODELS.filter((m) => m !== PLAYER_MODEL));
  }

  spawnNpc(plan) {
    const npc = new Npc(this.randomModel(), { kind: 'encounter', role: plan.role, variant: plan.variant, route: plan.route, delay: plan.delay || 0 });
    npc.meet = plan.meet || null;
    npc.meetIdx = plan.meetIdx ?? 0;
    npc.enterDoor = !!plan.enterDoor;
    npc.spawnAt(plan.x, plan.z, plan.heading);
    npc.c.y = this.world.grid.heightAt(plan.x, plan.z);
    npc.c.sync(0);
    this.scene.add(npc.c.root);
    this.npcs.push(npc);
    return npc;
  }

  spawnAmbient(initial = false) {
    const p = this.player;
    const nodes = this.world.graph.filter((n) => {
      const d = Math.hypot(n.x - p.x, n.z - p.z);
      return d > (initial ? 12 : 22) && d < 50 && (initial || !this.inView(n.x, n.z));
    });
    if (!nodes.length) return;
    const n = pick(nodes);
    const variants = MAPS[this.level.map].ambientVariants;
    let variant = null;
    if (variants && Math.random() < 0.45) variant = pick(variants);
    else if (Math.random() < 0.15) variant = 'phone';
    const npc = new Npc(this.randomModel(), { kind: 'ambient', lane: (Math.random() - 0.5) * 1.6, delay: 0, variant });
    const nb = pick(n.links);
    npc.spawnAt(n.x, n.z, Math.atan2(nb.x - n.x, nb.z - n.z));
    npc.graphPrev = n; npc.graphTarget = nb;
    npc.leaving = true;
    npc.c.y = this.world.grid.heightAt(n.x, n.z);
    if (initial) { npc.fade = 1; npc.c.setOpacity(1); }
    this.scene.add(npc.c.root);
    this.npcs.push(npc);
  }

  inView(x, z) {
    this.projM.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projM);
    return this.frustum.containsPoint(new THREE.Vector3(x, 1, z)) && Math.hypot(x - this.camera.position.x, z - this.camera.position.z) < 70;
  }

  // ---------- talking ----------
  say(who, text, cls = '') {
    const isPlayer = who === this.player;
    const target = isPlayer ? this.player.c : who.c || who;
    this.ui.bubble(target, text, { cls: cls || (isPlayer ? 'player' : ''), dur: Math.max(1.8, text.length * 0.07), height: who.c ? 1.55 : 2.1 });
    if (cls === 'thought') return;
    if (isPlayer) this.sound.speak(text, { pitch: 1.0, rate: 1.1, voiceIndex: 0 });
    else this.sound.speak(text, { pitch: 0.7 + (((who.id || 3) * 37) % 9) / 10, rate: 1.15, voiceIndex: (who.id || 5) * 7 + 1 });
  }

  later(t, fn) { this.timers.push({ t, fn }); }

  addPoints(n, at, note = '') {
    this.points += n;
    this.ui.setScore(Math.max(0, this.points * this.mult), this.streak);
    const shown = Math.round(n * this.mult);
    this.ui.floatText({ x: at.x, y: (at.y || 0) + 2.6, z: at.z }, `${shown > 0 ? '+' : ''}${fmt(shown)}${note ? ` ${note}` : ''}`, shown > 0 ? 'good pts' : 'bad pts');
  }

  onAlert(npc) {
    this.sound.sting();
    this.ui.bubble(npc.c, '!', { cls: 'alert', dur: 1.0, height: 1.75 });
    if (!this.firstAlertHint) {
      this.firstAlertHint = true;
      this.ui.hint('Uh oh. Sidestep, slow down, or hurry past!', 4);
    }
  }

  onDodge() {
    this.sound.dodge();
    this.ui.floatText({ x: this.player.x, y: this.player.y + 1.9, z: this.player.z }, pick(['Dodged!', 'Nice!', 'Slick!', 'Close call!']), 'good');
    this.awkward = Math.max(0, this.awkward - 6);
    this.streak++;
    this.addPoints(PTS.dodge * this.streak, this.player, this.streak > 1 ? `x${this.streak} streak` : '');
    if (Math.random() < 0.4) this.say(this.player, pick(HERO_DODGE));
  }

  onBlocked(what) {
    if (this.blockSay > 0 || this.state !== 'play') return;
    this.blockSay = 6;
    this.say(this.player, pick(what === 'road' ? JAYWALK : LAWN), 'thought');
  }

  onHonk(car, line) {
    if (this.state !== 'play') return;
    this.sound.honk();
    this.ui.bubble(car, line, { dur: 2.0, height: 2.2 });
    this.ui.floatText({ x: car.x, y: 2.6, z: car.z }, 'HONK!', 'bad');
    this.awkward += 3 * this.diff.honk;
    this.addPoints(PTS.honk, car);
    this.ui.shakeMeter();
  }

  // ---------- bumping ----------
  checkBumps() {
    const p = this.player;
    if (p.frozen > 0) return;
    for (const n of this.npcs) {
      if (!n.bumpable || n.ghost > 0 || n.state === 'pending' || n.c.opacity < 0.6) continue;
      const h = n.hitPoint();
      const d = Math.hypot(h.x - p.x, h.z - p.z);
      if (d > BUMP.dist + (n.radius - NPCCFG.radius)) continue;
      // only count it if they're actually closing on each other (standing still is a valid, if slow, strategy)
      const nvx = Math.sin(n.c.heading) * n.c.speed, nvz = Math.cos(n.c.heading) * n.c.speed;
      const rx = (p.x - h.x) / (d || 1), rz = (p.z - h.z) / (d || 1);
      const closing = -((p.vx - nvx) * rx + (p.vz - nvz) * rz);
      if (closing < 0.6) continue;
      this.bump(n, h);
      break;
    }
  }

  bump(n, h) {
    const p = this.player, grid = this.world.grid;
    const hurry = p.hurrying;
    const ambient = n.kind === 'ambient';
    n.bumped = true; n.bumpable = false;
    if (!n.outcome) n.outcome = 'bumped';
    this.bumps++;
    this.streak = 0;
    this.addPoints(PTS.bump, { x: (this.player.x + n.x) / 2, z: (this.player.z + n.z) / 2 });
    let dx = p.x - h.x, dz = p.z - h.z; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
    const k = BUMP.knockback * (hurry ? 1.6 : 1);
    const r1 = grid.move(p.x, p.z, dx * k, dz * k, 0.3); p.c.x = r1.x; p.c.z = r1.z;
    const r2 = grid.move(n.c.x, n.c.z, -dx * k * 0.6, -dz * k * 0.6, 0.28); n.c.x = r2.x; n.c.z = r2.z;
    p.c.vx = p.c.vz = 0; p.c.speed = 0;
    const freeze = ambient ? BUMP.freeze * 0.7 : hurry ? BUMP.hurryFreeze : BUMP.freeze;
    p.frozen = freeze;
    // face each other for the awkward moment
    p.c.heading = Math.atan2(-dx, -dz); n.c.heading = Math.atan2(dx, dz);
    p.c.playOnce(hurry ? 'emote-no' : 'emote-yes');
    n.c.playOnce('emote-no');
    n.state = 'frozen'; n.stopTimer = freeze + 0.3;
    const add = ambient ? BUMP.ambientAwkward : hurry ? BUMP.hurryAwkward : BUMP.awkward;
    this.awkward += add * this.awkMul;
    this.ui.shakeMeter();
    this.ui.floatText({ x: (p.x + n.x) / 2, y: 2.2, z: (p.z + n.z) / 2 }, hurry ? 'WHUMP!' : 'BUMP!', 'bad');
    this.sound.bump(hurry);
    this.rig.shake = hurry ? 1 : 0.6;

    if (n.role === 'door') {
      // the classic doorway standoff
      p.frozen = 3.4; n.stopTimer = 3.6;
      this.say(this.player, HERO_DOOR[0]);
      this.later(0.9, () => this.say(n, pick(LINES.door)));
      this.later(1.8, () => this.say(this.player, HERO_DOOR[1 + ((Math.random() * 2) | 0)]));
      this.later(2.7, () => this.say(n, pick(LINES.door)));
      this.later(3.6, () => { if (n.enterDoor) { n.state = 'enter'; } else n.leave(this.ctx); });
      this.awkward += 6 * this.awkMul;
      return;
    }
    this.say(this.player, pick(hurry ? HERO_HURRY_BUMP : HERO_BUMP));
    this.later(0.7, () => this.say(n, pick(n.lines())));
  }

  // Walking into a car that's already going through the crosswalk.
  checkCars(dt) {
    const p = this.player, grid = this.world.grid;
    this.carHitCd -= dt;
    const h = this.traffic.hit(p.x, p.z, 0.32);
    if (h) {
      const r = grid.move(p.x, p.z, h.px * 1.2, h.pz * 1.2, 0.3); p.c.x = r.x; p.c.z = r.z;
      if (h.moving && this.carHitCd <= 0 && p.frozen <= 0) {
        this.carHitCd = 2.5;
        this.carBumps++; this.bumps++;
        this.streak = 0;
        this.addPoints(PTS.car, p);
        p.c.vx = p.c.vz = 0; p.frozen = 1.0;
        p.c.playOnce('emote-no');
        this.awkward += 12 * this.awkMul;
        this.sound.honk(); this.sound.bump(false);
        this.rig.shake = 0.8;
        this.ui.shakeMeter();
        this.ui.floatText({ x: p.x, y: 2.4, z: p.z }, 'BOINK!', 'bad');
        this.say(this.player, pick(HERO_CAR));
        this.later(0.6, () => this.ui.bubble(h.car, pick(["Watch where you're walkin'!", 'HEY! The paint!', 'Are you kidding me?!', 'Crosswalk means LOOK, pal!']), { dur: 2.2, height: 2.2 }));
      }
    }
    for (const n of this.npcs) {
      const hn = this.traffic.hit(n.c.x, n.c.z, 0.3);
      if (hn) { n.c.x += hn.px; n.c.z += hn.pz; }
    }
  }

  separate() {
    const p = this.player, list = this.npcs;
    for (const n of list) {
      if (n.state === 'pending' || n.state === 'gone') continue;
      const dx = n.c.x - p.x, dz = n.c.z - p.z, d = Math.hypot(dx, dz);
      if (d < 0.6 && d > 1e-3 && (!n.bumpable || n.ghost > 0 || p.frozen > 0)) {
        const push = (0.6 - d) * 0.5;
        const r = this.world.grid.move(n.c.x, n.c.z, dx / d * push, dz / d * push, 0.28); n.c.x = r.x; n.c.z = r.z;
      }
    }
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i].c, b = list[j].c;
      if (list[i].state === 'pending' || list[j].state === 'pending') continue;
      const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
      if (d < 0.55 && d > 1e-3) {
        const push = (0.55 - d) * 0.5;
        a.x -= dx / d * push; a.z -= dz / d * push; b.x += dx / d * push; b.z += dz / d * push;
      }
    }
  }

  // ---------- end states ----------
  win() {
    this.state = 'end';
    this.lastWon = true;
    this.input.enabled = false;
    this.sound.stopMusic();
    this.sound.win();
    this.player.c.playOnce('emote-yes');
    const lv = this.level, frac = this.timeLeft / this.timeLimit;
    const stars = this.bumps <= 1 && frac >= 0.2 ? 3 : (this.bumps <= 3 || frac >= 0.12) ? 2 : 1;
    const timeBonus = Math.max(0, Math.ceil(this.timeLeft)) * PTS.perSecond;
    const clean = this.bumps === 0 ? PTS.clean : 0;
    const raw = PTS.finish + timeBonus + clean + this.points;
    const total = Math.max(0, Math.round(raw * this.mult));
    const prevHigh = this.progress.scores[lv.id] || 0;
    const newHigh = total > prevHigh;
    if (newHigh) this.progress.scores[lv.id] = total;
    const breakdown = [
      ['Errand complete', PTS.finish], [`Time bonus (${Math.ceil(this.timeLeft)}s × ${PTS.perSecond})`, timeBonus],
      ...(clean ? [['Untouched bonus', clean]] : []), ['Dodges, bumps & honks', this.points],
    ];
    const best = this.progress.best[lv.id] ||= {};
    if (stars > (best[this.progress.diff] || 0)) best[this.progress.diff] = stars;
    const newUnlock = this.levelIndex + 1 < LEVELS.length && this.levelIndex + 1 > this.progress.unlocked;
    this.progress.unlocked = Math.max(this.progress.unlocked, Math.min(LEVELS.length - 1, this.levelIndex + 1));
    this.saveProgress();
    const last = this.levelIndex === LEVELS.length - 1;
    this.showEnd({
      label: last ? 'ALL ERRANDS COMPLETE!' : `LEVEL ${this.levelIndex + 1} COMPLETE`,
      title: lv.arrive || `Made it to ${lv.place}!`,
      line: lv.winLine + (newUnlock ? ` Unlocked: ${LEVELS[this.levelIndex + 1].title} (${MAPS[LEVELS[this.levelIndex + 1].map].name}).` : ''),
      stars, won: true, last,
      score: { total, breakdown, mult: this.mult, newHigh, prevHigh },
    });
  }

  lose(reason) {
    this.state = 'end';
    this.lastWon = false;
    this.input.enabled = false;
    this.sound.stopMusic();
    this.sound.lose();
    const lv = this.level;
    const score = { total: Math.max(0, Math.round(this.points * this.mult)), breakdown: [['Dodges, bumps & honks', this.points]], mult: this.mult, lost: true };
    if (reason === 'awkward') {
      this.player.c.playOnce('die');
      this.say(this.player, 'I need to lie down.', 'thought');
      this.showEnd({ label: 'TOO AWKWARD', title: `${HERO_NAME} has had enough people for one day.`, line: `${HERO_NAME} lay down on the sidewalk for a bit. Several people politely stepped over.`, stars: 0, score }, 1.6);
    } else {
      this.player.c.playOnce('emote-no');
      this.showEnd({ label: "TIME'S UP", title: `${lv.place} is closed.`, line: pick(['A sign on the door says "Back in 5 minutes." It has said that since 2019.', 'Through the window, you see an employee flip the sign. They make eye contact. They do not unlock the door.', 'So close. Well, not that close.']), stars: 0, score }, 1.0);
    }
  }

  showEnd({ label, title, line, stars, won = false, last = false, score }, delay = 1.2) {
    const $ = (id) => document.getElementById(id);
    this.endReady = false;
    setTimeout(() => {
      $('end-label').textContent = label;
      $('end-title').textContent = title;
      $('end-line').textContent = line;
      $('end-stars').textContent = stars ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : '';
      if (score) {
        $('end-score-num').textContent = fmt(score.total);
        $('end-score-lines').innerHTML = score.breakdown.map(([k, v]) => `<div><span>${k}</span><b>${v >= 0 ? '+' : ''}${fmt(v)}</b></div>`).join('')
          + `<div class="mult"><span>Difficulty ${this.diff.n} multiplier</span><b>×${score.mult}</b></div>`;
        $('end-new').textContent = score.lost ? 'Finish the errand to post a high score.' : score.newHigh ? (score.prevHigh ? `NEW HIGH SCORE! (was ${fmt(score.prevHigh)})` : 'NEW HIGH SCORE!') : `High score: ${fmt(score.prevHigh)}`;
        $('end-new').classList.toggle('hot', !!score.newHigh);
      }
      const used = this.timeLimit - this.timeLeft;
      $('end-stats').innerHTML = `<div><b>${this.bumps}</b>bumps</div><div><b>${this.director.stats.dodged}</b>dodges</div><div><b>${Math.max(0, used).toFixed(1)}s</b>time</div>`;
      const b = this.bumps;
      $('end-rank').textContent = stars === 0 ? '' : b === 0 ? 'Rank: Sidewalk Ninja 🥷' : b === 1 ? 'Rank: Smooth Operator' : b <= 3 ? 'Rank: Mildly Jostled' : b <= 5 ? 'Rank: Human Pinball' : 'Rank: Public Menace';
      const hasNext = won && !last;
      $('next-btn').classList.toggle('hidden', !hasNext);
      $('again-btn').textContent = won ? 'Replay' : 'Try again';
      $('again-btn').classList.toggle('big', !hasNext);
      $('end-tip').textContent = won && last && this.progress.diff < 5 ? `Every level is unlocked. Think you can do it on difficulty ${this.progress.diff + 1}?` : '';
      this.ui.show('end');
      this.endReady = true;
    }, delay * 1000);
  }

  // ---------- main loop ----------
  frame() {
    const now = performance.now() / 1000;
    const dt = Math.min(0.05, now - (this.last || now));
    this.last = now;
    if (this.state === 'play') this.update(dt);
    else if (this.state === 'title' || this.state === 'intro') this.idle(dt);
    else if (this.state === 'end') this.endIdle(dt);
    this.ui.update(dt, this.camera);
    this.renderer.render(this.scene, this.camera);
  }

  idle(dt) {
    this.time += dt;
    this.ctx.time = this.time;
    this.titleOrbit = (this.titleOrbit || 0) + dt * 0.05;
    this.player.c.sync(dt);
    // slow aerial drift over the town
    const [x0, z0, x1, z1] = this.world.map.bounds;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, R = Math.max(x1 - x0, z1 - z0) * 0.32;
    const a = this.titleOrbit;
    this.camera.position.set(cx + Math.sin(a) * R, 22, cz + Math.cos(a) * R);
    this.camera.lookAt(cx, 0, cz);
    this.updateNpcs(dt);
    this.traffic?.update(dt, this.peds(), this.player);
    this.sun.position.set(cx + this.tod.sunDir[0], this.tod.sunDir[1], cz + this.tod.sunDir[2]); this.sun.target.position.set(cx, 0, cz);
    this.updateLamps(dt, cx, cz);
  }

  endIdle(dt) {
    this.time += dt;
    this.ctx.time = this.time;
    this.player.c.sync(dt);
    this.rig.update(dt, this.player, 0);
    this.updateNpcs(dt);
    this.traffic?.update(dt, this.peds(), this.player);
  }

  peds() {
    const list = [this.player];
    for (const n of this.npcs) if (n.state !== 'pending' && n.state !== 'gone' && n.c.opacity > 0.3) list.push(n);
    return list;
  }

  update(dt) {
    this.time += dt;
    this.ctx.time = this.time;
    const p = this.player;

    // timers
    for (const t of this.timers) t.t -= dt;
    const due = this.timers.filter((t) => t.t <= 0);
    this.timers = this.timers.filter((t) => t.t > 0);
    for (const t of due) t.fn();

    // click / tap to move
    for (const c of this.input.consumeClicks()) {
      const ndc = new THREE.Vector2((c.x / innerWidth) * 2 - 1, -(c.y / innerHeight) * 2 + 1);
      this.raycaster.setFromCamera(ndc, this.camera);
      const hit = new THREE.Vector3();
      if (this.raycaster.ray.intersectPlane(this.groundPlane, hit)) {
        const path = this.world.grid.findPath(p.x, p.z, hit.x, hit.z, 0.3);
        if (path) { p.setPath(path, c.double); this.sound.ui(); }
      }
    }

    this.rig.rotate(this.input.consumeYaw() + this.input.cameraKeys() * dt * 2.2);
    const z = this.input.consumeZoom(); if (z) this.rig.zoom(z);

    const px = p.x, pz = p.z;
    p.update(dt, this.input, this.rig, this.time);
    const moved = Math.hypot(p.x - px, p.z - pz);
    this.walked += moved;
    this.stepAcc += moved;
    if (this.stepAcc > (p.hurrying ? 1.3 : 0.85) && !p.airborne) { this.stepAcc = 0; this.sound.footstep(p.hurrying); }
    this.blockSay -= dt;

    this.director.update(dt);
    this.updateNpcs(dt);
    this.traffic.update(dt, this.peds(), p);
    this.checkCars(dt);
    this.separate();
    this.checkBumps();

    // ambient population
    const ambient = this.npcs.filter((n) => n.kind === 'ambient' && n.state !== 'gone').length;
    if (ambient < this.ambientTarget && Math.random() < dt * 0.8) this.spawnAmbient();

    this.rig.update(dt, p, p.camFollow);
    this.updateSun();
    this.updateLamps(dt, p.x, p.z);
    this.fadeBlockers(dt);

    // beacon bob
    this.beaconArrow.position.y = 3.4 + Math.sin(this.time * 3) * 0.25;
    this.beaconArrow.rotation.y += dt * 2;
    this.beaconRing.scale.setScalar(1 + Math.sin(this.time * 4) * 0.06);
    if (this.world.doors.po?.flag) this.world.doors.po.flag.rotation.y = Math.sin(this.time * 2) * 0.15;

    // clock & awkwardness
    this.timeLeft -= dt;
    this.awkward = Math.max(0, this.awkward - BUMP.awkwardDecay * dt);
    this.ui.setTimer(this.timeLeft);
    this.ui.setMeter(this.awkward);
    if (this.timeLeft <= 10 && Math.ceil(this.timeLeft) !== this.lastTick) { this.lastTick = Math.ceil(this.timeLeft); this.sound.tick(); }
    this.sound.urgent = this.timeLeft <= 15;
    const gd = this.goalDoor;
    const dist = Math.hypot(gd.x - p.x, gd.z - p.z);
    this.ui.setDistance(dist);
    this.ui.setCompass(this.rig.yaw - Math.atan2(gd.x - p.x, gd.z - p.z));
    this.ui.drawMinimap(p, this.rig.yaw, gd, this.startPoint, this.npcs, this.traffic.cars);

    if (dist < 1.3) this.win();
    else if (this.awkward >= 100) this.lose('awkward');
    else if (this.timeLeft <= 0) this.lose('time');
  }

  updateNpcs(dt) {
    for (const n of this.npcs) n.update(dt, this.ctx);
    const gone = this.npcs.filter((n) => n.state === 'gone');
    for (const n of gone) n.c.dispose();
    if (gone.length) this.npcs = this.npcs.filter((n) => n.state !== 'gone');
  }

  // Move the pool of lamp lights to the street lamps nearest the action (night only).
  updateLamps(dt, x, z) {
    if (!this.tod?.night) return;
    this.lampTimer -= dt;
    if (this.lampTimer > 0) return;
    this.lampTimer = 0.4;
    const near = [...this.world.lamps].sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
    this.lampLights.forEach((l, i) => {
      const lp = near[i];
      if (lp) { l.position.set(lp.x, lp.y - 0.3, lp.z); l.intensity = 26; } else l.intensity = 0;
    });
  }

  // Trees between the camera and the player go see-through.
  fadeBlockers(dt) {
    const c = this.camera.position, p = this.player;
    const sx = p.x - c.x, sz = p.z - c.z, L2 = sx * sx + sz * sz || 1;
    for (const f of this.world.fadeables) {
      if (Math.abs(f.x - p.x) > 14 || Math.abs(f.z - p.z) > 14) { if (f.o === 1) continue; }
      const t = Math.max(0, Math.min(1, ((f.x - c.x) * sx + (f.z - c.z) * sz) / L2));
      const d = Math.hypot(c.x + sx * t - f.x, c.z + sz * t - f.z);
      const want = d < 1.8 && t < 0.97 ? 0.25 : 1;
      const o = f.o + (want - f.o) * Math.min(1, dt * 8);
      const next = Math.abs(o - want) < 0.01 ? want : o;
      if (next === f.o) continue;
      f.o = next;
      for (const m of f.mats) { m.transparent = next < 1; m.opacity = next; m.depthWrite = next >= 1; }
    }
  }

  updateSun() {
    const p = this.player, d = this.tod.sunDir;
    this.sun.position.set(p.x + d[0], d[1], p.z + d[2]);
    this.sun.target.position.set(p.x, 0, p.z);
  }
}
