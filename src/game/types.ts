export type WeaponId =
  | 'assault'
  | 'sniper'
  | 'shotgun'
  | 'smg'
  | 'pistol'
  | 'rocket'
  | 'burst'
  | 'lmg'
  | 'revolver'
  | 'crossbow'
  | 'heavy_sniper';
export type ScopeType = 'iron' | 'red_dot' | 'acog' | 'sniper';
export type MapId = 'desert' | 'warehouse' | 'city' | 'military';
export type GameMode = 'practice' | 'ffa' | 'tdm' | 'ctf' | '1v1';
export type GraphicsQuality = 'low' | 'medium' | 'high';
export type GameScreen = 'menu' | 'playing' | 'paused' | 'gameover';

export interface WeaponConfig {
  id: WeaponId;
  name: string;
  shortName: string;
  damage: number;
  headshotMult: number;
  fireRateMs: number;
  magSize: number;
  reserveAmmo: number;
  reloadTimeMs: number;
  spread: number;
  recoilKick: number;
  pellets: number;
  automatic: boolean;
  adsFov: number;
  scopeType: ScopeType;
  projectileSpeed?: number;
  splashRadius?: number;
  color: string;
  description: string;
}

export interface GameSettings {
  sensitivity: number;
  fov: number;
  graphics: GraphicsQuality;
  volume: number;
  muted: boolean;
  showFps: boolean;
}

export interface PlayerProfile {
  name: string;
  totalKills: number;
  totalDeaths: number;
  gamesPlayed: number;
  highScore: number;
}

export interface ScoreboardEntry {
  id: string;
  name: string;
  team: 'red' | 'blue' | 'ffa';
  kills: number;
  deaths: number;
  score: number;
  isBot?: boolean;
  isLocal?: boolean;
}

export interface KillFeedItem {
  id: string;
  killer: string;
  victim: string;
  weapon: string;
  headshot: boolean;
  timestamp: number;
}

export interface RoomInfo {
  id: string;
  name: string;
  mode: 'ffa' | 'tdm' | 'ctf' | '1v1';
  mapId: MapId;
  playerCount: number;
  maxPlayers: number;
}

export interface HudState {
  hp: number;
  ammo: number;
  reserve: number;
  reloading: boolean;
  reloadProgress: number;
  weaponName: string;
  weaponId: WeaponId;
  kills: number;
  deaths: number;
  score: number;
  redScore: number;
  blueScore: number;
  timeLeft: number;
  fps: number;
  hitMarker: 'none' | 'body' | 'head';
  killFeed: KillFeedItem[];
  scoreboard: ScoreboardEntry[];
  alive: boolean;
  respawnIn: number;
  damageFlash: number;
  aiming: boolean;
  scopeType: ScopeType;
  flagStatus?: string;
}
