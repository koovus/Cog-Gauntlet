import React from 'react';
import { HudState, MinimapData } from '../game/types';

interface Props {
  hud: HudState;
  minimap: MinimapData;
}

function BarRow({ label, value, max, color, warn }: { label: string; value: number; max: number; color: string; warn?: boolean }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const isLow = pct < 25;
  return (
    <div className="mb-1">
      <div className="flex justify-between text-xs mb-0.5" style={{ color: isLow && warn ? '#ff4444' : '#aaaacc' }}>
        <span>{label}</span>
        <span>{Math.floor(value)}/{max}</span>
      </div>
      <div style={{ background: '#0a0a1a', height: 6, borderRadius: 2, border: '1px solid #2a1a4a' }}>
        <div style={{
          width: `${pct}%`, height: '100%', background: isLow && warn ? '#ff4444' : color,
          borderRadius: 2, transition: 'width 0.1s',
          boxShadow: `0 0 4px ${isLow && warn ? '#ff4444' : color}`,
        }} />
      </div>
    </div>
  );
}

function PartSlot({ label, name, pct, color }: { label: string; name: string | null; pct: number; color: string }) {
  const isLow = pct < 30 && pct > 0;
  return (
    <div className="mb-1" style={{ minWidth: 120 }}>
      <div className="flex justify-between text-xs mb-0.5" style={{ color: '#888899' }}>
        <span style={{ color: '#555577' }}>[{label}]</span>
        <span style={{ color: name ? (isLow ? '#ff4444' : color) : '#333344' }}>
          {name ? name.toUpperCase() : '---'}
        </span>
      </div>
      <div style={{ background: '#0a0a1a', height: 4, borderRadius: 2, border: '1px solid #1a1a3a' }}>
        {name && (
          <div style={{
            width: `${pct}%`, height: '100%', background: isLow ? '#ff4444' : color,
            borderRadius: 2, boxShadow: `0 0 3px ${color}`,
          }} />
        )}
      </div>
    </div>
  );
}

function Minimap({ data }: { data: MinimapData }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const SIZE = 140;
  const SCALE = SIZE / data.gridW;

  React.useEffect(() => {
    const c = canvasRef.current;
    if (!c || !data.tiles) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = '#04040c';
    ctx.fillRect(0, 0, SIZE, SIZE);

    for (let z = 0; z < data.gridH; z++) {
      for (let x = 0; x < data.gridW; x++) {
        if (data.tiles[z][x] === 1) {
          ctx.fillStyle = '#1a1a3a';
          ctx.fillRect(x * SCALE, z * SCALE, SCALE, SCALE);
        }
      }
    }

    data.generatorTiles.forEach(gen => {
      ctx.fillStyle = gen.active ? '#ff2200' : '#442200';
      ctx.beginPath();
      ctx.arc(gen.x * SCALE + SCALE / 2, gen.z * SCALE + SCALE / 2, SCALE * 1.2, 0, Math.PI * 2);
      ctx.fill();
    });

    data.enemyTiles.forEach(e => {
      ctx.fillStyle = '#ff2244';
      ctx.fillRect(e.x * SCALE, e.z * SCALE, SCALE, SCALE);
    });

    // Player
    const px = data.playerTileX * SCALE + SCALE / 2;
    const pz = data.playerTileZ * SCALE + SCALE / 2;
    ctx.fillStyle = '#00ffee';
    ctx.shadowColor = '#00ffee';
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(px, pz, SCALE * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }, [data]);

  return (
    <div style={{
      border: '1px solid #2a0066', background: 'rgba(4,4,12,0.85)',
      padding: 4, borderRadius: 2,
    }}>
      <div className="text-xs mb-1" style={{ color: '#5544aa', fontFamily: 'Share Tech Mono, monospace' }}>
        MINIMAP
      </div>
      <canvas ref={canvasRef} width={SIZE} height={SIZE} />
    </div>
  );
}

export function HUD({ hud, minimap }: Props) {
  const mono = { fontFamily: "'Share Tech Mono', monospace" };

  return (
    <>
      {/* Scanline overlay */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 50,
        background: 'repeating-linear-gradient(to bottom, transparent, transparent 2px, rgba(0,0,0,0.12) 2px, rgba(0,0,0,0.12) 4px)',
      }} />
      {/* Vignette */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 49,
        background: 'radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.75) 100%)',
      }} />

      {/* Top-left: minimap */}
      <div style={{ position: 'fixed', top: 12, left: 12, zIndex: 60, ...mono }}>
        <Minimap data={minimap} />
      </div>

      {/* Top-right: status panel */}
      <div style={{
        position: 'fixed', top: 12, right: 12, zIndex: 60,
        background: 'rgba(4,4,12,0.85)', border: '1px solid #2a0066',
        padding: '10px 14px', borderRadius: 2, minWidth: 180, ...mono,
      }}>
        <div className="text-xs mb-2" style={{ color: '#5544aa' }}>STATUS</div>

        <BarRow label="CORE HP" value={hud.coreHP} max={hud.maxCoreHP} color="#00ffee" warn />
        <BarRow label="ENERGY" value={hud.energy} max={hud.maxEnergy} color="#ffee00" warn />

        <div className="mt-2 mb-1 text-xs" style={{ color: '#5544aa' }}>PARTS</div>
        <PartSlot label="CORE" name={hud.parts.core?.name ?? null} pct={hud.partSlotHP.core} color="#00ffee" />
        <PartSlot label="PROP" name={hud.parts.propulsion?.name ?? null} pct={hud.partSlotHP.propulsion} color="#00cc88" />
        <PartSlot label="WEAP" name={hud.parts.weapon?.name ?? null} pct={hud.partSlotHP.weapon} color="#ff6a00" />
        <PartSlot label="UTIL" name={hud.parts.utility?.name ?? null} pct={hud.partSlotHP.utility} color="#bb44ff" />
      </div>

      {/* Bottom bar */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 60,
        background: 'rgba(4,4,12,0.9)', borderTop: '1px solid #2a0066',
        display: 'flex', alignItems: 'center', padding: '6px 16px', gap: 32, ...mono,
      }}>
        <span style={{ color: '#00ffee', fontSize: 13 }}>
          SCORE: <span style={{ color: '#ffffff' }}>{hud.score.toLocaleString()}</span>
        </span>
        <span style={{ color: '#00ffee', fontSize: 13 }}>
          WAVE: <span style={{ color: '#ffffff' }}>{hud.wave}</span>
        </span>
        <span style={{ color: '#00ffee', fontSize: 13 }}>
          KILLS: <span style={{ color: '#ffffff' }}>{hud.killCount}</span>
        </span>
        <span style={{ color: '#ff2244', fontSize: 13 }}>
          GENERATORS: <span style={{ color: hud.generatorsLeft > 0 ? '#ff4466' : '#00ff88' }}>
            {hud.generatorsLeft > 0 ? `${hud.generatorsLeft} ACTIVE` : 'ALL OFFLINE'}
          </span>
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ color: '#444466', fontSize: 11 }}>WASD MOVE • MOUSE AIM • LMB FIRE</span>
      </div>

      {/* Bottom-right: event log */}
      <div style={{
        position: 'fixed', bottom: 44, right: 12, zIndex: 60,
        background: 'rgba(4,4,12,0.8)', border: '1px solid #1a0044',
        padding: '8px 12px', borderRadius: 2, width: 240, ...mono,
      }}>
        {hud.log.slice(0, 6).map((line, i) => (
          <div key={i} style={{
            color: i === 0 ? '#00ffee' : `rgba(100,100,180,${0.9 - i * 0.15})`,
            fontSize: 11, lineHeight: '18px',
          }}>
            {line}
          </div>
        ))}
      </div>
    </>
  );
}
