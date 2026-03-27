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
  const [feedEntries, setFeedEntries] = useState(store.feedEntries.slice(0, 5));

  // Initial load + canvas setup
  useEffect(() => {
    api.getPlaza().then(data => {
      setPartners(data.partners || []);
    }).catch(() => {});
  }, []);

  // Create canvas once partners are loaded for the first time
  useEffect(() => {
    if (!canvasRef.current) return;
    if (plazaRef.current) return; // already initialized; updates go via updatePartners

    const canvas = canvasRef.current;
    const plaza = new PlazaCanvas(canvas, partners, (partner) => {
      setSelected(partner);
    });
    plazaRef.current = plaza;
    plaza.start();

    return () => plaza.stop();
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
      setFeedEntries(store.feedEntries.slice(0, 5));
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
      <div style={styles.feedOverlay}>
        <div style={styles.feedList}>
          {feedEntries.length === 0 ? (
            <div style={styles.feedEmpty}>No activity yet...</div>
          ) : (
            feedEntries.map(entry => (
              <div key={entry.id} style={styles.feedItem}>
                <span style={styles.feedIcon}>{FEED_ICONS[entry.type] || '🌿'}</span>
                <span style={styles.feedText}>{entry.message}</span>
              </div>
            ))
          )}
        </div>
        <button
          style={styles.feedButton}
          onClick={() => store.navigate('/feed')}
        >
          📰 View Full Feed
        </button>
      </div>

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
    position: 'relative',
    width: '100%',
    height: '100%',
    minHeight: '300px',
    overflow: 'hidden',
    background: '#15803d',
  },
  canvas: {
    display: 'block',
    width: '100%',
    height: '100%',
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
  closeBtn: {
    marginTop: '14px',
    padding: '8px 22px',
    background: '#4ade80',
    color: '#14532d',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 'bold',
    fontSize: '14px',
    cursor: 'pointer',
  },
  feedOverlay: {
    position: 'absolute',
    bottom: '4px',
    left: '4px',
    width: '50%',
    background: 'rgba(0, 0, 0, 0.45)',
    backdropFilter: 'blur(4px)',
    borderRadius: '10px',
    padding: '8px 10px 6px',
    pointerEvents: 'auto',
    zIndex: 5,
    maxHeight: '140px',
    display: 'flex',
    flexDirection: 'column',
  },
  feedList: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  feedEmpty: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: '12px',
    padding: '4px 0',
  },
  feedItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    lineHeight: '1.3',
  },
  feedIcon: {
    fontSize: '12px',
    flexShrink: 0,
  },
  feedText: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.8)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  feedButton: {
    marginTop: '6px',
    background: 'rgba(74, 222, 128, 0.2)',
    border: '1px solid rgba(74, 222, 128, 0.4)',
    borderRadius: '6px',
    color: '#4ade80',
    fontSize: '12px',
    fontWeight: 'bold',
    padding: '5px 0',
    cursor: 'pointer',
    textAlign: 'center',
    width: '100%',
  },
};
