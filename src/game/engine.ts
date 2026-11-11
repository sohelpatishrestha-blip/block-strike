import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  GameMode,
  GameSettings,
  HudState,
  KillFeedItem,
  MapId,
  ScoreboardEntry,
  WeaponId,
} from './types';
import { WEAPONS, WEAPON_LIST, buildWeaponViewModel } from './weapons';
import { AABB, MapDefinition, buildMapScene } from './maps';
import { soundEngine } from './audio';

const _vec3 = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();

interface RemotePlayer {
  id: string;
  name: string;
  team: 'red' | 'blue' | 'ffa';
  group: THREE.Group;
  headMesh: THREE.Mesh;
  targetPos: THREE.Vector3;
  targetYaw: number;
  kills: number;
  deaths: number;
  score: number;
  alive: boolean;
}

interface BotEntity {
  id: string;
  name: string;
  team: 'red' | 'blue' | 'ffa';
  group: THREE.Group;
  headMesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  yaw: number;
  hp: number;
  alive: boolean;
  respawnTimer: number;
  shootCooldown: number;
  strafeDir: number;
  strafeTimer: number;
  kills: number;
  deaths: number;
  score: number;
}

interface RocketProjectile {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  ownerId: string;
}

interface Particle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
}

function buildBlockCharacter(colorHex: number): { group: THREE.Group; headMesh: THREE.Mesh } {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.55,
    metalness: 0.15,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.7,
    metalness: 0.2,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xf1c27d,
    roughness: 0.75,
    metalness: 0.05,
  });
  const visorMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    roughness: 0.2,
    metalness: 0.8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.4,
  });

  // Legs
  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.75, 0.28), darkMat);
  leftLeg.position.set(-0.16, 0.375, 0);
  leftLeg.castShadow = true;
  const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.75, 0.28), darkMat);
  rightLeg.position.set(0.16, 0.375, 0);
  rightLeg.castShadow = true;

  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.75, 0.35), bodyMat);
  torso.position.set(0, 1.125, 0);
  torso.castShadow = true;

  // Arms
  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.65, 0.22), bodyMat);
  leftArm.position.set(-0.46, 1.125, 0);
  const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.65, 0.22), bodyMat);
  rightArm.position.set(0.46, 1.125, 0);

  // Head + Visor
  const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.46), skinMat);
  headMesh.position.set(0, 1.73, 0);
  headMesh.castShadow = true;
  headMesh.userData.isHead = true;

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.06), visorMat);
  visor.position.set(0, 1.75, -0.23);

  group.add(leftLeg, rightLeg, torso, leftArm, rightArm, headMesh, visor);
  return { group, headMesh };
}

export class BlockStrikeEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private frameId = 0;
  private lastTime = performance.now();
  private disposed = false;

  private mapDef!: MapDefinition;
  private settings: GameSettings;
  private onHudUpdate: (hud: HudState) => void;
  private onPauseRequest: () => void;

  // Game mode & state
  private isPlaying = false;
  private mode: GameMode = 'practice';
  private localPlayerName = 'Striker';
  private localTeam: 'red' | 'blue' | 'ffa' = 'ffa';
  private localId = 'local';

  // Player physics
  private pos = new THREE.Vector3(0, 2, 0);
  private vel = new THREE.Vector3(0, 0, 0);
  private yaw = 0;
  private pitch = 0;
  private grounded = false;
  private coyoteTimer = 0;
  private jumpBuffer = 0;
  private crouching = false;
  private currentEyeHeight = 1.65;
  private footstepTimer = 0;

  // Combat & Weapons
  private weaponId: WeaponId = 'assault';
  private weaponGroup: THREE.Group | null = null;
  private ammo = 30;
  private reserve = 120;
  private reloading = false;
  private reloadEndTime = 0;
  private lastShotTime = 0;
  private recoilOffset = 0;
  private weaponBobTime = 0;
  private cameraShake = 0;
  private hp = 200;
  private alive = true;
  private respawnTimer = 0;
  private kills = 0;
  private deaths = 0;
  private score = 0;
  private redScore = 0;
  private blueScore = 0;
  private matchTime = 300;
  private hitMarker: 'none' | 'body' | 'head' = 'none';
  private hitMarkerTimer = 0;
  private damageFlash = 0;

  // Input
  private keys = new Set<string>();
  private mouseDown = false;
  private rightMouseDown = false;
  private justPressedFire = false;

  // Entities
  private bots: BotEntity[] = [];
  private remotePlayers = new Map<string, RemotePlayer>();
  private rockets: RocketProjectile[] = [];
  private particles: Particle[] = [];
  private killFeed: KillFeedItem[] = [];

  // Multiplayer
  private ws: WebSocket | null = null;
  private lastNetSync = 0;

  // FPS counter
  private fpsFrames = 0;
  private fpsLastTime = performance.now();
  private currentFps = 60;
  private hudSyncTimer = 0;
  private menuOrbitAngle = 0;

  constructor(
    container: HTMLElement,
    settings: GameSettings,
    onHudUpdate: (hud: HudState) => void,
    onPauseRequest: () => void
  ) {
    this.container = container;
    this.settings = { ...settings };
    this.onHudUpdate = onHudUpdate;
    this.onPauseRequest = onPauseRequest;

    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl && settings.graphics !== 'low',
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.applyGraphicsSettings();

    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      settings.fov,
      container.clientWidth / container.clientHeight,
      0.1,
      180
    );
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.setupLights();
    this.loadMap('desert');
    this.bindEvents();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.loop();
  }

  private setupLights() {
    const hemi = new THREE.HemisphereLight(0xdbeafe, 0x334155, 0.75);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfffbeb, 1.35);
    sun.position.set(28, 45, 22);
    sun.castShadow = !this.isSoftwareGl;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -45;
    sun.shadow.camera.right = 45;
    sun.shadow.camera.top = 45;
    sun.shadow.camera.bottom = -45;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun);
  }

  public applySettings(newSettings: GameSettings) {
    this.settings = { ...newSettings };
    this.camera.fov = newSettings.fov;
    this.camera.updateProjectionMatrix();
    this.applyGraphicsSettings();
    soundEngine.setVolume(newSettings.volume);
    soundEngine.setMuted(newSettings.muted);
  }

  private applyGraphicsSettings() {
    if (this.isSoftwareGl) {
      this.renderer.setPixelRatio(1);
      this.renderer.shadowMap.enabled = false;
      return;
    }
    const pr =
      this.settings.graphics === 'high'
        ? Math.min(window.devicePixelRatio, 2)
        : this.settings.graphics === 'medium'
          ? Math.min(window.devicePixelRatio, 1.25)
          : 0.85;
    this.renderer.setPixelRatio(pr);
    this.renderer.shadowMap.enabled = this.settings.graphics !== 'low';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  public loadMap(mapId: MapId) {
    const oldMap = this.scene.getObjectByName('MapGeometry');
    if (oldMap) this.scene.remove(oldMap);
    this.mapDef = buildMapScene(
      mapId,
      this.scene,
      this.renderer.capabilities.getMaxAnisotropy()
    );
  }

  public startMatch(
    mode: GameMode,
    mapId: MapId,
    weaponId: WeaponId,
    playerName: string,
    ws?: WebSocket | null,
    localId?: string,
    localTeam?: 'red' | 'blue' | 'ffa'
  ) {
    this.clearEntities();
    this.loadMap(mapId);
    this.mode = mode;
    this.localPlayerName = playerName || 'Striker';
    this.localId = localId || 'local';
    this.localTeam = localTeam || 'ffa';
    this.ws = ws || null;

    this.kills = 0;
    this.deaths = 0;
    this.score = 0;
    this.redScore = 0;
    this.blueScore = 0;
    this.matchTime = 300;
    this.killFeed = [];

    this.equipWeapon(weaponId);
    this.respawnLocalPlayer();

    if (mode === 'practice') {
      this.spawnBots(5);
    } else if (mode === '1v1' && !ws) {
      this.spawnBots(1);
    }

    this.isPlaying = true;
    this.requestPointerLock();
  }

  public stopMatch() {
    this.isPlaying = false;
    this.clearEntities();
    if (this.weaponGroup) {
      this.camera.remove(this.weaponGroup);
      this.weaponGroup = null;
    }
    if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock();
    }
    this.ws = null;
  }

  public requestPointerLock() {
    if (this.isPlaying && document.pointerLockElement !== this.renderer.domElement) {
      this.renderer.domElement.requestPointerLock?.();
    }
  }

  public equipWeapon(weaponId: WeaponId) {
    this.weaponId = weaponId;
    const cfg = WEAPONS[weaponId];
    this.ammo = cfg.magSize;
    this.reserve = cfg.reserveAmmo;
    this.reloading = false;

    if (this.weaponGroup) {
      this.camera.remove(this.weaponGroup);
    }
    this.weaponGroup = buildWeaponViewModel(weaponId);
    this.weaponGroup.position.set(0.24, -0.22, -0.42);
    this.camera.add(this.weaponGroup);
  }

  private clearEntities() {
    for (const b of this.bots) this.scene.remove(b.group);
    this.bots = [];
    for (const r of this.remotePlayers.values()) this.scene.remove(r.group);
    this.remotePlayers.clear();
    for (const rk of this.rockets) this.scene.remove(rk.mesh);
    this.rockets = [];
    for (const p of this.particles) this.scene.remove(p.mesh);
    this.particles = [];
  }

  private spawnBots(count: number) {
    const botNames = ['AlphaBot', 'ViperAI', 'Kobra_X', 'NovaUnit', 'TitanBot', 'Ghost_AI'];
    for (let i = 0; i < count; i++) {
      const sp = this.mapDef.spawnPoints[i % this.mapDef.spawnPoints.length];
      const { group, headMesh } = buildBlockCharacter(0xef4444);
      group.position.set(sp.x, 0, sp.z);
      this.scene.add(group);
      this.bots.push({
        id: 'bot-' + i,
        name: botNames[i % botNames.length],
        team: 'red',
        group,
        headMesh,
        pos: new THREE.Vector3(sp.x, 0, sp.z),
        vel: new THREE.Vector3(),
        yaw: Math.random() * Math.PI * 2,
        hp: 200,
        alive: true,
        respawnTimer: 0,
        shootCooldown: 1 + Math.random(),
        strafeDir: Math.random() > 0.5 ? 1 : -1,
        strafeTimer: 1.5,
        kills: 0,
        deaths: 0,
        score: 0,
      });
    }
  }

  public handleNetworkMessage(msg: Record<string, unknown>) {
    if (msg.type === 'playerJoined') {
      const p = msg.player as {
        id: string;
        name: string;
        team: 'red' | 'blue' | 'ffa';
        x: number;
        y: number;
        z: number;
      };
      if (p.id === this.localId || this.remotePlayers.has(p.id)) return;
      const color = p.team === 'red' ? 0xef4444 : p.team === 'blue' ? 0x3b82f6 : 0xf59e0b;
      const { group, headMesh } = buildBlockCharacter(color);
      group.position.set(p.x, p.y, p.z);
      group.userData.remoteId = p.id;
      this.scene.add(group);
      this.remotePlayers.set(p.id, {
        id: p.id,
        name: p.name,
        team: p.team,
        group,
        headMesh,
        targetPos: new THREE.Vector3(p.x, p.y, p.z),
        targetYaw: 0,
        kills: 0,
        deaths: 0,
        score: 0,
        alive: true,
      });
    } else if (msg.type === 'playerMoved') {
      const rp = this.remotePlayers.get(msg.id as string);
      if (rp) {
        rp.targetPos.set(Number(msg.x), Number(msg.y), Number(msg.z));
        rp.targetYaw = Number(msg.yaw);
      }
    } else if (msg.type === 'playerLeft') {
      const rp = this.remotePlayers.get(msg.id as string);
      if (rp) {
        this.scene.remove(rp.group);
        this.remotePlayers.delete(msg.id as string);
      }
    } else if (msg.type === 'damaged') {
      this.hp = Math.max(0, Number(msg.hp));
      this.damageFlash = 0.6;
      this.cameraShake = 0.08;
    } else if (msg.type === 'playerKilled') {
      const killerId = msg.killerId as string;
      const victimId = msg.victimId as string;
      if (killerId === this.localId) {
        this.kills += 1;
        this.score += msg.headshot ? 150 : 100;
      }
      if (victimId === this.localId) {
        this.alive = false;
        this.hp = 0;
        this.deaths += 1;
        this.respawnTimer = 3.0;
      }
      const rp = this.remotePlayers.get(victimId);
      if (rp) {
        rp.alive = false;
        rp.group.visible = false;
        rp.deaths += 1;
      }
      const rk = this.remotePlayers.get(killerId);
      if (rk) {
        rk.kills += 1;
        rk.score += msg.headshot ? 150 : 100;
      }
      this.redScore = Number(msg.redScore) || this.redScore;
      this.blueScore = Number(msg.blueScore) || this.blueScore;
      this.addKillFeed(
        String(msg.killerName),
        String(msg.victimName),
        String(msg.weapon),
        Boolean(msg.headshot)
      );
    } else if (msg.type === 'playerRespawned') {
      const id = msg.id as string;
      if (id === this.localId) {
        this.respawnLocalPlayer();
      } else {
        const rp = this.remotePlayers.get(id);
        if (rp) {
          rp.alive = true;
          rp.group.visible = true;
        }
      }
    }
  }

  private respawnLocalPlayer() {
    const sp =
      this.mapDef.spawnPoints[Math.floor(Math.random() * this.mapDef.spawnPoints.length)];
    this.pos.set(sp.x, sp.y, sp.z);
    this.vel.set(0, 0, 0);
    this.hp = 200;
    this.alive = true;
    const cfg = WEAPONS[this.weaponId];
    this.ammo = cfg.magSize;
    this.reserve = cfg.reserveAmmo;
    this.reloading = false;
  }

  private addKillFeed(killer: string, victim: string, weapon: string, headshot: boolean) {
    this.killFeed.unshift({
      id: Math.random().toString(36).slice(2),
      killer,
      victim,
      weapon,
      headshot,
      timestamp: Date.now(),
    });
    if (this.killFeed.length > 5) this.killFeed.length = 5;
  }

  private bindEvents() {
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('wheel', this.onWheel);
    this.renderer.domElement.addEventListener('contextmenu', this.onContextMenu);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
  }

  private onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };

  private onResize = () => {
    if (!this.container) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private onKeyDown = (e: KeyboardEvent) => {
    this.keys.add(e.code);
    if (e.code === 'Space') this.jumpBuffer = 0.12;
    if (e.code === 'KeyR' && this.isPlaying && this.alive) this.startReload();
    if (e.code === 'Escape' && this.isPlaying) {
      this.onPauseRequest();
    }
    if (this.isPlaying && this.alive) {
      if (e.code === 'KeyQ') {
        this.cycleWeapon(1);
      } else if (e.code.startsWith('Digit')) {
        const num = parseInt(e.code.replace('Digit', ''), 10);
        const idx = num === 0 ? 9 : num - 1;
        if (idx >= 0 && idx < WEAPON_LIST.length) {
          this.equipWeapon(WEAPON_LIST[idx].id);
        }
      }
    }
  };

  private onWheel = (e: WheelEvent) => {
    if (!this.isPlaying || !this.alive) return;
    if (document.pointerLockElement !== this.renderer.domElement) return;
    this.cycleWeapon(e.deltaY > 0 ? 1 : -1);
  };

  private cycleWeapon(dir: number) {
    const idx = WEAPON_LIST.findIndex((w) => w.id === this.weaponId);
    const nextIdx = (idx + dir + WEAPON_LIST.length) % WEAPON_LIST.length;
    this.equipWeapon(WEAPON_LIST[nextIdx].id);
  }

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onBlur = () => {
    this.keys.clear();
    this.mouseDown = false;
    this.rightMouseDown = false;
  };

  private onPointerLockChange = () => {
    if (
      this.isPlaying &&
      document.pointerLockElement !== this.renderer.domElement
    ) {
      this.keys.clear();
      this.mouseDown = false;
      this.rightMouseDown = false;
    }
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.isPlaying || !this.alive) return;
    if (document.pointerLockElement !== this.renderer.domElement) return;
    const zoomScale = this.rightMouseDown ? 0.55 : 1.0;
    const sens = 0.0022 * this.settings.sensitivity * zoomScale;
    this.yaw -= e.movementX * sens;
    this.pitch -= e.movementY * sens;
    this.pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, this.pitch));
  };

  private onMouseDown = (e: MouseEvent) => {
    if (!this.isPlaying) return;
    if (document.pointerLockElement !== this.renderer.domElement) {
      this.requestPointerLock();
      return;
    }
    if (e.button === 0) {
      this.mouseDown = true;
      this.justPressedFire = true;
    } else if (e.button === 2) {
      this.rightMouseDown = true;
    }
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.mouseDown = false;
    if (e.button === 2) this.rightMouseDown = false;
  };

  private startReload() {
    const cfg = WEAPONS[this.weaponId];
    if (this.reloading || this.ammo >= cfg.magSize || this.reserve <= 0) return;
    this.reloading = true;
    this.reloadEndTime = performance.now() + cfg.reloadTimeMs;
    soundEngine.playReload();
  }

  private tryShoot() {
    if (!this.alive || this.reloading) return;
    const cfg = WEAPONS[this.weaponId];
    const now = performance.now();
    if (now - this.lastShotTime < cfg.fireRateMs) return;

    if (this.ammo <= 0) {
      this.startReload();
      return;
    }

    this.lastShotTime = now;
    this.ammo -= 1;
    this.recoilOffset = Math.min(0.18, this.recoilOffset + cfg.recoilKick);
    this.cameraShake = Math.min(0.06, this.cameraShake + cfg.recoilKick * 0.4);
    this.pitch = Math.min(Math.PI / 2 - 0.05, this.pitch + cfg.recoilKick * 0.35);

    soundEngine.playShoot(this.weaponId);

    if (this.weaponId === 'rocket') {
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 0.4, 8),
        new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xea580c })
      );
      mesh.position.copy(this.camera.position).addScaledVector(dir, 0.8);
      mesh.quaternion.copy(this.camera.quaternion);
      mesh.rotateX(Math.PI / 2);
      this.scene.add(mesh);
      this.rockets.push({
        mesh,
        pos: mesh.position.clone(),
        vel: dir.multiplyScalar(cfg.projectileSpeed || 42),
        life: 3.5,
        ownerId: this.localId,
      });
      return;
    }

    // Hitscan pellets
    const spreadMult = this.rightMouseDown ? 0.35 : 1.0;
    for (let p = 0; p < cfg.pellets; p++) {
      _dir.set(
        (Math.random() - 0.5) * cfg.spread * spreadMult,
        (Math.random() - 0.5) * cfg.spread * spreadMult,
        -1
      );
      _dir.applyQuaternion(this.camera.quaternion).normalize();
      _raycaster.set(this.camera.position, _dir);

      const targets: THREE.Object3D[] = [];
      for (const b of this.bots) {
        if (b.alive) targets.push(b.group);
      }
      for (const r of this.remotePlayers.values()) {
        if (r.alive && (this.localTeam === 'ffa' || r.team !== this.localTeam)) {
          targets.push(r.group);
        }
      }

      const hits = _raycaster.intersectObjects(targets, true);
      if (hits.length > 0) {
        const hit = hits[0];
        const isHead = Boolean(hit.object.userData.isHead);
        const dmg = Math.round(cfg.damage * (isHead ? cfg.headshotMult : 1));
        this.spawnSpark(hit.point, isHead ? 0xfacc15 : 0xef4444);
        this.hitMarker = isHead ? 'head' : 'body';
        this.hitMarkerTimer = 0.16;
        soundEngine.playHitMarker(isHead);

        // Check if bot
        const bot = this.bots.find((b) => hit.object === b.group || b.group.children.includes(hit.object));
        if (bot) {
          bot.hp -= dmg;
          if (bot.hp <= 0) {
            bot.hp = 0;
            bot.alive = false;
            bot.group.visible = false;
            bot.respawnTimer = 3.0;
            bot.deaths += 1;
            this.kills += 1;
            this.score += isHead ? 150 : 100;
            this.addKillFeed(this.localPlayerName, bot.name, cfg.shortName, isHead);
          }
        } else {
          // Remote player
          let obj: THREE.Object3D | null = hit.object;
          while (obj && !obj.userData.remoteId) obj = obj.parent;
          if (obj && obj.userData.remoteId && this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(
              JSON.stringify({
                type: 'hit',
                targetId: obj.userData.remoteId,
                damage: dmg,
                headshot: isHead,
              })
            );
          }
        }
      }
    }
  }

  private spawnSpark(pos: THREE.Vector3, colorHex: number) {
    const count = this.settings.graphics === 'low' ? 3 : 6;
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.08, 0.08),
        new THREE.MeshBasicMaterial({ color: colorHex })
      );
      mesh.position.copy(pos);
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 6,
          Math.random() * 5,
          (Math.random() - 0.5) * 6
        ),
        life: 0.35,
        maxLife: 0.35,
      });
    }
  }

  private resolveCollisions(pos: THREE.Vector3, vel: THREE.Vector3, radius: number, height: number) {
    const colliders: AABB[] = this.mapDef.colliders;
    for (const box of colliders) {
      if (
        pos.x + radius > box.minX &&
        pos.x - radius < box.maxX &&
        pos.z + radius > box.minZ &&
        pos.z - radius < box.maxZ
      ) {
        // Check vertical overlap
        if (pos.y < box.maxY && pos.y + height > box.minY) {
          const overlapTop = box.maxY - pos.y;
          if (overlapTop > 0 && overlapTop <= 0.65 && vel.y <= 0) {
            // Step up onto stairs/platform
            pos.y = box.maxY;
            vel.y = 0;
            this.grounded = true;
            continue;
          }
          // Push out horizontally
          const dx1 = box.maxX - (pos.x - radius);
          const dx2 = pos.x + radius - box.minX;
          const dz1 = box.maxZ - (pos.z - radius);
          const dz2 = pos.z + radius - box.minZ;
          const minOverlap = Math.min(dx1, dx2, dz1, dz2);
          if (minOverlap === dx1) pos.x = box.maxX + radius;
          else if (minOverlap === dx2) pos.x = box.minX - radius;
          else if (minOverlap === dz1) pos.z = box.maxZ + radius;
          else pos.z = box.minZ - radius;
        }
      }
    }
  }

  private updatePlayer(dt: number) {
    if (!this.alive) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0 && this.mode === 'practice') {
        this.respawnLocalPlayer();
      }
      return;
    }

    this.crouching = this.keys.has('ControlLeft') || this.keys.has('ControlRight');
    const sprinting = (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) && !this.crouching;
    const targetEye = this.crouching ? 1.05 : 1.65;
    this.currentEyeHeight = THREE.MathUtils.damp(this.currentEyeHeight, targetEye, 14, dt);

    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const wishDir = new THREE.Vector3();

    if (this.keys.has('KeyW')) wishDir.add(forward);
    if (this.keys.has('KeyS')) wishDir.sub(forward);
    if (this.keys.has('KeyD')) wishDir.add(right);
    if (this.keys.has('KeyA')) wishDir.sub(right);
    if (wishDir.lengthSq() > 0) wishDir.normalize();

    const maxSpeed = this.crouching ? 5.5 : sprinting ? 13.5 : 9.5;
    const accel = this.grounded ? 14 : 4.5; // Bunny-hop air control

    this.vel.x = THREE.MathUtils.lerp(this.vel.x, wishDir.x * maxSpeed, Math.min(1, accel * dt));
    this.vel.z = THREE.MathUtils.lerp(this.vel.z, wishDir.z * maxSpeed, Math.min(1, accel * dt));

    if (this.grounded) {
      this.coyoteTimer = 0.12;
    } else {
      this.coyoteTimer -= dt;
    }

    if (this.jumpBuffer > 0) {
      this.jumpBuffer -= dt;
      if (this.coyoteTimer > 0) {
        this.vel.y = 8.8;
        this.grounded = false;
        this.coyoteTimer = 0;
        this.jumpBuffer = 0;
        soundEngine.playJump();
      }
    }

    this.vel.y -= 22 * dt; // Gravity
    this.pos.addScaledVector(this.vel, dt);

    this.grounded = false;
    if (this.pos.y <= 0) {
      this.pos.y = 0;
      this.vel.y = 0;
      this.grounded = true;
    }

    this.resolveCollisions(this.pos, this.vel, 0.45, this.crouching ? 1.2 : 1.85);

    // Footsteps
    const horizSpeed = Math.hypot(this.vel.x, this.vel.z);
    if (this.grounded && horizSpeed > 2.5) {
      this.footstepTimer -= dt * (sprinting ? 1.35 : 1);
      if (this.footstepTimer <= 0) {
        soundEngine.playFootstep();
        this.footstepTimer = 0.36;
      }
    }

    // Camera transform
    const shakeX = (Math.random() - 0.5) * this.cameraShake;
    const shakeY = (Math.random() - 0.5) * this.cameraShake;
    this.cameraShake = THREE.MathUtils.damp(this.cameraShake, 0, 12, dt);

    this.camera.position.set(
      this.pos.x + shakeX,
      this.pos.y + this.currentEyeHeight + shakeY,
      this.pos.z
    );
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');

    // Weapon firing & reload
    const cfg = WEAPONS[this.weaponId];
    if (this.reloading && performance.now() >= this.reloadEndTime) {
      const needed = cfg.magSize - this.ammo;
      const take = Math.min(needed, this.reserve);
      this.ammo += take;
      this.reserve -= take;
      this.reloading = false;
    }

    if (this.justPressedFire || (this.mouseDown && cfg.automatic)) {
      this.tryShoot();
    }
    this.justPressedFire = false;

    // Smooth ADS FOV zoom
    const targetFov = this.rightMouseDown && !this.reloading ? cfg.adsFov : this.settings.fov;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 14, dt);
      this.camera.updateProjectionMatrix();
    }

    // Weapon viewmodel animation
    if (this.weaponGroup) {
      const isSniperScoped = this.rightMouseDown && !this.reloading && cfg.scopeType === 'sniper';
      this.weaponGroup.visible = !isSniperScoped;
      this.recoilOffset = THREE.MathUtils.damp(this.recoilOffset, 0, 14, dt);
      if (this.grounded && horizSpeed > 1) {
        this.weaponBobTime += dt * (sprinting ? 12 : 8);
      }
      const bobScale = this.rightMouseDown ? 0.25 : 1.0;
      const bobX = Math.cos(this.weaponBobTime) * 0.012 * bobScale;
      const bobY = Math.abs(Math.sin(this.weaponBobTime)) * 0.012 * bobScale;
      const reloadTilt = this.reloading ? -0.55 : 0;
      const targetX = this.rightMouseDown && !this.reloading ? 0.0 : 0.24;
      const targetY = this.rightMouseDown && !this.reloading ? -0.15 : -0.22;
      this.weaponGroup.position.x = THREE.MathUtils.damp(this.weaponGroup.position.x, targetX + bobX, 16, dt);
      this.weaponGroup.position.y = THREE.MathUtils.damp(
        this.weaponGroup.position.y,
        targetY - bobY - (this.reloading ? 0.08 : 0),
        16,
        dt
      );
      this.weaponGroup.position.z = -0.42 + this.recoilOffset;
      this.weaponGroup.rotation.x = THREE.MathUtils.damp(
        this.weaponGroup.rotation.x,
        reloadTilt + this.recoilOffset * 1.5,
        14,
        dt
      );
    }

    // Network position sync
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.lastNetSync += dt;
      if (this.lastNetSync >= 0.05) {
        this.lastNetSync = 0;
        this.ws.send(
          JSON.stringify({
            type: 'move',
            x: this.pos.x,
            y: this.pos.y,
            z: this.pos.z,
            yaw: this.yaw,
            pitch: this.pitch,
            weapon: this.weaponId,
            crouching: this.crouching,
          })
        );
      }
    }
  }

  private updateBots(dt: number) {
    for (const bot of this.bots) {
      if (!bot.alive) {
        bot.respawnTimer -= dt;
        if (bot.respawnTimer <= 0) {
          const sp =
            this.mapDef.spawnPoints[Math.floor(Math.random() * this.mapDef.spawnPoints.length)];
          bot.pos.set(sp.x, 0, sp.z);
          bot.hp = 200;
          bot.alive = true;
          bot.group.visible = true;
        }
        continue;
      }

      const toPlayer = _vec3.subVectors(this.pos, bot.pos);
      toPlayer.y = 0;
      const dist = toPlayer.length();
      if (dist > 0.1) toPlayer.divideScalar(dist);

      bot.yaw = Math.atan2(-toPlayer.x, -toPlayer.z);
      bot.group.rotation.y = bot.yaw;

      bot.strafeTimer -= dt;
      if (bot.strafeTimer <= 0) {
        bot.strafeDir *= -1;
        bot.strafeTimer = 1.2 + Math.random() * 1.5;
      }

      const moveSpeed = 4.2;
      if (dist > 10) {
        bot.pos.addScaledVector(toPlayer, moveSpeed * dt);
      } else {
        // Strafe
        bot.pos.x += -toPlayer.z * bot.strafeDir * moveSpeed * 0.7 * dt;
        bot.pos.z += toPlayer.x * bot.strafeDir * moveSpeed * 0.7 * dt;
      }

      // Keep inside arena
      bot.pos.x = Math.max(-38, Math.min(38, bot.pos.x));
      bot.pos.z = Math.max(-38, Math.min(38, bot.pos.z));
      bot.group.position.copy(bot.pos);

      // Shoot at player if in range
      if (this.alive && dist < 28) {
        bot.shootCooldown -= dt;
        if (bot.shootCooldown <= 0) {
          bot.shootCooldown = 0.85 + Math.random() * 0.9;
          if (Math.random() < 0.45) {
            this.hp -= 10;
            this.damageFlash = 0.45;
            this.cameraShake = 0.04;
            if (this.hp <= 0) {
              this.hp = 0;
              this.alive = false;
              this.deaths += 1;
              bot.kills += 1;
              bot.score += 100;
              this.respawnTimer = 3.0;
              this.addKillFeed(bot.name, this.localPlayerName, 'AK-47X', false);
            }
          }
        }
      }
    }
  }

  private updateRocketsAndParticles(dt: number) {
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const rk = this.rockets[i];
      rk.life -= dt;
      rk.pos.addScaledVector(rk.vel, dt);
      rk.mesh.position.copy(rk.pos);

      let exploded = rk.life <= 0 || rk.pos.y <= 0.1;
      if (!exploded) {
        for (const b of this.bots) {
          if (b.alive && rk.pos.distanceTo(b.pos) < 1.5) {
            exploded = true;
            break;
          }
        }
      }

      if (exploded) {
        soundEngine.playExplosion();
        this.spawnSpark(rk.pos, 0xf97316);
        const splash = WEAPONS.rocket.splashRadius || 5.5;
        for (const b of this.bots) {
          if (!b.alive) continue;
          const d = rk.pos.distanceTo(b.pos);
          if (d < splash) {
            const dmg = Math.round(WEAPONS.rocket.damage * (1 - d / splash));
            b.hp -= dmg;
            if (b.hp <= 0) {
              b.hp = 0;
              b.alive = false;
              b.group.visible = false;
              b.respawnTimer = 3.0;
              b.deaths += 1;
              this.kills += 1;
              this.score += 120;
              this.addKillFeed(this.localPlayerName, b.name, 'RPG-7X', false);
            }
          }
        }
        this.scene.remove(rk.mesh);
        this.rockets.splice(i, 1);
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.vel.y -= 15 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.scale.setScalar(Math.max(0.01, p.life / p.maxLife));
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
      }
    }
  }

  private loop = () => {
    if (this.disposed) return;

    const now = performance.now();
    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(rawDt, 0.05);

    this.fpsFrames++;
    if (now - this.fpsLastTime >= 500) {
      this.currentFps = Math.round((this.fpsFrames * 1000) / (now - this.fpsLastTime));
      this.fpsFrames = 0;
      this.fpsLastTime = now;
    }

    if (this.isPlaying) {
      this.matchTime = Math.max(0, this.matchTime - dt);
      this.updatePlayer(dt);
      if (this.mode === 'practice' || (this.mode === '1v1' && !this.ws)) this.updateBots(dt);
      this.updateRocketsAndParticles(dt);

      // Interpolate remote players
      for (const rp of this.remotePlayers.values()) {
        rp.group.position.lerp(rp.targetPos, Math.min(1, 14 * dt));
        rp.group.rotation.y = rp.targetYaw;
      }

      if (this.hitMarkerTimer > 0) {
        this.hitMarkerTimer -= dt;
        if (this.hitMarkerTimer <= 0) this.hitMarker = 'none';
      }
      if (this.damageFlash > 0) {
        this.damageFlash = Math.max(0, this.damageFlash - dt * 2.2);
      }

      this.hudSyncTimer += dt;
      if (this.hudSyncTimer >= 0.05) {
        this.hudSyncTimer = 0;
        const cfg = WEAPONS[this.weaponId];
        const scoreboard: ScoreboardEntry[] = [
          {
            id: this.localId,
            name: this.localPlayerName,
            team: this.localTeam,
            kills: this.kills,
            deaths: this.deaths,
            score: this.score,
            isLocal: true,
          },
          ...this.bots.map((b) => ({
            id: b.id,
            name: b.name,
            team: b.team,
            kills: b.kills,
            deaths: b.deaths,
            score: b.score,
            isBot: true,
          })),
          ...Array.from(this.remotePlayers.values()).map((r) => ({
            id: r.id,
            name: r.name,
            team: r.team,
            kills: r.kills,
            deaths: r.deaths,
            score: r.score,
          })),
        ].sort((a, b) => b.score - a.score);

        this.onHudUpdate({
          hp: this.hp,
          ammo: this.ammo,
          reserve: this.reserve,
          reloading: this.reloading,
          reloadProgress: this.reloading
            ? Math.max(0, Math.min(1, 1 - (this.reloadEndTime - now) / cfg.reloadTimeMs))
            : 0,
          weaponName: cfg.name,
          weaponId: this.weaponId,
          kills: this.kills,
          deaths: this.deaths,
          score: this.score,
          redScore: this.redScore,
          blueScore: this.blueScore,
          timeLeft: Math.ceil(this.matchTime),
          fps: this.currentFps,
          hitMarker: this.hitMarker,
          killFeed: [...this.killFeed],
          scoreboard,
          alive: this.alive,
          respawnIn: Math.ceil(this.respawnTimer),
          damageFlash: this.damageFlash,
          aiming: this.rightMouseDown && !this.reloading && this.alive,
          scopeType: cfg.scopeType,
        });
      }
    } else {
      // Live-world atmospheric camera pan on Title Screen
      this.menuOrbitAngle += dt * 0.14;
      const radius = 28;
      this.camera.position.set(
        Math.cos(this.menuOrbitAngle) * radius,
        14,
        Math.sin(this.menuOrbitAngle) * radius
      );
      this.camera.lookAt(0, 2, 0);
    }

    this.renderer.render(this.scene, this.camera);

    if (this.isSoftwareGl) {
      this.afterDraw(this.loop);
    } else {
      this.frameId = requestAnimationFrame(this.loop);
    }
  };

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('wheel', this.onWheel);
    this.renderer.domElement.removeEventListener('contextmenu', this.onContextMenu);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
