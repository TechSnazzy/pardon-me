// Turns a list of streets into roads, sidewalks, crosswalks, car lanes,
// intersections and the sidewalk walking graph. Maps only describe streets.
export const RH = 3.5;        // road half-width (two lanes)
export const LANE = 1.75;     // lane centre offset from the road centre

const subtract = (pieces, a, b) => {
  const out = [];
  for (const [p0, p1] of pieces) {
    if (b <= p0 || a >= p1) { out.push([p0, p1]); continue; }
    if (a > p0) out.push([p0, a]);
    if (b < p1) out.push([b, p1]);
  }
  return out;
};

export function layoutStreets(map) {
  const streets = map.streets.map((s) => ({ sw: 3, ...s }));
  const byName = Object.fromEntries(streets.map((s) => [s.name, s]));
  const [bx0, bz0, bx1, bz1] = map.bounds;
  // `a` = along the street, `p` = across it
  const rect = (s, a0, a1, p0, p1) => (s.axis === 'x' ? [a0, p0, a1, p1] : [p0, a0, p1, a1]);
  const pt = (s, a, p) => (s.axis === 'x' ? { x: a, z: p } : { x: p, z: a });
  const atBound = (s, v) => (s.axis === 'x' ? v <= bx0 || v >= bx1 : v <= bz0 || v >= bz1);

  const roads = streets.map((s) => ({ street: s, rect: rect(s, s.from, s.to, s.at - RH, s.at + RH) }));
  const sidewalks = [], crosswalks = [], ends = [], bands = [];

  for (const s of streets) {
    for (const side of [-1, 1]) {
      const p0 = side < 0 ? s.at - RH - s.sw : s.at + RH, p1 = p0 + s.sw;
      let pieces = [[s.from, s.to]];
      const gaps = [];
      for (const o of streets) {
        if (o.axis === s.axis || o.to <= p0 || o.from >= p1) continue;
        const g0 = o.at - RH, g1 = o.at + RH;
        if (g1 <= s.from || g0 >= s.to) continue;
        pieces = subtract(pieces, g0, g1);
        if (o.from <= p0 && o.to >= p1 && s.from <= g0 && s.to >= g1) {
          crosswalks.push({ rect: rect(s, g0, g1, p0, p1), axis: s.axis, crosses: o });
          gaps.push([g0, g1]);
        }
      }
      for (const [a0, a1] of pieces) {
        sidewalks.push(rect(s, a0, a1, p0, p1));
        for (const [v, dir] of [[a0, 1], [a1, -1]]) {
          if (atBound(s, v)) ends.push({ ...pt(s, v + dir * 0.5, (p0 + p1) / 2), axis: s.axis === 'x' ? 'z' : 'x' });
        }
      }
      bands.push({ s, side, p0, p1, c: (p0 + p1) / 2, pieces, gaps });
    }
  }

  // mid-block crosswalks
  const midLinks = [];
  for (const cw of map.crosswalks || []) {
    const s = byName[cw.street];
    const w = cw.w || 3;
    crosswalks.push({ rect: rect(s, cw.at - w / 2, cw.at + w / 2, s.at - RH, s.at + RH), axis: s.axis === 'x' ? 'z' : 'x', mid: true });
    midLinks.push({ s, at: cw.at });
  }

  // ---- sidewalk graph ----
  const nodes = new Map();
  const key = (p) => `${p.x.toFixed(2)},${p.z.toFixed(2)}`;
  const node = (p) => { const k = key(p); if (!nodes.has(k)) nodes.set(k, { x: p.x, z: p.z, links: [] }); return nodes.get(k); };
  const link = (a, b) => { if (a !== b && !a.links.includes(b)) { a.links.push(b); b.links.push(a); } };
  const inPieces = (pieces, v) => pieces.some(([a, b]) => v >= a + 0.3 && v <= b - 0.3);
  for (const b of bands) {
    const s = b.s;
    const pos = new Set();
    for (const [a0, a1] of b.pieces) {
      pos.add(a0 + (atBound(s, a0) ? 1.5 : 0.6)); pos.add(a1 - (atBound(s, a1) ? 1.5 : 0.6));
      for (let v = a0 + 15; v < a1 - 7; v += 15) pos.add(Math.round(v));
    }
    for (const o of streets) {
      if (o.axis === s.axis) continue;
      for (const sd of [-1, 1]) pos.add(o.at + sd * (RH + o.sw / 2));
    }
    for (const m of midLinks) if (m.s === s) pos.add(m.at);
    const list = [...pos].filter((v) => inPieces(b.pieces, v)).sort((x, y) => x - y);
    for (let i = 0; i < list.length; i++) {
      const n = node(pt(s, list[i], b.c));
      if (i > 0) {
        const a = list[i - 1], c = list[i];
        // linked if the stretch between is one piece of sidewalk, or a crosswalk bridges the gap
        const samePiece = b.pieces.some(([p0, p1]) => a >= p0 && c <= p1);
        const viaCrosswalk = b.gaps.some(([g0, g1]) => a < g0 && c > g1);
        if (samePiece || viaCrosswalk) link(node(pt(s, a, b.c)), n);
      }
    }
  }
  for (const m of midLinks) {
    const s = m.s, w = s.sw;
    link(node(pt(s, m.at, s.at - RH - w / 2)), node(pt(s, m.at, s.at + RH + w / 2)));
  }

  // ---- car lanes & intersections ----
  const lanes = [];
  for (const s of streets) {
    if (!s.cars) continue;
    const lo = s.axis === 'x' ? bx0 : bz0, hi = s.axis === 'x' ? bx1 : bz1;
    if (s.from > lo || s.to < hi) continue;  // only through-streets get traffic
    // right-hand traffic: +x drives at +z, -x at -z, +z drives at -x, -z at +x
    for (const dir of [1, -1]) {
      const off = s.axis === 'x' ? dir * LANE : -dir * LANE;
      lanes.push({ street: s, axis: s.axis, dir, perp: s.at + off, start: dir > 0 ? s.from - 45 : s.to + 45, end: dir > 0 ? s.to + 45 : s.from - 45 });
    }
  }
  const intersections = [];
  for (const a of streets) for (const b of streets) {
    if (a.axis !== 'x' || b.axis !== 'z') continue;
    if (b.at - RH < a.from || b.at + RH > a.to || a.at - RH < b.from || a.at + RH > b.to) continue;
    intersections.push({ rect: [b.at - RH, a.at - RH, b.at + RH, a.at + RH], x: b.at, z: a.at, xs: a, zs: b, owner: null, cars: new Set(), waiting: 0 });
  }

  return { streets, roads, sidewalks, crosswalks, ends, graph: [...nodes.values()], lanes, intersections };
}
