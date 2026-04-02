import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GameRef, HudState, MinimapData, EnemyState, ProjectileState, GeneratorState, TileType } from '../game/types';
import {
  TILE_SIZE, PLAYER_RADIUS, PLAYER_MAX_HP, PLAYER_MAX_ENERGY,
  CORE_DRAIN_RATE, PICKUP_RADIUS,
  PROJECTILE_SPEED_PLAYER, PROJECTILE_SPEED_ENEMY, PROJECTILE_RADIUS, PROJECTILE_TTL,
  ENEMY_RADIUS, ENEMY_STATS, C,
} from '../game/constants';
import { generateDungeon, isFloor, bfsNextStep, worldToTile } from '../game/dungeon';
import { makeDefaultParts, getPlayerSpeed, getPlayerDamage, getPlayerFireRate, getEnergyDrain, shouldAutoEquip, ALL_PARTS } from '../game/parts';
import {
  ThreeObjects, initThree, buildDungeonGeometry, buildEnemyMesh,
  buildGeneratorMesh, buildPickupMesh, buildProjectileMesh,
  spawnParticle, updateCameraFollow, getAimPoint,
} from '../game/sceneBuilder';

let _eid = 0;

function uid() { return (_eid++ % 999999).toString(36) + Date.now().toString(36); }

function makeDefaultHud(): HudState {
  return {
    phase: 'menu',
    coreHP: PLAYER_MAX_HP, maxCoreHP: PLAYER_MAX_HP,
    energy: PLAYER_MAX_ENERGY, maxEnergy: PLAYER_MAX_ENERGY,
    score: 0, wave: 1, killCount: 0, partsEquipped: 0,
    parts: { core: null, propulsion: null, weapon: null, utility: null },
    log: ['> SYSTEM ONLINE', '> PRESS START'],
    generatorsLeft: 0,
    partSlotHP: { core: 100, propulsion: 100, weapon: 100, utility: 0 },
  };
}

function makeDefaultMinimap(): MinimapData {
  return { tiles: null, gridW: 50, gridH: 50, playerTileX: 0, playerTileZ: 0, enemyTiles: [], generatorTiles: [] };
}

function dist2(ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax; const dz = bz - az;
  return dx * dx + dz * dz;
}

function canMove(tiles: TileType[][], x: number, z: number, r: number): boolean {
  return isFloor(tiles, x + r, z) && isFloor(tiles, x - r, z) &&
    isFloor(tiles, x, z + r) && isFloor(tiles, x, z - r) &&
    isFloor(tiles, x, z);
}

export function useGame(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const threeRef = useRef<ThreeObjects | null>(null);
  const gameRef = useRef<GameRef>({
    phase: 'menu',
    player: {
      x: 50, z: 50, aimAngle: 0,
      coreHP: PLAYER_MAX_HP, maxCoreHP: PLAYER_MAX_HP,
      energy: PLAYER_MAX_ENERGY, maxEnergy: PLAYER_MAX_ENERGY,
      fireCooldown: 0, hitFlashTime: 0,
      parts: { core: null, propulsion: null, weapon: null, utility: null },
    },
    enemies: [], generators: [], projectiles: [], particles: [], pickups: [],
    dungeon: null, score: 0, wave: 1, killCount: 0,
    waveTimer: 0, partsEquipped: 0, log: [], logTimer: 0, time: 0,
  });

  const keysRef = useRef<Set<string>>(new Set());
  const mouseRef = useRef({ x: 0, y: 0, down: false });
  const lastTimeRef = useRef(0);
  const hudTimerRef = useRef(0);
  const rafRef = useRef(0);

  const [hudState, setHudState] = useState<HudState>(makeDefaultHud);
  const [minimapData, setMinimapData] = useState<MinimapData>(makeDefaultMinimap);
  const [webglError, setWebglError] = useState<string | null>(null);

  const addLog = useCallback((msg: string) => {
    const g = gameRef.current;
    g.log = ['> ' + msg, ...g.log].slice(0, 8);
  }, []);

  const spawnEnemy = useCallback((gen: GeneratorState, three: ThreeObjects) => {
    const g = gameRef.current;
    if (!g.dungeon) return;
    const stats = ENEMY_STATS[gen.enemyType];
    const angle = Math.random() * Math.PI * 2;
    const dist = 2 + Math.random() * 2;
    const ex = gen.tileX * TILE_SIZE + TILE_SIZE / 2 + Math.cos(angle) * dist;
    const ez = gen.tileZ * TILE_SIZE + TILE_SIZE / 2 + Math.sin(angle) * dist;

    const enemy: EnemyState = {
      id: uid(),
      type: gen.enemyType,
      x: ex, z: ez,
      hp: stats.hp, maxHp: stats.hp,
      speed: stats.speed, damage: stats.damage,
      attackRange: stats.attackRange,
      fireRate: stats.fireRate,
      fireCooldown: 0.5 + Math.random() * 1.5,
      pathCooldown: 0,
      targetX: ex, targetZ: ez,
      isAlive: true, flashTime: 0,
    };
    g.enemies.push(enemy);

    const mesh = buildEnemyMesh(gen.enemyType);
    mesh.position.set(ex, 0, ez);
    three.scene.add(mesh);
    three.enemyMeshMap.set(enemy.id, mesh);
  }, []);

  const startNewRun = useCallback(() => {
    const three = threeRef.current;
    if (!three) return;
    const g = gameRef.current;

    // Clean up previous run
    g.enemies.forEach(e => {
      const m = three.enemyMeshMap.get(e.id);
      if (m) three.scene.remove(m);
    });
    three.enemyMeshMap.clear();
    g.generators.forEach(gen => {
      const gm = three.generatorMeshMap.get(gen.id);
      if (gm) three.scene.remove(gm.mesh);
    });
    three.generatorMeshMap.clear();
    g.pickups.forEach(pk => {
      const pm = three.pickupMeshMap.get(pk.id);
      if (pm) three.scene.remove(pm);
    });
    three.pickupMeshMap.clear();
    g.projectiles.forEach(pr => {
      const pm = three.projMeshMap.get(pr.id);
      if (pm) three.scene.remove(pm);
    });
    three.projMeshMap.clear();
    three.activeParticles.forEach(p => { p.mesh.visible = false; });
    three.activeParticles.length = 0;

    const seed = Date.now();
    const dungeon = generateDungeon(seed);
    buildDungeonGeometry(dungeon, three);

    const defaultParts = makeDefaultParts();
    g.player = {
      x: dungeon.playerStartX, z: dungeon.playerStartZ,
      aimAngle: 0,
      coreHP: PLAYER_MAX_HP, maxCoreHP: PLAYER_MAX_HP,
      energy: PLAYER_MAX_ENERGY, maxEnergy: PLAYER_MAX_ENERGY,
      fireCooldown: 0, hitFlashTime: 0,
      parts: { ...defaultParts, utility: null },
    };
    three.playerMesh.position.set(g.player.x, 0, g.player.z);
    three.camera.position.set(g.player.x, 80, g.player.z);

    g.enemies = [];
    g.projectiles = [];
    g.particles = [];
    g.score = 0;
    g.wave = 1;
    g.killCount = 0;
    g.waveTimer = 0;
    g.partsEquipped = 0;
    g.log = ['> NEW RUN INITIATED', '> CORE ONLINE'];
    g.dungeon = dungeon;

    // Set up generators
    g.generators = dungeon.generators.map(gen => ({ ...gen }));
    g.generators.forEach(gen => {
      const gm = buildGeneratorMesh(three.scene);
      const wx = gen.tileX * TILE_SIZE + TILE_SIZE / 2;
      const wz = gen.tileZ * TILE_SIZE + TILE_SIZE / 2;
      gm.mesh.position.set(wx, 0, wz);
      three.generatorMeshMap.set(gen.id, gm);
    });

    // Set up pickups
    g.pickups = dungeon.pickups.map(p => ({ ...p }));
    g.pickups.forEach(pk => {
      const slot = pk.partDef?.slot;
      const mesh = buildPickupMesh(pk.type, slot);
      mesh.position.set(pk.x, 0, pk.z);
      three.scene.add(mesh);
      three.pickupMeshMap.set(pk.id, mesh);
    });

    g.phase = 'playing';
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let three: ThreeObjects;
    try {
      three = initThree(canvas);
    } catch (err: unknown) {
      setWebglError(err instanceof Error ? err.message : 'WebGL initialization failed');
      return;
    }
    threeRef.current = three;

    const onKey = (e: KeyboardEvent, down: boolean) => {
      if (down) keysRef.current.add(e.code);
      else keysRef.current.delete(e.code);
      if (e.code === 'Space') e.preventDefault();
    };
    const onKeyDown = (e: KeyboardEvent) => onKey(e, true);
    const onKeyUp = (e: KeyboardEvent) => onKey(e, false);
    const onMouseMove = (e: MouseEvent) => { mouseRef.current.x = e.clientX; mouseRef.current.y = e.clientY; };
    const onMouseDown = (e: MouseEvent) => { if (e.button === 0) mouseRef.current.down = true; };
    const onMouseUp = (e: MouseEvent) => { if (e.button === 0) mouseRef.current.down = false; };
    const onCtxMenu = (e: Event) => e.preventDefault();

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('contextmenu', onCtxMenu);

    const loop = (time: number) => {
      const dt = Math.min((time - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = time;

      const g = gameRef.current;

      if (g.phase === 'playing') {
        g.time += dt;
        tick(dt, g, three, keysRef.current, mouseRef.current, addLog, spawnEnemy);
      } else if (g.phase === 'menu') {
        // Slowly rotate player mesh for menu
        three.playerMesh.rotation.y += dt * 0.5;
      }

      three.scanlinePass.uniforms.time.value = g.time;
      three.composer.render();

      // Sync HUD every 100ms
      hudTimerRef.current += dt;
      if (hudTimerRef.current >= 0.1) {
        hudTimerRef.current = 0;
        const p = g.player;
        const gens = g.generators.filter(gen => gen.isActive);
        setHudState({
          phase: g.phase,
          coreHP: Math.max(0, p.coreHP),
          maxCoreHP: p.maxCoreHP,
          energy: Math.max(0, p.energy),
          maxEnergy: p.maxEnergy,
          score: g.score,
          wave: g.wave,
          killCount: g.killCount,
          partsEquipped: g.partsEquipped,
          parts: { ...p.parts },
          log: [...g.log],
          generatorsLeft: gens.length,
          partSlotHP: {
            core: p.parts.core ? (p.parts.core.integrity / p.parts.core.maxIntegrity) * 100 : 0,
            propulsion: p.parts.propulsion ? (p.parts.propulsion.integrity / p.parts.propulsion.maxIntegrity) * 100 : 0,
            weapon: p.parts.weapon ? (p.parts.weapon.integrity / p.parts.weapon.maxIntegrity) * 100 : 0,
            utility: p.parts.utility ? (p.parts.utility.integrity / p.parts.utility.maxIntegrity) * 100 : 0,
          },
        });
        if (g.dungeon) {
          const pt = worldToTile(p.x, p.z);
          setMinimapData({
            tiles: g.dungeon.tiles,
            gridW: g.dungeon.gridW, gridH: g.dungeon.gridH,
            playerTileX: pt.tx, playerTileZ: pt.tz,
            enemyTiles: g.enemies.filter(e => e.isAlive).map(e => { const t = worldToTile(e.x, e.z); return { x: t.tx, z: t.tz }; }),
            generatorTiles: g.generators.map(gen => ({
              x: gen.tileX, z: gen.tileZ, active: gen.isActive,
            })),
          });
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('contextmenu', onCtxMenu);
      three.renderer.dispose();
    };
  }, []);

  return { hudState, minimapData, startNewRun, webglError };
}

const WAVE_DURATION = 75; // seconds before forced wave advance

function advanceWave(
  g: GameRef,
  three: ThreeObjects,
  addLog: (msg: string) => void,
  spawnEnemy: (gen: GeneratorState, three: ThreeObjects) => void,
) {
  g.wave++;
  g.waveTimer = 0;
  addLog(`>>> WAVE ${g.wave} INCOMING <<<`);
  g.score += 100;

  // Scale up remaining ACTIVE generators only — destroyed ones stay destroyed
  const activeGens = g.generators.filter(gen => gen.isActive);
  for (const gen of activeGens) {
    gen.hp = Math.ceil(gen.maxHp * 1.3);
    gen.maxHp = gen.hp;
    gen.spawnRate = Math.max(3, gen.spawnRate * 0.85);
    gen.spawnCooldown = gen.spawnRate * 0.3;
    spawnEnemy(gen, three);
  }

  // Spawn a fresh generator in the first unoccupied room (rooms 1,3,5,7 etc)
  if (g.dungeon) {
    const occupiedTiles = new Set(g.generators.map(gen => `${gen.tileX},${gen.tileZ}`));
    const enemyTypes: Array<GeneratorState['enemyType']> = ['scout', 'heavy', 'swarm', 'turret'];
    for (let ri = 1; ri < g.dungeon.rooms.length; ri++) {
      const room = g.dungeon.rooms[ri];
      const key = `${room.cx},${room.cz}`;
      if (!occupiedTiles.has(key)) {
        const newGen: GeneratorState = {
          id: `gen_w${g.wave}_${ri}`,
          tileX: room.cx, tileZ: room.cz,
          hp: 60 + g.wave * 20, maxHp: 60 + g.wave * 20,
          spawnRate: Math.max(3, 8 - g.wave * 0.5),
          spawnCooldown: 2,
          isActive: true,
          enemyType: enemyTypes[(g.wave + ri) % enemyTypes.length],
        };
        g.generators.push(newGen);
        occupiedTiles.add(key);
        const gm = buildGeneratorMesh(three.scene);
        const wx = room.cx * TILE_SIZE + TILE_SIZE / 2;
        const wz = room.cz * TILE_SIZE + TILE_SIZE / 2;
        gm.mesh.position.set(wx, 0, wz);
        three.generatorMeshMap.set(newGen.id, gm);
        addLog(`NEW SPAWN POINT ONLINE [${room.cx},${room.cz}]`);
        break;
      }
    }
  }
}

function destroyGenerator(
  gen: GeneratorState,
  three: ThreeObjects,
  g: GameRef,
  bonus: number,
  addLog: (msg: string) => void,
) {
  gen.isActive = false;
  const gm = three.generatorMeshMap.get(gen.id);
  const gx = gen.tileX * TILE_SIZE + TILE_SIZE / 2;
  const gz = gen.tileZ * TILE_SIZE + TILE_SIZE / 2;
  if (gm) { three.scene.remove(gm.mesh); three.generatorMeshMap.delete(gen.id); }
  g.score += bonus;
  addLog(`GENERATOR OFFLINE +${bonus}pts`);
  for (let i = 0; i < 20; i++) spawnParticle(three, gx, gz, C.generatorGlow);
  if (g.generators.every(g2 => !g2.isActive)) {
    g.score += 500;
    addLog('ALL GENERATORS OFFLINE! +500pts');
  }
}

function tick(
  dt: number,
  g: GameRef,
  three: ThreeObjects,
  keys: Set<string>,
  mouse: { x: number; y: number; down: boolean },
  addLog: (msg: string) => void,
  spawnEnemy: (gen: GeneratorState, three: ThreeObjects) => void,
) {
  if (!g.dungeon) return;
  const { tiles } = g.dungeon;
  const p = g.player;

  // === PLAYER INPUT & MOVEMENT ===
  let mx = 0, mz = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) mz -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) mz += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;

  const speed = getPlayerSpeed(p.parts);
  if (mx !== 0 || mz !== 0) {
    const len = Math.sqrt(mx * mx + mz * mz);
    mx /= len; mz /= len;
    const nx = p.x + mx * speed * dt;
    const nz = p.z + mz * speed * dt;
    if (canMove(tiles, nx, nz, PLAYER_RADIUS)) {
      p.x = nx; p.z = nz;
    } else if (canMove(tiles, nx, p.z, PLAYER_RADIUS)) {
      p.x = nx;
    } else if (canMove(tiles, p.x, nz, PLAYER_RADIUS)) {
      p.z = nz;
    }
  }

  // Aim
  const aimPt = getAimPoint(three, mouse.x, mouse.y);
  if (aimPt) {
    const adx = aimPt.x - p.x;
    const adz = aimPt.z - p.z;
    p.aimAngle = Math.atan2(adx, adz);
  }

  // Update player mesh
  three.playerMesh.position.set(p.x, 0, p.z);
  three.playerMesh.rotation.y = p.aimAngle;
  if (p.hitFlashTime > 0) {
    p.hitFlashTime -= dt;
    const flash = p.hitFlashTime > 0 ? 0xff0000 : C.playerCore;
    const coreMesh = three.playerMesh.children[0] as THREE.Mesh;
    const mat = coreMesh.material as THREE.MeshLambertMaterial;
    mat.color.setHex(flash);
    mat.emissive.setHex(flash);
  }

  // Camera follow
  updateCameraFollow(three.camera, p.x, p.z, dt);

  // === FIRE ===
  p.fireCooldown -= dt;
  if (mouse.down && p.fireCooldown <= 0 && p.parts.weapon) {
    const fireRate = getPlayerFireRate(p.parts);
    p.fireCooldown = 1 / fireRate;
    const spread = 0.02;
    const dx = Math.sin(p.aimAngle) + (Math.random() - 0.5) * spread;
    const dz = Math.cos(p.aimAngle) + (Math.random() - 0.5) * spread;
    const len = Math.sqrt(dx * dx + dz * dz);
    const proj: ProjectileState = {
      id: uid(),
      x: p.x + dx * 0.6, z: p.z + dz * 0.6,
      dx: dx / len, dz: dz / len,
      speed: PROJECTILE_SPEED_PLAYER,
      damage: getPlayerDamage(p.parts),
      isPlayer: true,
      timeToLive: PROJECTILE_TTL,
    };
    g.projectiles.push(proj);
    const pm = buildProjectileMesh(true);
    pm.position.set(proj.x, 0.5, proj.z);
    three.scene.add(pm);
    three.projMeshMap.set(proj.id, pm);
  }

  // === ENERGY DRAIN ===
  const drainRate = getEnergyDrain(p.parts);
  p.energy -= drainRate * dt;
  if (p.energy < 0) {
    p.energy = 0;
    p.coreHP -= CORE_DRAIN_RATE * dt;
    if (Math.random() < dt * 2) addLog('ENERGY CRITICAL!');
    if (p.coreHP <= 0) {
      p.coreHP = 0;
      g.phase = 'gameover';
      addLog('CORE FAILURE — RUN ENDED');
      return;
    }
  }

  // === PICKUPS ===
  const collectRadius2 = PICKUP_RADIUS * PICKUP_RADIUS;
  for (const pk of g.pickups) {
    if (pk.isCollected) continue;
    if (dist2(p.x, p.z, pk.x, pk.z) < collectRadius2) {
      pk.isCollected = true;
      const mesh = three.pickupMeshMap.get(pk.id);
      if (mesh) { three.scene.remove(mesh); three.pickupMeshMap.delete(pk.id); }

      if (pk.type === 'energy') {
        p.energy = Math.min(p.maxEnergy, p.energy + pk.energyAmount);
        g.score += 5;
        addLog(`+${pk.energyAmount} ENERGY`);
      } else if (pk.type === 'part' && pk.partDef) {
        const slot = pk.partDef.slot;
        const current = p.parts[slot];
        if (shouldAutoEquip(current, pk.partDef)) {
          p.parts[slot] = { ...pk.partDef };
          g.partsEquipped++;
          addLog(`EQUIPPED: ${pk.partDef.name.toUpperCase()}`);
          g.score += 15;
        } else {
          addLog(`PART IGNORED: ${pk.partDef.name.toUpperCase()}`);
        }
      }
    }
    // Bob pickup
    const pkMesh = three.pickupMeshMap.get(pk.id);
    if (pkMesh) {
      pkMesh.position.y = Math.sin(g.time * 2 + pk.bobOffset) * 0.12;
      pkMesh.rotation.y = g.time * 1.2 + pk.bobOffset;
    }
  }

  // === WAVE TIMER ===
  g.waveTimer += dt;
  if (g.waveTimer >= WAVE_DURATION) {
    advanceWave(g, three, addLog, spawnEnemy);
  } else if (g.generators.every(gen => !gen.isActive) && g.generators.length > 0) {
    // All generators cleared → wave advance immediately
    advanceWave(g, three, addLog, spawnEnemy);
  }

  // === GENERATORS ===
  for (const gen of g.generators) {
    if (!gen.isActive) continue;
    gen.spawnCooldown -= dt;
    if (gen.spawnCooldown <= 0) {
      gen.spawnCooldown = gen.spawnRate;
      spawnEnemy(gen, three);
    }

    // Generator pulse animation
    const gm = three.generatorMeshMap.get(gen.id);
    if (gm) {
      const pulse = 0.8 + Math.sin(g.time * 4) * 0.4;
      gm.light.intensity = pulse * 2.5;
    }

    // Player walks into generator → instant destruction (high-risk melee)
    const gx = gen.tileX * TILE_SIZE + TILE_SIZE / 2;
    const gz = gen.tileZ * TILE_SIZE + TILE_SIZE / 2;
    if (dist2(p.x, p.z, gx, gz) < 1.0 * 1.0) {
      // Deal chip damage to player for the risk
      p.coreHP -= 8;
      p.hitFlashTime = 0.2;
      addLog('GENERATOR RAMMED!');
      destroyGenerator(gen, three, g, 150, addLog);
    }
  }

  // === ENEMIES ===
  for (let ei = g.enemies.length - 1; ei >= 0; ei--) {
    const e = g.enemies[ei];
    if (!e.isAlive) {
      g.enemies.splice(ei, 1);
      continue;
    }

    const mesh = three.enemyMeshMap.get(e.id);
    e.flashTime -= dt;

    // Movement (not for turrets)
    if (e.type !== 'turret' && e.speed > 0) {
      e.pathCooldown -= dt;
      if (e.pathCooldown <= 0) {
        e.pathCooldown = 0.45 + Math.random() * 0.15;
        const next = bfsNextStep(tiles, e.x, e.z, p.x, p.z);
        if (next) { e.targetX = next.x; e.targetZ = next.z; }
        else { e.targetX = p.x; e.targetZ = p.z; }
      }

      const tdx = e.targetX - e.x;
      const tdz = e.targetZ - e.z;
      const tlen = Math.sqrt(tdx * tdx + tdz * tdz);
      if (tlen > 0.1) {
        const moveX = (tdx / tlen) * e.speed * dt;
        const moveZ = (tdz / tlen) * e.speed * dt;
        const nx = e.x + moveX;
        const nz = e.z + moveZ;
        if (canMove(tiles, nx, nz, ENEMY_RADIUS)) { e.x = nx; e.z = nz; }
        else if (canMove(tiles, nx, e.z, ENEMY_RADIUS)) { e.x = nx; }
        else if (canMove(tiles, e.x, nz, ENEMY_RADIUS)) { e.z = nz; }
      }
    }

    // Face player
    const faceAngle = Math.atan2(p.x - e.x, p.z - e.z);
    if (mesh) {
      mesh.position.set(e.x, 0, e.z);
      mesh.rotation.y = faceAngle;
      const col = { scout: C.enemyScout, heavy: C.enemyHeavy, turret: C.enemyTurret, swarm: C.enemySwarm }[e.type];
      const flashColor = e.flashTime > 0 ? 0xffffff : col;
      mesh.children.forEach(c => {
        const m = c as THREE.Mesh;
        if (m.isMesh) {
          (m.material as THREE.MeshLambertMaterial).color.setHex(flashColor);
        }
      });
    }

    // Attack
    e.fireCooldown -= dt;
    const distSq = dist2(e.x, e.z, p.x, p.z);
    const rangeSq = e.attackRange * e.attackRange;
    if (e.fireCooldown <= 0 && distSq < rangeSq) {
      e.fireCooldown = 1 / e.fireRate;

      if (e.type === 'swarm' && distSq < 2.5 * 2.5) {
        // Melee
        p.coreHP -= e.damage * dt;
        p.hitFlashTime = 0.15;
      } else {
        // Ranged projectile
        const spread = 0.08;
        const rdx = p.x - e.x + (Math.random() - 0.5) * spread * e.attackRange;
        const rdz = p.z - e.z + (Math.random() - 0.5) * spread * e.attackRange;
        const rlen = Math.sqrt(rdx * rdx + rdz * rdz);
        if (rlen > 0) {
          const proj: ProjectileState = {
            id: uid(),
            x: e.x, z: e.z,
            dx: rdx / rlen, dz: rdz / rlen,
            speed: PROJECTILE_SPEED_ENEMY,
            damage: e.damage,
            isPlayer: false,
            timeToLive: PROJECTILE_TTL,
          };
          g.projectiles.push(proj);
          const pm = buildProjectileMesh(false);
          pm.position.set(proj.x, 0.5, proj.z);
          three.scene.add(pm);
          three.projMeshMap.set(proj.id, pm);
        }
      }
    }
  }

  // === PROJECTILES ===
  for (let pi = g.projectiles.length - 1; pi >= 0; pi--) {
    const proj = g.projectiles[pi];
    proj.x += proj.dx * proj.speed * dt;
    proj.z += proj.dz * proj.speed * dt;
    proj.timeToLive -= dt;

    const pm = three.projMeshMap.get(proj.id);
    let remove = false;

    if (proj.timeToLive <= 0 || !isFloor(tiles, proj.x, proj.z)) {
      remove = true;
      if (!isFloor(tiles, proj.x, proj.z)) {
        // Hit wall sparks
        for (let i = 0; i < 3; i++) spawnParticle(three, proj.x, proj.z, proj.isPlayer ? C.projPlayer : C.projEnemy);
      }
    } else if (proj.isPlayer) {
      // Check vs enemies
      for (const e of g.enemies) {
        if (!e.isAlive) continue;
        if (dist2(proj.x, proj.z, e.x, e.z) < (PROJECTILE_RADIUS + ENEMY_RADIUS) ** 2) {
          e.hp -= proj.damage;
          e.flashTime = 0.12;
          if (e.hp <= 0) {
            e.isAlive = false;
            const em = three.enemyMeshMap.get(e.id);
            if (em) { three.scene.remove(em); three.enemyMeshMap.delete(e.id); }
            g.score += 50 + g.wave * 10;
            g.killCount++;
            addLog(`ENEMY DESTROYED +${50 + g.wave * 10}pts`);
            // Glitch explosion
            for (let i = 0; i < 12; i++) spawnParticle(three, e.x, e.z, { scout: C.enemyScout, heavy: C.enemyHeavy, turret: C.enemyTurret, swarm: C.enemySwarm }[e.type]);
            // Drop energy
            if (Math.random() < 0.45) {
              const dropId = uid();
              const dropPk = {
                id: dropId, type: 'energy' as const,
                x: e.x + (Math.random() - 0.5) * 1.5, z: e.z + (Math.random() - 0.5) * 1.5,
                energyAmount: 10 + Math.floor(Math.random() * 18),
                partDef: null, isCollected: false, bobOffset: Math.random() * Math.PI * 2,
              };
              g.pickups.push(dropPk);
              const dropMesh = buildPickupMesh('energy');
              dropMesh.position.set(dropPk.x, 0, dropPk.z);
              three.scene.add(dropMesh);
              three.pickupMeshMap.set(dropId, dropMesh);
            }
            // Rare part drop
            if (Math.random() < 0.12) {
              const partDef = ALL_PARTS[Math.floor(Math.random() * ALL_PARTS.length)];
              const dropId = uid();
              const dropPk = {
                id: dropId, type: 'part' as const,
                x: e.x + (Math.random() - 0.5) * 1.5, z: e.z + (Math.random() - 0.5) * 1.5,
                energyAmount: 0,
                partDef: { ...partDef, integrity: partDef.maxIntegrity }, isCollected: false, bobOffset: Math.random() * Math.PI * 2,
              };
              g.pickups.push(dropPk);
              const dropMesh = buildPickupMesh('part', partDef.slot);
              dropMesh.position.set(dropPk.x, 0, dropPk.z);
              three.scene.add(dropMesh);
              three.pickupMeshMap.set(dropId, dropMesh);
            }
          }
          remove = true; break;
        }
      }
      // Check vs generators
      if (!remove) {
        for (const gen of g.generators) {
          if (!gen.isActive) continue;
          const gx = gen.tileX * TILE_SIZE + TILE_SIZE / 2;
          const gz = gen.tileZ * TILE_SIZE + TILE_SIZE / 2;
          if (dist2(proj.x, proj.z, gx, gz) < 1.1 * 1.1) {
            gen.hp -= proj.damage;
            if (gen.hp <= 0) {
              destroyGenerator(gen, three, g, 200, addLog);
            }
            remove = true; break;
          }
        }
      }
    } else {
      // Enemy projectile vs player
      if (dist2(proj.x, proj.z, p.x, p.z) < (PROJECTILE_RADIUS + PLAYER_RADIUS) ** 2) {
        p.coreHP -= proj.damage;
        p.hitFlashTime = 0.2;
        // Damage equipped part
        const slots: (keyof typeof p.parts)[] = ['weapon', 'propulsion', 'utility', 'core'];
        for (const slot of slots) {
          if (p.parts[slot]) {
            p.parts[slot]!.integrity -= proj.damage * 0.5;
            if (p.parts[slot]!.integrity <= 0) {
              addLog(`${p.parts[slot]!.name.toUpperCase()} DESTROYED`);
              p.parts[slot] = null;
            }
            break;
          }
        }
        if (p.coreHP <= 0) {
          p.coreHP = 0;
          g.phase = 'gameover';
          addLog('CORE FAILURE — RUN ENDED');
        }
        remove = true;
      }
    }

    if (pm) {
      if (remove) { three.scene.remove(pm); three.projMeshMap.delete(proj.id); }
      else pm.position.set(proj.x, 0.5, proj.z);
    }
    if (remove) g.projectiles.splice(pi, 1);
  }

  // === PARTICLES ===
  for (let pi = three.activeParticles.length - 1; pi >= 0; pi--) {
    const part = three.activeParticles[pi];
    part.life += dt;
    const t = part.life / part.maxLife;
    if (t >= 1) {
      part.mesh.visible = false;
      three.activeParticles.splice(pi, 1);
      continue;
    }
    part.mesh.position.x += part.vx * dt;
    part.mesh.position.y += part.vy * dt;
    part.mesh.position.z += part.vz * dt;
    part.mesh.position.y -= 4 * t * dt; // gravity
    const s = 1 - t;
    part.mesh.scale.setScalar(s);
    (part.mesh.material as THREE.MeshBasicMaterial).opacity = s;
  }
}
