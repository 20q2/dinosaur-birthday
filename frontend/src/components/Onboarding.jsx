import { useState } from 'preact/hooks';
import { store } from '../store.js';

export function Onboarding() {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError('');
    try {
      await store.register(name.trim(), '');
      const pending = store.popPendingRoute();
      if (pending) {
        store.navigate(pending);
      } else {
        store.navigate('/plaza');
      }
    } catch (err) {
      setError('Failed to join. Try again!');
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.logo}>🦕</div>
      <h1 style={styles.title}>DINO PARTY</h1>
      <p style={styles.subtitle}>Alex's Birthday Bash</p>

      <form onSubmit={handleSubmit} style={styles.form}>
        <input
          type="text"
          placeholder="Enter your name"
          value={name}
          onInput={(e) => setName(e.target.value)}
          maxLength={20}
          style={styles.input}
          autoFocus
        />

        {error && <p style={styles.error}>{error}</p>}

        <button
          type="submit"
          disabled={loading || !name.trim()}
          style={{
            ...styles.button,
            opacity: loading || !name.trim() ? 0.5 : 1,
          }}
        >
          {loading ? 'Joining...' : 'JOIN THE PARTY'}
        </button>
      </form>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', minHeight: '100dvh', padding: '20px',
  },
  logo: { fontSize: '64px', marginBottom: '16px' },
  title: { fontSize: '24px', fontWeight: 'bold', marginBottom: '6px' },
  subtitle: { color: '#888', fontSize: '14px', marginBottom: '32px' },
  form: { width: '100%', maxWidth: '300px', display: 'flex', flexDirection: 'column', gap: '16px' },
  input: {
    padding: '14px', borderRadius: '8px', border: '1px solid #333',
    background: '#1a1a2e', color: '#e0e0e0', fontSize: '16px',
    outline: 'none', textAlign: 'center',
  },
  button: {
    padding: '14px', borderRadius: '8px', border: 'none',
    background: '#6366f1', color: 'white', fontSize: '16px',
    fontWeight: 'bold', cursor: 'pointer',
  },
  error: { color: '#ef4444', fontSize: '13px', textAlign: 'center' },
};
