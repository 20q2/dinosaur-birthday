import { useState, useEffect } from 'preact/hooks';
import { store } from '../store.js';
import { api } from '../api.js';

export function NoteScan({ noteId }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await api.scanNote(store.playerId, noteId);
        setResult(data);
        await store.refresh();
      } catch (err) {
        setError(err.message);
      }
      setLoading(false);
    })();
  }, [noteId]);

  if (loading) {
    return <div style={styles.center}><p>Unrolling scroll...</p></div>;
  }

  if (error) {
    return (
      <div style={styles.center}>
        <p style={{ color: '#ef4444' }}>{error}</p>
        <button onClick={() => store.navigate('/plaza')} style={styles.button}>Back to Plaza</button>
      </div>
    );
  }

  const noteNum = noteId.replace('note', '');
  const found = result?.notes_found ?? 0;
  const total = result?.notes_total ?? 5;
  const wasAlreadyFound = result?.already_found;

  return (
    <div style={styles.container}>
      <div style={styles.header}>EXPLORER'S NOTES</div>
      <div style={styles.counter}>
        {found}/{total} found
        <span style={styles.counterBar}>
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              style={{
                ...styles.pip,
                background: i < found ? '#f59e0b' : '#374151',
              }}
            />
          ))}
        </span>
      </div>

      <div style={styles.parchment}>
        <div style={styles.parchmentHeader}>
          <span style={{ fontSize: '18px' }}>📜</span>
          <span style={{ fontWeight: 'bold', color: '#92400e' }}>Note #{noteNum}</span>
          {wasAlreadyFound && (
            <span style={styles.alreadyTag}>Already found</span>
          )}
        </div>
        <div style={styles.parchmentText}>
          {result?.note_text}
        </div>
      </div>

      {!wasAlreadyFound && (
        <div style={{ color: '#4ade80', fontSize: '13px', textAlign: 'center' }}>
          New note discovered!
        </div>
      )}

      <button onClick={() => store.navigate('/plaza')} style={styles.button}>Back to Plaza</button>
    </div>
  );
}

const styles = {
  center: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', minHeight: '80dvh', padding: '20px', gap: '16px',
  },
  container: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '24px 20px', gap: '16px',
  },
  header: {
    color: '#f59e0b', fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px',
  },
  counter: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    color: '#9ca3af', fontSize: '13px', gap: '6px',
  },
  counterBar: {
    display: 'flex', gap: '5px',
  },
  pip: {
    width: '14px', height: '14px', borderRadius: '50%', display: 'inline-block',
  },
  parchment: {
    background: '#fef3c7',
    border: '2px solid #d97706',
    borderRadius: '8px',
    padding: '20px',
    maxWidth: '320px',
    width: '100%',
    boxShadow: '2px 3px 8px #00000044',
    color: '#1c1917',
  },
  parchmentHeader: {
    display: 'flex', alignItems: 'center', gap: '8px',
    marginBottom: '12px', flexWrap: 'wrap',
  },
  parchmentText: {
    fontFamily: 'Georgia, serif',
    fontSize: '15px',
    lineHeight: '1.6',
    color: '#292524',
    fontStyle: 'italic',
  },
  alreadyTag: {
    background: '#d97706', color: '#fff', borderRadius: '4px',
    padding: '2px 7px', fontSize: '11px', fontWeight: 'bold',
  },
  button: {
    padding: '14px', borderRadius: '8px', border: 'none',
    background: '#6366f1', color: 'white', fontSize: '16px',
    fontWeight: 'bold', cursor: 'pointer', width: '100%', maxWidth: '320px',
  },
};
