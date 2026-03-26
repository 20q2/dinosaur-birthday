import { useEffect, useState } from 'preact/hooks';
import { store } from '../store.js';

/**
 * BossVictory — victory celebration screen shown after Godzilla is defeated.
 * Features confetti particles, "GODZILLA DEFEATED!" header, hat award message.
 */
export function BossVictory() {
  const [particles, setParticles] = useState([]);

  // Generate confetti on mount
  useEffect(() => {
    const colors = ['#f87171', '#fb923c', '#facc15', '#4ade80', '#60a5fa', '#c084fc', '#f472b6'];
    const items = Array.from({ length: 60 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 2,
      duration: 2.5 + Math.random() * 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 6 + Math.floor(Math.random() * 10),
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 720,
    }));
    setParticles(items);
  }, []);

  return (
    <div style={styles.container}>
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translateY(110vh) rotate(var(--rot)); opacity: 0; }
        }
        @keyframes victoryPulse {
          0%, 100% { transform: scale(1); text-shadow: 0 0 30px rgba(74,222,128,0.6); }
          50%       { transform: scale(1.04); text-shadow: 0 0 60px rgba(74,222,128,1); }
        }
        @keyframes hatBounce {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-10px); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .victory-title { animation: victoryPulse 2s ease-in-out infinite; }
        .hat-icon      { animation: hatBounce 1.5s ease-in-out infinite; }
        .fade-in-up    { animation: fadeInUp 0.6s ease-out forwards; }
      `}</style>

      {/* Confetti particles */}
      {particles.map(p => (
        <div
          key={p.id}
          style={{
            position: 'fixed',
            left: `${p.x}%`,
            top: 0,
            width: `${p.size}px`,
            height: `${p.size}px`,
            background: p.color,
            borderRadius: p.id % 3 === 0 ? '50%' : '2px',
            animation: `confettiFall ${p.duration}s ${p.delay}s linear infinite`,
            '--rot': `${p.rotationSpeed}deg`,
            zIndex: 0,
            pointerEvents: 'none',
          }}
        />
      ))}

      {/* Content */}
      <div style={styles.content}>
        {/* Victory header */}
        <div style={styles.victoryEmoji}>🏆</div>
        <h1 class="victory-title fade-in-up" style={styles.victoryTitle}>
          GODZILLA<br />DEFEATED!
        </h1>

        {/* Hat award */}
        <div class="fade-in-up" style={{ ...styles.hatCard, animationDelay: '0.3s' }}>
          <div class="hat-icon" style={styles.hatEmoji}>🎩</div>
          <div style={styles.hatTitle}>Hat Unlocked!</div>
          <div style={styles.hatName}>Kaiju Slayer</div>
          <div style={styles.hatDesc}>
            Awarded to brave dino tamers who<br />
            helped defeat Godzilla!
          </div>
        </div>

        {/* Flavor text */}
        <div class="fade-in-up" style={{ ...styles.flavorText, animationDelay: '0.6s' }}>
          The plaza is safe... for now.
        </div>

        {/* Back button */}
        <button
          class="fade-in-up"
          style={{ ...styles.backBtn, animationDelay: '0.9s' }}
          onClick={() => store.navigate('/plaza')}
        >
          Back to Plaza
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    position: 'relative',
    width: '100%',
    minHeight: '100dvh',
    background: 'radial-gradient(ellipse at center, #052e16 0%, #0a0a0a 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  content: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '40px 24px 100px',
    textAlign: 'center',
    maxWidth: '400px',
    width: '100%',
  },
  victoryEmoji: {
    fontSize: '72px',
    marginBottom: '8px',
  },
  victoryTitle: {
    fontSize: 'clamp(36px, 10vw, 56px)',
    fontWeight: '900',
    color: '#4ade80',
    lineHeight: 1.1,
    letterSpacing: '2px',
    margin: '0 0 24px',
  },
  hatCard: {
    background: 'rgba(250,204,21,0.08)',
    border: '2px solid rgba(250,204,21,0.4)',
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '24px',
    width: '100%',
    boxShadow: '0 0 40px rgba(250,204,21,0.1)',
  },
  hatEmoji: {
    fontSize: '48px',
    marginBottom: '8px',
  },
  hatTitle: {
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#fbbf24',
    letterSpacing: '2px',
    textTransform: 'uppercase',
    marginBottom: '4px',
  },
  hatName: {
    fontSize: '24px',
    fontWeight: '900',
    color: '#facc15',
    textShadow: '0 0 20px rgba(250,204,21,0.5)',
    marginBottom: '8px',
  },
  hatDesc: {
    fontSize: '13px',
    color: '#d97706',
    lineHeight: 1.5,
  },
  flavorText: {
    fontSize: '16px',
    color: 'rgba(255,255,255,0.4)',
    fontStyle: 'italic',
    marginBottom: '32px',
  },
  backBtn: {
    padding: '14px 40px',
    background: 'linear-gradient(135deg, #16a34a, #4ade80)',
    color: '#052e16',
    border: 'none',
    borderRadius: '12px',
    fontWeight: '900',
    fontSize: '16px',
    cursor: 'pointer',
    letterSpacing: '1px',
    boxShadow: '0 4px 20px rgba(74,222,128,0.3)',
    opacity: 0,
  },
};
