// Tuning knobs. Most "feel" changes should only need edits here.

export const HERO_NAME = 'Sean';

export const WORLD_SCALE = 5;      // Kenney city kits -> world units
export const CHAR_SCALE = 1.55;    // Kenney mini characters -> ~1.1 units tall
export const CELL = 0.5;           // collision / pathfinding grid cell size

export const PLAYER = {
  radius: 0.32,
  walkSpeed: 3.0,
  hurrySpeed: 5.0,
  dawdleSpeed: 1.4,
  accel: 14,
  turnRate: 12,            // rad/s visual turn smoothing
  jumpSpeed: 6.4,          // initial upward speed (~0.8 units high, ~0.5s in the air)
  gravity: 26,
};

export const NPC = {
  radius: 0.32,
  walkSpeed: 2.6,
  maxSpeed: 3.6,           // fastest an encounter NPC will hurry to make the "appointment"
  accel: 6,
  engageDist: 5.0,         // start homing on the player inside this distance
  commitDist: 2.0,         // stop adjusting inside this distance (last-second dodge window)
  reactionDelay: 0.5,      // seconds of lag when mirroring the player's sidestep
  steerRate: 1.4,          // rad/s heading change while engaging
  patience: [2.2, 3.8],    // seconds an NPC will dawdle waiting for the player before moving on
};

export const DIRECTOR = {
  startGrace: 4.0,
  cooldown: [3.6, 6.0],    // breathing room between encounters
  lookahead: 7.0,          // seconds of player prediction
  minMeetTime: 1.8,
  maxMeetTime: 6.5,
  encounterTimeout: 14,
  doorRivalRange: 16,
  weights: { cross: 0.45, headon: 0.35, overtake: 0.2 },
  maxActive: 1,            // how many targeted encounters at once (difficulty raises it)
};

export const BUMP = {
  dist: 0.72,
  freeze: 1.0,
  hurryFreeze: 1.7,
  awkward: 22,
  hurryAwkward: 34,
  ambientAwkward: 14,
  awkwardDecay: 1.2,       // per second
  knockback: 0.75,
};

export const CAMERA = {
  distance: 6.2,
  height: 3.4,
  lookHeight: 1.0,
  lookAhead: 2.0,
  followRate: 2.2,
  minDist: 1.2,
  maxDist: 11,
};
