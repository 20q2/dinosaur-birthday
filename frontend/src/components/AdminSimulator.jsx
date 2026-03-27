import { useState, useEffect } from 'preact/hooks';
import { api } from '../api.js';
import { HATS } from '../data/hats.js';
import { generateId } from '../utils/uuid.js';

const SPECIES = ['trex', 'spinosaurus', 'dilophosaurus', 'pachycephalosaurus', 'parasaurolophus', 'stegosaurus', 'triceratops'];
const SPECIES_NAMES = { trex: 'T-Rex', spinosaurus: 'Spinosaurus', dilophosaurus: 'Dilophosaurus', pachycephalosaurus: 'Pachycephalosaurus', parasaurolophus: 'Parasaurolophus', stegosaurus: 'Stegosaurus', triceratops: 'Triceratops' };
const FOOD_TYPES = ['meat', 'mejoberries'];
const EVENT_TYPES = ['cooking_pot', 'dance_floor', 'photo_booth', 'cake_table', 'mystery_chest'];

export function AdminSimulator() {
  const [players, setPlayers] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [playerData, setPlayerData] = useState(null);
  const [testCount, setTestCount] = useState(1);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // Form states
  const [scanSpecies, setScanSpecies] = useState(SPECIES[0]);
  const [foodType, setFoodType] = useState(FOOD_TYPES[0]);
  const [foodSpecies, setFoodSpecies] = useState('');
  const [customSpecies, setCustomSpecies] = useState('');
  const [customName, setCustomName] = useState('');
  const [customHat, setCustomHat] = useState('');
  const [customPartner, setCustomPartner] = useState(false);
  const [lobbyCode, setLobbyCode] = useState('');
  const [triviaState, setTriviaState] = useState(null);
  const [eventType, setEventType] = useState(EVENT_TYPES[0]);
  const [noteId, setNoteId] = useState('1');

  useEffect(() => { loadPlayers(); }, []);

  async function loadPlayers() {
    try {
      const data = await api.adminDashboard();
      setPlayers(data.player_list || []);
    } catch {}
  }

  async function createTestPlayer() {
    const id = generateId();
    const name = `TestPlayer-${testCount}`;
    setTestCount(c => c + 1);
    try {
      await api.createPlayer(id, name, '');
      await loadPlayers();
      setSelectedId(id);
      setResult({ ok: true, data: { created: name, id } });
    } catch (err) {
      setResult({ ok: false, data: err.message });
    }
  }

  async function refreshPlayer() {
    if (!selectedId) return;
    try {
      const data = await api.getPlayer(selectedId);
      setPlayerData(data);
      setResult({ ok: true, data });
    } catch (err) {
      setResult({ ok: false, data: err.message });
    }
  }

  useEffect(() => {
    if (selectedId) refreshPlayer();
    else setPlayerData(null);
  }, [selectedId]);

  async function run(fn) {
    setLoading(true);
    setResult(null);
    try {
      const data = await fn();
      setResult({ ok: true, data });
      refreshPlayer();
    } catch (err) {
      setResult({ ok: false, data: err.message });
    }
    setLoading(false);
  }

  const pid = selectedId;
  const tamedDinos = (playerData?.dinos || []).filter(d => d.tamed);

  return (
    <div style={styles.container}>
      {/* Player selector */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Player</h3>
        <div style={styles.row}>
          <select style={styles.select} value={selectedId} onChange={e => setSelectedId(e.target.value)}>
            <option value="">-- Select player --</option>
            {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button style={styles.btn} onClick={createTestPlayer}>Create Test Player</button>
          <button style={styles.btnSmall} onClick={refreshPlayer} disabled={!pid}>Refresh</button>
        </div>
        {playerData && (
          <div style={styles.statsRow}>
            <span>{playerData.name}</span>
            <span>Dinos: {tamedDinos.length}</span>
            <span>Items: {(playerData.items || []).length}</span>
            <span>Notes: {(playerData.notes || []).length}/5</span>
            <span>{playerData.inspiration ? 'Inspired' : ''}</span>
          </div>
        )}
      </div>

      {pid && (
        <>
          {/* Scan Dino */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Scan Dino</h3>
            <div style={styles.row}>
              <select style={styles.select} value={scanSpecies} onChange={e => setScanSpecies(e.target.value)}>
                {SPECIES.map(s => <option key={s} value={s}>{SPECIES_NAMES[s]}</option>)}
              </select>
              <button style={styles.btn} onClick={() => run(() => api.scanDino(pid, scanSpecies))} disabled={loading}>Encounter</button>
            </div>
          </div>

          {/* Tame Dino */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Tame Dino</h3>
            <div style={styles.row}>
              <select style={styles.select} value={foodType} onChange={e => setFoodType(e.target.value)}>
                {FOOD_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
              <input style={styles.input} placeholder="species (optional)" value={foodSpecies} onInput={e => setFoodSpecies(e.target.value)} />
              <button style={styles.btn} onClick={() => run(() => api.scanFood(pid, foodType, foodSpecies || null))} disabled={loading}>Feed</button>
            </div>
          </div>

          {/* Customize Dino */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Customize Dino</h3>
            <div style={styles.row}>
              <select style={styles.select} value={customSpecies} onChange={e => setCustomSpecies(e.target.value)}>
                <option value="">-- Select dino --</option>
                {tamedDinos.map(d => <option key={d.species} value={d.species}>{d.name || SPECIES_NAMES[d.species]}</option>)}
              </select>
              <input style={styles.input} placeholder="Name" value={customName} onInput={e => setCustomName(e.target.value)} />
            </div>
            <div style={styles.row}>
              <select style={styles.select} value={customHat} onChange={e => setCustomHat(e.target.value)}>
                <option value="">-- Hat --</option>
                {HATS.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
              <label style={styles.checkLabel}>
                <input type="checkbox" checked={customPartner} onChange={e => setCustomPartner(e.target.checked)} />
                Partner
              </label>
              <button style={styles.btn} onClick={() => run(async () => {
                const updates = {};
                if (customName.trim()) updates.name = customName.trim();
                if (customHat) updates.hat = customHat;
                let res = {};
                if (Object.keys(updates).length > 0) {
                  res = await api.customizeDino(pid, customSpecies, updates);
                }
                if (customPartner) {
                  res = await api.setPartner(pid, customSpecies);
                }
                return res;
              })} disabled={loading || !customSpecies}>Save</button>
            </div>
          </div>

          {/* Social Play */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Social Play</h3>
            <div style={styles.row}>
              <button style={styles.btn} onClick={() => run(() => api.createLobby(pid))} disabled={loading}>Create Lobby</button>
              <input style={styles.input} placeholder="Lobby code" value={lobbyCode} onInput={e => setLobbyCode(e.target.value)} />
              <button style={styles.btn} onClick={() => run(async () => {
                const res = await api.joinLobby(pid, lobbyCode);
                if (res.trivia) setTriviaState({ code: lobbyCode, ...res.trivia });
                return res;
              })} disabled={loading || !lobbyCode}>Join</button>
            </div>
            {triviaState && (
              <div style={styles.triviaBox}>
                <p style={{ margin: '0 0 8px', fontWeight: '600' }}>{triviaState.question}</p>
                {triviaState.options.map((opt, i) => (
                  <button key={i} style={styles.triviaBtn} onClick={() => {
                    run(() => api.answerTrivia(pid, triviaState.code, i));
                    setTriviaState(null);
                  }}>{opt}</button>
                ))}
              </div>
            )}
          </div>

          {/* Scan Event */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Scan Event</h3>
            <div style={styles.row}>
              <select style={styles.select} value={eventType} onChange={e => setEventType(e.target.value)}>
                {EVENT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
              <button style={styles.btn} onClick={() => run(() => api.scanEvent(pid, eventType, ''))} disabled={loading}>Claim</button>
            </div>
          </div>

          {/* Scan Inspiration */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Scan Inspiration</h3>
            <button style={styles.btn} onClick={() => run(() => api.scanInspiration(pid))} disabled={loading}>Claim Inspiration</button>
          </div>

          {/* Scan Note */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Scan Note</h3>
            <div style={styles.row}>
              <select style={styles.select} value={noteId} onChange={e => setNoteId(e.target.value)}>
                {[1,2,3,4,5].map(n => <option key={n} value={String(n)}>Note #{n}</option>)}
              </select>
              <button style={styles.btn} onClick={() => run(() => api.scanNote(pid, noteId))} disabled={loading}>Read Note</button>
            </div>
          </div>

          {/* Boss Tap */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Boss Tap</h3>
            <button style={styles.btn} onClick={() => run(() => api.bossTap(pid))} disabled={loading}>Tap Boss</button>
          </div>
        </>
      )}

      {/* Result display */}
      {result && (
        <div style={{ ...styles.resultBox, borderColor: result.ok ? '#22c55e' : '#ef4444' }}>
          <pre style={styles.resultPre}>{JSON.stringify(result.data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { padding: '16px' },
  section: { marginBottom: '16px', padding: '12px', background: '#111', borderRadius: '10px', border: '1px solid #222' },
  sectionTitle: { margin: '0 0 8px', fontSize: '14px', fontWeight: '700', color: '#e5e7eb' },
  row: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' },
  select: { flex: '1 1 120px', padding: '8px', background: '#1f2937', border: '1px solid #374151', borderRadius: '6px', color: '#f0f0f0', fontSize: '13px' },
  input: { flex: '1 1 100px', padding: '8px', background: '#1f2937', border: '1px solid #374151', borderRadius: '6px', color: '#f0f0f0', fontSize: '13px' },
  btn: { padding: '8px 14px', background: '#6366f1', border: 'none', borderRadius: '6px', color: '#fff', fontWeight: '600', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' },
  btnSmall: { padding: '8px 10px', background: '#374151', border: 'none', borderRadius: '6px', color: '#ccc', fontSize: '12px', cursor: 'pointer' },
  checkLabel: { display: 'flex', alignItems: 'center', gap: '4px', color: '#ccc', fontSize: '13px' },
  statsRow: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '8px', fontSize: '12px', color: '#9ca3af' },
  triviaBox: { marginTop: '10px', padding: '10px', background: '#1a1a2e', borderRadius: '8px' },
  triviaBtn: { display: 'block', width: '100%', padding: '8px', marginTop: '4px', background: '#374151', border: '1px solid #4b5563', borderRadius: '6px', color: '#f0f0f0', cursor: 'pointer', textAlign: 'left', fontSize: '13px' },
  resultBox: { position: 'sticky', bottom: '10px', margin: '16px 0', padding: '12px', background: '#0a0a0a', border: '2px solid', borderRadius: '10px', maxHeight: '200px', overflow: 'auto' },
  resultPre: { margin: 0, fontSize: '11px', color: '#d1d5db', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
};
