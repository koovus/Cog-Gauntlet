import { TileType, DungeonData, Room, GeneratorState, PickupState } from './types';
import { TILE_SIZE, GRID_W, GRID_H, GENERATOR_HP, GENERATOR_SPAWN_RATE } from './constants';
import { ALL_PARTS } from './parts';

function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function tileCenter(tx: number, tz: number) {
  return { x: tx * TILE_SIZE + TILE_SIZE / 2, z: tz * TILE_SIZE + TILE_SIZE / 2 };
}

function carveRoom(tiles: TileType[][], room: Room) {
  for (let tz = room.z; tz < room.z + room.h; tz++) {
    for (let tx = room.x; tx < room.x + room.w; tx++) {
      if (tz >= 0 && tz < GRID_H && tx >= 0 && tx < GRID_W) tiles[tz][tx] = 1;
    }
  }
}

function carveCorridor(tiles: TileType[][], x1: number, z1: number, x2: number, z2: number) {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  for (let tx = minX; tx <= maxX; tx++) {
    for (let dz = -1; dz <= 1; dz++) {
      const tz = z1 + dz;
      if (tz >= 0 && tz < GRID_H && tx >= 0 && tx < GRID_W) tiles[tz][tx] = 1;
    }
  }
  const minZ = Math.min(z1, z2);
  const maxZ = Math.max(z1, z2);
  for (let tz = minZ; tz <= maxZ; tz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const tx = x2 + dx;
      if (tz >= 0 && tz < GRID_H && tx >= 0 && tx < GRID_W) tiles[tz][tx] = 1;
    }
  }
}

function roomsOverlap(a: Room, b: Room): boolean {
  const pad = 2;
  return !(a.x + a.w + pad <= b.x || b.x + b.w + pad <= a.x ||
           a.z + a.h + pad <= b.z || b.z + b.h + pad <= a.z);
}

export function generateDungeon(seed: number): DungeonData {
  const rng = makeRng(seed);
  const tiles: TileType[][] = Array.from({ length: GRID_H }, () =>
    new Array<TileType>(GRID_W).fill(0)
  );
  const rooms: Room[] = [];
  const ROOM_COUNT = 9;

  for (let i = 0; i < ROOM_COUNT; i++) {
    for (let attempt = 0; attempt < 80; attempt++) {
      const w = 5 + Math.floor(rng() * 8);
      const h = 5 + Math.floor(rng() * 8);
      const x = 2 + Math.floor(rng() * (GRID_W - w - 4));
      const z = 2 + Math.floor(rng() * (GRID_H - h - 4));
      const room: Room = { x, z, w, h, cx: x + Math.floor(w / 2), cz: z + Math.floor(h / 2) };
      if (!rooms.some(r => roomsOverlap(r, room))) {
        rooms.push(room);
        carveRoom(tiles, room);
        break;
      }
    }
  }

  for (let i = 1; i < rooms.length; i++) {
    carveCorridor(tiles, rooms[i - 1].cx, rooms[i - 1].cz, rooms[i].cx, rooms[i].cz);
  }

  const startPos = tileCenter(rooms[0].cx, rooms[0].cz);
  const generators: GeneratorState[] = [];
  const enemyTypes: Array<GeneratorState['enemyType']> = ['scout', 'heavy', 'swarm', 'turret'];

  [2, 4, 6, 8].filter(i => i < rooms.length).forEach((ri, gi) => {
    generators.push({
      id: `gen_${gi}`,
      tileX: rooms[ri].cx,
      tileZ: rooms[ri].cz,
      hp: GENERATOR_HP,
      maxHp: GENERATOR_HP,
      spawnCooldown: 1 + rng() * 2,
      spawnRate: GENERATOR_SPAWN_RATE,
      isActive: true,
      enemyType: enemyTypes[gi % enemyTypes.length],
    });
  });

  const pickups: PickupState[] = [];
  let pid = 0;

  for (let ri = 0; ri < rooms.length; ri++) {
    const room = rooms[ri];
    const energyCount = 2 + Math.floor(rng() * 3);
    for (let e = 0; e < energyCount; e++) {
      const tx = room.x + 1 + Math.floor(rng() * Math.max(1, room.w - 2));
      const tz = room.z + 1 + Math.floor(rng() * Math.max(1, room.h - 2));
      const pos = tileCenter(tx, tz);
      pickups.push({
        id: `en_${pid++}`,
        type: 'energy',
        x: pos.x + (rng() - 0.5) * 0.6,
        z: pos.z + (rng() - 0.5) * 0.6,
        energyAmount: 20 + Math.floor(rng() * 30),
        partDef: null,
        isCollected: false,
        bobOffset: rng() * Math.PI * 2,
      });
    }

    if (ri > 0 && rng() > 0.4) {
      const tx = room.x + 1 + Math.floor(rng() * Math.max(1, room.w - 2));
      const tz = room.z + 1 + Math.floor(rng() * Math.max(1, room.h - 2));
      const pos = tileCenter(tx, tz);
      const part = ALL_PARTS[Math.floor(rng() * ALL_PARTS.length)];
      pickups.push({
        id: `pt_${pid++}`,
        type: 'part',
        x: pos.x + (rng() - 0.5) * 0.6,
        z: pos.z + (rng() - 0.5) * 0.6,
        energyAmount: 0,
        partDef: { ...part, integrity: part.maxIntegrity },
        isCollected: false,
        bobOffset: rng() * Math.PI * 2,
      });
    }
  }

  return {
    gridW: GRID_W, gridH: GRID_H,
    tiles, rooms,
    playerStartX: startPos.x, playerStartZ: startPos.z,
    generators, pickups,
  };
}

export function tileAt(tiles: TileType[][], worldX: number, worldZ: number): TileType {
  const tx = Math.floor(worldX / TILE_SIZE);
  const tz = Math.floor(worldZ / TILE_SIZE);
  if (tx < 0 || tx >= GRID_W || tz < 0 || tz >= GRID_H) return 0;
  return tiles[tz][tx];
}

export function isFloor(tiles: TileType[][], worldX: number, worldZ: number): boolean {
  return tileAt(tiles, worldX, worldZ) === 1;
}

export function worldToTile(worldX: number, worldZ: number) {
  return { tx: Math.floor(worldX / TILE_SIZE), tz: Math.floor(worldZ / TILE_SIZE) };
}

export function bfsNextStep(
  tiles: TileType[][],
  fromX: number, fromZ: number,
  toX: number, toZ: number,
): { x: number; z: number } | null {
  const fromTX = Math.floor(fromX / TILE_SIZE);
  const fromTZ = Math.floor(fromZ / TILE_SIZE);
  const toTX = Math.floor(toX / TILE_SIZE);
  const toTZ = Math.floor(toZ / TILE_SIZE);

  if (fromTX === toTX && fromTZ === toTZ) return null;
  if (fromTX < 0 || fromTX >= GRID_W || fromTZ < 0 || fromTZ >= GRID_H) return null;
  if (!tiles[toTZ]?.[toTX]) return null;

  const W = GRID_W;
  const key = (x: number, z: number) => z * W + x;
  const parent = new Map<number, number>();
  const fromKey = key(fromTX, fromTZ);
  parent.set(fromKey, -1);

  const queue: [number, number][] = [[fromTX, fromTZ]];
  const dirs: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  let found = false;
  let head = 0;

  while (head < queue.length) {
    const [tx, tz] = queue[head++];
    if (tx === toTX && tz === toTZ) { found = true; break; }
    if (head > 900) break;
    for (const [dx, dz] of dirs) {
      const nx = tx + dx; const nz = tz + dz;
      if (nx < 0 || nx >= GRID_W || nz < 0 || nz >= GRID_H) continue;
      if (tiles[nz][nx] !== 1) continue;
      const nk = key(nx, nz);
      if (parent.has(nk)) continue;
      parent.set(nk, key(tx, tz));
      queue.push([nx, nz]);
    }
  }

  if (!found) return null;

  // Trace path back to get first step from origin
  let curr = key(toTX, toTZ);
  let prev = curr;
  while (true) {
    const p = parent.get(curr)!;
    if (p === fromKey) {
      // curr is the first step tile
      const tx = curr % W;
      const tz = Math.floor(curr / W);
      return { x: tx * TILE_SIZE + TILE_SIZE / 2, z: tz * TILE_SIZE + TILE_SIZE / 2 };
    }
    if (p === -1) break;
    prev = curr;
    curr = p;
  }
  // fromTile and toTile are adjacent
  return { x: toTX * TILE_SIZE + TILE_SIZE / 2, z: toTZ * TILE_SIZE + TILE_SIZE / 2 };
}
