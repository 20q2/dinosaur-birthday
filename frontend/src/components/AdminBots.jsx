import { useState } from 'preact/hooks';
import { api } from '../api.js';
import { generateId } from '../utils/uuid.js';
import samplePhoto from '../assets/sample/sample_profile_pic.PNG';

const BOT_NAMES = ['Rex', 'Stego', 'Trike', 'Spino', 'Pachy', 'Para', 'Dilo'];
const SPECIES = ['trex', 'spinosaurus', 'dilophosaurus', 'pachycephalosaurus', 'parasaurolophus', 'triceratops', 'ankylosaurus'];
const FOOD_MAP = { trex: 'meat', spinosaurus: 'meat', dilophosaurus: 'meat', pachycephalosaurus: 'mejoberries', parasaurolophus: 'mejoberries', triceratops: 'mejoberries', ankylosaurus: 'mejoberries' };
const SPECIES_NAMES = { trex: 'T-Rex', spinosaurus: 'Spinosaurus', dilophosaurus: 'Dilophosaurus', pachycephalosaurus: 'Pachycephalosaurus', parasaurolophus: 'Parasaurolophus', triceratops: 'Triceratops', ankylosaurus: 'Ankylosaurus' };
const DINO_NAMES = [
  'Chompers', 'Tiny', 'Bigfoot', 'Nugget', 'Thunder', 'Pickles', 'Biscuit',
  'Waffles', 'Sprout', 'Gizmo', 'Pebbles', 'Crunchy', 'Bubbles', 'Snaggletooth',
  'Turbo', 'Mochi', 'Pancake', 'Zipper', 'Noodle', 'Fern', 'Boulder', 'Tater Tot',
  'Mango', 'Cheddar', 'Pixel', 'Dusty', 'Snickers', 'Maple', 'Orbit', 'Bean',
  'Sparky', 'Clover', 'Pepper', 'Goober', 'Stardust', 'Tangerine', 'Ripley',
  'Blitz', 'Pretzel', 'Cosmo', 'Jellybean', 'Sage', 'Rascal', 'Juniper', 'Rumble',
  'Tofu', 'Patches', 'Willow', 'Crouton', 'Bandit',
];

function randomDinoName() {
  return DINO_NAMES[Math.floor(Math.random() * DINO_NAMES.length)];
}

export function AdminBots() {
  const [bots, setBots] = useState([]);
  const [bulkLobbyCode, setBulkLobbyCode] = useState('');
  const [log, setLog] = useState([]);

  function addLog(msg) {
    setLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));
  }

  function updateBot(id, updates) {
    setBots(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
  }

  async function spawnBot() {
    const id = generateId();
    const nameBase = BOT_NAMES[bots.length % BOT_NAMES.length];
    const name = `Bot-${nameBase}-${bots.length + 1}`;
    try {
      await api.createPlayer(id, name, samplePhoto);
      const bot = { id, name, state: 'collecting', dinos: 0 };
      setBots(prev => [...prev, bot]);
      addLog(`Spawned ${name}`);

      // Auto-collect a dino so the bot appears in the plaza immediately
      const species = SPECIES[Math.floor(Math.random() * SPECIES.length)];
      const food = FOOD_MAP[species];
      await api.scanDino(id, species);
      await api.scanFood(id, food, species);
      const dinoName = randomDinoName();
      await api.customizeDino(id, species, { name: dinoName });
      await api.setPartner(id, species);
      addLog(`${name} auto-collected ${SPECIES_NAMES[species]} and set as partner`);
      updateBot(id, { state: 'idle', dinos: 1 });
    } catch (err) {
      addLog(`Failed to spawn bot: ${err.message}`);
    }
  }

  function removeBot(id) {
    setBots(prev => prev.filter(b => b.id !== id));
  }

  async function autoCollect(bot) {
    updateBot(bot.id, { state: 'collecting' });
    const species = SPECIES[Math.floor(Math.random() * SPECIES.length)];
    const food = FOOD_MAP[species];
    try {
      await api.scanDino(bot.id, species);
      addLog(`${bot.name} encountered ${SPECIES_NAMES[species]}`);

      await api.scanFood(bot.id, food, species);
      addLog(`${bot.name} tamed ${SPECIES_NAMES[species]}`);

      const dinoName = randomDinoName();
      await api.customizeDino(bot.id, species, { name: dinoName });
      await api.setPartner(bot.id, species);
      addLog(`${bot.name} set ${dinoName} as partner`);

      updateBot(bot.id, { state: 'idle', dinos: (bot.dinos || 0) + 1 });
    } catch (err) {
      addLog(`${bot.name} auto-collect failed: ${err.message}`);
      updateBot(bot.id, { state: 'idle' });
    }
  }

  async function joinLobby(bot, code) {
    updateBot(bot.id, { state: 'trivia' });
    try {
      const joinRes = await api.joinLobby(bot.id, code);
      addLog(`${bot.name} joined lobby ${code}`);
      if (joinRes.trivia) {
        const answerIdx = Math.floor(Math.random() * 4);
        await api.answerTrivia(bot.id, code, answerIdx);
        addLog(`${bot.name} answered trivia (option ${answerIdx})`);
      }
    } catch (err) {
      addLog(`${bot.name} lobby failed: ${err.message}`);
    }
    updateBot(bot.id, { state: 'idle' });
  }

  async function bossTap(bot, count = 10) {
    updateBot(bot.id, { state: 'fighting' });
    let totalDmg = 0;
    for (let i = 0; i < count; i++) {
      try {
        const res = await api.bossTap(bot.id);
        totalDmg += res.damage || 0;
      } catch { break; }
    }
    addLog(`${bot.name} dealt ${totalDmg} total damage (${count} taps)`);
    updateBot(bot.id, { state: 'idle' });
  }

  async function bulkAction(fn) {
    await Promise.all(bots.map(fn));
  }

  return (
    <div style={styles.container}>
      {/* Controls */}
      <div style={styles.controls}>
        <button style={styles.btn} onClick={spawnBot}>Spawn Bot</button>
        <button style={styles.btnSecondary} onClick={() => bulkAction(b => autoCollect(b))} disabled={bots.length === 0}>All Auto-Collect</button>
        <div style={styles.row}>
          <input style={styles.input} placeholder="Lobby code" value={bulkLobbyCode} onInput={e => setBulkLobbyCode(e.target.value)} />
          <button style={styles.btnSecondary} onClick={() => bulkAction(b => joinLobby(b, bulkLobbyCode))} disabled={!bulkLobbyCode || bots.length === 0}>All Join</button>
        </div>
        <button style={styles.btnSecondary} onClick={() => bulkAction(b => bossTap(b))} disabled={bots.length === 0}>All Boss Tap x10</button>
      </div>

      {/* Bot list */}
      <div style={styles.botList}>
        {bots.length === 0 && <p style={styles.muted}>No bots spawned yet.</p>}
        {bots.map(bot => (
          <div key={bot.id} style={styles.botRow}>
            <div style={styles.botInfo}>
              <span style={{ ...styles.statusDot, background: bot.state === 'idle' ? '#22c55e' : '#f59e0b' }} />
              <span style={styles.botName}>{bot.name}</span>
              <span style={styles.botState}>{bot.state}</span>
              <span style={styles.botDinos}>{bot.dinos} dinos</span>
            </div>
            <div style={styles.botActions}>
              <button style={styles.btnSmall} onClick={() => autoCollect(bot)} disabled={bot.state !== 'idle'}>Collect</button>
              <button style={styles.btnSmall} onClick={() => bossTap(bot)} disabled={bot.state !== 'idle'}>Tap x10</button>
              <button style={{ ...styles.btnSmall, color: '#ef4444' }} onClick={() => removeBot(bot.id)}>X</button>
            </div>
          </div>
        ))}
      </div>

      {/* Activity log */}
      {log.length > 0 && (
        <div style={styles.logBox}>
          <h4 style={styles.logTitle}>Activity Log</h4>
          {log.map((entry, i) => (
            <div key={i} style={styles.logEntry}>{entry}</div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { padding: '16px' },
  controls: { display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' },
  row: { display: 'flex', gap: '8px' },
  btn: { padding: '10px 16px', background: '#6366f1', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: '700', fontSize: '14px', cursor: 'pointer' },
  btnSecondary: { padding: '8px 14px', background: '#374151', border: '1px solid #4b5563', borderRadius: '6px', color: '#ccc', fontSize: '13px', cursor: 'pointer' },
  btnSmall: { padding: '4px 8px', background: '#1f2937', border: '1px solid #374151', borderRadius: '4px', color: '#ccc', fontSize: '11px', cursor: 'pointer' },
  input: { flex: 1, padding: '8px', background: '#1f2937', border: '1px solid #374151', borderRadius: '6px', color: '#f0f0f0', fontSize: '13px' },
  botList: { display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' },
  botRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#111', borderRadius: '8px', border: '1px solid #222' },
  botInfo: { display: 'flex', alignItems: 'center', gap: '8px' },
  statusDot: { width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0 },
  botName: { fontSize: '13px', fontWeight: '600', color: '#e5e7eb' },
  botState: { fontSize: '11px', color: '#9ca3af' },
  botDinos: { fontSize: '11px', color: '#6b7280' },
  botActions: { display: 'flex', gap: '4px' },
  muted: { color: '#6b7280', fontSize: '13px' },
  logBox: { background: '#0a0a0a', border: '1px solid #222', borderRadius: '10px', padding: '12px', maxHeight: '250px', overflow: 'auto' },
  logTitle: { margin: '0 0 8px', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px' },
  logEntry: { fontSize: '11px', color: '#9ca3af', fontFamily: 'monospace', padding: '2px 0' },
};
