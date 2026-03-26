export type TileType = 0 | 1;
export type PartSlot = 'core' | 'propulsion' | 'weapon' | 'utility';
export type EnemyType = 'scout' | 'heavy' | 'turret' | 'swarm';
export type GamePhase = 'menu' | 'playing' | 'gameover';
export type PickupType = 'energy' | 'part';

export interface PartDef {
  id: string;
  name: string;
  slot: PartSlot;
  integrity: number;
  maxIntegrity: number;
  speedBonus: number;
  energyDrainMod: number;
  damage: number;
  fireRate: number;
}

export interface EquippedParts {
  core: PartDef | null;
  propulsion: PartDef | null;
  weapon: PartDef | null;
  utility: PartDef | null;
}

export interface Room {
  x: number;
  z: number;
  w: number;
  h: number;
  cx: number;
  cz: number;
}

export interface GeneratorState {
  id: string;
  tileX: number;
  tileZ: number;
  hp: number;
  maxHp: number;
  spawnCooldown: number;
  spawnRate: number;
  isActive: boolean;
  enemyType: EnemyType;
}

export interface EnemyState {
  id: string;
  type: EnemyType;
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  attackRange: number;
  fireRate: number;
  fireCooldown: number;
  pathCooldown: number;
  targetX: number;
  targetZ: number;
  isAlive: boolean;
  flashTime: number;
}

export interface ProjectileState {
  id: string;
  x: number;
  z: number;
  dx: number;
  dz: number;
  speed: number;
  damage: number;
  isPlayer: boolean;
  timeToLive: number;
}

export interface PickupState {
  id: string;
  type: PickupType;
  x: number;
  z: number;
  energyAmount: number;
  partDef: PartDef | null;
  isCollected: boolean;
  bobOffset: number;
}

export interface DungeonData {
  gridW: number;
  gridH: number;
  tiles: TileType[][];
  rooms: Room[];
  playerStartX: number;
  playerStartZ: number;
  generators: GeneratorState[];
  pickups: PickupState[];
}

export interface PlayerData {
  x: number;
  z: number;
  aimAngle: number;
  coreHP: number;
  maxCoreHP: number;
  energy: number;
  maxEnergy: number;
  fireCooldown: number;
  hitFlashTime: number;
  parts: EquippedParts;
}

export interface ParticleData {
  id: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  color: number;
}

export interface GameRef {
  phase: GamePhase;
  player: PlayerData;
  enemies: EnemyState[];
  generators: GeneratorState[];
  projectiles: ProjectileState[];
  particles: ParticleData[];
  pickups: PickupState[];
  dungeon: DungeonData | null;
  score: number;
  wave: number;
  killCount: number;
  waveTimer: number;
  partsEquipped: number;
  log: string[];
  logTimer: number;
  time: number;
}

export interface HudState {
  phase: GamePhase;
  coreHP: number;
  maxCoreHP: number;
  energy: number;
  maxEnergy: number;
  score: number;
  wave: number;
  killCount: number;
  partsEquipped: number;
  parts: EquippedParts;
  log: string[];
  generatorsLeft: number;
  partSlotHP: { core: number; propulsion: number; weapon: number; utility: number };
}

export interface MinimapData {
  tiles: TileType[][] | null;
  gridW: number;
  gridH: number;
  playerTileX: number;
  playerTileZ: number;
  enemyTiles: Array<{ x: number; z: number }>;
  generatorTiles: Array<{ x: number; z: number; active: boolean }>;
}
