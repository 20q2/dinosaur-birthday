import { useEffect, useRef, useState } from 'preact/hooks';
import { api } from '../api.js';
import { ws } from '../ws.js';
import { store } from '../store.js';
import { PlazaCanvas } from './PlazaCanvas.js';
import { TitleBar } from './TitleBar.jsx';
import { FEED_ICONS } from '../data/icons.js';
import { Leaf, Footprints } from 'lucide-preact';

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
  const [feedEntries, setFeedEntries] = useState(store.feedEntries.slice(0, 7));
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
      setPartners(prev => {
        const updated = [...prev.filter(p => p.player_id !== data.player_id), data];
        if (plazaRef.current) plazaRef.current.updatePartners(updated);
        return updated;
      });
    });
    const offLeave = ws.on('plaza', 'dino_leave', (data) => {
      setPartners(prev => {
        const updated = prev.filter(p => p.player_id !== data.player_id);
        if (plazaRef.current) plazaRef.current.updatePartners(updated);
        return updated;
      });
    });

    return () => { offArrive(); offLeave(); };
  }, []);

  // Boss buildup — fetch persisted phase on mount, then listen for WS updates
  useEffect(() => {
    api.getBossState().then(data => {
      if (plazaRef.current && data.buildup_phase === 1) {
        plazaRef.current.setShadowPhase(true);
      }
    }).catch(() => {});

    const off = ws.on('plaza', 'buildup', (data) => {
      if (!plazaRef.current) return;
      plazaRef.current.setShadowPhase(data.phase === 1);
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

  // Subscribe to live feed entries from store
  useEffect(() => {
    const unsub = store.subscribe(() => {
      setFeedEntries(store.feedEntries.slice(0, 7));
    });
    return unsub;
  }, []);

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
              return (
                <div key={entry.id} style={styles.feedItem}>
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
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.85)',
    wordBreak: 'break-word',
  },
};
