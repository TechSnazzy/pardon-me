// Pleasant Acres: the original neighborhood. Maple Ave (east-west) crosses Elm St (north-south).
// x = east, z = south. Rects are [x0, z0, x1, z1].

export const SUBURB = {
  id: 'suburb',
  name: 'Pleasant Acres',
  bounds: [-60, -50, 70, 70],
  ground: '#7fcf6e',
  streets: [
    { name: 'MAPLE AVE', axis: 'x', at: 0, from: -60, to: 70, cars: true },
    { name: 'ELM ST', axis: 'z', at: 0, from: -50, to: 70, cars: true },
  ],
  park: {
    rect: [-46, 6.5, -6.5, 30],
    // hedge segments (rects) around the park, leaving openings onto the sidewalks
    hedges: [
      [-46, 6.5, -27, 7.3],
      [-24, 6.5, -6.5, 7.3],
      [-7.3, 7.3, -6.5, 16],
      [-7.3, 19, -6.5, 30],
      [-46, 29.2, -7.3, 30],
      [-46, 7.3, -45.2, 29.2],
    ],
    paths: [
      [-25.5, 16.5, -6.5, 18.5],
      [-26.5, 6.5, -24.5, 27],
      [-26.5, 25, -10, 27],
      [-11, 18.5, -9, 25],
    ],
    pond: { x: -36, z: 17, r: 4.5 },
    trees: [[-42, 10], [-40, 25], [-30, 11], [-30, 23], [-19, 11], [-17, 22], [-13, 13], [-44, 18], [-21, 28.2], [-36, 26.5]],
    benches: [[-20, 15.6, 0], [-14, 15.6, 0], [-27.6, 12, Math.PI / 2], [-18, 24.1, 0]],
  },
  houses: [
    // Elm St, west side (south of the park) - home is here
    { model: 'building-type-k', facing: 'e', front: -12.5, at: 36 },
    { model: 'building-type-c', facing: 'e', front: -12.5, at: 46, home: true },
    { model: 'building-type-r', facing: 'e', front: -12.5, at: 56 },
    { model: 'building-type-e', facing: 'e', front: -12.5, at: 66 },
    // Elm St, east side
    { model: 'building-type-a', facing: 'w', front: 12.5, at: 14 },
    { model: 'building-type-o', facing: 'w', front: 12.5, at: 24 },
    { model: 'building-type-l', facing: 'w', front: 12.5, at: 34 },
    { model: 'building-type-p', facing: 'w', front: 12.5, at: 44 },
    { model: 'building-type-j', facing: 'w', front: 12.5, at: 54 },
    { model: 'building-type-u', facing: 'w', front: 12.5, at: 64 },
    // Maple Ave, south side (east of Elm)
    { model: 'building-type-s', facing: 'n', front: 12.5, at: 27 },
    { model: 'building-type-h', facing: 'n', front: 12.5, at: 37 },
    { model: 'building-type-d', facing: 'n', front: 12.5, at: 47 },
    { model: 'building-type-i', facing: 'n', front: 12.5, at: 57 },
    { model: 'building-type-g', facing: 'n', front: 12.5, at: 66 },
    // Maple Ave, south side (west of the park)
    { model: 'building-type-b', facing: 'n', front: 12.5, at: -53 },
    // Maple Ave, north side (west of Elm)
    { model: 'building-type-f', facing: 's', front: -12.5, at: -15 },
    { model: 'building-type-q', facing: 's', front: -12.5, at: -25 },
    { model: 'building-type-t', facing: 's', front: -12.5, at: -35 },
    { model: 'building-type-m', facing: 's', front: -12.5, at: -45 },
    { model: 'building-type-n', facing: 's', front: -12.5, at: -55 },
    // Elm St, west side (north of Maple)
    { model: 'building-type-r', facing: 'e', front: -12.5, at: -27 },
    { model: 'building-type-a', facing: 'e', front: -12.5, at: -37 },
    { model: 'building-type-k', facing: 'e', front: -12.5, at: -46 },
  ],
  shops: [
    { id: 'cafe', model: 'building-c', facing: 's', front: -6.5, at: 10.5, sign: 'BEAN THERE CAFÉ', color: '#c0703a' },
    { id: 'books', model: 'building-a', facing: 's', front: -6.5, at: 15.5, sign: 'PAGE TURNERS', color: '#6a4fb3' },
    { id: 'barber', model: 'building-g', facing: 's', front: -6.5, at: 20.8, sign: 'SHEAR MADNESS', color: '#c23b4b' },
    { id: 'laundry', model: 'building-d', facing: 's', front: -6.5, at: 25.6, sign: 'SPIN CITY', color: '#2f8fc9' },
    { id: 'deli', model: 'building-h', facing: 's', front: -6.5, at: 30.2, sign: 'LETTUCE EAT DELI', color: '#3b9a4b' },
    { id: 'po', model: 'building-e', facing: 's', front: -6.5, at: 37.5, sign: 'POST OFFICE', color: '#24479b' },
    { id: 'pharmacy', model: 'building-b', facing: 's', front: -6.5, at: 44.5, sign: 'RX & CHILL', color: '#1f9a8a' },
    { id: 'grocery', model: 'building-j', facing: 's', front: -6.5, at: 54, sign: 'AISLE BE BACK', color: '#d6612a' },
    { id: 'pizza', model: 'building-f', facing: 's', front: -6.5, at: 62, sign: 'PIZZA MY HEART', color: '#c9302c' },
    { id: 'bank', model: 'building-a', facing: 's', front: -6.5, at: 67, sign: 'FIRST NATL BANK', color: '#4a5568' },
    // Elm St, east side, north of Maple
    { id: 'hardware', model: 'building-d', facing: 'w', front: 6.5, at: -16, sign: 'NUTS & BOLTS', color: '#8a5a2b' },
    { id: 'florist', model: 'building-h', facing: 'w', front: 6.5, at: -22, sign: 'PETAL PUSHERS', color: '#d65aa0' },
    { id: 'office', model: 'building-i', facing: 'w', front: 6.5, at: -29, sign: 'SYNERGY CORP', color: '#3a6ea5' },
    { id: 'gym', model: 'building-l', facing: 'w', front: 6.5, at: -37, sign: 'SWEAT EQUITY', color: '#e0a020' },
    { id: 'dentist', model: 'building-c', facing: 'w', front: 6.5, at: -45, sign: 'TOOTH HURTY', color: '#5aa0d6' },
  ],
  props: [
    // Maple north curb
    ...[-50, -36, -22, 13, 23, 33, 48, 58].map((x) => ({ kind: 'tree', x, z: -4.2 })),
    ...[-45, -30, -15, 18, 41, 65].map((x) => ({ kind: 'lamp', x, z: -3.85, rot: Math.PI })),
    { kind: 'mailbox', x: 35, z: -4.3 },
    { kind: 'trash', x: 28, z: -4.1 },
    { kind: 'bench', x: 51, z: -4.2, rot: Math.PI },
    // Maple south curb
    ...[-52, -38, -16, 14, 30, 44, 60].map((x) => ({ kind: 'tree', x, z: 4.2 })),
    ...[-30, 22, 50].map((x) => ({ kind: 'lamp', x, z: 3.85, rot: 0 })),
    { kind: 'hydrant', x: 37, z: 4.0 },
    { kind: 'hydrant', x: -20, z: 4.0 },
    // Elm west curb
    ...[-40, -20, 12, 24, 40, 60].map((z) => ({ kind: 'tree', x: -4.2, z })),
    ...[-30, 30, 52].map((z) => ({ kind: 'lamp', x: -3.85, z, rot: -Math.PI / 2 })),
    { kind: 'hydrant', x: -4.0, z: 33 },
    // Elm east curb
    ...[-36, -24, 18, 30, 48, 62].map((z) => ({ kind: 'tree', x: 4.2, z })),
    ...[-44, 10, 40].map((z) => ({ kind: 'lamp', x: 3.85, z, rot: Math.PI / 2 })),
    { kind: 'trash', x: 4.1, z: -12 },
  ],
  parkPortals: [
    { spawn: [-23, 17.5], route: [[-23, 17.5], [-7, 17.5], [-5, 17.5]], stroller: true },
    { spawn: [-25.5, 23], route: [[-25.5, 23], [-25.5, 7], [-25.5, 5]], stroller: true },
    { spawn: [-12, 26], route: [[-12, 26], [-10, 26], [-10, 18.5], [-7, 17.5], [-5, 17.5]], stroller: true },
  ],
  starts: {
    home: { door: 'home' },
  },
  ambient: 6,
};
