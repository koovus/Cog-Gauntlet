import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { DungeonData, PartDef, EnemyType, PickupType } from './types';
import { TILE_SIZE, WALL_HEIGHT, GRID_W, GRID_H, C, FRUSTUM_H } from './constants';

const ScanlineShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    time: { value: 0 },
    resolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform vec2 resolution;
    varying vec2 vUv;
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float lineY = mod(vUv.y * resolution.y, 3.0);
      float scanline = lineY < 1.5 ? 0.88 : 1.0;
      color.rgb *= scanline;
      float vignette = smoothstep(0.9, 0.4, length(vUv - 0.5) * 1.6);
      color.rgb *= mix(0.55, 1.0, vignette);
      color.rgb = pow(color.rgb, vec3(0.95));
      gl_FragColor = color;
    }
  `,
};

export interface ThreeObjects {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  camera: THREE.OrthographicCamera;
  composer: EffectComposer;
  scanlinePass: ShaderPass;
  playerMesh: THREE.Group;
  playerLight: THREE.PointLight;
  enemyMeshMap: Map<string, THREE.Group>;
  generatorMeshMap: Map<string, { mesh: THREE.Group; light: THREE.PointLight }>;
  pickupMeshMap: Map<string, THREE.Group>;
  projMeshMap: Map<string, THREE.Mesh>;
  particlePool: THREE.Mesh[];
  activeParticles: Array<{
    mesh: THREE.Mesh; vx: number; vy: number; vz: number; life: number; maxLife: number;
  }>;
  dungeonGroup: THREE.Group;
  raycaster: THREE.Raycaster;
  floorPlane: THREE.Plane;
  wallInstances: THREE.InstancedMesh | null;
}

let _frustumH = FRUSTUM_H;

export function initThree(canvas: HTMLCanvasElement): ThreeObjects {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(C.background);
  renderer.shadowMap.enabled = false;

  const w = window.innerWidth;
  const h = window.innerHeight;
  _frustumH = FRUSTUM_H;
  const aspect = w / h;

  const camera = new THREE.OrthographicCamera(
    -_frustumH * aspect / 2, _frustumH * aspect / 2,
    _frustumH / 2, -_frustumH / 2,
    0.1, 300
  );
  camera.position.set(0, 80, 0);
  camera.up.set(0, 0, -1);
  camera.lookAt(0, 0, 0);
  renderer.setSize(w, h);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(C.background, 40, 90);

  const hemi = new THREE.HemisphereLight(C.lightAmbient, C.lightGround, 0.4);
  scene.add(hemi);

  const dirCyan = new THREE.DirectionalLight(C.lightCyan, 1.8);
  dirCyan.position.set(-10, 20, -10);
  scene.add(dirCyan);

  const dirMag = new THREE.DirectionalLight(C.lightMagenta, 1.4);
  dirMag.position.set(10, 15, 10);
  scene.add(dirMag);

  const playerMesh = buildPlayerMesh();
  scene.add(playerMesh);

  const playerLight = new THREE.PointLight(C.playerCore, 1.5, 6);
  playerMesh.add(playerLight);
  playerLight.position.set(0, 1, 0);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const scanlinePass = new ShaderPass(ScanlineShader);
  scanlinePass.uniforms.resolution.value.set(w, h);
  composer.addPass(scanlinePass);

  window.addEventListener('resize', () => {
    const nw = window.innerWidth;
    const nh = window.innerHeight;
    renderer.setSize(nw, nh);
    composer.setSize(nw, nh);
    scanlinePass.uniforms.resolution.value.set(nw, nh);
    const na = nw / nh;
    camera.left = -_frustumH * na / 2;
    camera.right = _frustumH * na / 2;
    camera.top = _frustumH / 2;
    camera.bottom = -_frustumH / 2;
    camera.updateProjectionMatrix();
  });

  const particleGeo = new THREE.SphereGeometry(0.12, 4, 4);
  const particlePool: THREE.Mesh[] = [];
  for (let i = 0; i < 200; i++) {
    const pm = new THREE.Mesh(particleGeo, new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true }));
    pm.visible = false;
    scene.add(pm);
    particlePool.push(pm);
  }

  return {
    scene, renderer, camera, composer, scanlinePass,
    playerMesh, playerLight,
    enemyMeshMap: new Map(),
    generatorMeshMap: new Map(),
    pickupMeshMap: new Map(),
    projMeshMap: new Map(),
    particlePool,
    activeParticles: [],
    dungeonGroup: new THREE.Group(),
    raycaster: new THREE.Raycaster(),
    floorPlane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    wallInstances: null,
  };
}

function neonMat(color: number, emissive?: number): THREE.MeshLambertMaterial {
  const mat = new THREE.MeshLambertMaterial({ color });
  if (emissive !== undefined) {
    mat.emissive = new THREE.Color(emissive);
    mat.emissiveIntensity = 0.4;
  }
  return mat;
}

function edgeMesh(geo: THREE.BufferGeometry, color: number): THREE.LineSegments {
  return new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color })
  );
}

export function buildDungeonGeometry(dungeon: DungeonData, three: ThreeObjects) {
  if (three.dungeonGroup.parent) three.dungeonGroup.parent.remove(three.dungeonGroup);
  three.dungeonGroup = new THREE.Group();

  const { tiles, gridW, gridH } = dungeon;
  const totalW = gridW * TILE_SIZE;
  const totalH = gridH * TILE_SIZE;

  const floorGeo = new THREE.PlaneGeometry(totalW, totalH);
  floorGeo.rotateX(-Math.PI / 2);
  floorGeo.translate(totalW / 2, -0.01, totalH / 2);
  const floorMesh = new THREE.Mesh(floorGeo, neonMat(C.floor));
  three.dungeonGroup.add(floorMesh);

  const wallGeo = new THREE.BoxGeometry(TILE_SIZE, WALL_HEIGHT, TILE_SIZE);
  const wallMat = neonMat(C.wall, C.wallTop);
  const walls: THREE.Matrix4[] = [];

  for (let tz = 0; tz < gridH; tz++) {
    for (let tx = 0; tx < gridW; tx++) {
      if (tiles[tz][tx] === 0) {
        const m = new THREE.Matrix4();
        m.setPosition(tx * TILE_SIZE + TILE_SIZE / 2, WALL_HEIGHT / 2, tz * TILE_SIZE + TILE_SIZE / 2);
        walls.push(m);
      }
    }
  }

  if (walls.length > 0) {
    const inst = new THREE.InstancedMesh(wallGeo, wallMat, walls.length);
    walls.forEach((m, i) => inst.setMatrixAt(i, m));
    inst.instanceMatrix.needsUpdate = true;
    three.dungeonGroup.add(inst);
    three.wallInstances = inst;
  }

  three.scene.add(three.dungeonGroup);
}

export function buildPlayerMesh(): THREE.Group {
  const group = new THREE.Group();

  const coreGeo = new THREE.BoxGeometry(0.7, 0.55, 0.7);
  const coreMesh = new THREE.Mesh(coreGeo, neonMat(C.playerCore, C.playerCore));
  coreMesh.position.y = 0.4;
  group.add(coreMesh);
  group.add(edgeMesh(coreGeo.clone().translate(0, 0.4, 0), C.playerCore));

  const propGeo = new THREE.CylinderGeometry(0.35, 0.38, 0.22, 8);
  const propMesh = new THREE.Mesh(propGeo, neonMat(C.playerPropulsion, C.playerPropulsion));
  propMesh.position.set(0, 0.11, 0);
  group.add(propMesh);

  const weapGeo = new THREE.BoxGeometry(0.15, 0.15, 0.6);
  const weapMesh = new THREE.Mesh(weapGeo, neonMat(C.playerWeapon, C.playerWeapon));
  weapMesh.position.set(0, 0.42, 0.4);
  group.add(weapMesh);
  group.add(edgeMesh(weapGeo.clone().translate(0, 0.42, 0.4), C.playerWeapon));

  const utilGeo = new THREE.SphereGeometry(0.2, 6, 6);
  const utilMesh = new THREE.Mesh(utilGeo, neonMat(C.playerUtility, C.playerUtility));
  utilMesh.position.set(0.38, 0.42, 0);
  group.add(utilMesh);

  return group;
}

function getEnemyColor(type: EnemyType): number {
  switch (type) {
    case 'scout': return C.enemyScout;
    case 'heavy': return C.enemyHeavy;
    case 'turret': return C.enemyTurret;
    case 'swarm': return C.enemySwarm;
  }
}

export function buildEnemyMesh(type: EnemyType): THREE.Group {
  const group = new THREE.Group();
  const color = getEnemyColor(type);
  const mat = neonMat(color, color);

  switch (type) {
    case 'scout': {
      const geo = new THREE.OctahedronGeometry(0.42);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = 0.42;
      group.add(mesh);
      group.add(edgeMesh(geo.clone().translate(0, 0.42, 0), color));
      break;
    }
    case 'heavy': {
      const geo = new THREE.BoxGeometry(0.75, 0.65, 0.75);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = 0.5;
      group.add(mesh);
      group.add(edgeMesh(geo.clone().translate(0, 0.5, 0), color));
      break;
    }
    case 'turret': {
      const baseGeo = new THREE.CylinderGeometry(0.4, 0.45, 0.5, 8);
      const baseMesh = new THREE.Mesh(baseGeo, mat);
      baseMesh.position.y = 0.25;
      group.add(baseMesh);
      const barrelGeo = new THREE.BoxGeometry(0.12, 0.12, 0.55);
      const barrelMesh = new THREE.Mesh(barrelGeo, mat);
      barrelMesh.position.set(0, 0.5, 0.3);
      group.add(barrelMesh);
      group.add(edgeMesh(baseGeo.clone().translate(0, 0.25, 0), color));
      break;
    }
    case 'swarm': {
      const geo = new THREE.ConeGeometry(0.28, 0.55, 6);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = 0.3;
      group.add(mesh);
      group.add(edgeMesh(geo.clone().translate(0, 0.3, 0), color));
      break;
    }
  }

  return group;
}

export function buildGeneratorMesh(scene: THREE.Scene): { mesh: THREE.Group; light: THREE.PointLight } {
  const group = new THREE.Group();
  const mat = neonMat(C.generator, C.generatorGlow);

  const baseGeo = new THREE.CylinderGeometry(0.3, 0.4, 1.8, 8);
  const base = new THREE.Mesh(baseGeo, mat);
  base.position.y = 0.9;
  group.add(base);
  group.add(edgeMesh(baseGeo.clone().translate(0, 0.9, 0), C.generatorGlow));

  const topGeo = new THREE.SphereGeometry(0.3, 8, 8);
  const top = new THREE.Mesh(topGeo, new THREE.MeshBasicMaterial({ color: C.generatorGlow }));
  top.position.y = 1.9;
  group.add(top);

  const light = new THREE.PointLight(C.generatorGlow, 2.5, 9);
  light.position.y = 2;
  group.add(light);
  scene.add(group);

  return { mesh: group, light };
}

function getPickupColor(type: PickupType, slot?: string): number {
  if (type === 'energy') return C.energyPickup;
  switch (slot) {
    case 'core': return C.playerCore;
    case 'propulsion': return C.playerPropulsion;
    case 'weapon': return C.playerWeapon;
    case 'utility': return C.playerUtility;
    default: return C.partPickup;
  }
}

export function buildPickupMesh(type: PickupType, partSlot?: string): THREE.Group {
  const group = new THREE.Group();
  const color = getPickupColor(type, partSlot);

  if (type === 'energy') {
    const geo = new THREE.SphereGeometry(0.22, 8, 8);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color }));
    mesh.position.y = 0.4;
    group.add(mesh);
    const light = new THREE.PointLight(color, 1.5, 3);
    light.position.y = 0.5;
    group.add(light);
  } else {
    const geo = new THREE.BoxGeometry(0.32, 0.32, 0.32);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color }));
    mesh.position.y = 0.4;
    group.add(mesh);
    group.add(edgeMesh(geo.clone().translate(0, 0.4, 0), color));
  }

  return group;
}

export function buildProjectileMesh(isPlayer: boolean): THREE.Mesh {
  const color = isPlayer ? C.projPlayer : C.projEnemy;
  const geo = new THREE.SphereGeometry(isPlayer ? 0.14 : 0.12, 5, 5);
  const mat = new THREE.MeshBasicMaterial({ color });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.5;
  return mesh;
}

export function spawnParticle(three: ThreeObjects, x: number, z: number, color: number) {
  const particle = three.particlePool.find(p => !p.visible);
  if (!particle) return;

  (particle.material as THREE.MeshBasicMaterial).color.setHex(color);
  particle.position.set(x, 0.3 + Math.random() * 0.5, z);
  particle.visible = true;

  const speed = 2.5 + Math.random() * 3.5;
  const angle = Math.random() * Math.PI * 2;
  const vy = 1.5 + Math.random() * 2.5;

  three.activeParticles.push({
    mesh: particle,
    vx: Math.cos(angle) * speed,
    vy,
    vz: Math.sin(angle) * speed,
    life: 0,
    maxLife: 0.4 + Math.random() * 0.35,
  });
}

export function updateCameraFollow(camera: THREE.OrthographicCamera, playerX: number, playerZ: number, dt: number) {
  const lerpFactor = Math.min(1, 8 * dt);
  camera.position.x += (playerX - camera.position.x) * lerpFactor;
  camera.position.z += (playerZ - camera.position.z) * lerpFactor;
}

export function getAimPoint(
  three: ThreeObjects,
  mouseX: number, mouseY: number,
): THREE.Vector3 | null {
  const ndcX = (mouseX / window.innerWidth) * 2 - 1;
  const ndcY = -(mouseY / window.innerHeight) * 2 + 1;
  three.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), three.camera);
  const target = new THREE.Vector3();
  const hit = three.raycaster.ray.intersectPlane(three.floorPlane, target);
  return hit ? target : null;
}

export function updatePartsMeshes(playerMesh: THREE.Group, parts: { weapon: PartDef | null; utility: PartDef | null }) {
  // weapon child index 2, util child index 3 - just scale to show/hide
}
