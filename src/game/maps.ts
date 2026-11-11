import * as THREE from 'three';
import { MapId } from './types';

export interface AABB {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface MapDefinition {
  id: MapId;
  name: string;
  description: string;
  skyColor: number;
  fogColor: number;
  groundColor: string;
  wallColor: string;
  accentColor: string;
  colliders: AABB[];
  spawnPoints: { x: number; y: number; z: number }[];
  redFlagPos: { x: number; y: number; z: number };
  blueFlagPos: { x: number; y: number; z: number };
}

export const MAP_META: Record<MapId, { name: string; description: string; badge: string }> = {
  desert: {
    name: 'Desert Arena',
    description: 'Sun-baked sandstone ruins, central sniper tower, and flanking ramps.',
    badge: '#f59e0b',
  },
  warehouse: {
    name: 'Industrial Warehouse',
    description: 'Stacked shipping containers, elevated catwalks, and tight CQC lanes.',
    badge: '#38bdf8',
  },
  city: {
    name: 'City Streets',
    description: 'Urban low-poly blocks, rooftop platforms, and alleyways.',
    badge: '#a855f7',
  },
  military: {
    name: 'Military Base',
    description: 'Fortified bunkers, watchtowers, helipad, and tactical cover.',
    badge: '#22c55e',
  },
};

function createGridTexture(baseHex: string, lineHex: string, repeat = 24): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = lineHex;
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, 256, 256);

  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.moveTo(128, 0);
  ctx.lineTo(128, 256);
  ctx.moveTo(0, 128);
  ctx.lineTo(256, 128);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildMapScene(
  mapId: MapId,
  scene: THREE.Scene,
  maxAnisotropy: number
): MapDefinition {
  const colliders: AABB[] = [];
  const mapGroup = new THREE.Group();
  mapGroup.name = 'MapGeometry';

  const configs: Record<
    MapId,
    {
      sky: number;
      ground: string;
      groundLine: string;
      wall: string;
      accent: string;
    }
  > = {
    desert: {
      sky: 0xd9a76a,
      ground: '#d4a373',
      groundLine: '#bc8a5f',
      wall: '#e6ccb2',
      accent: '#b08968',
    },
    warehouse: {
      sky: 0x1e293b,
      ground: '#334155',
      groundLine: '#475569',
      wall: '#64748b',
      accent: '#0284c7',
    },
    city: {
      sky: 0x3b4d6b,
      ground: '#27272a',
      groundLine: '#3f3f46',
      wall: '#52525b',
      accent: '#eab308',
    },
    military: {
      sky: 0x4b5e40,
      ground: '#3f4f36',
      groundLine: '#526348',
      wall: '#5c6b54',
      accent: '#ca8a04',
    },
  };

  const cfg = configs[mapId];
  scene.background = new THREE.Color(cfg.sky);
  scene.fog = new THREE.Fog(cfg.sky, 35, 115);

  const groundTex = createGridTexture(cfg.ground, cfg.groundLine, 32);
  groundTex.anisotropy = maxAnisotropy;

  const groundMat = new THREE.MeshStandardMaterial({
    map: groundTex,
    roughness: 0.9,
    metalness: 0.05,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  mapGroup.add(ground);

  const wallTex = createGridTexture(cfg.wall, cfg.groundLine, 2);
  wallTex.anisotropy = maxAnisotropy;
  const wallMat = new THREE.MeshStandardMaterial({
    map: wallTex,
    roughness: 0.75,
    metalness: 0.1,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: cfg.accent,
    roughness: 0.45,
    metalness: 0.35,
  });

  const addBox = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    mat: THREE.Material = wallMat
  ) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mapGroup.add(mesh);
    colliders.push({
      minX: x - w / 2,
      maxX: x + w / 2,
      minY: y,
      maxY: y + h,
      minZ: z - d / 2,
      maxZ: z + d / 2,
    });
  };

  const addStairs = (
    x: number,
    y: number,
    z: number,
    w: number,
    totalH: number,
    totalD: number,
    steps: number,
    dir: 'z+' | 'z-' | 'x+' | 'x-'
  ) => {
    const stepH = totalH / steps;
    const stepD = totalD / steps;
    for (let i = 0; i < steps; i++) {
      const h = stepH * (i + 1);
      if (dir === 'z+') {
        addBox(x, y, z - totalD / 2 + stepD * (i + 0.5), w, h, stepD, accentMat);
      } else if (dir === 'z-') {
        addBox(x, y, z + totalD / 2 - stepD * (i + 0.5), w, h, stepD, accentMat);
      } else if (dir === 'x+') {
        addBox(x - totalD / 2 + stepD * (i + 0.5), y, z, stepD, h, w, accentMat);
      } else {
        addBox(x + totalD / 2 - stepD * (i + 0.5), y, z, stepD, h, w, accentMat);
      }
    }
  };

  // Perimeter arena bounds
  addBox(0, 0, -42, 84, 7, 2);
  addBox(0, 0, 42, 84, 7, 2);
  addBox(-42, 0, 0, 2, 7, 84);
  addBox(42, 0, 0, 2, 7, 84);

  if (mapId === 'desert') {
    // Central sandstone platform + tower
    addBox(0, 0, 0, 10, 3.2, 10, wallMat);
    addStairs(0, 0, 8, 4, 3.2, 6, 8, 'z-');
    addStairs(0, 0, -8, 4, 3.2, 6, 8, 'z+');
    // Cover pillars & crates
    addBox(-14, 0, -14, 4, 5, 4, accentMat);
    addBox(14, 0, -14, 4, 5, 4, accentMat);
    addBox(-14, 0, 14, 4, 5, 4, accentMat);
    addBox(14, 0, 14, 4, 5, 4, accentMat);
    addBox(-24, 0, 0, 3, 2.2, 8, wallMat);
    addBox(24, 0, 0, 3, 2.2, 8, wallMat);
    addBox(-8, 0, 22, 5, 2, 2.5, accentMat);
    addBox(8, 0, -22, 5, 2, 2.5, accentMat);
  } else if (mapId === 'warehouse') {
    // Shipping containers & catwalks
    addBox(-12, 0, -10, 5, 3.6, 12, accentMat);
    addBox(12, 0, 10, 5, 3.6, 12, accentMat);
    addBox(-12, 0, 14, 8, 3.6, 4.5, wallMat);
    addBox(12, 0, -14, 8, 3.6, 4.5, wallMat);
    // Elevated catwalk
    addBox(0, 3.2, 0, 18, 0.5, 4, wallMat);
    addStairs(-12, 0, 0, 3.5, 3.2, 6, 8, 'x+');
    addStairs(12, 0, 0, 3.5, 3.2, 6, 8, 'x-');
    // Crates
    addBox(0, 0, -18, 3, 2, 3, accentMat);
    addBox(0, 0, 18, 3, 2, 3, accentMat);
  } else if (mapId === 'city') {
    // City buildings & alleyways
    addBox(-16, 0, -16, 10, 9, 10, wallMat);
    addBox(16, 0, -16, 10, 11, 10, wallMat);
    addBox(-16, 0, 16, 10, 10, 10, wallMat);
    addBox(16, 0, 16, 10, 8, 10, wallMat);
    // Mid street barriers & bus
    addBox(0, 0, 0, 3.2, 2.6, 9, accentMat);
    addBox(-16, 0, 0, 4, 1.8, 3, accentMat);
    addBox(16, 0, 0, 4, 1.8, 3, accentMat);
    // Accessible rooftop platform
    addBox(0, 0, -24, 12, 3.5, 6, wallMat);
    addStairs(0, 0, -18, 4, 3.5, 6, 8, 'z-');
  } else {
    // Military Base: Bunkers, watchtowers, helipad
    addBox(0, 0, 0, 12, 0.4, 12, accentMat); // Helipad
    addBox(-18, 0, -18, 6, 4.5, 6, wallMat);
    addBox(18, 0, 18, 6, 4.5, 6, wallMat);
    addStairs(-18, 0, -12, 3.5, 4.5, 6, 9, 'z-');
    addStairs(18, 0, 12, 3.5, 4.5, 6, 9, 'z+');
    // Sandbag walls
    addBox(-10, 0, 8, 6, 1.6, 1.5, accentMat);
    addBox(10, 0, -8, 6, 1.6, 1.5, accentMat);
    addBox(0, 0, 22, 8, 2.5, 3, wallMat);
    addBox(0, 0, -22, 8, 2.5, 3, wallMat);
  }

  scene.add(mapGroup);

  return {
    id: mapId,
    name: MAP_META[mapId].name,
    description: MAP_META[mapId].description,
    skyColor: cfg.sky,
    fogColor: cfg.sky,
    groundColor: cfg.ground,
    wallColor: cfg.wall,
    accentColor: cfg.accent,
    colliders,
    spawnPoints: [
      { x: -30, y: 2, z: -30 },
      { x: 30, y: 2, z: 30 },
      { x: -30, y: 2, z: 30 },
      { x: 30, y: 2, z: -30 },
      { x: 0, y: 2, z: -32 },
      { x: 0, y: 2, z: 32 },
    ],
    redFlagPos: { x: -32, y: 0.5, z: -32 },
    blueFlagPos: { x: 32, y: 0.5, z: 32 },
  };
}
