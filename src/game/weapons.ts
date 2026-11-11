import * as THREE from 'three';
import { WeaponConfig, WeaponId } from './types';

export const WEAPONS: Record<WeaponId, WeaponConfig> = {
  assault: {
    id: 'assault',
    name: 'Assault Rifle',
    shortName: 'AK-47X',
    damage: 26,
    headshotMult: 2.0,
    fireRateMs: 110,
    magSize: 30,
    reserveAmmo: 120,
    reloadTimeMs: 1600,
    spread: 0.018,
    recoilKick: 0.035,
    pellets: 1,
    automatic: true,
    adsFov: 58,
    scopeType: 'red_dot',
    color: '#f59e0b',
    description: 'Balanced automatic rifle with Red Dot optic and high DPS.',
  },
  sniper: {
    id: 'sniper',
    name: 'Sniper Rifle',
    shortName: 'AWP-V',
    damage: 85,
    headshotMult: 2.5,
    fireRateMs: 1050,
    magSize: 5,
    reserveAmmo: 25,
    reloadTimeMs: 2200,
    spread: 0.002,
    recoilKick: 0.12,
    pellets: 1,
    automatic: false,
    adsFov: 26,
    scopeType: 'sniper',
    color: '#38bdf8',
    description: 'High-caliber bolt-action rifle with 3x Sniper Scope.',
  },
  shotgun: {
    id: 'shotgun',
    name: 'Shotgun',
    shortName: 'M870-B',
    damage: 18,
    headshotMult: 1.6,
    fireRateMs: 750,
    magSize: 8,
    reserveAmmo: 32,
    reloadTimeMs: 1900,
    spread: 0.075,
    recoilKick: 0.09,
    pellets: 7,
    automatic: false,
    adsFov: 68,
    scopeType: 'iron',
    color: '#ef4444',
    description: 'Devastating close-quarters 7-pellet spread.',
  },
  smg: {
    id: 'smg',
    name: 'Submachine Gun',
    shortName: 'MP5-K',
    damage: 18,
    headshotMult: 1.8,
    fireRateMs: 75,
    magSize: 35,
    reserveAmmo: 140,
    reloadTimeMs: 1350,
    spread: 0.032,
    recoilKick: 0.022,
    pellets: 1,
    automatic: true,
    adsFov: 62,
    scopeType: 'red_dot',
    color: '#22c55e',
    description: 'Ultra-fast fire rate with Red Dot sight for CQC.',
  },
  pistol: {
    id: 'pistol',
    name: 'Pistol',
    shortName: 'DE-50',
    damage: 34,
    headshotMult: 2.1,
    fireRateMs: 240,
    magSize: 12,
    reserveAmmo: 60,
    reloadTimeMs: 1100,
    spread: 0.012,
    recoilKick: 0.045,
    pellets: 1,
    automatic: false,
    adsFov: 66,
    scopeType: 'iron',
    color: '#a855f7',
    description: 'Crisp semi-automatic sidearm with high precision.',
  },
  rocket: {
    id: 'rocket',
    name: 'Rocket Launcher',
    shortName: 'RPG-7X',
    damage: 95,
    headshotMult: 1.2,
    fireRateMs: 1300,
    magSize: 2,
    reserveAmmo: 10,
    reloadTimeMs: 2400,
    spread: 0.005,
    recoilKick: 0.15,
    pellets: 1,
    automatic: false,
    adsFov: 54,
    scopeType: 'acog',
    projectileSpeed: 42,
    splashRadius: 5.5,
    color: '#f97316',
    description: 'Fires explosive rockets with area-of-effect splash damage.',
  },
  burst: {
    id: 'burst',
    name: 'Tactical Rifle',
    shortName: 'FAMAS-B',
    damage: 32,
    headshotMult: 2.1,
    fireRateMs: 165,
    magSize: 24,
    reserveAmmo: 120,
    reloadTimeMs: 1500,
    spread: 0.009,
    recoilKick: 0.028,
    pellets: 1,
    automatic: true,
    adsFov: 44,
    scopeType: 'acog',
    color: '#06b6d4',
    description: 'Precision bullpup rifle equipped with 2x ACOG scope.',
  },
  lmg: {
    id: 'lmg',
    name: 'Heavy LMG',
    shortName: 'M249-H',
    damage: 22,
    headshotMult: 1.75,
    fireRateMs: 95,
    magSize: 80,
    reserveAmmo: 240,
    reloadTimeMs: 2600,
    spread: 0.028,
    recoilKick: 0.032,
    pellets: 1,
    automatic: true,
    adsFov: 56,
    scopeType: 'red_dot',
    color: '#eab308',
    description: '80-round box-magazine machine gun for sustained fire.',
  },
  revolver: {
    id: 'revolver',
    name: 'Heavy Revolver',
    shortName: '.357-M',
    damage: 58,
    headshotMult: 2.4,
    fireRateMs: 420,
    magSize: 6,
    reserveAmmo: 36,
    reloadTimeMs: 1650,
    spread: 0.006,
    recoilKick: 0.095,
    pellets: 1,
    automatic: false,
    adsFov: 60,
    scopeType: 'iron',
    color: '#ec4899',
    description: 'High-caliber 6-shooter with lethal headshot power.',
  },
  crossbow: {
    id: 'crossbow',
    name: 'Tactical Crossbow',
    shortName: 'X-BOW',
    damage: 90,
    headshotMult: 2.2,
    fireRateMs: 900,
    magSize: 1,
    reserveAmmo: 20,
    reloadTimeMs: 1250,
    spread: 0.001,
    recoilKick: 0.04,
    pellets: 1,
    automatic: false,
    adsFov: 36,
    scopeType: 'acog',
    color: '#10b981',
    description: 'Silent precision bolt launcher with ACOG optic.',
  },
  heavy_sniper: {
    id: 'heavy_sniper',
    name: 'Heavy .50 Sniper',
    shortName: 'M82-Z',
    damage: 135,
    headshotMult: 2.5,
    fireRateMs: 1350,
    magSize: 4,
    reserveAmmo: 20,
    reloadTimeMs: 2500,
    spread: 0.001,
    recoilKick: 0.16,
    pellets: 1,
    automatic: false,
    adsFov: 20,
    scopeType: 'sniper',
    color: '#6366f1',
    description: 'Anti-materiel .50 cal sniper with 4x long-range scope.',
  },
};

export const WEAPON_LIST: WeaponConfig[] = Object.values(WEAPONS);

export function buildWeaponViewModel(weaponId: WeaponId): THREE.Group {
  const group = new THREE.Group();

  const darkMetal = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.35,
    metalness: 0.8,
  });
  const gunMetal = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.4,
    metalness: 0.7,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x78350f,
    roughness: 0.8,
    metalness: 0.05,
  });
  const accentColor = new THREE.Color(WEAPONS[weaponId].color);
  const accentMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    roughness: 0.3,
    metalness: 0.5,
    emissive: accentColor,
    emissiveIntensity: 0.2,
  });

  if (weaponId === 'assault') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.45), darkMetal);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.35, 8), gunMetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, -0.35);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 0.09), gunMetal);
    mag.position.set(0, -0.11, -0.05);
    mag.rotation.x = 0.25;
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.22), woodMat);
    stock.position.set(0, -0.02, 0.28);
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.08), accentMat);
    sight.position.set(0, 0.068, 0.05);
    group.add(body, barrel, mag, stock, sight);
  } else if (weaponId === 'sniper') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.09, 0.52), gunMetal);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.55, 8), darkMetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, -0.5);
    const scopeTube = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.26, 10), darkMetal);
    scopeTube.rotation.x = Math.PI / 2;
    scopeTube.position.set(0, 0.08, -0.05);
    const scopeLens = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.02, 10), accentMat);
    scopeLens.rotation.x = Math.PI / 2;
    scopeLens.position.set(0, 0.08, -0.18);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.1, 0.08), darkMetal);
    mag.position.set(0, -0.08, -0.02);
    group.add(body, barrel, scopeTube, scopeLens, mag);
  } else if (weaponId === 'shotgun') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.1, 0.4), darkMetal);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.42, 8), gunMetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.025, -0.35);
    const pump = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.065, 0.18), woodMat);
    pump.position.set(0, -0.025, -0.28);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.22), woodMat);
    stock.position.set(0, -0.03, 0.25);
    const bead = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.015, 0.015), accentMat);
    bead.position.set(0, 0.055, -0.54);
    group.add(body, barrel, pump, stock, bead);
  } else if (weaponId === 'smg') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.095, 0.3), darkMetal);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.18, 8), gunMetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.015, -0.22);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.055), gunMetal);
    mag.position.set(0, -0.13, -0.06);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.1, 0.055), darkMetal);
    grip.position.set(0, -0.08, 0.08);
    grip.rotation.x = -0.2;
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.02, 0.14), accentMat);
    rail.position.set(0, 0.058, 0);
    group.add(body, barrel, mag, grip, rail);
  } else if (weaponId === 'pistol') {
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.065, 0.24), gunMetal);
    slide.position.set(0, 0.02, -0.04);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.2), darkMetal);
    frame.position.set(0, -0.025, -0.02);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.12, 0.065), darkMetal);
    grip.position.set(0, -0.08, 0.05);
    grip.rotation.x = -0.22;
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.015, 0.02), accentMat);
    sight.position.set(0, 0.06, -0.14);
    group.add(slide, frame, grip, sight);
  } else if (weaponId === 'burst') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.11, 0.42), darkMetal);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 8), gunMetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, -0.32);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.045, 0.26), gunMetal);
    handle.position.set(0, 0.075, -0.02);
    const acog = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.12, 8), accentMat);
    acog.rotation.x = Math.PI / 2;
    acog.position.set(0, 0.11, -0.02);
    group.add(body, barrel, handle, acog);
  } else if (weaponId === 'lmg') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.12, 0.48), gunMetal);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.42, 8), darkMetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, -0.4);
    const boxMag = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), accentMat);
    boxMag.position.set(-0.04, -0.1, -0.04);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.22), darkMetal);
    stock.position.set(0, -0.01, 0.3);
    group.add(body, barrel, boxMag, stock);
  } else if (weaponId === 'revolver') {
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.055, 0.26), gunMetal);
    barrel.position.set(0, 0.03, -0.08);
    const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.09, 8), darkMetal);
    cylinder.rotation.x = Math.PI / 2;
    cylinder.position.set(0, 0.02, 0.02);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.12, 0.06), woodMat);
    grip.position.set(0, -0.07, 0.08);
    grip.rotation.x = -0.3;
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.015, 0.02), accentMat);
    sight.position.set(0, 0.065, -0.19);
    group.add(barrel, cylinder, grip, sight);
  } else if (weaponId === 'crossbow') {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.48), darkMetal);
    const limbL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.03, 0.04), gunMetal);
    limbL.position.set(-0.14, 0.01, -0.22);
    limbL.rotation.y = 0.25;
    const limbR = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.03, 0.04), gunMetal);
    limbR.position.set(0.14, 0.01, -0.22);
    limbR.rotation.y = -0.25;
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.45, 6), accentMat);
    bolt.rotation.x = Math.PI / 2;
    bolt.position.set(0, 0.04, -0.12);
    group.add(rail, limbL, limbR, bolt);
  } else if (weaponId === 'heavy_sniper') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 0.56), darkMetal);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.65, 8), gunMetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, -0.58);
    const muzzleBrake = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.09), darkMetal);
    muzzleBrake.position.set(0, 0.02, -0.92);
    const scopeTube = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.32, 10), darkMetal);
    scopeTube.rotation.x = Math.PI / 2;
    scopeTube.position.set(0, 0.09, -0.06);
    const scopeLens = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.02, 10), accentMat);
    scopeLens.rotation.x = Math.PI / 2;
    scopeLens.position.set(0, 0.09, -0.22);
    group.add(body, barrel, muzzleBrake, scopeTube, scopeLens);
  } else {
    // Rocket Launcher
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.85, 10), gunMetal);
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, 0.03, -0.15);
    const warhead = new THREE.Mesh(new THREE.ConeGeometry(0.058, 0.18, 8), accentMat);
    warhead.rotation.x = -Math.PI / 2;
    warhead.position.set(0, 0.03, -0.64);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.06), darkMetal);
    grip.position.set(0, -0.08, -0.05);
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.08), darkMetal);
    sight.position.set(-0.06, 0.07, -0.1);
    group.add(tube, warhead, grip, sight);
  }

  return group;
}
