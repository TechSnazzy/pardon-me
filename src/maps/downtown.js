// Downtown: three avenues x two streets, wide sidewalks, towers, and a plaza with a fountain.
// Blocks between the streets are lined with buildings flush to the sidewalk.

const SW = 4;
// block extents (between outer sidewalk edges)
const COLS = { A: [-56, -37.5], B: [-22.5, -7.5], C: [7.5, 22.5], D: [37.5, 56] };
const ROW_MODELS = ['building-a', 'building-b', 'building-d', 'building-g', 'building-h', 'building-c', 'building-l', 'building-skyscraper-c', 'building-skyscraper-d', 'building-skyscraper-e'];
const SMALL = ['building-a', 'building-b', 'building-c', 'building-d', 'building-g', 'building-h'];

const rows = [];
// along Market St (z = -12) and Central St (z = 24)
for (const c of ['A', 'B', 'C', 'D']) {
  const [x0, x1] = COLS[c];
  rows.push({ facing: 's', front: -19.5, from: x0, to: x1, models: ROW_MODELS, maxDepth: 7 });
  rows.push({ facing: 'n', front: 31.5, from: x0, to: x1, models: ROW_MODELS, maxDepth: 7 });
  if (c !== 'C') {
    rows.push({ facing: 'n', front: -4.5, from: x0, to: x1, models: SMALL, maxDepth: 6 });
    rows.push({ facing: 's', front: 16.5, from: x0, to: x1, models: SMALL, maxDepth: 6 });
  }
}
// along the avenues, in the space the street-facing rows leave free
for (const [z0, z1, depth] of [[-40, -27, 6], [2, 10, 6], [39, 50, 6]]) {
  rows.push({ facing: 'e', front: -37.5, from: z0, to: z1, models: SMALL, maxDepth: depth });
  rows.push({ facing: 'w', front: -22.5, from: z0, to: z1, models: SMALL, maxDepth: depth });
  rows.push({ facing: 'e', front: -7.5, from: z0, to: z1, models: SMALL, maxDepth: depth });
  rows.push({ facing: 'w', front: 37.5, from: z0, to: z1, models: SMALL, maxDepth: depth });
  if (z0 !== 2) {
    rows.push({ facing: 'w', front: 7.5, from: z0, to: z1, models: SMALL, maxDepth: depth });
    rows.push({ facing: 'e', front: 22.5, from: z0, to: z1, models: SMALL, maxDepth: depth });
  }
}

export const DOWNTOWN = {
  id: 'downtown',
  name: 'Downtown',
  bounds: [-56, -40, 56, 50],
  ground: '#8d8aa0',
  streets: [
    { name: '1ST AVE', axis: 'z', at: -30, from: -40, to: 50, sw: SW, cars: true },
    { name: 'BROADWAY', axis: 'z', at: 0, from: -40, to: 50, sw: SW, cars: true },
    { name: '3RD AVE', axis: 'z', at: 30, from: -40, to: 50, sw: SW, cars: true },
    { name: 'MARKET ST', axis: 'x', at: -12, from: -56, to: 56, sw: SW, cars: true },
    { name: 'CENTRAL ST', axis: 'x', at: 24, from: -56, to: 56, sw: SW, cars: true },
  ],
  shops: [
    // Market St, north side
    { id: 'bagels', model: 'building-a', facing: 's', front: -19.5, at: -47, sign: 'BAGEL BOSS', color: '#c98a3a' },
    { id: 'grind', model: 'building-c', facing: 's', front: -19.5, at: -15, sign: 'THE DAILY GRIND', color: '#6b4a3a' },
    { id: 'synergy', model: 'building-skyscraper-a', facing: 's', front: -19.5, at: 15, sign: 'SYNERGY CORP', color: '#3a6ea5' },
    { id: 'bank', model: 'building-l', facing: 's', front: -19.5, at: 46, sign: 'BANK OF BANKS', color: '#4a5568' },
    // Market St, south side
    { id: 'pizza', model: 'building-f', facing: 'n', front: -4.5, at: -47, sign: 'SLICE SLICE BABY', color: '#c9302c' },
    { id: 'wok', model: 'building-h', facing: 'n', front: -4.5, at: -15, sign: 'WOK THIS WAY', color: '#d0432b' },
    { id: 'shoes', model: 'building-d', facing: 'n', front: -4.5, at: 46, sign: 'SOLE MATES', color: '#2f8fc9' },
    // Central St, north side
    { id: 'deli', model: 'building-b', facing: 's', front: 16.5, at: -46, sign: 'CTRL ALT DELI', color: '#3b9a4b' },
    { id: 'salon', model: 'building-g', facing: 's', front: 16.5, at: -15, sign: 'HAIR FORCE ONE', color: '#d65aa0' },
    { id: 'books', model: 'building-a', facing: 's', front: 16.5, at: 46, sign: 'NOVEL IDEA', color: '#6a4fb3' },
    // Central St, south side
    { id: 'gym', model: 'building-c', facing: 'n', front: 31.5, at: -47, sign: 'FLEX APPEAL', color: '#e0a020' },
    { id: 'music', model: 'building-d', facing: 'n', front: 31.5, at: -15, sign: 'SOUND DECISIONS', color: '#2a9d8f' },
    { id: 'hotel', model: 'building-skyscraper-b', facing: 'n', front: 31.5, at: 15, sign: 'GRAND HOTEL', color: '#8a2a4a' },
    { id: 'cinema', model: 'building-k', facing: 'n', front: 31.5, at: 47, sign: 'REEL TALK CINEMA', color: '#b8322a' },
  ],
  rows,
  plaza: {
    rect: [7.5, -4.5, 22.5, 16.5],
    fountain: { x: 15, z: 6, r: 2.6 },
    trees: [[10, -1.5], [20, -1.5], [10, 13.5], [20, 13.5]],
    benches: [[15, 1.4, 0], [15, 10.6, Math.PI], [10.6, 6, Math.PI / 2], [19.4, 6, -Math.PI / 2]],
  },
  parkPortals: [
    { spawn: [15, -1], route: [[15, -1], [15, -6.5]] },
    { spawn: [12, 3], route: [[12, 3], [5.5, 3]] },
    { spawn: [18, 9], route: [[18, 9], [24.5, 9]] },
    { spawn: [15, 13], route: [[15, 13], [15, 18.5]] },
    { spawn: [9, -2], route: [[9, -2], [9, -6.5]] },
    { spawn: [21, 14], route: [[21, 14], [21, 18.5]] },
  ],
  autoProps: { trees: 16, lamps: 22, extras: ['hydrant', 'trash', 'bench'] },
  props: [
    { kind: 'subway', x: -37.1, z: 47.5 },
    { kind: 'busstop', x: 7.0, z: 40 },
  ],
  starts: {
    subway: { x: -35.5, z: 44, heading: Math.PI },
    hotel: { door: 'hotel' },
  },
  ambient: 11,
  skyline: true,
};
