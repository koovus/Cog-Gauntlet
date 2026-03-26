export const TILE_SIZE = 2;
export const WALL_HEIGHT = 2.8;
export const GRID_W = 50;
export const GRID_H = 50;

export const PLAYER_RADIUS = 0.45;
export const PLAYER_MAX_HP = 100;
export const PLAYER_MAX_ENERGY = 100;
export const ENERGY_DRAIN_RATE = 1.8;
export const CORE_DRAIN_RATE = 8;
export const ENERGY_CELL_AMOUNT = 35;

export const PROJECTILE_SPEED_PLAYER = 14;
export const PROJECTILE_SPEED_ENEMY = 7;
export const PROJECTILE_RADIUS = 0.18;
export const PROJECTILE_TTL = 3;

export const ENEMY_RADIUS = 0.42;
export const GENERATOR_HP = 35;
export const GENERATOR_SPAWN_RATE = 5;
export const PICKUP_RADIUS = 0.95;

export const FRUSTUM_H = 18;

export const C = {
  background: 0x050508,
  floor: 0x0e0e20,
  wall: 0x1a0040,
  wallTop: 0x3a0088,

  playerCore: 0x00ffee,
  playerPropulsion: 0x00cc88,
  playerWeapon: 0xff6a00,
  playerUtility: 0xbb44ff,

  enemyScout: 0xff2244,
  enemyHeavy: 0xcc0022,
  enemyTurret: 0xff5500,
  enemySwarm: 0xff0077,

  energyPickup: 0xffee00,
  partPickup: 0x00ff88,

  projPlayer: 0x00ffee,
  projEnemy: 0xff3322,

  generator: 0x550011,
  generatorGlow: 0xff2200,

  lightCyan: 0x00ccff,
  lightMagenta: 0xff00cc,
  lightAmbient: 0x2020aa,
  lightGround: 0x080818,
} as const;

export const ENEMY_STATS = {
  scout: { hp: 14, speed: 3.8, damage: 10, attackRange: 8, fireRate: 1.4 },
  heavy: { hp: 50, speed: 2.0, damage: 28, attackRange: 6, fireRate: 0.5 },
  turret: { hp: 25, speed: 0, damage: 18, attackRange: 14, fireRate: 2.2 },
  swarm: { hp: 8, speed: 5.5, damage: 8, attackRange: 2.2, fireRate: 3.0 },
} as const;
