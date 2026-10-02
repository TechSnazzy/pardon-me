import * as THREE from 'three';
import { GLTFLoader } from '../vendor/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from '../vendor/addons/utils/SkeletonUtils.js';

const loader = new GLTFLoader();
const cache = new Map();
let clips = null;
const shared = new WeakSet();   // geometry/materials/textures owned by the loaded models

export function markShared(obj) { shared.add(obj); return obj; }
export function isShared(obj) { return shared.has(obj); }

export const CHARACTER_MODELS = [
  'character-male-a', 'character-male-b', 'character-male-c', 'character-male-d', 'character-male-e', 'character-male-f',
  'character-female-a', 'character-female-b', 'character-female-c', 'character-female-d', 'character-female-e', 'character-female-f',
];

function prep(root, { shadows = true } = {}) {
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = shadows;
      o.receiveShadow = true;
      if (o.material?.map) o.material.map.colorSpace = THREE.SRGBColorSpace;
    }
  });
  return root;
}

export async function loadAll(list, onProgress) {
  let done = 0;
  // a handful at a time: friendlier to slow connections and small servers
  const queue = [...list];
  const worker = async () => { while (queue.length) await loadOne(queue.shift()); };
  const loadOne = async (path) => {
    const gltf = await loader.loadAsync(`assets/models/${path}.glb`);
    prep(gltf.scene);
    gltf.scene.traverse((o) => {
      if (o.geometry) shared.add(o.geometry);
      for (const m of [].concat(o.material || [])) { shared.add(m); if (m.map) shared.add(m.map); }
    });
    cache.set(path, gltf);
    if (!clips && gltf.animations?.length) clips = gltf.animations;
    done++; onProgress?.(done / list.length);
  };
  await Promise.all(Array.from({ length: 8 }, worker));
}

export function model(path) {
  const g = cache.get(path);
  if (!g) throw new Error(`model not loaded: ${path}`);
  return g.scene.clone(true);
}

export function character(name) {
  const g = cache.get(`characters/${name}`);
  return SkeletonUtils.clone(g.scene);
}

export function animationClips() { return clips || []; }

export function modelBox(path) {
  const g = cache.get(path);
  return new THREE.Box3().setFromObject(g.scene);
}
