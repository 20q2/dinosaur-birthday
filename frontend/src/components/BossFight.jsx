import { useEffect, useRef, useState } from 'preact/hooks';
import { api } from '../api.js';
import { ws } from '../ws.js';
import { store } from '../store.js';
import { useStore } from '../router.jsx';
import { Skull } from 'lucide-preact';
import { BossFightCanvas } from './BossFightCanvas.js';
import godzillaUrl from '../assets/sprites/godzilla.png';

const TAP_THROTTLE_MS = 333; // ~3 taps/sec

/**
 * BossFight — full-screen tap-to-attack boss fight screen.
 * Shows Godzilla in a raid-style arena with all plaza dinos surrounding it.
 * Player's tamed dinos occupy the front arc and lunge on every tap.
 */
export function BossFight() {
  const { bossState, player, playerId } = useStore();
  const [localHp, setLocalHp] = useState(null);
  const [maxHp, setMaxHp] = useState(null);
  const [damageNumbers, setDamageNumbers] = useState([]);
  const [plazaPartners, setPlazaPartners] = useState([]);
  const [showVictoryOverlay, setShowVictoryOverlay] = useState(false);
  const lastTapRef = useRef(0);
  const idCounter  = useRef(0);
  const canvasRef  = useRef(null);
  const arenaRef   = useRef(null);   // BossFightCanvas instance
  const godzImgRef = useRef(null);   // preloaded Image

  // Sync HP from store
  useEffect(() => {
    if (bossState) {
      setLocalHp(bossState.hp ?? null);
      setMaxHp(bossState.max_hp ?? bossState.maxHp ?? null);
    }
  }, [bossState]);

  // Navigate to victory when boss is defeated
  useEffect(() => {
    if (bossState?.status === 'defeated') {
      if (arenaRef.current) arenaRef.current.setDefeated(true);
      // Show "VICTORY!" overlay after fall animation completes (~1.6s)
      const overlayTimer = setTimeout(() => setShowVictoryOverlay(true), 1600);
      // Navigate to victory screen after players appreciate the fall (~3s)
      const navTimer = setTimeout(() => store.navigate('/boss/victory'), 3000);
      return () => { clearTimeout(overlayTimer); clearTimeout(navTimer); };
    }
  }, [bossState?.status]);

  // Preload Godzilla image then mount the arena canvas
  useEffect(() => {
    const img = new Image();
    img.src = godzillaUrl;
    godzImgRef.current = img;

    const init = () => {
      if (!canvasRef.current) return;
      const myDinos = (player?.dinos ?? [])
        .filter(d => d.tamed)
        .map(d => ({
          ...d,
          player_id:   playerId,
          owner_name:  player?.name,
          owner_photo: player?.photo_url,
        }));

      const arena = new BossFightCanvas(canvasRef.current, {
        plazaDinos: [],
        myDinos,
        godzillaImg: img,
      });
      arenaRef.current = arena;
      arena.start();
    };

    if (img.complete) {
      init();
    } else {
      img.onload = init;
    }

    return () => {
      if (arenaRef.current) { arenaRef.current.destroy(); arenaRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch plaza partners and listen for live updates
  useEffect(() => {
    api.getPlaza().then(data => {
      const partners = data.partners || [];
      setPlazaPartners(partners);
      if (arenaRef.current) arenaRef.current.updatePlazaDinos(partners);
    }).catch(() => {});

    const offArrive = ws.on('plaza', 'dino_arrive', (data) => {
      setPlazaPartners(prev => {
        const updated = [...prev.filter(p => p.player_id !== data.player_id), data];
        if (arenaRef.current) arenaRef.current.updatePlazaDinos(updated);
        return updated;
      });
    });
    const offLeave = ws.on('plaza', 'dino_leave', (data) => {
      setPlazaPartners(prev => {
        const updated = prev.filter(p => p.player_id !== data.player_id);
        if (arenaRef.current) arenaRef.current.updatePlazaDinos(updated);
        return updated;
      });
    });

    return () => { offArrive(); offLeave(); };
  }, []);

  // Keep my dinos in sync when player data changes
  useEffect(() => {
    if (!arenaRef.current || !player) return;
    const myDinos = (player.dinos ?? [])
      .filter(d => d.tamed)
      .map(d => ({
        ...d,
        player_id:   playerId,
        owner_name:  player.name,
        owner_photo: player.photo_url,
      }));
    arenaRef.current.updateMyDinos(myDinos);
  }, [player, playerId]);

  const handleTap = async (e) => {
    const now = Date.now();
    if (now - lastTapRef.current < TAP_THROTTLE_MS) return;
    lastTapRef.current = now;

    if (!playerId) return;

    // Trigger attack animation immediately (before API resolves)
    if (arenaRef.current) arenaRef.current.triggerAttack();

    // Get tap coordinates for floating damage number
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX || rect.width / 2) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY || rect.height / 2) - rect.top;

    try {
      const result = await api.bossTap(playerId);
      const dmg    = result.damage ?? 0;
      const newHp  = result.hp ?? 0;

      setLocalHp(newHp);

      const id = ++idCounter.current;
      setDamageNumbers(prev => [...prev, { id, dmg, x, y }]);
      setTimeout(() => {
        setDamageNumbers(prev => prev.filter(n => n.id !== id));
      }, 1200);

      if (dmg >= 20) {
        if (arenaRef.current) arenaRef.current.setShaking(true);
        setTimeout(() => {
          if (arenaRef.current) arenaRef.current.setShaking(false);
        }, 400);
      }
    } catch {
      // Tap failed (throttled by server or fight over), ignore
    }
  };

  const hp  = localHp ?? bossState?.hp ?? 0;
  const max = maxHp ?? bossState?.max_hp ?? bossState?.maxHp ?? 1;
  const hpPct = Math.max(0, Math.min(100, (hp / max) * 100));

  const isDefeated = hp <= 0 || bossState?.status === 'defeated';

  return (
    <div
      style={styles.container}
      onClick={!isDefeated ? handleTap : undefined}
      onTouchStart={!isDefeated ? handleTap : undefined}
    >
      <style>{`
        @keyframes floatUp {
          0%   { opacity: 1; transform: translateY(0) scale(1); }
          50%  { opacity: 1; transform: translateY(-40px) scale(1.2); }
          100% { opacity: 0; transform: translateY(-80px) scale(0.8); }
        }
        @keyframes hpBarPulse {
          0%   { filter: brightness(1); }
          50%  { filter: brightness(1.3); }
          100% { filter: brightness(1); }
        }
        .dmg-float { animation: floatUp 1.2s ease-out forwards; position: absolute; pointer-events: none; }
        .hp-pulse  { animation: hpBarPulse 0.5s ease-in-out; }
      `}</style>

      {/* Arena canvas — full screen */}
      <canvas ref={canvasRef} style={styles.arenaCanvas} />

      {/* Header — top overlay */}
      <div style={styles.header}>
        <div style={styles.bossTitle}>GODZILLA ATTACKS!</div>
        <div style={styles.bossSubtitle}>Tap anywhere to fight back!</div>
      </div>

      {/* UI overlay — HP bar, stats, tap hint at bottom */}
      <div style={styles.uiOverlay}>
        <div style={styles.hpSection}>
          <div style={styles.hpLabel}>
            <span>GODZILLA HP</span>
            <span style={{ color: hpPct < 25 ? '#f87171' : '#4ade80' }}>
              {hp} / {max}
            </span>
          </div>
          <div style={styles.hpBarBg}>
            <div
              style={{
                ...styles.hpBarFill,
                width: `${hpPct}%`,
                background: hpPct < 25
                  ? 'linear-gradient(90deg, #ef4444, #f87171)'
                  : hpPct < 50
                    ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                    : 'linear-gradient(90deg, #16a34a, #4ade80)',
              }}
            />
          </div>
        </div>
        <div style={styles.flavorText}>
          Your tamed dinosaurs are joining in on the fight!
        </div>
        {!isDefeated && <div style={styles.tapHint}>TAP TO ATTACK!</div>}
      </div>

      {/* Victory overlay — delayed so fall animation is visible */}
      {showVictoryOverlay && (
        <div style={styles.defeatedOverlay}>
          <div style={styles.defeatedText}>VICTORY!</div>
        </div>
      )}

      {/* Floating damage numbers */}
      {damageNumbers.map(({ id, dmg, x, y }) => (
        <div
          key={id}
          class="dmg-float"
          style={{
            left: x,
            top: y,
            fontSize: dmg >= 20 ? '32px' : '24px',
            fontWeight: 'bold',
            color: dmg >= 20 ? '#ffdd00' : '#ffffff',
            textShadow: '0 0 8px rgba(0,0,0,0.8)',
            zIndex: 100,
          }}
        >
          -{dmg}
        </div>
      ))}
    </div>
  );
}

const styles = {
  container: {
    position: 'relative',
    width: '100%',
    height: '100dvh',
    background: 'radial-gradient(ellipse at center, #1a0505 0%, #0d0d0d 100%)',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    cursor: 'crosshair',
    overflow: 'hidden',
  },
  arenaCanvas: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    display: 'block',
    pointerEvents: 'none',
  },
  header: {
    position: 'absolute',
    top: '20px',
    left: 0,
    right: 0,
    textAlign: 'center',
    pointerEvents: 'none',
    zIndex: 10,
  },
  bossTitle: {
    fontSize: '28px',
    fontWeight: '900',
    color: '#f87171',
    textShadow: '0 0 20px rgba(248,113,113,0.6)',
    letterSpacing: '2px',
  },
  bossSubtitle: {
    fontSize: '14px',
    color: '#fca5a5',
    marginTop: '4px',
  },
  uiOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: '12px 16px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)',
    pointerEvents: 'none',
    zIndex: 10,
  },
  hpSection: {
    width: '100%',
    maxWidth: '400px',
  },
  hpLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#d1d5db',
    marginBottom: '6px',
  },
  hpBarBg: {
    width: '100%',
    height: '20px',
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '10px',
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.15)',
  },
  hpBarFill: {
    height: '100%',
    borderRadius: '10px',
    transition: 'width 0.4s ease-out',
  },
  flavorText: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.55)',
    fontStyle: 'italic',
    textAlign: 'center',
    letterSpacing: '0.3px',
  },
  tapHint: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: '3px',
    animation: 'hpBarPulse 1.5s ease-in-out infinite',
  },
  defeatedOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.3)',
    zIndex: 50,
  },
  defeatedText: {
    fontSize: 'clamp(48px, 15vw, 80px)',
    fontWeight: '900',
    color: '#4ade80',
    textShadow: '0 0 40px rgba(74,222,128,0.7)',
    letterSpacing: '4px',
  },
};
