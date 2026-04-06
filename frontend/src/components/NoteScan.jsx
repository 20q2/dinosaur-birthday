import { useState, useEffect } from 'preact/hooks';
import { store } from '../store.js';
import { api } from '../api.js';
import { NoteViewer } from './NoteViewer.jsx';

export function NoteScan({ noteId }) {
  const noteKey = noteId.startsWith('note') ? noteId : `note${noteId}`;
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await api.scanNote(store.playerId, noteKey);
        setResult(data);
        await store.refresh();
      } catch (err) {
        setError(err.message);
      }
      setLoading(false);
    })();
  }, [noteId]);

  if (loading) {
    return (
      <div style={styles.blackScreen}>
        <p style={styles.loadingText}>Unrolling scroll...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.blackScreen}>
        <p style={{ color: '#ef4444', fontSize: '16px' }}>{error}</p>
        <button onClick={() => store.navigate('/plaza')} style={styles.btn}>Back to Plaza</button>
      </div>
    );
  }

  const wasAlreadyFound = result?.already_found;
  const xpAwarded = result?.xp_awarded;

  const badges = (
    <>
      {!wasAlreadyFound && xpAwarded && (
        <div style={styles.xpBadge}>+{xpAwarded} XP</div>
      )}
      {!wasAlreadyFound && (
        <div style={styles.newBadge}>NEW DISCOVERY</div>
      )}
      {wasAlreadyFound && (
        <div style={styles.alreadyBadge}>ALREADY FOUND</div>
      )}
    </>
  );

  return (
    <NoteViewer
      noteId={noteKey}
      onClose={() => store.navigate('/plaza')}
      badges={badges}
      fadeFromBlack
    />
  );
}

const styles = {
  blackScreen: {
    position: 'fixed', inset: 0, zIndex: 9999,
    background: '#000', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: '16px',
  },
  loadingText: {
    color: '#f59e0b', fontSize: '14px', letterSpacing: '2px',
    fontFamily: 'Georgia, serif', fontStyle: 'italic',
  },
  btn: {
    padding: '7px 20px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.3)',
    background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: '13px', cursor: 'pointer',
  },
  xpBadge: {
    background: '#6366f1', color: '#fff', borderRadius: '6px',
    padding: '5px 12px', fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px',
  },
  newBadge: {
    background: '#16a34a', color: '#fff', borderRadius: '6px',
    padding: '5px 12px', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px',
  },
  alreadyBadge: {
    background: '#d97706', color: '#fff', borderRadius: '6px',
    padding: '5px 12px', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px',
  },
};
