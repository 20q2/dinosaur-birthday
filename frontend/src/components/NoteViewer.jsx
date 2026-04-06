import { useState, useEffect, useRef, useCallback } from 'preact/hooks';

import note1 from '../assets/notes/note1.png';
import note2 from '../assets/notes/note2.png';
import note3 from '../assets/notes/note3.png';
import note4 from '../assets/notes/note4.png';
import note5 from '../assets/notes/note5.png';

const NOTE_IMAGES = { note1, note2, note3, note4, note5 };

/**
 * Full-screen landscape note viewer with pinch-to-zoom and pan.
 * Used by both NoteScan (on first discovery) and Profile (re-viewing).
 *
 * @param {string} noteId - e.g. "note1"
 * @param {function} onClose - called when user taps to dismiss
 * @param {object} [badges] - optional badge elements to render in bottom bar
 * @param {boolean} [fadeFromBlack] - if true, fade in from solid black (ARK style)
 */
export function NoteViewer({ noteId, onClose, badges, fadeFromBlack = false }) {
  const [phase, setPhase] = useState(fadeFromBlack ? 'black' : 'visible');
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const lastTouch = useRef(null);
  const lastPinchDist = useRef(null);
  const lastTap = useRef(0);

  useEffect(() => {
    if (fadeFromBlack) {
      const t1 = setTimeout(() => setPhase('fadein'), 300);
      const t2 = setTimeout(() => setPhase('visible'), 2500);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    // Non-fade: quick fade-in
    requestAnimationFrame(() => setPhase('visible'));
  }, [fadeFromBlack]);

  // --- Touch handlers ---
  const getTouchDist = (t1, t2) =>
    Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
  const getTouchCenter = (t1, t2) => ({
    x: (t1.clientX + t2.clientX) / 2,
    y: (t1.clientY + t2.clientY) / 2,
  });

  const onTouchStart = useCallback((e) => {
    if (e.touches.length === 1) {
      lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      setIsPanning(true);
    } else if (e.touches.length === 2) {
      lastPinchDist.current = getTouchDist(e.touches[0], e.touches[1]);
      lastTouch.current = getTouchCenter(e.touches[0], e.touches[1]);
    }
  }, []);

  const onTouchMove = useCallback((e) => {
    e.preventDefault();
    if (e.touches.length === 2) {
      const dist = getTouchDist(e.touches[0], e.touches[1]);
      if (lastPinchDist.current) {
        setScale(s => Math.min(Math.max(s * (dist / lastPinchDist.current), 1), 5));
      }
      lastPinchDist.current = dist;
      const center = getTouchCenter(e.touches[0], e.touches[1]);
      if (lastTouch.current) {
        setTranslate(t => ({
          x: t.x + (center.x - lastTouch.current.x),
          y: t.y + (center.y - lastTouch.current.y),
        }));
      }
      lastTouch.current = center;
    } else if (e.touches.length === 1 && isPanning && scale > 1) {
      const touch = e.touches[0];
      if (lastTouch.current) {
        setTranslate(t => ({
          x: t.x + (touch.clientX - lastTouch.current.x),
          y: t.y + (touch.clientY - lastTouch.current.y),
        }));
      }
      lastTouch.current = { x: touch.clientX, y: touch.clientY };
    }
  }, [isPanning, scale]);

  const onTouchEnd = useCallback((e) => {
    if (e.touches.length === 0) {
      setIsPanning(false);
      lastTouch.current = null;
      lastPinchDist.current = null;
      if (scale <= 1) { setScale(1); setTranslate({ x: 0, y: 0 }); }
    } else if (e.touches.length === 1) {
      lastPinchDist.current = null;
      lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }, [scale]);

  const handleTap = useCallback((e) => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      e.preventDefault();
      if (scale > 1) { setScale(1); setTranslate({ x: 0, y: 0 }); }
      else { setScale(2.5); }
    } else {
      setTimeout(() => {
        if (Date.now() - lastTap.current >= 280 && scale <= 1 && onClose) onClose();
      }, 300);
    }
    lastTap.current = now;
  }, [scale, onClose]);

  const noteImg = NOTE_IMAGES[noteId];
  const noteNum = noteId.replace('note', '');

  const imageOpacity = phase === 'black' ? 0 : 1;
  const overlayOpacity = phase === 'black' ? 1 : phase === 'fadein' ? 1 : 0;
  const uiOpacity = phase === 'visible' ? 1 : 0;

  return (
    <div
      style={styles.fullscreen}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onClick={handleTap}
    >
      {/* Image layer */}
      <div style={{
        ...styles.imageContainer,
        opacity: imageOpacity,
        transition: fadeFromBlack ? 'opacity 2s ease-in' : 'opacity 0.4s ease-in',
      }}>
        {noteImg && (
          <img
            src={noteImg}
            alt={`Explorer Note #${noteNum}`}
            style={{
              ...styles.noteImage,
              transform: `rotate(90deg) scale(${scale}) translate(${translate.x / scale}px, ${translate.y / scale}px)`,
              transition: isPanning ? 'none' : 'transform 0.2s ease-out',
            }}
          />
        )}
      </div>

      {/* Black overlay (for fade-from-black mode) */}
      {fadeFromBlack && (
        <div style={{
          ...styles.blackOverlay,
          opacity: overlayOpacity,
          transition: 'opacity 2s ease-in',
          pointerEvents: 'none',
        }} />
      )}

      {/* UI chrome */}
      <div style={{
        ...styles.uiLayer,
        opacity: uiOpacity,
        transition: 'opacity 0.5s ease-in',
      }}>
        <div style={styles.topBar}>
          <div style={styles.noteTitle}>EXPLORER NOTE #{noteNum}</div>
          <div style={styles.hintText}>
            {scale > 1 ? 'DOUBLE-TAP TO RESET' : 'TAP TO CLOSE'}
          </div>
        </div>

        <div style={styles.bottomBar}>
          {badges}
          {onClose && (
            <button
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              style={styles.dismissBtn}
            >
              Dismiss
            </button>
          )}
        </div>
      </div>

      {/* Zoom hint */}
      {phase === 'visible' && scale <= 1 && (
        <div style={styles.zoomHint}>Pinch to zoom · drag to pan</div>
      )}
    </div>
  );
}

const styles = {
  fullscreen: {
    position: 'fixed', inset: 0, zIndex: 9999,
    background: '#000', overflow: 'hidden',
    touchAction: 'none',
  },
  imageContainer: {
    position: 'absolute', inset: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  noteImage: {
    maxWidth: '100vh', maxHeight: '100vw',
    objectFit: 'contain',
    transformOrigin: 'center center',
    filter: 'drop-shadow(0 0 20px rgba(245, 158, 11, 0.3))',
    userSelect: 'none',
    WebkitUserDrag: 'none',
  },
  blackOverlay: {
    position: 'absolute', inset: 0, background: '#000',
  },
  uiLayer: {
    position: 'absolute', inset: 0,
    display: 'flex', flexDirection: 'column',
    justifyContent: 'space-between',
    pointerEvents: 'none',
  },
  topBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 16px',
    background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)',
    pointerEvents: 'auto',
  },
  noteTitle: {
    color: '#f59e0b', fontSize: '12px', fontWeight: 'bold',
    letterSpacing: '2px', textShadow: '0 1px 4px rgba(0,0,0,0.8)',
  },
  hintText: {
    color: '#9ca3af', fontSize: '11px', letterSpacing: '1px',
  },
  bottomBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: '10px', padding: '12px 16px',
    background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)',
    pointerEvents: 'auto',
  },
  dismissBtn: {
    padding: '7px 20px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.3)',
    background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: '13px',
    cursor: 'pointer', backdropFilter: 'blur(4px)',
  },
  zoomHint: {
    position: 'absolute', bottom: '56px', left: 0, right: 0,
    textAlign: 'center', color: 'rgba(255,255,255,0.35)',
    fontSize: '11px', letterSpacing: '1px',
    pointerEvents: 'none',
  },
};
