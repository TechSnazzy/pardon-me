// Walkability / height grid with collision helpers and A* pathfinding.
import { CELL } from './config.js';

export const SURF = { BLOCKED: 0, SIDEWALK: 1, CROSSWALK: 2, PARK: 3, PATH: 4 };

export class Grid {
  constructor(bounds) {
    const [x0, z0, x1, z1] = bounds;
    this.x0 = x0; this.z0 = z0;
    this.w = Math.ceil((x1 - x0) / CELL);
    this.h = Math.ceil((z1 - z0) / CELL);
    this.surf = new Uint8Array(this.w * this.h);
    this.height = new Float32Array(this.w * this.h);
  }

  ix(x) { return Math.floor((x - this.x0) / CELL); }
  iz(z) { return Math.floor((z - this.z0) / CELL); }
  cx(i) { return this.x0 + (i + 0.5) * CELL; }
  cz(j) { return this.z0 + (j + 0.5) * CELL; }

  paintRect([ax, az, bx, bz], surf, height) {
    const i0 = Math.max(0, this.ix(Math.min(ax, bx) + 1e-4)), i1 = Math.min(this.w - 1, this.ix(Math.max(ax, bx) - 1e-4));
    const j0 = Math.max(0, this.iz(Math.min(az, bz) + 1e-4)), j1 = Math.min(this.h - 1, this.iz(Math.max(az, bz) - 1e-4));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * this.w + i; this.surf[k] = surf; if (height !== undefined) this.height[k] = height;
    }
  }

  paintCircle(x, z, r, surf) {
    const i0 = this.ix(x - r), i1 = this.ix(x + r), j0 = this.iz(z - r), j1 = this.iz(z + r);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      if (i < 0 || j < 0 || i >= this.w || j >= this.h) continue;
      const dx = this.cx(i) - x, dz = this.cz(j) - z;
      if (dx * dx + dz * dz <= (r + CELL * 0.5) ** 2) this.surf[j * this.w + i] = surf;
    }
  }

  surfAt(x, z) {
    const i = this.ix(x), j = this.iz(z);
    if (i < 0 || j < 0 || i >= this.w || j >= this.h) return SURF.BLOCKED;
    return this.surf[j * this.w + i];
  }
  cellWalkable(i, j) {
    return i >= 0 && j >= 0 && i < this.w && j < this.h && this.surf[j * this.w + i] !== SURF.BLOCKED;
  }
  walkable(x, z) { return this.surfAt(x, z) !== SURF.BLOCKED; }
  heightAt(x, z) {
    const i = this.ix(x), j = this.iz(z);
    if (i < 0 || j < 0 || i >= this.w || j >= this.h) return 0;
    return this.height[j * this.w + i];
  }

  // Is a circle of radius r at (x,z) entirely on walkable ground?
  circleFree(x, z, r) {
    if (!this.walkable(x, z)) return false;
    for (let a = 0; a < 8; a++) {
      const t = (a / 8) * Math.PI * 2;
      if (!this.walkable(x + Math.cos(t) * r, z + Math.sin(t) * r)) return false;
    }
    return true;
  }

  // Move a circle by (dx,dz) with axis-separated sliding. Returns {x,z,blocked}.
  move(x, z, dx, dz, r) {
    let blocked = false;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (CELL * 0.4)));
    const sx = dx / steps, sz = dz / steps;
    for (let s = 0; s < steps; s++) {
      if (this.circleFree(x + sx, z, r)) x += sx; else blocked = true;
      if (this.circleFree(x, z + sz, r)) z += sz; else blocked = true;
    }
    return { x, z, blocked };
  }

  // Like move(), but if we're mostly blocked, try angling off to slip around trees, poles and corners.
  moveSmart(x, z, dx, dz, r) {
    const want = Math.hypot(dx, dz);
    const base = this.move(x, z, dx, dz, r);
    if (want < 1e-5) return base;
    const nx = dx / want, nz = dz / want;
    const prog = (res) => (res.x - x) * nx + (res.z - z) * nz;
    if (prog(base) > want * 0.6) return base;
    // Only angle off toward a side where the way forward opens up (so we slip around a
    // tree, but don't drift sideways along a long wall we're pushing into).
    const score = (res) => prog(res) + 0.3 * Math.hypot(res.x - x, res.z - z);
    let best = base, bs = score(base);
    for (const a of [0.6, -0.6, 1.1, -1.1]) {
      const c = Math.cos(a), s = Math.sin(a);
      const rx = nx * c - nz * s, rz = nx * s + nz * c;
      if (!this.circleFree(x + rx * 0.7 + nx * 0.6, z + rz * 0.7 + nz * 0.6, r)) continue;
      const res = this.move(x, z, rx * want * c, rz * want * c, r);
      const sc = score(res);
      if (sc > bs + 1e-5) { best = res; bs = sc; }
    }
    return best;
  }

  // Straight-line clearance test for a circle of radius r.
  lineFree(ax, az, bx, bz, r = 0) {
    const d = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.ceil(d / (CELL * 0.5)));
    for (let s = 0; s <= n; s++) {
      const t = s / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      if (r > 0 ? !this.circleFree(x, z, r) : !this.walkable(x, z)) return false;
    }
    return true;
  }

  nearestWalkable(x, z, maxR = 8) {
    if (this.walkable(x, z)) return { x, z };
    const ci = this.ix(x), cj = this.iz(z);
    for (let rad = 1; rad <= maxR / CELL; rad++) {
      let best = null, bd = Infinity;
      for (let j = cj - rad; j <= cj + rad; j++) for (let i = ci - rad; i <= ci + rad; i++) {
        if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== rad || !this.cellWalkable(i, j)) continue;
        const d = (this.cx(i) - x) ** 2 + (this.cz(j) - z) ** 2;
        if (d < bd) { bd = d; best = { x: this.cx(i), z: this.cz(j) }; }
      }
      if (best) return best;
    }
    return null;
  }

  // A* over 8-connected cells, keeping `clear` cells of margin from walls when possible.
  findPath(ax, az, bx, bz, r = 0.3) {
    const start = this.nearestWalkable(ax, az), goal = this.nearestWalkable(bx, bz);
    if (!start || !goal) return null;
    const si = this.ix(start.x), sj = this.iz(start.z), gi = this.ix(goal.x), gj = this.iz(goal.z);
    const W = this.w, N = W * this.h;
    if (!this._g) { this._g = new Float32Array(N); this._from = new Int32Array(N); this._seen = new Uint32Array(N); this._stamp = 0; this._penalty = this._buildPenalty(); }
    const g = this._g, from = this._from, seen = this._seen, pen = this._penalty;
    const stamp = ++this._stamp;
    const heap = new MinHeap();
    const s = sj * W + si, goalK = gj * W + gi;
    g[s] = 0; from[s] = -1; seen[s] = stamp;
    const hfn = (i, j) => { const dx = Math.abs(i - gi), dz = Math.abs(j - gj); return Math.max(dx, dz) + 0.4142 * Math.min(dx, dz); };
    heap.push(s, hfn(si, sj));
    const closed = new Set();
    let found = false, iter = 0;
    while (heap.size && iter++ < 60000) {
      const k = heap.pop();
      if (k === goalK) { found = true; break; }
      if (closed.has(k)) continue;
      closed.add(k);
      const i = k % W, j = (k / W) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = i + di, nj = j + dj;
        if (!this.cellWalkable(ni, nj)) continue;
        if (di && dj && (!this.cellWalkable(i + di, j) || !this.cellWalkable(i, j + dj))) continue;
        const nk = nj * W + ni;
        const cost = g[k] + (di && dj ? 1.4142 : 1) + pen[nk];
        if (seen[nk] !== stamp || cost < g[nk]) {
          seen[nk] = stamp; g[nk] = cost; from[nk] = k;
          heap.push(nk, cost + hfn(ni, nj));
        }
      }
    }
    if (!found) return null;
    const cells = [];
    for (let k = goalK; k !== -1; k = from[k]) cells.push(k);
    cells.reverse();
    const pts = cells.map((k) => ({ x: this.cx(k % W), z: this.cz((k / W) | 0) }));
    pts[pts.length - 1] = { x: goal.x, z: goal.z };
    return this.smooth([{ x: ax, z: az }, ...pts.slice(1)], r);
  }

  // Cells hugging walls cost a little more so paths stay off the curb.
  _buildPenalty() {
    const p = new Float32Array(this.w * this.h);
    for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) {
      let near = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (!this.cellWalkable(i + di, j + dj)) near++;
      p[j * this.w + i] = near ? 0.8 : 0;
    }
    return p;
  }

  smooth(pts, r) {
    if (pts.length <= 2) return pts;
    const out = [pts[0]];
    let a = 0;
    while (a < pts.length - 1) {
      let b = pts.length - 1;
      while (b > a + 1 && !this.lineFree(pts[a].x, pts[a].z, pts[b].x, pts[b].z, r)) b--;
      out.push(pts[b]);
      a = b;
    }
    return out;
  }
}

class MinHeap {
  constructor() { this.k = []; this.p = []; }
  get size() { return this.k.length; }
  push(key, pri) {
    const k = this.k, p = this.p; let i = k.length; k.push(key); p.push(pri);
    while (i > 0) { const pa = (i - 1) >> 1; if (p[pa] <= p[i]) break; [k[pa], k[i]] = [k[i], k[pa]]; [p[pa], p[i]] = [p[i], p[pa]]; i = pa; }
  }
  pop() {
    const k = this.k, p = this.p; const top = k[0]; const lk = k.pop(), lp = p.pop();
    if (k.length) {
      k[0] = lk; p[0] = lp; let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < k.length && p[l] < p[m]) m = l;
        if (r < k.length && p[r] < p[m]) m = r;
        if (m === i) break;
        [k[m], k[i]] = [k[i], k[m]]; [p[m], p[i]] = [p[i], p[m]]; i = m;
      }
    }
    return top;
  }
}
