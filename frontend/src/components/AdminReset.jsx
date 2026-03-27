import { useState, useEffect } from 'preact/hooks';
import { api } from '../api.js';

export function AdminReset() {
  const [players, setPlayers] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [nukeConfirm, setNukeConfirm] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.adminDashboard().then(data => {
      setPlayers(data.player_list || []);
    }).catch(() => {});
  }, []);

  const selectedPlayer = players.find(p => p.id === selectedId);

  async function handleResetPlayer() {
    if (!selectedId) return;
    if (!confirm(`Reset all game data for "${selectedPlayer?.name}"? This keeps their profile but removes all dinos, items, notes, inspiration, and cooldowns.`)) return;
    setLoading(true);
    try {
      const res = await api.resetPlayer(selectedId);
      setResult({ ok: true, msg: `Deleted ${res.deleted} items for ${selectedPlayer?.name}` });
    } catch (err) {
      setResult({ ok: false, msg: err.message });
    }
    setLoading(false);
  }

  async function handleResetAll() {
    if (resetConfirm !== 'RESET') return;
    setLoading(true);
    try {
      const res = await api.resetAll();
      setResult({ ok: true, msg: `Full reset complete. Deleted ${res.deleted} items. Player profiles preserved.` });
      setResetConfirm('');
    } catch (err) {
      setResult({ ok: false, msg: err.message });
    }
    setLoading(false);
  }

  async function handleNukeAll() {
    if (nukeConfirm !== 'NUKE') return;
    setLoading(true);
    try {
      const res = await api.nukeAll();
      setResult({ ok: true, msg: `Full nuke complete. Deleted ${res.deleted} items. All profiles wiped.` });
      setNukeConfirm('');
      setPlayers([]);
    } catch (err) {
      setResult({ ok: false, msg: err.message });
    }
    setLoading(false);
  }

  return (
    <div style={styles.container}>
      {/* Per-player reset */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Reset Player</h3>
        <p style={styles.desc}>Wipe a player's dinos, items, notes, inspiration, and cooldowns. Their profile (name) is kept.</p>
        <div style={styles.row}>
          <select style={styles.select} value={selectedId} onChange={e => setSelectedId(e.target.value)}>
            <option value="">-- Select player --</option>
            {players.map(p => <option key={p.id} value={p.id}>{p.name} ({p.dino_count} dinos)</option>)}
          </select>
          <button
            style={{ ...styles.dangerBtn, opacity: selectedId ? 1 : 0.4 }}
            onClick={handleResetPlayer}
            disabled={!selectedId || loading}
          >
            Reset Player
          </button>
        </div>
      </div>

      {/* Full game reset */}
      <div style={styles.section}>
        <h3 style={{ ...styles.sectionTitle, color: '#ef4444' }}>Full Game Reset</h3>
        <div style={styles.warningBox}>
          <p style={styles.warningText}>
            This deletes ALL game data — every player's dinos, items, notes, the plaza, feed, boss state, lobbies, and cooldowns. Player profiles are kept so players don't have to re-register.
          </p>
        </div>
        <p style={styles.desc}>Type <strong style={{ color: '#ef4444' }}>RESET</strong> to enable the button:</p>
        <div style={styles.row}>
          <input
            style={styles.input}
            value={resetConfirm}
            onInput={e => setResetConfirm(e.target.value)}
            placeholder='Type "RESET" to confirm'
          />
          <button
            style={{ ...styles.dangerBtn, opacity: resetConfirm === 'RESET' ? 1 : 0.4 }}
            onClick={handleResetAll}
            disabled={resetConfirm !== 'RESET' || loading}
          >
            Reset Everything
          </button>
        </div>
      </div>

      {/* Full nuke */}
      <div style={styles.section}>
        <h3 style={{ ...styles.sectionTitle, color: '#ff0000' }}>Full Nuke</h3>
        <div style={{ ...styles.warningBox, background: '#2a0000', borderColor: '#991b1b' }}>
          <p style={styles.warningText}>
            This deletes EVERYTHING — all game data AND all player profiles. Every player will need to re-register from scratch. There is no undo.
          </p>
        </div>
        <p style={styles.desc}>Type <strong style={{ color: '#ff0000' }}>NUKE</strong> to enable the button:</p>
        <div style={styles.row}>
          <input
            style={styles.input}
            value={nukeConfirm}
            onInput={e => setNukeConfirm(e.target.value)}
            placeholder='Type "NUKE" to confirm'
          />
          <button
            style={{ ...styles.nukeBtn, opacity: nukeConfirm === 'NUKE' ? 1 : 0.4 }}
            onClick={handleNukeAll}
            disabled={nukeConfirm !== 'NUKE' || loading}
          >
            Nuke Everything
          </button>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div style={{ ...styles.resultBox, borderColor: result.ok ? '#22c55e' : '#ef4444' }}>
          <p style={{ margin: 0, fontSize: '13px', color: result.ok ? '#22c55e' : '#ef4444' }}>{result.msg}</p>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { padding: '16px' },
  section: { marginBottom: '20px', padding: '14px', background: '#111', borderRadius: '10px', border: '1px solid #222' },
  sectionTitle: { margin: '0 0 8px', fontSize: '14px', fontWeight: '700', color: '#e5e7eb' },
  desc: { margin: '0 0 10px', fontSize: '13px', color: '#9ca3af', lineHeight: '1.5' },
  row: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  select: { flex: '1 1 160px', padding: '8px', background: '#1f2937', border: '1px solid #374151', borderRadius: '6px', color: '#f0f0f0', fontSize: '13px' },
  input: { flex: '1 1 160px', padding: '8px', background: '#1f2937', border: '1px solid #374151', borderRadius: '6px', color: '#f0f0f0', fontSize: '13px' },
  dangerBtn: { padding: '8px 16px', background: '#dc2626', border: 'none', borderRadius: '6px', color: '#fff', fontWeight: '700', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' },
  nukeBtn: { padding: '8px 16px', background: '#7f1d1d', border: '2px solid #ff0000', borderRadius: '6px', color: '#ff0000', fontWeight: '700', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' },
  warningBox: { padding: '12px', background: '#1a0000', border: '1px solid #7f1d1d', borderRadius: '8px', marginBottom: '10px' },
  warningText: { margin: 0, fontSize: '13px', color: '#fca5a5', lineHeight: '1.5' },
  resultBox: { padding: '12px', background: '#0a0a0a', border: '2px solid', borderRadius: '10px' },
};
