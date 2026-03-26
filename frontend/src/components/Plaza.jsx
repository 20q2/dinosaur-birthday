import { useEffect, useRef, useState } from 'preact/hooks';
import { api } from '../api.js';
import { PlazaCanvas } from './PlazaCanvas.js';

export function Plaza() {
  const canvasRef = useRef(null);
  const plazaRef = useRef(null);
  const [selected, setSelected] = useState(null);
  const [partners, setPartners] = useState([]);

  useEffect(() => {
    // Load plaza data once on mount (WebSocket wiring comes in Task 9)
    api.getPlaza().then(data => {
      setPartners(data.partners || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!canvasRef.current || partners.length === 0) return;

    const canvas = canvasRef.current;
    const plaza = new PlazaCanvas(canvas, partners, (partner) => {
      setSelected(partner);
    });
    plazaRef.current = plaza;
    plaza.start();

    return () => plaza.stop();
  }, [partners]);

  return (
    <div style={styles.container}>
      <canvas
        ref={canvasRef}
        style={styles.canvas}
        onClick={(e) => {
          if (plazaRef.current) {
            const rect = e.target.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            plazaRef.current.handleTap(x, y);
          }
        }}
      />

      {partners.length === 0 && (
        <div style={styles.emptyHint}>
          <span style={{ fontSize: '48px' }}>🦕</span>
          <p style={{ color: '#4ade80', marginTop: '8px' }}>No dinos here yet!</p>
          <p style={{ color: '#86efac', fontSize: '13px' }}>Set a partner dino to appear in the plaza.</p>
        </div>
      )}

      {selected && (
        <div style={styles.popup} onClick={() => setSelected(null)}>
          <div style={styles.popupCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: '40px', marginBottom: '8px' }}>🦕</div>
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
    cursor: 'pointer',
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
};
