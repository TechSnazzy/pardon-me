// Riverside: shops along Shore Dr, then a big park sloping down to a river with two footbridges.
// The ice cream stand is on the far bank. Joggers, strollers and dog walkers everywhere.

export const RIVERSIDE = {
  id: 'riverside',
  name: 'Riverside',
  bounds: [-50, -32, 50, 46],
  ground: '#7fcf6e',
  streets: [
    { name: 'SHORE DR', axis: 'x', at: -20, from: -50, to: 50, cars: true },
  ],
  crosswalks: [
    { street: 'SHORE DR', at: -20 },
    { street: 'SHORE DR', at: 10 },
    { street: 'SHORE DR', at: 38 },
  ],
  shops: [
    { id: 'bakery', model: 'building-c', facing: 's', front: -26.5, at: -40, sign: 'KNEAD TO KNOW', color: '#c98a3a' },
    { id: 'bait', model: 'building-h', facing: 's', front: -26.5, at: -27, sign: 'REEL GOOD BAIT', color: '#2f7fa9' },
    { id: 'brew', model: 'building-a', facing: 's', front: -26.5, at: -3, sign: 'BREW-HAHA CAFÉ', color: '#6b4a3a' },
    { id: 'bikes', model: 'building-d', facing: 's', front: -26.5, at: 22, sign: 'TWO WHEEL DEAL', color: '#3b9a4b' },
    { id: 'kites', model: 'building-g', facing: 's', front: -26.5, at: 42, sign: 'GO FLY A KITE', color: '#d65aa0' },
  ],
  rows: [
    { facing: 's', front: -26.5, from: -50, to: 50, models: ['building-a', 'building-b', 'building-c', 'building-d', 'building-g', 'building-h'], maxDepth: 5.6 },
  ],
  park: {
    rect: [-50, -13.5, 50, 46],
    hedges: [
      [-50, -13.5, -21.5, -12.7], [-18.5, -13.5, 8.5, -12.7], [11.5, -13.5, 36.5, -12.7], [39.5, -13.5, 50, -12.7],
    ],
    paths: [
      [-21, -13.5, -19, 11], [9, -13.5, 11, 11], [37, -13.5, 39, 11],
      [-50, 10.5, 50, 13], [-50, 21, 50, 23.5],
      [-19, -2, 9, 0], [11, 3, 37, 5],
      [33, 23.5, 35, 29.6], [-39, 23.5, -37, 28.4],
    ],
    trees: [[-44, -6], [-32, -2], [-26, 5], [-12, -8], [-4, 6], [16, -6], [28, -2], [30, 8], [46, -4], [-46, 4],
      [-44, 30], [-30, 34], [-20, 28], [-8, 40], [8, 30], [18, 38], [26, 42], [44, 28], [46, 40], [-46, 42], [2, 35]],
    benches: [[-40, 9.4, 0], [-10, 9.4, 0], [15, 9.4, 0], [30, 9.4, 0], [-15, 24.6, Math.PI], [12, 24.6, Math.PI]],
    blankets: [[-34, 4, '#e76f51'], [20, -8, '#2a9d8f'], [-12, 33, '#e9c46a'], [28, 34, '#9b5de5']],
  },
  water: [[-50, 14, 50, 20]],
  bridges: [[-26.5, 12.8, -23.5, 21.2], [20.5, 12.8, 23.5, 21.2]],
  kiosks: [
    { id: 'scoops', x: 34, z: 31.6, facing: 'n', sign: 'SCOOPS AHOY', color: '#ff6fa8', cone: true },
    { id: 'franks', x: -38, z: 30.4, facing: 'n', sign: "FRANK'S FRANKS", color: '#e76f51' },
  ],
  parkPortals: [
    { spawn: [-48, 11.7], route: [[-48, 11.7], [-20, 11.7]], dog: true, jogger: true },
    { spawn: [48, 11.7], route: [[48, 11.7], [10, 11.7]], dog: true, jogger: true },
    { spawn: [-25, 22.2], route: [[-25, 22.2], [-25, 11.7]], stroller: true, dog: true },
    { spawn: [22, 22.2], route: [[22, 22.2], [22, 11.7]], stroller: true, dog: true },
    { spawn: [-5, 7], route: [[-5, 7], [-5, -1]], dog: true },
    { spawn: [25, -7], route: [[25, -7], [25, 4]], dog: true, stroller: true },
    { spawn: [0, 38], route: [[0, 38], [0, 22.2]], dog: true, jogger: true },
    { spawn: [48, 22.2], route: [[48, 22.2], [34, 22.2]], jogger: true, dog: true },
    { spawn: [24, 32], route: [[24, 32], [33.9, 25]], dog: true },
  ],
  graphExtra: [
    [[-20, -15], [-20, -1], [-20, 11.7]],
    [[10, -15], [10, -1], [10, 4], [10, 11.7]],
    [[38, -15], [38, 4], [38, 11.7]],
    [[-48, 11.7], [-25, 11.7], [-20, 11.7], [10, 11.7], [22, 11.7], [38, 11.7], [48, 11.7]],
    [[-25, 11.7], [-25, 22.2]],
    [[22, 11.7], [22, 22.2]],
    [[-48, 22.2], [-38, 22.2], [-25, 22.2], [0, 22.2], [22, 22.2], [34, 22.2], [48, 22.2]],
    [[-20, -1], [10, -1]],
    [[10, 4], [38, 4]],
  ],
  autoProps: { trees: 0, lamps: 18, extras: ['hydrant', 'trash'] },
  props: [],
  starts: {
    bakery: { x: -44, z: -25, heading: Math.PI / 2 },
  },
  ambient: 8,
  ambientVariants: ['dog', 'stroller', 'jogger'],
};
