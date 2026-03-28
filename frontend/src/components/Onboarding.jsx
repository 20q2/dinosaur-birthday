import { useState, useRef } from 'preact/hooks';
import { store } from '../store.js';
import splashImg from '../assets/splash/splash.png';

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
      {/* Splash background */}
      <img src={splashImg} alt="" style={styles.splash} />
      <div style={styles.overlay} />

      {/* Content pinned to bottom */}
      <div style={styles.content}>
        <h1 style={styles.title}>Alex's Birthday Bash</h1>

        <form onSubmit={handleSubmit} style={styles.form}>
          {/* Photo upload */}
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
                  <span style={styles.tapText}>Add selfie</span>
                </div>
              )}
            </div>
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
    </div>
  );
}

const styles = {
  container: {
    position: 'relative',
    minHeight: '100dvh',
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
  },
  splash: {
    position: 'absolute', top: 0, left: 0,
    width: '100%', height: '100%',
    objectFit: 'cover', objectPosition: 'center top',
  },
  overlay: {
    position: 'absolute', top: 0, left: 0,
    width: '100%', height: '100%',
    background: 'linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.7) 65%, rgba(0,0,0,0.92) 100%)',
  },
  content: {
    position: 'relative', zIndex: 1,
    marginTop: 'auto',
    padding: '20px 20px 32px',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
  },
  title: {
    fontSize: '20px', fontWeight: 'bold', marginBottom: '16px',
    color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.6)',
  },
  form: { width: '100%', maxWidth: '300px', display: 'flex', flexDirection: 'column', gap: '14px' },

  // Photo section
  photoSection: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
  },
  photoCircle: {
    width: '100px', height: '100px', borderRadius: '50%',
    border: '3px dashed rgba(255,255,255,0.5)', overflow: 'hidden',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', background: 'rgba(0,0,0,0.4)',
    backdropFilter: 'blur(4px)',
  },
  photoImg: {
    width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%',
  },
  photoPlaceholder: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
  },
  cameraIcon: { fontSize: '28px' },
  tapText: { fontSize: '11px', color: '#ccc', fontWeight: 'bold' },
  retakeBtn: {
    background: 'none', border: 'none', color: '#a5b4fc',
    fontSize: '12px', cursor: 'pointer', textDecoration: 'underline',
  },
  photoReminder: {
    color: '#f59e0b', fontSize: '12px', textAlign: 'center',
    margin: '0', fontWeight: '600',
  },

  input: {
    padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(0,0,0,0.4)', color: '#e0e0e0', fontSize: '16px',
    outline: 'none', textAlign: 'center',
    backdropFilter: 'blur(4px)',
  },
  button: {
    padding: '14px', borderRadius: '10px', border: 'none',
    background: '#6366f1', color: 'white', fontSize: '16px',
    fontWeight: 'bold', cursor: 'pointer',
  },
  error: { color: '#ef4444', fontSize: '13px', textAlign: 'center' },
};
