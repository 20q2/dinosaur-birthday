import { useEffect, useRef, useState } from 'preact/hooks';
import { api } from '../api.js';
import { ws } from '../ws.js';
import { store } from '../store.js';
import { PlazaCanvas } from './PlazaCanvas.js';
import { TitleBar } from './TitleBar.jsx';
import { FEED_ICONS } from '../data/icons.js';
import { Leaf, Footprints } from 'lucide-preact';

// Inject feed animations once
if (typeof document !== 'undefined' && !document.getElementById('feed-anim-styles')) {
  const sheet = document.createElement('style');
  sheet.id = 'feed-anim-styles';
  sheet.textContent = `
    @keyframes feedSlideIn {
      from { opacity: 0; transform: translateX(-30px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    @keyframes feedShrinkOut {
      from { opacity: 1; max-height: 28px; margin-bottom: 3px; }
      to   { opacity: 0; max-height: 0px; margin-bottom: 0px; }
    }
  `;
  document.head.appendChild(sheet);
}

const RECENT_PLAYS_KEY = 'dino_party_recent_plays';

function getActiveCooldownIds() {
  try {
    const entries = JSON.parse(localStorage.getItem(RECENT_PLAYS_KEY) || '[]');
    const now = Date.now();
    return entries.filter(e => e.expiresAt > now && e.partnerId).map(e => e.partnerId);
  } catch { return []; }
}

export function Plaza() {
  const canvasRef = useRef(null);
  const plazaRef = useRef(null);
  const [partners, setPartners] = useState([]);
  const [feedEntries, setFeedEntries] = useState(() =>
    store.feedEntries.slice(0, 5).map(e => ({ ...e, arrivedAt: Date.now() }))
  );
  const [cooldownIds, setCooldownIds] = useState(() => getActiveCooldownIds());

  // Initial load + canvas setup
  useEffect(() => {
    api.getPlaza().then(data => {
      setPartners(data.partners || []);
    }).catch(() => {});
  }, []);

  // Create canvas once on mount
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const plaza = new PlazaCanvas(canvas, [], () => {});
    plazaRef.current = plaza;
    plaza.start();
    return () => plaza.stop();
  }, []);

  // Push partner updates into the existing canvas instance
  useEffect(() => {
    if (plazaRef.current) plazaRef.current.updatePartners(partners);
  }, [partners]);

  // Wire real-time plaza updates
  useEffect(() => {
    const offArrive = ws.on('plaza', 'dino_arrive', (data) => {
      console.log('[Plaza] dino_arrive ws event', data.player_id, 'plazaRef?', !!plazaRef.current);
      // Schedule drop-in BEFORE updatePartners so _pendingDropIns is populated
      // when the new dino gets built (survives any subsequent rebuild).
      if (plazaRef.current) plazaRef.current.dropInDino(data.player_id);
      setPartners(prev => {
        const updated = [...prev.filter(p => p.player_id !== data.player_id), data];
        if (plazaRef.current) plazaRef.current.updatePartners(updated);
        return updated;
      });
    });
    const offLeave = ws.on('plaza', 'dino_leave', (data) => {
      if (plazaRef.current) plazaRef.current.fadeOutDino(data.player_id);
      setPartners(prev => {
        const updated = prev.filter(p => p.player_id !== data.player_id);
        if (plazaRef.current) plazaRef.current.updatePartners(updated);
        return updated;
      });
    });

    const offPartnerUpdate = ws.on('plaza', 'partner_update', (data) => {
      setPartners(prev => {
        const updated = prev.map(p =>
          p.player_id === data.player_id
            ? { ...p, ...data }
            : p
        );
        if (plazaRef.current) {
          plazaRef.current.updatePartners(updated);
          plazaRef.current.boingDino(data.player_id);
        }
        return updated;
      });
    });

    const offPlayTogether = ws.on('plaza', 'play_together', (data) => {
      if (plazaRef.current && data.player_ids) {
        plazaRef.current.setPlayingTogether(data.player_ids);
      }
    });
    const offPlayEnded = ws.on('plaza', 'play_ended', (data) => {
      if (plazaRef.current && data.player_ids) {
        plazaRef.current.clearPlayingTogether(data.player_ids);
      }
    });

    return () => { offArrive(); offLeave(); offPartnerUpdate(); offPlayTogether(); offPlayEnded(); };
  }, []);

  // Boss buildup — fetch persisted phase on mount, then listen for WS updates
  useEffect(() => {
    api.getBossState().then(data => {
      if (!plazaRef.current) return;
      if (data.buildup_phase === 1) plazaRef.current.setShadowPhase(true);
      if (data.buildup_phase === 2) {
        plazaRef.current.setShadowPhase(true);
        plazaRef.current.setTremorPhase(true);
      }
    }).catch(() => {});

    const off = ws.on('plaza', 'buildup', (data) => {
      if (!plazaRef.current) return;
      // Phase 1: shadows only. Phase 2: shadows continue + tremors begin.
      // Phase 3 (roar): buildup's one-shot overlay handles it; clear passives.
      plazaRef.current.setShadowPhase(data.phase === 1 || data.phase === 2);
      plazaRef.current.setTremorPhase(data.phase === 2);
    });
    return () => off();
  }, []);

  // Push cooldown updates to canvas, refresh every 30s
  useEffect(() => {
    if (plazaRef.current) plazaRef.current.setCooldowns(cooldownIds);
  }, [cooldownIds]);

  useEffect(() => {
    const iv = setInterval(() => setCooldownIds(getActiveCooldownIds()), 30000);
    return () => clearInterval(iv);
  }, []);

  // Subscribe to live feed entries from store — keep max 5, stamp arrival time
  // When a new entry would push past 5, mark the oldest as exiting
  useEffect(() => {
    const unsub = store.subscribe(() => {
      setFeedEntries(prev => {
        const existingIds = new Set(prev.map(e => e.id));
        const newOnes = store.feedEntries
          .filter(e => !existingIds.has(e.id))
          .map(e => ({ ...e, arrivedAt: Date.now(), exiting: false }));
        if (newOnes.length === 0) return prev;
        let merged = [...newOnes, ...prev];
        // Mark overflow entries as exiting instead of dropping them
        if (merged.length > 5) {
          merged = merged.map((e, i) => i >= 5 ? { ...e, exiting: true, exitStart: e.exitStart || Date.now() } : e);
        }
        return merged;
      });
    });
    return unsub;
  }, []);

  // Mark entries as exiting after 60s, remove fully exited entries after animation
  useEffect(() => {
    if (feedEntries.length === 0) return;
    const iv = setInterval(() => {
      const now = Date.now();
      setFeedEntries(prev => {
        let changed = false;
        const updated = prev.map(e => {
          if (!e.exiting && now - e.arrivedAt >= 60000) {
            changed = true;
            return { ...e, exiting: true, exitStart: now };
          }
          return e;
        });
        // Remove entries that have been exiting for 400ms (animation duration)
        const filtered = updated.filter(e => !e.exiting || now - (e.exitStart || now) < 500);
        if (filtered.length !== updated.length) changed = true;
        return changed ? filtered : prev;
      });
    }, 500);
    return () => clearInterval(iv);
  }, [feedEntries.length > 0]);

  return (
    <div style={styles.container}>
      <TitleBar title="Plaza" transparent />
      <canvas ref={canvasRef} style={styles.canvas} />

      {partners.length === 0 && (
        <div style={styles.emptyHint}>
          <Footprints size={48} color="#4ade80" />
          <p style={{ color: '#4ade80', marginTop: '8px' }}>It's quiet in here...</p>
          <p style={{ color: '#86efac', fontSize: '13px' }}>Maybe there are some dinos hiding around the party that might want to join?</p>
        </div>
      )}

      {feedEntries.length > 0 && (
        <div style={styles.feedOverlay}>
          <div style={styles.feedList}>
            {feedEntries.map(entry => {
              const FeedIcon = FEED_ICONS[entry.type] || Leaf;
              const animStyle = entry.exiting
                ? { animation: 'feedShrinkOut 0.4s ease-out forwards', overflow: 'hidden' }
                : { animation: 'feedSlideIn 0.3s ease-out both' };
              return (
                <div key={entry.id} style={{ ...styles.feedItem, ...animStyle }}>
                  <FeedIcon size={12} style={styles.feedIcon} />
                  <span style={styles.feedText}>{entry.message}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    position: 'absolute',
    inset: 0,
    overflow: 'hidden',
    background: '#15803d',
  },
  canvas: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    display: 'block',
    cursor: 'grab',
    touchAction: 'none',
    imageRendering: 'pixelated',
  },
  emptyHint: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    textAlign: 'center',
    pointerEvents: 'none',
    background: 'rgba(0,0,0,0.65)',
    backdropFilter: 'blur(4px)',
    borderRadius: '16px',
    padding: '20px 24px',
    maxWidth: '320px',
    width: '85%',
  },
  feedOverlay: {
    position: 'absolute',
    bottom: '8px',
    left: '8px',
    width: '200px',
    pointerEvents: 'none',
    zIndex: 5,
    background: 'rgba(0, 0, 0, 0.25)',
    borderRadius: '8px',
    padding: '6px 8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  feedList: {
    display: 'flex',
    flexDirection: 'column-reverse',
    gap: '3px',
  },
  feedItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    lineHeight: '1.3',
    textShadow: '0 1px 3px rgba(0,0,0,0.8)',
  },
  feedIcon: {
    flexShrink: 0,
  },
  feedText: {
    fontSize: '10px',
    color: 'rgba(255, 255, 255, 0.85)',
    wordBreak: 'break-word',
  },
};
