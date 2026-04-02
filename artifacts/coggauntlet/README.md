# CogGauntlet

A browser-based dungeon crawler combining the horde-combat feel of **Gauntlet** with the modular robot survival of **Cogmind**. You are a robot chassis fighting through procedurally generated dungeons, scrapping enemy parts to upgrade yourself, and destroying the generators that endlessly feed the horde.

---

## Aesthetic

CogGauntlet renders entirely in **Three.js** — no sprites or textures. The look is ASCII-meets-low-poly:

- Near-black background (`#050508`) with neon terminal colors (cyan, orange, violet, red)
- Flat-shaded geometry with `EdgesGeometry` wireframe outlines
- Post-processing scanline shader via `EffectComposer` (per-row darkening + radial vignette + gamma correction)
- `Share Tech Mono` monospace font throughout the UI
- All geometry is procedural Three.js primitives — no external 3D assets

The camera is a top-down orthographic view that follows the player smoothly.

---

## Controls

| Input | Action |
|---|---|
| `W A S D` | Move |
| Mouse | Aim (the player always faces the cursor) |
| `Left Mouse Button` | Fire |

---

## Objective

Each dungeon contains **Generators** — pulsing red structures that endlessly spawn enemies. Your goal is to destroy them all. A wave ends either when you destroy every active generator **or** when the 75-second wave timer expires. Each new wave scales up the enemy threat.

---

## Core Systems

### Dungeon Generation
Dungeons are procedurally built each run using **Binary Space Partitioning (BSP)**. The 50×50 tile grid is recursively split into rooms connected by L-shaped corridors. Each room can host one generator. The player always starts in a safe central room.

### Energy & Survival
Your robot runs on energy. Energy drains constantly at a rate determined by your equipped parts. When energy hits zero:
- Your **Core HP** begins bleeding at 8 HP/s
- Log messages warn you: `ENERGY CRITICAL!`
- Core HP hitting zero ends the run

Pick up glowing **yellow energy cells** dropped by killed enemies (45% drop chance) to stay alive.

### Parts System
Your chassis has four equipment slots:

| Slot | Color | Effect |
|---|---|---|
| **Core** | Cyan | Base HP pool and energy drain modifier |
| **Propulsion** | Green | Movement speed |
| **Weapon** | Orange | Damage and fire rate |
| **Utility** | Violet | Additional energy/mobility bonuses |

Parts drop from destroyed enemies (12% chance) and appear as spinning green pickups. Walk over one to auto-equip it — the game always equips a part if the incoming piece has higher max integrity than what you're carrying. You start the run with basic versions of Core, Propulsion, and Weapon (no Utility).

**Available parts:**

*Core:* Basic Core, Military Core, Research Core, Tactical Core, Salvage Core

*Propulsion:* Basic Treads, Light Treads, Heavy Tracks, Mag-Lev Pod, Crawler Legs

*Weapon:* Basic Blaster, Plasma Cannon, Ion Beam, Scatter Shot, Heavy Rail

*Utility:* Shield Cell, Sensor Array, Repair Module

Parts have **integrity** — taking hits degrades the most recently hit part. A part destroyed at zero integrity falls off and leaves that slot empty.

### Generators
Generators have 35 HP and can be destroyed two ways:

- **Shooting** — projectile hits deal damage and award 200 pts
- **Ramming** — walking within 1 unit destroys instantly for 150 pts, but deals 8 chip damage to your Core

Active generators pulse with a red glow and spawn enemies every ~5 seconds. **Destroyed generators stay destroyed** across waves — progress carries forward.

### Wave Progression
- Wave advances every **75 seconds** OR when all active generators are cleared
- Each wave scales the number of active generators and spawns a new one in an unoccupied room
- Enemy stats and spawn rates scale with the wave number

---

## Enemy Types

| Enemy | Color | HP | Speed | Behavior |
|---|---|---|---|---|
| **Scout** | Bright red | 14 | Fast (3.8) | Quick flanker, ranged fire |
| **Heavy** | Dark red | 50 | Slow (2.0) | High damage, tough |
| **Turret** | Orange-red | 25 | Stationary | Long range (14u), high fire rate |
| **Swarm** | Hot pink | 8 | Very fast (5.5) | Melee-only, rushes in groups |

All enemies use **BFS pathfinding** through the dungeon tile graph, recalculated every ~0.45–0.6 seconds with slight randomization to avoid lock-step behavior. Enemies flash white when hit and leave particle explosion effects on death.

---

## Scoring

| Event | Points |
|---|---|
| Enemy killed | 50 + (wave × 10) |
| Generator shot destroyed | 200 |
| Generator rammed | 150 |
| Energy pickup collected | 5 |
| Part equipped | 15 |

The game-over screen shows your final score, kill count, wave reached, parts installed count, and final loadout.

---

## HUD

- **Top-left** — Minimap (140×140 canvas): floor tiles, player (cyan dot), enemies (red), active generators (bright red), destroyed generators (dark red)
- **Top-right** — Status panel: Core HP bar, Energy bar, four part slots with integrity bars
- **Bottom bar** — Score, Wave, Kills, Generator count
- **Bottom-right** — Event log (last 6 messages, fading with age)

---

## Tech Stack

- **React + Vite** (TypeScript)
- **Three.js** — scene, orthographic camera, instanced geometry, post-processing
- `EffectComposer` → `RenderPass` → custom `ScanlineShader` (`ShaderPass`)
- All mutable game state lives in `useRef` (zero re-renders per frame)
- HUD and minimap update at ~10 Hz via `useState`
- No external game engine — pure Three.js game loop via `requestAnimationFrame`

---

## Project Structure

```
src/
  App.tsx              — Menu, GameOver, and canvas mount
  hooks/
    useGame.ts         — Entire game loop (~760 lines)
  game/
    constants.ts       — Tuning values and color palette
    types.ts           — All TypeScript interfaces
    dungeon.ts         — BSP dungeon generation + BFS pathfinding
    parts.ts           — Part definitions and stat calculations
    sceneBuilder.ts    — Three.js scene construction and mesh builders
  components/
    HUD.tsx            — All in-game UI (HUD, minimap, overlays)
```

---

## Running Locally

```bash
pnpm --filter @workspace/coggauntlet run dev
```

Requires a browser with **WebGL and hardware acceleration enabled**. The game will display a `SYSTEM ERROR` screen if WebGL is unavailable (e.g. in headless/sandboxed environments).
