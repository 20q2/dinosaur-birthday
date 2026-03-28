import { useEffect, useState } from 'preact/hooks';
import { ws } from '../ws.js';
import { Flame, Zap } from 'lucide-preact';

/**
 * BossBanner — global overlay that appears during boss buildup phases.
 * Phase 1 (shadows): dark overlay sweeps across screen
 * Phase 2 (tremors): screen shake animation
 * Phase 3 (roar): full screen flash with "ROOOOAR" text
 */
export function BossBanner() {
  const [phase, setPhase] = useState(null); // null | 1 | 2 | 3

  useEffect(() => {
    const off = ws.on('plaza', 'buildup', (data) => {
      setPhase(data.phase);
      // Auto-dismiss after animation completes
      const duration = data.phase === 3 ? 3500 : 2500;
      setTimeout(() => setPhase(null), duration);
    });
    return () => off();
  }, []);

  if (!phase) return null;

  if (phase === 1) return <ShadowsOverlay />;
  if (phase === 2) return <TremorsOverlay />;
  if (phase === 3) return <RoarOverlay />;
  return null;
}

function ShadowsOverlay() {
  return (
    <div style={styles.overlay}>
      <style>{`
        @keyframes shadowSweep {
          0%   { transform: translateX(-110%); opacity: 0.9; }
          50%  { transform: translateX(0%);    opacity: 1;   }
          100% { transform: translateX(110%);  opacity: 0;   }
        }
        .shadow-sweep {
          animation: shadowSweep 2.5s ease-in-out forwards;
        }
      `}</style>
      <div class="shadow-sweep" style={styles.shadowPanel} />
      <div style={styles.shadowText}>Something stirs in the darkness...</div>
    </div>
  );
}

function TremorsOverlay() {
  return (
    <div style={styles.tremorsOverlay}>
      <style>{`
        @keyframes shake {
          0%   { transform: translate(0, 0) rotate(0deg); }
          10%  { transform: translate(-4px, -2px) rotate(-0.5deg); }
          20%  { transform: translate(4px, 2px) rotate(0.5deg); }
          30%  { transform: translate(-4px, 2px) rotate(0deg); }
          40%  { transform: translate(4px, -2px) rotate(0.5deg); }
          50%  { transform: translate(-4px, -4px) rotate(-0.5deg); }
          60%  { transform: translate(4px, 4px) rotate(0deg); }
          70%  { transform: translate(-4px, 2px) rotate(-0.5deg); }
          80%  { transform: translate(4px, -2px) rotate(0.5deg); }
          90%  { transform: translate(-4px, 0) rotate(0deg); }
          100% { transform: translate(0, 0) rotate(0deg); }
        }
        .screen-shake {
          animation: shake 0.5s linear infinite;
          animation-duration: 2.5s;
          animation-fill-mode: forwards;
        }
      `}</style>
      <div class="screen-shake" style={styles.tremorsInner}>
        <div style={styles.tremorsText}>The ground trembles...</div>
        <Flame size={48} color="#ffaa00" style={{ marginTop: '16px' }} />
      </div>
    </div>
  );
}

function RoarOverlay() {
  return (
    <div style={styles.roarOverlay}>
      <style>{`
        @keyframes roarFlash {
          0%   { opacity: 0; background: #ff0000; }
          10%  { opacity: 1; background: #ff4400; }
          25%  { opacity: 0.8; background: #ff0000; }
          50%  { opacity: 1; background: #cc0000; }
          75%  { opacity: 0.9; background: #880000; }
          100% { opacity: 0; background: #440000; }
        }
        @keyframes roarText {
          0%   { transform: scale(0.5); opacity: 0; }
          20%  { transform: scale(1.3); opacity: 1; }
          40%  { transform: scale(1.0); opacity: 1; }
          80%  { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(2.0); opacity: 0; }
        }
        .roar-bg {
          animation: roarFlash 3.5s ease-in-out forwards;
        }
        .roar-text {
          animation: roarText 3.5s ease-out forwards;
        }
      `}</style>
      <div class="roar-bg" style={styles.roarBg} />
      <div style={styles.roarContent}>
        <div class="roar-text" style={styles.roarTextBig}>ROOOOAR!</div>
        <div class="roar-text" style={{ ...styles.roarSubText, animationDelay: '0.3s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <Zap size={28} color="#ffdd00" /> GODZILLA IS COMING! <Zap size={28} color="#ffdd00" />
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    pointerEvents: 'none',
    overflow: 'hidden',
  },
  shadowPanel: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(90deg, transparent, rgba(0,0,0,0.85) 40%, rgba(0,0,0,0.95) 60%, transparent)',
    width: '150%',
    height: '100%',
  },
  shadowText: {
    position: 'absolute',
    bottom: '30%',
    left: '50%',
    transform: 'translateX(-50%)',
    color: '#aaa',
    fontSize: '20px',
    fontStyle: 'italic',
    textShadow: '0 0 20px rgba(255,100,0,0.5)',
    whiteSpace: 'nowrap',
  },
  tremorsOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    pointerEvents: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tremorsInner: {
    textAlign: 'center',
  },
  tremorsText: {
    fontSize: '24px',
    color: '#ffaa00',
    fontWeight: 'bold',
    textShadow: '0 0 10px rgba(255,170,0,0.8)',
  },
  roarOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    pointerEvents: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roarBg: {
    position: 'absolute',
    inset: 0,
  },
  roarContent: {
    position: 'relative',
    textAlign: 'center',
    zIndex: 1,
  },
  roarTextBig: {
    fontSize: 'clamp(48px, 12vw, 96px)',
    fontWeight: '900',
    color: '#fff',
    textShadow: '0 0 30px #ff4400, 0 0 60px #ff0000',
    letterSpacing: '4px',
  },
  roarSubText: {
    fontSize: 'clamp(20px, 5vw, 32px)',
    color: '#ffdd00',
    fontWeight: 'bold',
    marginTop: '16px',
    textShadow: '0 0 20px rgba(255,221,0,0.8)',
  },
};
