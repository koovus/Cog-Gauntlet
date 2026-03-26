import { useRef } from 'react';
import { useGame } from './hooks/useGame';
import { HUD } from './components/HUD';
import { HudState } from './game/types';

function MenuScreen({ onStart }: { onStart: () => void }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 80, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(5,5,8,0.88)',
      fontFamily: "'Share Tech Mono', monospace",
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: '#5544aa', letterSpacing: 6, marginBottom: 8 }}>
          COGTECH INDUSTRIES INC.
        </div>
        <div style={{
          fontSize: 58, fontWeight: 'bold', lineHeight: 1, marginBottom: 4,
          background: 'linear-gradient(135deg, #00ffee, #aa44ff)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          filter: 'drop-shadow(0 0 20px rgba(0,255,238,0.4))',
        }}>
          COG
        </div>
        <div style={{
          fontSize: 58, fontWeight: 'bold', lineHeight: 1, marginBottom: 20,
          background: 'linear-gradient(135deg, #ff6a00, #ff2244)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          filter: 'drop-shadow(0 0 20px rgba(255,106,0,0.4))',
        }}>
          GAUNTLET
        </div>

        <div style={{ color: '#444466', fontSize: 12, marginBottom: 40, lineHeight: 1.8 }}>
          MODULAR ROBOT HORDE SURVIVOR<br />
          DESTROY GENERATORS · COLLECT PARTS · SURVIVE
        </div>

        <button
          onClick={onStart}
          style={{
            background: 'transparent', border: '2px solid #00ffee', color: '#00ffee',
            fontFamily: "'Share Tech Mono', monospace", fontSize: 15,
            padding: '12px 36px', cursor: 'pointer', letterSpacing: 3,
            boxShadow: '0 0 20px rgba(0,255,238,0.3), inset 0 0 20px rgba(0,255,238,0.05)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => {
            (e.target as HTMLButtonElement).style.background = 'rgba(0,255,238,0.12)';
            (e.target as HTMLButtonElement).style.boxShadow = '0 0 30px rgba(0,255,238,0.5), inset 0 0 30px rgba(0,255,238,0.1)';
          }}
          onMouseLeave={e => {
            (e.target as HTMLButtonElement).style.background = 'transparent';
            (e.target as HTMLButtonElement).style.boxShadow = '0 0 20px rgba(0,255,238,0.3), inset 0 0 20px rgba(0,255,238,0.05)';
          }}
        >
          INITIALIZE RUN
        </button>

        <div style={{ marginTop: 40, color: '#333355', fontSize: 11, lineHeight: 2 }}>
          WASD · MOVE &nbsp;|&nbsp; MOUSE · AIM &nbsp;|&nbsp; LMB · FIRE<br />
          WALK OVER ITEMS TO COLLECT &nbsp;|&nbsp; SHOOT GENERATORS TO DISABLE
        </div>
      </div>
    </div>
  );
}

function GameOverScreen({ hud, onRestart }: { hud: HudState; onRestart: () => void }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 80, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(5,5,8,0.9)',
      fontFamily: "'Share Tech Mono', monospace",
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 44, color: '#ff2244', marginBottom: 8, letterSpacing: 4,
          textShadow: '0 0 30px rgba(255,34,68,0.6)' }}>
          CORE FAILURE
        </div>
        <div style={{ color: '#5544aa', fontSize: 13, marginBottom: 32 }}>UNIT DESTROYED</div>

        <div style={{
          background: 'rgba(10,10,20,0.8)', border: '1px solid #2a0066',
          padding: '20px 40px', marginBottom: 32, minWidth: 280,
        }}>
          <div style={{ color: '#888899', fontSize: 12, marginBottom: 16 }}>FINAL REPORT</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 32px', textAlign: 'left' }}>
            <span style={{ color: '#5544aa', fontSize: 12 }}>SCORE</span>
            <span style={{ color: '#00ffee', fontSize: 13 }}>{hud.score.toLocaleString()}</span>
            <span style={{ color: '#5544aa', fontSize: 12 }}>KILLS</span>
            <span style={{ color: '#00ffee', fontSize: 13 }}>{hud.killCount}</span>
            <span style={{ color: '#5544aa', fontSize: 12 }}>WAVE REACHED</span>
            <span style={{ color: '#00ffee', fontSize: 13 }}>{hud.wave}</span>
            <span style={{ color: '#5544aa', fontSize: 12 }}>PARTS INSTALLED</span>
            <span style={{ color: '#ff9900', fontSize: 13 }}>{hud.partsEquipped}</span>
          </div>
          {hud.partsEquipped > 0 && (
            <div style={{ marginTop: 12, borderTop: '1px solid #2a0066', paddingTop: 10 }}>
              <div style={{ color: '#888899', fontSize: 11, marginBottom: 6 }}>FINAL LOADOUT</div>
              {(['core', 'propulsion', 'weapon', 'utility'] as const).map(slot => (
                hud.parts[slot] ? (
                  <div key={slot} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ color: '#444466', fontSize: 11, textTransform: 'uppercase' }}>{slot}</span>
                    <span style={{ color: '#aa88ff', fontSize: 11 }}>{hud.parts[slot]!.name}</span>
                  </div>
                ) : null
              ))}
            </div>
          )}
        </div>

        <button
          onClick={onRestart}
          style={{
            background: 'transparent', border: '2px solid #ff2244', color: '#ff2244',
            fontFamily: "'Share Tech Mono', monospace", fontSize: 14,
            padding: '10px 32px', cursor: 'pointer', letterSpacing: 3,
            boxShadow: '0 0 20px rgba(255,34,68,0.3)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => {
            (e.target as HTMLButtonElement).style.background = 'rgba(255,34,68,0.12)';
          }}
          onMouseLeave={e => {
            (e.target as HTMLButtonElement).style.background = 'transparent';
          }}
        >
          REBOOT
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { hudState, minimapData, startNewRun, webglError } = useGame(canvasRef);

  if (webglError) {
    return (
      <div style={{
        width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#050508', fontFamily: "'Share Tech Mono', monospace", textAlign: 'center', padding: 32,
      }}>
        <div>
          <div style={{ fontSize: 28, color: '#ff2244', marginBottom: 16 }}>SYSTEM ERROR</div>
          <div style={{ color: '#888899', fontSize: 14, lineHeight: 1.8 }}>
            WebGL is required to run CogGauntlet.<br />
            Please use a modern browser with hardware acceleration enabled.
          </div>
          <div style={{ color: '#444466', fontSize: 12, marginTop: 16 }}>
            {webglError}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      width: '100vw', height: '100vh', overflow: 'hidden',
      background: '#050508', position: 'relative', cursor: 'crosshair',
    }}>
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
      />

      {hudState.phase !== 'menu' && (
        <HUD hud={hudState} minimap={minimapData} />
      )}

      {hudState.phase === 'menu' && <MenuScreen onStart={startNewRun} />}
      {hudState.phase === 'gameover' && (
        <GameOverScreen hud={hudState} onRestart={startNewRun} />
      )}
    </div>
  );
}
