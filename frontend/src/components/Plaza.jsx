import { useEffect, useRef, useState } from 'preact/hooks';
import { api } from '../api.js';
import { ws } from '../ws.js';
import { store } from '../store.js';
import { PlazaCanvas } from './PlazaCanvas.js';
import { DinoSprite } from './DinoSprite.jsx';

export function Plaza() {
  const canvasRef = useRef(null);
  const plazaRef = useRef(null);
  const [selected, setSelected] = useState(null);
  const [partners, setPartners] = useState([]);
  const [feedEntries, setFeedEntries] = useState(store.feedEntries.slice(0, 7));

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
    const plaza = new PlazaCanvas(canvas, [], (partner) => {
      setSelected(partner);
    });
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

  // Subscribe to live feed entries from store
  useEffect(() => {
    const unsub = store.subscribe(() => {
      setFeedEntries(store.feedEntries.slice(0, 7));
    });
    return unsub;
  }, []);

  return (
    <div style={styles.container}>
      <canvas ref={canvasRef} style={styles.canvas} />

      {partners.length === 0 && (
        <div style={styles.emptyHint}>
          <span style={{ fontSize: '48px' }}>🦕</span>
          <p style={{ color: '#4ade80', marginTop: '8px' }}>No dinos here yet!</p>
          <p style={{ color: '#86efac', fontSize: '13px' }}>Set a partner dino to appear in the plaza.</p>
        </div>
      )}

      {/* Mini live feed overlay */}
      {feedEntries.length > 0 && (
        <div style={styles.feedOverlay}>
          <div style={styles.feedList}>
            {feedEntries.map(entry => (
              <div key={entry.id} style={styles.feedItem}>
                <span style={styles.feedIcon}>{FEED_ICONS[entry.type] || '🌿'}</span>
                <span style={styles.feedText}>{entry.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {selected && (
        <div style={styles.popup} onClick={() => setSelected(null)}>
          <div style={styles.popupCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ marginBottom: '8px' }}>
              <DinoSprite
                species={selected.species}
                colors={selected.colors || {}}
                scale={3}
              />
            </div>
            <div style={{ fontWeight: 'bold', fontSize: '18px', color: '#f0fdf4' }}>
              {selected.name || 'Unnamed'}
            </div>
            <div style={{ color: '#86efac', fontSize: '13px', marginTop: '2px' }}>
              {selected.species} · Lv{selected.level}
            </div>
            {selected.hat && (
              <div style={{ color: '#a78bfa', fontSize: '12px', marginTop: '6px' }}>
                🎩 {selected.hat.replace('_', ' ')}
              </div>
            )}
            <div style={{ color: '#4ade80', fontSize: '13px', marginTop: '10px' }}>
              Owner: {selected.owner_name || 'Unknown'}
            </div>
            <button
              onClick={() => { setSelected(null); store.navigate('/play'); }}
              style={styles.playBtn}
            >
              🤝 Play Together
            </button>
            <button onClick={() => setSelected(null)} style={styles.closeBtn}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const FEED_ICONS = {
  encounter: '🦕',
  tamed: '🎉',
  play: '🤝',
  levelup: '⬆️',
  boss: '⚔️',
  event: '🌿',
  inspiration: '✨',
};

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
  },
  popup: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(0,0,0,0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  popupCard: {
    background: '#1a2e1a',
    border: '1.5px solid #4ade80',
    borderRadius: '16px',
    padding: '24px 28px',
    textAlign: 'center',
    minWidth: '200px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  },
  playBtn: {
    marginTop: '14px',
    padding: '8px 22px',
    background: '#6366f1',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 'bold',
    fontSize: '14px',
    cursor: 'pointer',
    width: '100%',
  },
  closeBtn: {
    marginTop: '8px',
    padding: '8px 22px',
    background: 'transparent',
    color: '#86efac',
    border: '1px solid #86efac',
    borderRadius: '8px',
    fontWeight: 'bold',
    fontSize: '14px',
    cursor: 'pointer',
    width: '100%',
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
    flexDirection: 'column',
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
    fontSize: '12px',
    flexShrink: 0,
  },
  feedText: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.85)',
    wordBreak: 'break-word',
  },
};
