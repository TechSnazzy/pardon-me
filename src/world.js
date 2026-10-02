import * as THREE from 'three';
import { RoundedBoxGeometry } from '../vendor/addons/utils/RoundedBoxGeometry.js';
import { WORLD_SCALE } from './config.js';
import { Grid, SURF } from './grid.js';
import * as A from './assets.js';
import { layoutStreets, RH } from './layout.js';
import { MAPS } from './levels.js';

const FACING = {
  e: { x: 1, z: 0, rot: Math.PI / 2 },
  w: { x: -1, z: 0, rot: -Math.PI / 2 },
  n: { x: 0, z: -1, rot: Math.PI },
  s: { x: 0, z: 1, rot: 0 },
};

const H_SIDEWALK = 0.14, H_ROAD = 0.02, H_PATH = 0.05;
const BACKFILL = 'abcdefghijklmn'.split('').map((c) => `commercial/low-detail-building-${c}`)
  .concat(['commercial/low-detail-building-wide-a', 'commercial/low-detail-building-wide-b']);

// Every model any map might use, so all levels can load up front.
export const WORLD_MODELS = (() => {
  const set = new Set([
    'suburban/tree-large', 'suburban/tree-small', 'suburban/planter',
    'roads/light-square', 'roads/construction-barrier', 'roads/construction-cone',
    ...BACKFILL,
  ]);
  for (const m of Object.values(MAPS)) {
    for (const h of m.houses || []) set.add(`suburban/${h.model}`);
    for (const s of m.shops || []) set.add(`commercial/${s.model}`);
    for (const r of m.rows || []) for (const md of r.models) set.add(`commercial/${md}`);
  }
  return [...set];
})();

function mat(color, opts = {}) { return new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, ...opts }); }

function tileTexture(base, line, px = 128) {
  const c = document.createElement('canvas'); c.width = c.height = px;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, px, px);
  g.strokeStyle = line; g.lineWidth = 3; g.strokeRect(1.5, 1.5, px - 3, px - 3);
  for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.04})`; g.fillRect(Math.random() * px, Math.random() * px, 2, 2); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function signTexture(text, color) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 112;
  const g = c.getContext('2d');
  g.fillStyle = color; g.beginPath(); g.roundRect(4, 4, 504, 104, 18); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 6; g.beginPath(); g.roundRect(14, 14, 484, 84, 12); g.stroke();
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  let size = 60; g.font = `800 ${size}px "Trebuchet MS", system-ui, sans-serif`;
  while (g.measureText(text).width > 450 && size > 20) { size -= 2; g.font = `800 ${size}px "Trebuchet MS", system-ui, sans-serif`; }
  g.fillText(text, 256, 60);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

function box(w, h, d, material, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  return m;
}

function slab([x0, z0, x1, z1], h, material, y0 = 0, uvScale = 0) {
  const w = x1 - x0, d = z1 - z0;
  const geo = new THREE.BoxGeometry(w, h, d);
  if (uvScale) {
    // world-aligned UVs on the top face so tiles line up between slabs
    const uv = geo.attributes.uv, pos = geo.attributes.position, nrm = geo.attributes.normal;
    for (let i = 0; i < uv.count; i++) {
      if (nrm.getY(i) > 0.5) uv.setXY(i, (pos.getX(i) + x0 + w / 2) / uvScale, (pos.getZ(i) + z0 + d / 2) / uvScale);
      else uv.setXY(i, 0.02, 0.02);
    }
  }
  const m = new THREE.Mesh(geo, material);
  m.position.set(x0 + w / 2, y0 + h / 2, z0 + d / 2);
  m.receiveShadow = true;
  return m;
}

const inRect = ([x0, z0, x1, z1], x, z, pad = 0) => x > x0 - pad && x < x1 + pad && z > z0 - pad && z < z1 + pad;

export function buildWorld(scene, mapId) {
  const map = MAPS[mapId];
  const L = layoutStreets(map);
  const [bx0, bz0, bx1, bz1] = map.bounds;
  const grid = new Grid(map.bounds);
  const group = new THREE.Group();
  scene.add(group);
  const occluders = [];
  const portals = [];
  const doors = {};
  const fadeables = [];
  const lamps = [];
  const m4 = new THREE.Matrix4();
  const roadRects = L.roads.map((r) => r.rect);
  const water = map.water || [];

  // ---------- ground ----------
  const cx = (bx0 + bx1) / 2, cz = (bz0 + bz1) / 2;
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), mat(map.ground || '#7fcf6e'));
  grass.rotation.x = -Math.PI / 2; grass.position.set(cx, -0.01, cz); grass.receiveShadow = true;
  group.add(grass);

  // ---------- roads (extended past the edge so cars can drive in and out of view) ----------
  const asphalt = mat('#5d5b73');
  for (const r of L.roads) {
    const s = r.street, ext = 60;
    const lo = s.axis === 'x' ? bx0 : bz0, hi = s.axis === 'x' ? bx1 : bz1;
    const a0 = s.from <= lo ? s.from - ext : s.from, a1 = s.to >= hi ? s.to + ext : s.to;
    group.add(slab(s.axis === 'x' ? [a0, s.at - RH, a1, s.at + RH] : [s.at - RH, a0, s.at + RH, a1], 0.02, asphalt, -0.005));
  }
  // centre dashes, skipping intersections
  const dashes = [];
  for (const s of L.streets) {
    const cross = L.streets.filter((o) => o.axis !== s.axis);
    for (let a = s.from - 58; a < s.to + 58; a += 4) {
      if (cross.some((o) => Math.abs(a - o.at) < RH + o.sw + 1.5 && o.from <= s.at && o.to >= s.at)) continue;
      if ((map.crosswalks || []).some((c) => c.street === s.name && Math.abs(c.at - a) < 3)) continue;
      dashes.push(s.axis === 'x' ? [a, s.at, 2, 0.18] : [s.at, a, 0.18, 2]);
    }
  }
  addInstancedBoxes(dashes.map(([x, z, w, d]) => [x, 0.02, z, w, 0.01, d]), mat('#f4f1e6'), false);

  // sidewalks
  const swMat = new THREE.MeshStandardMaterial({ map: tileTexture('#dcd9e4', '#bdb8cc'), roughness: 0.95 });
  for (const r of L.sidewalks) { group.add(slab(r, H_SIDEWALK, swMat, 0, 1.5)); grid.paintRect(r, SURF.SIDEWALK, H_SIDEWALK); }

  // crosswalks
  const stripes = [];
  for (const cw of L.crosswalks) {
    grid.paintRect(cw.rect, SURF.CROSSWALK, H_ROAD);
    const [x0, z0, x1, z1] = cw.rect;
    if (cw.axis === 'z') for (let z = z0 + 0.6; z < z1 - 0.3; z += 1.0) stripes.push([(x0 + x1) / 2, 0.017, z + 0.25, x1 - x0 - 0.5, 0.01, 0.5]);
    else for (let x = x0 + 0.6; x < x1 - 0.3; x += 1.0) stripes.push([x + 0.25, 0.017, (z0 + z1) / 2, 0.5, 0.01, z1 - z0 - 0.5]);
  }
  addInstancedBoxes(stripes, mat('#f7f7f2'), false);

  // ---------- park ----------
  const pathMat = new THREE.MeshStandardMaterial({ map: tileTexture('#e8d8b0', '#d8c595', 64), roughness: 1 });
  const P = map.park;
  if (P) {
    group.add(slab(P.rect, 0.02, mat('#8ad97a'), -0.01));
    grid.paintRect(P.rect, SURF.PARK, 0.0);
    for (const p of P.paths) { group.add(slab(p, H_PATH, pathMat, 0, 1.0)); grid.paintRect(p, SURF.PATH, H_PATH); }
    const hedgeMat = mat('#3f9f55');
    for (const [x0, z0, x1, z1] of P.hedges) {
      const w = x1 - x0, d = z1 - z0;
      const hm = new THREE.Mesh(new RoundedBoxGeometry(w, 1.0, d, 2, 0.3), hedgeMat);
      hm.position.set(x0 + w / 2, 0.5, z0 + d / 2); hm.castShadow = hm.receiveShadow = true;
      group.add(hm);
      grid.paintRect([x0, z0, x1, z1], SURF.BLOCKED);
    }
    if (P.pond) {
      const { pond } = P;
      const wm = new THREE.Mesh(new THREE.CircleGeometry(pond.r, 40), mat('#5bb8e8', { roughness: 0.2, metalness: 0.1 }));
      wm.rotation.x = -Math.PI / 2; wm.position.set(pond.x, 0.04, pond.z);
      group.add(wm);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(pond.r, 0.25, 6, 40), mat('#b9b4c4'));
      rim.rotation.x = -Math.PI / 2; rim.position.set(pond.x, 0.06, pond.z); rim.receiveShadow = true;
      group.add(rim);
      grid.paintCircle(pond.x, pond.z, pond.r + 0.2, SURF.BLOCKED);
      addDuck(pond.x + 1.2, pond.z - 0.8, 0.05);
    }
    for (const [x, z, color] of P.blankets || []) {
      const b = box(2.0, 0.02, 1.6, mat(color), x, 0.012, z); b.castShadow = false; b.rotation.y = Math.random() - 0.5; group.add(b);
      const basket = box(0.5, 0.35, 0.35, mat('#a8693e'), x + 0.5, 0.18, z + 0.3); group.add(basket);
      grid.paintCircle(x + 0.5, z + 0.3, 0.3, SURF.BLOCKED);
    }
    for (const [x, z] of P.trees) addTree(x, z, Math.random() < 0.5);
    for (const [x, z, rot] of P.benches) addBench(x, z, rot);
  }

  // ---------- river & bridges ----------
  const waterMat = mat('#4fa8de', { roughness: 0.15, metalness: 0.1 });
  for (const r of water) {
    grid.paintRect(r, SURF.BLOCKED);
    const [x0, z0, x1, z1] = r;
    group.add(slab([x0 - 60, z0, x1 + 60, z1], 0.02, waterMat, 0.015));
    // grassy banks
    for (const z of [z0, z1]) group.add(slab([x0 - 60, z - 0.25, x1 + 60, z + 0.25], 0.12, mat('#6fb862'), 0));
    for (let i = 0; i < 4; i++) addDuck(x0 + 10 + Math.random() * (x1 - x0 - 20), z0 + 1 + Math.random() * (z1 - z0 - 2), 0.02);
  }
  const wood = mat('#b07a4a'), rail = mat('#8a5a32');
  for (const r of map.bridges || []) {
    const [x0, z0, x1, z1] = r;
    group.add(slab(r, 0.28, wood, 0, 0));
    grid.paintRect(r, SURF.PATH, 0.28);
    for (const x of [x0 + 0.12, x1 - 0.12]) {
      group.add(box(0.14, 0.9, z1 - z0, rail, x, 0.28 + 0.45, (z0 + z1) / 2));
      grid.paintRect([x - 0.2, z0 + 1.2, x + 0.2, z1 - 1.2], SURF.BLOCKED);
    }
  }

  // ---------- plaza ----------
  if (map.plaza) {
    const pz = map.plaza;
    group.add(slab(pz.rect, H_PATH + 0.04, new THREE.MeshStandardMaterial({ map: tileTexture('#e3dccf', '#c9bfae', 96), roughness: 1 }), 0, 2.0));
    grid.paintRect(pz.rect, SURF.PATH, H_PATH + 0.04);
    const f = pz.fountain;
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(f.r, f.r + 0.2, 0.6, 32), mat('#c9c3d6'));
    basin.position.set(f.x, 0.3, f.z); basin.castShadow = basin.receiveShadow = true; group.add(basin);
    const fw = new THREE.Mesh(new THREE.CylinderGeometry(f.r - 0.25, f.r - 0.25, 0.05, 32), mat('#5bb8e8', { roughness: 0.15 }));
    fw.position.set(f.x, 0.58, f.z); group.add(fw);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 1.8, 12), mat('#c9c3d6'));
    col.position.set(f.x, 0.9, f.z); col.castShadow = true; group.add(col);
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), mat('#7fc8f0', { transparent: true, opacity: 0.75, roughness: 0.1 }));
    top.position.set(f.x, 1.9, f.z); group.add(top);
    grid.paintCircle(f.x, f.z, f.r + 0.1, SURF.BLOCKED);
    for (const [x, z] of pz.trees) addTree(x, z, true, false, H_PATH + 0.04);
    for (const [x, z, rot] of pz.benches) addBench(x, z, rot, H_PATH + 0.04);
  }

  // ---------- houses ----------
  const walkMat = new THREE.MeshStandardMaterial({ map: tileTexture('#ece7f0', '#cfc8d8', 64), roughness: 1 });
  const picket = [];
  for (const h of map.houses || []) {
    const f = FACING[h.facing];
    const b = placeBuilding(`suburban/${h.model}`, f, h.front, h.at);
    const door = frontPoint(f, h.front, h.at);
    // front walk out to the first sidewalk cell
    let reach = 0.5;
    while (reach < 25 && grid.surfAt(door.x + f.x * reach, door.z + f.z * reach) !== SURF.SIDEWALK) reach += 0.25;
    const edgePt = { x: door.x + f.x * reach, z: door.z + f.z * reach };
    const walkRect = f.x !== 0
      ? [Math.min(door.x, edgePt.x), h.at - 0.75, Math.max(door.x, edgePt.x), h.at + 0.75]
      : [h.at - 0.75, Math.min(door.z, edgePt.z), h.at + 0.75, Math.max(door.z, edgePt.z)];
    group.add(slab(walkRect, H_PATH + 0.01, walkMat, 0, 1.0));
    grid.paintRect(walkRect, SURF.PATH, H_PATH);
    const doorPt = { x: door.x + f.x * 0.45, z: door.z + f.z * 0.45 };
    const entry = { x: door.x + f.x * (reach + 1.5), z: door.z + f.z * (reach + 1.5) };
    const rec = { x: doorPt.x, z: doorPt.z, f, entry, box: b };
    if (h.home) doors.home = rec;
    else portals.push({ kind: 'house', spawn: doorPt, route: [doorPt, entry], entry, facing: f });
    // picket fence along the sidewalk edge of the lot, leaving the walk open
    const lotHalf = 4.6;
    for (const side of [-1, 1]) {
      const a = h.at + side * 1.2, c = h.at + side * lotHalf;
      picket.push(f.x !== 0
        ? { x: edgePt.x - f.x * 0.35, z0: Math.min(a, c), z1: Math.max(a, c), axis: 'z' }
        : { z: edgePt.z - f.z * 0.35, x0: Math.min(a, c), x1: Math.max(a, c), axis: 'x' });
    }
    if (Math.random() < 0.7) {
      const p = A.model('suburban/planter'); p.scale.setScalar(WORLD_SCALE * 0.8);
      p.position.set(door.x + f.x * 0.6 + f.z * 1.6, 0, door.z + f.z * 0.6 + f.x * 1.6);
      p.rotation.y = f.rot; group.add(p);
    }
  }
  if (picket.length) buildPickets(picket);

  // ---------- shops: named ones first, then rows fill the gaps ----------
  const taken = [];
  for (const s of map.shops || []) {
    const rec = placeShop(s.model, s.facing, s.front, s.at, s);
    taken.push({ facing: s.facing, front: s.front, a0: rec.a0, a1: rec.a1 });
  }
  for (const r of map.rows || []) fillRow(r);

  // post office flag
  const po = doors.po;
  if (po) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 6.5, 8), mat('#d8d8e0', { metalness: 0.4, roughness: 0.4 }));
    pole.position.set(po.x + 4.8, 3.25, po.z - 0.6); pole.castShadow = true; group.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0, 8, 1), new THREE.MeshStandardMaterial({ map: flagTexture(), side: THREE.DoubleSide }));
    flag.position.set(po.x + 4.8 + 0.8, 5.9, po.z - 0.6); group.add(flag);
    po.flag = flag;
    grid.paintCircle(po.x + 4.8, po.z - 0.6, 0.2, SURF.BLOCKED);
  }

  // ---------- kiosks ----------
  for (const k of map.kiosks || []) addKiosk(k);

  // ---------- props ----------
  for (const p of map.props || []) addProp(p);
  if (map.autoProps) autoProps(map.autoProps);

  for (const e of L.ends) {
    const b = A.model('roads/construction-barrier'); b.scale.setScalar(WORLD_SCALE * 0.9);
    b.position.set(e.x, H_SIDEWALK, e.z); b.rotation.y = e.axis === 'z' ? Math.PI / 2 : 0; group.add(b);
    for (const k of [-1, 1]) {
      const c = A.model('roads/construction-cone'); c.scale.setScalar(WORLD_SCALE);
      const inward = e.axis === 'z' ? (e.x > cx ? -0.8 : 0.8) : (e.z > cz ? -0.8 : 0.8);
      const ox = e.axis === 'x' ? k * 1.0 : inward, oz = e.axis === 'z' ? k * 1.0 : inward;
      c.position.set(e.x + ox, H_SIDEWALK, e.z + oz); group.add(c);
    }
    grid.paintRect(e.axis === 'z' ? [e.x - 0.6, e.z - 2.2, e.x + 0.6, e.z + 2.2] : [e.x - 2.2, e.z - 0.6, e.x + 2.2, e.z + 0.6], SURF.BLOCKED);
  }

  // park / plaza portals
  for (const p of map.parkPortals || []) {
    const route = p.route.map(([x, z]) => ({ x, z }));
    portals.push({ kind: 'park', spawn: route[0], route, entry: route[route.length - 1], stroller: p.stroller, dog: p.dog, jogger: p.jogger });
  }

  // ---------- walking graph ----------
  const graph = buildGraph();

  addBackdrop();

  return {
    map, layout: L, grid, group, occluders, portals, doors, fadeables, lamps, graph,
    roads: roadRects, water,
    dispose() {
      scene.remove(group);
      group.traverse((o) => {
        if (o.geometry && !A.isShared(o.geometry)) o.geometry.dispose();
        const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        for (const m of ms) if (!A.isShared(m)) { m.map && !A.isShared(m.map) && m.map.dispose(); m.dispose(); }
      });
    },
  };

  // ---------- helpers ----------
  function frontPoint(f, front, at) {
    return f.x !== 0 ? { x: front, z: at } : { x: at, z: front };
  }

  function addInstancedBoxes(list, material, shadows) {
    if (!list.length) return;
    const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, list.length);
    const q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
    list.forEach(([x, y, z, w, h, d], i) => inst.setMatrixAt(i, m4.compose(v.set(x, y, z), q, s.set(w, h, d))));
    inst.receiveShadow = true; inst.castShadow = shadows;
    group.add(inst);
  }

  function placeBuilding(path, f, front, at) {
    const m = A.model(path);
    m.scale.setScalar(WORLD_SCALE);
    m.rotation.y = f.rot;
    const lb = A.modelBox(path);
    const p = frontPoint(f, front, at);
    // move so the model's front face (local +z) lands on the front line, centred on `at`
    const off = new THREE.Vector3((lb.min.x + lb.max.x) / 2 * WORLD_SCALE, 0, lb.max.z * WORLD_SCALE)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), f.rot);
    m.position.set(p.x - off.x, 0, p.z - off.z);
    group.add(m);
    m.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(m);
    occluders.push(b);
    return b;
  }

  // A commercial building flush to the sidewalk, with a doorway NPCs can come out of.
  function placeShop(model, facing, front, at, named) {
    const f = FACING[facing];
    const b = placeBuilding(`commercial/${model}`, f, front, at);
    const door = frontPoint(f, front, at);
    const notch = f.x !== 0 ? [front - f.x * 0.6, at - 0.7, front, at + 0.7] : [at - 0.7, front - f.z * 0.6, at + 0.7, front];
    grid.paintRect(notch, SURF.SIDEWALK, H_SIDEWALK);
    const doorPt = { x: door.x - f.x * 0.2, z: door.z - f.z * 0.2 };
    const entry = { x: door.x + f.x * 1.5, z: door.z + f.z * 1.5 };
    if (named) {
      doors[named.id] = { id: named.id, name: named.sign, x: doorPt.x, z: doorPt.z, f, entry, box: b };
      const width = Math.min(4.2, (f.x !== 0 ? b.max.z - b.min.z : b.max.x - b.min.x) * 0.8);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(width, width * 112 / 512), new THREE.MeshBasicMaterial({ map: signTexture(named.sign, named.color) }));
      sign.position.set(door.x + f.x * 0.12, 2.75, door.z + f.z * 0.12);
      sign.rotation.y = f.rot;
      group.add(sign);
    }
    portals.push({ kind: 'shop', id: named?.id, spawn: doorPt, route: [doorPt, entry], entry, facing: f });
    const a0 = f.x !== 0 ? b.min.z : b.min.x, a1 = f.x !== 0 ? b.max.z : b.max.x;
    return { a0, a1 };
  }

  function fillRow(r) {
    const occupied = taken.filter((t) => t.facing === r.facing && Math.abs(t.front - r.front) < 0.01).map((t) => [t.a0 - 0.3, t.a1 + 0.3]);
    const models = r.models.filter((md) => {
      const bb = A.modelBox(`commercial/${md}`);
      return (bb.max.z - bb.min.z) * WORLD_SCALE <= r.maxDepth;
    });
    let cursor = r.from + 0.3, guard = 0;
    while (cursor < r.to && guard++ < 60) {
      const md = models[(Math.random() * models.length) | 0];
      const bb = A.modelBox(`commercial/${md}`);
      const w = (bb.max.x - bb.min.x) * WORLD_SCALE;
      if (cursor + w > r.to - 0.3) {
        // try the narrowest model before giving up on this stretch
        const narrow = models.map((m2) => [m2, (A.modelBox(`commercial/${m2}`).max.x - A.modelBox(`commercial/${m2}`).min.x) * WORLD_SCALE]).sort((a, b) => a[1] - b[1])[0];
        if (!narrow || cursor + narrow[1] > r.to - 0.3) break;
        const hit = occupied.find(([o0, o1]) => cursor < o1 && cursor + narrow[1] > o0);
        if (hit) { cursor = hit[1]; continue; }
        placeShop(narrow[0], r.facing, r.front, cursor + narrow[1] / 2);
        break;
      }
      const hit = occupied.find(([o0, o1]) => cursor < o1 && cursor + w > o0);
      if (hit) { cursor = hit[1]; continue; }
      placeShop(md, r.facing, r.front, cursor + w / 2);
      cursor += w + 0.25;
    }
  }

  function addKiosk(k) {
    const f = FACING[k.facing];
    const g = new THREE.Group();
    const W = 3.2, D = 2.6, H = 2.3;
    const body = mat('#fff6ea'), trim = mat(k.color);
    g.add(box(W, H, D, body, 0, H / 2, 0));
    g.add(box(W + 0.1, 0.25, D + 0.1, trim, 0, 0.12, 0));
    g.add(box(W - 0.6, 0.9, 0.05, mat('#3a3550'), 0, 1.45, D / 2 + 0.01));   // serving window
    g.add(box(W - 0.4, 0.12, 0.5, trim, 0, 0.95, D / 2 + 0.2));               // counter
    for (let i = 0; i < 6; i++) {                                              // striped awning
      const a = box(W / 6, 0.08, 1.0, i % 2 ? body : trim, -W / 2 + W / 12 + i * W / 6, 2.15, D / 2 + 0.4);
      a.rotation.x = 0.35; g.add(a);
    }
    g.add(box(W + 0.2, 0.15, D + 0.2, trim, 0, H + 0.07, 0));
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 3.0 * 112 / 512), new THREE.MeshBasicMaterial({ map: signTexture(k.sign, k.color) }));
    sign.position.set(0, H + 0.6, D / 2 - 0.2); g.add(sign);
    if (k.cone) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.4, 12), mat('#e0a35a'));
      cone.rotation.x = Math.PI; cone.position.set(0, H + 1.1, -0.3); cone.castShadow = true; g.add(cone);
      const scoop = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), mat('#ff9fc8'));
      scoop.position.set(0, H + 1.9, -0.3); scoop.castShadow = true; g.add(scoop);
    } else {
      const dog = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 1.2, 4, 10), mat('#c0603a'));
      dog.rotation.z = Math.PI / 2; dog.position.set(0, H + 0.6, -0.4); g.add(dog);
    }
    g.position.set(k.x, 0, k.z); g.rotation.y = f.rot;
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    group.add(g);
    g.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(g);
    occluders.push(b);
    grid.paintRect([b.min.x, b.min.z, b.max.x, b.max.z], SURF.BLOCKED);
    const front = { x: k.x + f.x * D / 2, z: k.z + f.z * D / 2 };
    doors[k.id] = { id: k.id, name: k.sign, x: front.x + f.x * 0.5, z: front.z + f.z * 0.5, f, entry: { x: front.x + f.x * 2.0, z: front.z + f.z * 2.0 }, box: b };
  }

  function addProp(p) {
    if (p.kind === 'tree') addTree(p.x, p.z, false, true);
    else if (p.kind === 'lamp') addLamp(p.x, p.z, p.rot + Math.PI);
    else if (p.kind === 'hydrant') addHydrant(p.x, p.z);
    else if (p.kind === 'trash') addTrash(p.x, p.z);
    else if (p.kind === 'mailbox') addMailbox(p.x, p.z);
    else if (p.kind === 'bench') addBench(p.x, p.z, p.rot, H_SIDEWALK);
    else if (p.kind === 'subway') addSignPost(p.x, p.z, 'SUBWAY', '#2a9d4a');
    else if (p.kind === 'busstop') addSignPost(p.x, p.z, 'BUS', '#2a5fd0');
  }

  // Street trees and lamps along every curb, keeping clear of doors and crosswalks.
  function autoProps(cfg) {
    const avoid = [...portals.map((p) => p.entry), ...Object.values(doors).map((d) => d.entry)];
    const clear = (x, z, r) => !avoid.some((q) => Math.hypot(q.x - x, q.z - z) < r)
      && !L.crosswalks.some((c) => inRect(c.rect, x, z, 1.6));
    let n = 0;
    for (const s of L.streets) for (const side of [-1, 1]) {
      const curb = side < 0 ? s.at - RH - 0.75 : s.at + RH + 0.75;
      const lampRot = s.axis === 'x' ? (side < 0 ? Math.PI : 0) : (side < 0 ? -Math.PI / 2 : Math.PI / 2);
      for (let a = s.from + 4; a < s.to - 4; a += 2) {
        const x = s.axis === 'x' ? a : curb, z = s.axis === 'x' ? curb : a;
        if (grid.surfAt(x, z) !== SURF.SIDEWALK || !clear(x, z, 2.2)) continue;
        const k = Math.round(a);
        if (cfg.trees && k % cfg.trees === 0) addTree(x, z, false, true);
        else if (cfg.lamps && (k + 7) % cfg.lamps === 0) addLamp(x, z, lampRot + Math.PI);
        else if (cfg.extras && (k + 3) % 23 === 0) {
          const kind = cfg.extras[(n++) % cfg.extras.length];
          if (kind === 'hydrant') addHydrant(x, z); else if (kind === 'trash') addTrash(x, z);
          else if (kind === 'bench') addBench(x, z, lampRot + Math.PI, H_SIDEWALK);
        }
      }
    }
  }

  function addLamp(x, z, rot) {
    const l = A.model('roads/light-square'); l.scale.setScalar(WORLD_SCALE); l.position.set(x, H_SIDEWALK, z); l.rotation.y = rot; group.add(l);
    grid.paintCircle(x, z, 0.15, SURF.BLOCKED);
    // a bulb at the end of the arm (glows at night)
    const head = new THREE.Vector3(0, 2.9, -1.0).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), lampBulbMat);
    bulb.position.set(x + head.x, H_SIDEWALK + head.y, z + head.z);
    group.add(bulb);
    lamps.push({ x: bulb.position.x, y: bulb.position.y, z: bulb.position.z });
  }

  function addSignPost(x, z, text, color) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 8), mat('#5a5a66'));
    post.position.set(x, H_SIDEWALK + 1.3, z); post.castShadow = true; group.add(post);
    for (const ry of [0, Math.PI / 2]) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4 * 112 / 512), new THREE.MeshBasicMaterial({ map: signTexture(text, color), side: THREE.DoubleSide }));
      s.position.set(x, H_SIDEWALK + 2.5, z); s.rotation.y = ry; group.add(s);
    }
    grid.paintCircle(x, z, 0.15, SURF.BLOCKED);
  }

  function addDuck(x, z, y) {
    const duck = new THREE.Group();
    duck.add(box(0.5, 0.3, 0.35, mat('#f6f2e8'), 0, 0.15, 0));
    duck.add(box(0.22, 0.25, 0.22, mat('#3a7d44'), 0.22, 0.38, 0));
    duck.add(box(0.14, 0.06, 0.1, mat('#f2a33a'), 0.38, 0.36, 0));
    duck.position.set(x, y, z); duck.rotation.y = Math.random() * 6;
    group.add(duck);
  }

  function addTree(x, z, small, curb, y) {
    const t = A.model(small ? 'suburban/tree-small' : 'suburban/tree-large');
    t.scale.setScalar(WORLD_SCALE * (0.9 + Math.random() * 0.25));
    t.rotation.y = Math.random() * Math.PI * 2;
    t.position.set(x, y ?? (curb ? H_SIDEWALK : 0), z);
    group.add(t);
    // own materials so the tree can fade when it blocks the camera
    const mats = [];
    t.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); mats.push(o.material); } });
    fadeables.push({ x, z, mats, o: 1 });
    if (curb) {
      const pit = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.02, 1.1), mat('#7a5f48'));
      pit.position.set(x, H_SIDEWALK + 0.005, z); pit.receiveShadow = true; group.add(pit);
    }
    grid.paintCircle(x, z, 0.4, SURF.BLOCKED);
  }

  function addBench(x, z, rot, y = 0) {
    const g = new THREE.Group();
    const wd = mat('#a8693e'), iron = mat('#3b3a48');
    g.add(box(1.8, 0.08, 0.5, wd, 0, 0.45, 0));
    g.add(box(1.8, 0.4, 0.08, wd, 0, 0.75, -0.22));
    for (const s of [-0.75, 0.75]) g.add(box(0.08, 0.45, 0.45, iron, s, 0.22, 0));
    g.position.set(x, y, z); g.rotation.y = rot; group.add(g);
    const c = Math.abs(Math.cos(rot));
    grid.paintRect(c > 0.5 ? [x - 0.95, z - 0.3, x + 0.95, z + 0.3] : [x - 0.3, z - 0.95, x + 0.3, z + 0.95], SURF.BLOCKED);
  }

  function addHydrant(x, z) {
    const g = new THREE.Group(); const red = mat('#d83a2e');
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.6, 10), red)); g.children[0].position.y = 0.3;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), red); cap.position.y = 0.6; g.add(cap);
    g.add(box(0.5, 0.1, 0.1, red, 0, 0.42, 0));
    g.traverse((o) => { o.castShadow = true; });
    g.position.set(x, H_SIDEWALK, z); group.add(g);
    grid.paintCircle(x, z, 0.2, SURF.BLOCKED);
  }

  function addTrash(x, z) {
    const g = new THREE.Group();
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.26, 0.9, 12), mat('#3e6b4c')); can.position.y = 0.45; can.castShadow = true;
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.08, 12), mat('#2c4d37')); lid.position.y = 0.92;
    g.add(can, lid); g.position.set(x, H_SIDEWALK, z); group.add(g);
    grid.paintCircle(x, z, 0.3, SURF.BLOCKED);
  }

  function addMailbox(x, z) {
    const g = new THREE.Group(); const blue = mat('#2a4fa8');
    g.add(box(0.7, 0.85, 0.6, blue, 0, 0.62, 0));
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.6, 14), blue);
    top.rotation.x = Math.PI / 2; top.position.y = 1.0; top.castShadow = true;
    g.add(top);
    for (const s of [-0.28, 0.28]) for (const t of [-0.22, 0.22]) g.add(box(0.07, 0.2, 0.07, mat('#1d2f5e'), s, 0.1, t));
    g.add(box(0.4, 0.05, 0.02, mat('#d9dce6'), 0, 0.85, 0.31));
    g.position.set(x, H_SIDEWALK, z); group.add(g);
    grid.paintRect([x - 0.4, z - 0.35, x + 0.4, z + 0.35], SURF.BLOCKED);
  }

  function buildPickets(lines) {
    const white = mat('#f6f4ef');
    const posts = [];
    for (const Ln of lines) {
      if (Ln.axis === 'z') {
        for (let z = Ln.z0; z <= Ln.z1 + 1e-3; z += 0.35) posts.push([Ln.x, 0.35, z, 0.12, 0.7, 0.06]);
        for (const y of [0.25, 0.55]) posts.push([Ln.x, y, (Ln.z0 + Ln.z1) / 2, 0.06, 0.06, Ln.z1 - Ln.z0]);
        grid.paintRect([Ln.x - 0.15, Ln.z0, Ln.x + 0.15, Ln.z1], SURF.BLOCKED);
      } else {
        for (let x = Ln.x0; x <= Ln.x1 + 1e-3; x += 0.35) posts.push([x, 0.35, Ln.z, 0.12, 0.7, 0.06]);
        for (const y of [0.25, 0.55]) posts.push([(Ln.x0 + Ln.x1) / 2, y, Ln.z, Ln.x1 - Ln.x0, 0.06, 0.06]);
        grid.paintRect([Ln.x0, Ln.z - 0.15, Ln.x1, Ln.z + 0.15], SURF.BLOCKED);
      }
    }
    addInstancedBoxes(posts, white, true);
  }

  function buildGraph() {
    const nodes = L.graph.map((n) => ({ x: n.x, z: n.z, links: [] }));
    const idx = new Map(L.graph.map((n, i) => [n, i]));
    L.graph.forEach((n, i) => { for (const m of n.links) nodes[i].links.push(nodes[idx.get(m)]); });
    const nodeAt = (x, z) => {
      let best = null, bd = 2.5;
      for (const n of nodes) { const d = Math.hypot(n.x - x, n.z - z); if (d < bd) { bd = d; best = n; } }
      if (best) return best;
      const n = { x, z, links: [] }; nodes.push(n); return n;
    };
    for (const line of map.graphExtra || []) {
      let prev = null;
      for (const [x, z] of line) {
        const n = nodeAt(x, z);
        if (prev && prev !== n && !prev.links.includes(n)) { prev.links.push(n); n.links.push(prev); }
        prev = n;
      }
    }
    // drop links that run through something solid (barriers, props)
    for (const n of nodes) n.links = n.links.filter((m) => grid.lineFree(n.x, n.z, m.x, m.z, 0.15));
    return nodes.filter((n) => n.links.length && grid.walkable(n.x, n.z));
  }

  // Downtown: fill block interiors and the horizon with background buildings.
  function addSkyline() {
    const tryPlace = (x, z, inside) => {
      const path = BACKFILL[(Math.random() * BACKFILL.length) | 0];
      const m = A.model(path);
      m.scale.setScalar(WORLD_SCALE * (inside ? 1 : 1.3 + Math.random() * 0.8));
      m.rotation.y = ((Math.random() * 4) | 0) * Math.PI / 2;
      m.position.set(x, 0, z);
      m.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(m);
      const pad = 0.4;
      if (occluders.some((o) => b.min.x < o.max.x + pad && b.max.x > o.min.x - pad && b.min.z < o.max.z + pad && b.max.z > o.min.z - pad)) return false;
      if (L.streets.some((s) => (s.axis === 'x' ? b.min.z < s.at + RH + s.sw + 0.5 && b.max.z > s.at - RH - s.sw - 0.5 : b.min.x < s.at + RH + s.sw + 0.5 && b.max.x > s.at - RH - s.sw - 0.5))) return false;
      if (inside) {
        for (let k = 0; k < 12; k++) {
          const px = b.min.x + Math.random() * (b.max.x - b.min.x), pz = b.min.z + Math.random() * (b.max.z - b.min.z);
          if (grid.walkable(px, pz)) return false;
        }
      }
      group.add(m);
      occluders.push(b);
      return true;
    };
    for (let i = 0; i < 500; i++) tryPlace(bx0 + Math.random() * (bx1 - bx0), bz0 + Math.random() * (bz1 - bz0), true);
    for (let i = 0; i < 160; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.max(bx1 - bx0, bz1 - bz0) * (0.62 + Math.random() * 0.45);
      tryPlace(cx + Math.cos(a) * d, cz + Math.sin(a) * d, false);
    }
  }

  function addBackdrop() {
    if (map.skyline) { addSkyline(); return; }
    // distant ring
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.max(bx1 - bx0, bz1 - bz0) * 0.75 + Math.random() * 40;
      const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (roadRects.some((r) => inRect(r, x, z, 3)) || L.streets.some((s) => Math.abs((s.axis === 'x' ? z : x) - s.at) < RH + 3)) continue;
      if (water.some((w) => z > w[1] - 2 && z < w[3] + 2)) continue;
      const t = A.model('suburban/tree-large'); t.scale.setScalar(WORLD_SCALE * (1.2 + Math.random())); t.position.set(x, 0, z); group.add(t);
    }
    // fill empty lawns / back lots with trees so blocks feel enclosed
    let placed = 0;
    for (let i = 0; i < 900 && placed < (map.id === 'downtown' ? 0 : 90); i++) {
      const x = bx0 - 15 + Math.random() * (bx1 - bx0 + 30), z = bz0 - 15 + Math.random() * (bz1 - bz0 + 30);
      const inside = x > bx0 && x < bx1 && z > bz0 && z < bz1;
      if (L.streets.some((s) => Math.abs((s.axis === 'x' ? z : x) - s.at) < RH + (s.sw || 3) + 1.5)) continue;
      if (water.some((w) => z > w[1] - 1.5 && z < w[3] + 1.5)) continue;
      if (occluders.some((b) => x > b.min.x - 1.5 && x < b.max.x + 1.5 && z > b.min.z - 1.5 && z < b.max.z + 1.5)) continue;
      if (inside) {
        if (grid.walkable(x, z)) continue;
        let near = false;
        for (let k = 0; k < 8 && !near; k++) { const a = k / 8 * Math.PI * 2; near = grid.walkable(x + Math.cos(a) * 2, z + Math.sin(a) * 2); }
        if (near) continue;
      }
      const t = A.model(Math.random() < 0.4 ? 'suburban/tree-small' : 'suburban/tree-large');
      t.scale.setScalar(WORLD_SCALE * (0.9 + Math.random() * 0.4)); t.position.set(x, 0, z); t.rotation.y = Math.random() * 6;
      group.add(t); placed++;
    }
  }
}

export const lampBulbMat = A.markShared(new THREE.MeshBasicMaterial({ color: '#fff4cc' }));

function flagTexture() {
  const c = document.createElement('canvas'); c.width = 96; c.height = 60;
  const g = c.getContext('2d');
  for (let i = 0; i < 7; i++) { g.fillStyle = i % 2 ? '#fff' : '#c8323a'; g.fillRect(0, i * 60 / 7, 96, 60 / 7 + 1); }
  g.fillStyle = '#2a3f8f'; g.fillRect(0, 0, 40, 30);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
