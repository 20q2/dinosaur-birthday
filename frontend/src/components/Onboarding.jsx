import { useState, useRef } from 'preact/hooks';
import { store } from '../store.js';

function resizeImage(file, maxSize = 200) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;
        if (w > h) {
          if (w > maxSize) { h = (h * maxSize) / w; w = maxSize; }
        } else {
          if (h > maxSize) { w = (w * maxSize) / h; h = maxSize; }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export function Onboarding() {
  const [name, setName] = useState('');
  const [photo, setPhoto] = useState(null); // data URL
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await resizeImage(file);
    setPhoto(dataUrl);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError('');
    try {
      await store.register(name.trim(), photo || '');
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
        {/* Photo upload — prominent and encouraged */}
        <div style={styles.photoSection}>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="user"
            onChange={handlePhoto}
            style={{ display: 'none' }}
          />
          <div
            style={styles.photoCircle}
            onClick={() => fileRef.current?.click()}
          >
            {photo ? (
              <img src={photo} alt="Your selfie" style={styles.photoImg} />
            ) : (
              <div style={styles.photoPlaceholder}>
                <span style={styles.cameraIcon}>📸</span>
                <span style={styles.tapText}>Tap to add selfie</span>
              </div>
            )}
          </div>
          {!photo && (
            <div style={styles.encourageBox}>
              <p style={styles.encourageText}>
                Add a selfie so other players can find you at the party!
              </p>
              <p style={styles.encourageSubtext}>
                Highly recommended — it helps everyone recognize each other
              </p>
            </div>
          )}
          {photo && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              style={styles.retakeBtn}
            >
              Retake photo
            </button>
          )}
        </div>

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

        {!photo && name.trim() && (
          <p style={styles.photoReminder}>
            Don't forget to add your selfie above!
          </p>
        )}
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

  // Photo section
  photoSection: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
  },
  photoCircle: {
    width: '120px', height: '120px', borderRadius: '50%',
    border: '3px dashed #6366f1', overflow: 'hidden',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', background: '#1a1a2e',
    transition: 'border-color 0.2s, transform 0.15s',
  },
  photoImg: {
    width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%',
  },
  photoPlaceholder: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
  },
  cameraIcon: { fontSize: '32px' },
  tapText: { fontSize: '11px', color: '#6366f1', fontWeight: 'bold' },
  encourageBox: {
    background: '#1a1a2e', borderRadius: '8px', padding: '10px 14px',
    border: '1px solid #6366f1', textAlign: 'center',
  },
  encourageText: {
    margin: '0 0 4px', fontSize: '13px', color: '#e0e0e0', fontWeight: '600',
  },
  encourageSubtext: {
    margin: 0, fontSize: '11px', color: '#888', fontStyle: 'italic',
  },
  retakeBtn: {
    background: 'none', border: 'none', color: '#6366f1',
    fontSize: '12px', cursor: 'pointer', textDecoration: 'underline',
  },
  photoReminder: {
    color: '#f59e0b', fontSize: '12px', textAlign: 'center',
    margin: '0', fontWeight: '600',
    animation: 'pulse 2s ease-in-out infinite',
  },

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
