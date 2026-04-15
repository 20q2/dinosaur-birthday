import { useEffect, useRef, useState } from 'preact/hooks';
import { api } from '../api.js';
import { SPECIES } from '../data/species.js';
import { HATS } from '../data/hats.js';
import { DinoSprite } from './DinoSprite.jsx';

const BUILDUP_PHASES = [
  { phase: 1, label: 'Shadows', icon: '\uD83C\uDF11', description: 'Shadows creep over the plaza' },
  { phase: 2, label: 'Tremors', icon: '\uD83C\uDF0D', description: 'The ground starts shaking' },
  { phase: 3, label: 'Roar',    icon: '\uD83D\uDD0A', description: 'A deafening roar echoes out' },
];

export function AdminDashboard() {
  // Dashboard state
  const [dashboard, setDashboard]   = useState(null);
  const [dashLoading, setDashLoading] = useState(true);
  const [dashError, setDashError]   = useState(null);

  // Buildup state — track which phases have been triggered locally
  const [triggeredPhases, setTriggeredPhases] = useState(new Set());
  const [buildupWorking, setBuildupWorking]   = useState(null); // phase number currently in-flight

  // Boss start state
  const [bossStarted, setBossStarted]   = useState(false);
  const [bossStarting, setBossStarting] = useState(false);
  const [bossStopping, setBossStopping] = useState(false);

  // Announce state
  const [announceMsg, setAnnounceMsg]     = useState('');
  const [announceSending, setAnnounceSending] = useState(false);
  const [announceConfirm, setAnnounceConfirm] = useState(null);

  // Give all items state
  const [givingTo, setGivingTo] = useState(null); // player_id currently in-flight

  const intervalRef = useRef(null);

  // ── Fetch dashboard ──────────────────────────────────────────────────────

  async function fetchDashboard() {
    try {
      const data = await api.adminDashboard();
      setDashboard(data);
      setDashError(null);

      // Seed boss started flag from server state
      if (data.boss && data.boss.status === 'active') {
        setBossStarted(true);
      }
    } catch (err) {
      setDashError(err.message || 'Failed to load dashboard');
    } finally {
      setDashLoading(false);
    }
  }

  useEffect(() => {
    fetchDashboard();
    intervalRef.current = setInterval(fetchDashboard, 10_000);
    return () => clearInterval(intervalRef.current);
  }, []);

  // ── Buildup handlers ─────────────────────────────────────────────────────

  async function handleBuildup(phase) {
    if (triggeredPhases.has(phase) || buildupWorking !== null) return;
    setBuildupWorking(phase);
    try {
      await api.adminBossBuildup(phase);
      setTriggeredPhases(prev => new Set([...prev, phase]));
    } catch (err) {
      alert(`Buildup phase ${phase} failed: ${err.message}`);
    } finally {
      setBuildupWorking(null);
    }
  }

  // ── Boss start handler ───────────────────────────────────────────────────

  async function handleBossStart() {
    if (bossStarted || bossStarting) return;
    if (!confirm('Start the boss fight? This will push all players into the boss screen!')) return;
    setBossStarting(true);
    try {
      await api.adminBossStart();
      setBossStarted(true);
      await fetchDashboard();
    } catch (err) {
      alert(`Boss start failed: ${err.message}`);
    } finally {
      setBossStarting(false);
    }
  }

  async function handleBossStop() {
    if (bossStopping) return;
    if (!confirm('Stop the boss fight? This will reset everything and send all players back to the plaza.')) return;
    setBossStopping(true);
    try {
      await api.adminBossStop();
      setBossStarted(false);
      await fetchDashboard();
    } catch (err) {
      alert(`Stop boss failed: ${err.message}`);
    } finally {
      setBossStopping(false);
    }
  }

  // ── Announce handler ─────────────────────────────────────────────────────

  async function handleAnnounce(e) {
    e.preventDefault();
    const msg = announceMsg.trim();
    if (!msg || announceSending) return;
    setAnnounceSending(true);
    setAnnounceConfirm(null);
    try {
      await api.adminAnnounce(msg);
      setAnnounceConfirm('Announcement sent!');
      setAnnounceMsg('');
      setTimeout(() => setAnnounceConfirm(null), 4000);
    } catch (err) {
      setAnnounceConfirm(`Error: ${err.message}`);
    } finally {
      setAnnounceSending(false);
    }
  }

  // ── Give all items handler ───────────────────────────────────────────────

  async function handleGiveAllItems(playerId) {
    if (givingTo) return;
    setGivingTo(playerId);
    try {
      await api.adminGiveAllItems(playerId);
      await fetchDashboard();
    } catch (err) {
      alert(`Give all items failed: ${err.message}`);
    } finally {
      setGivingTo(null);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const boss = dashboard?.boss;
  const bossStatus = boss?.status ?? 'waiting';
  const hpPct = boss
    ? Math.max(0, Math.min(100, (boss.hp / (boss.max_hp || 1)) * 100))
    : 0;

  return (
    <div>
      <style>{`
        @keyframes adminPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.6; }
        }
        .admin-pulsing { animation: adminPulse 1.5s ease-in-out infinite; }
      `}</style>

      {/* ── Dashboard Section ─────────────────────────────────────────────── */}
      <Section title="Dashboard" icon={'\uD83D\uDCCA'}>
        {dashLoading && <p style={styles.muted}>Loading...</p>}
        {dashError  && <p style={styles.errorText}>{dashError}</p>}
        {dashboard && (
          <>
            <div style={styles.statsGrid}>
              <StatCard label="Players"      value={dashboard.players}      icon={'\uD83D\uDC65'} />
              <StatCard label="Dinos Tamed"  value={dashboard.dinos_tamed}  icon={'\uD83E\uDD95'} />
              <StatCard label="Feed Events"  value={dashboard.feed_entries} icon={'\uD83D\uDCF0'} />
              <StatCard
                label="Boss"
                value={bossStatus.toUpperCase()}
                icon={bossStatus === 'active' ? '\u2694\uFE0F' : bossStatus === 'defeated' ? '\uD83D\uDC80' : '\uD83D\uDE34'}
                valueColor={
                  bossStatus === 'active'   ? '#f87171' :
                  bossStatus === 'defeated' ? '#4ade80' :
                  '#9ca3af'
                }
              />
            </div>

            {boss && bossStatus === 'active' && (
              <div style={styles.hpWrapper}>
                <div style={styles.hpLabel}>
                  <span>Boss HP</span>
                  <span style={{ color: hpPct < 25 ? '#f87171' : '#4ade80' }}>
                    {boss.hp} / {boss.max_hp}
                  </span>
                </div>
                <div style={styles.hpBarBg}>
                  <div
                    style={{
                      ...styles.hpBarFill,
                      width: `${hpPct}%`,
                      background: hpPct < 25
                        ? 'linear-gradient(90deg, #ef4444, #f87171)'
                        : hpPct < 50
                          ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                          : 'linear-gradient(90deg, #16a34a, #4ade80)',
                    }}
                  />
                </div>
              </div>
            )}

            <p style={styles.autoRefreshNote}>Auto-refreshes every 10 seconds</p>
          </>
        )}
      </Section>

      {/* ── Boss Buildup Section ──────────────────────────────────────────── */}
      <Section title="Boss Buildup" icon={'\uD83C\uDF11'}>
        <p style={styles.sectionDesc}>
          Trigger buildup phases in sequence to build tension before the boss fight.
        </p>
        <div style={styles.buildupRow}>
          {BUILDUP_PHASES.map(({ phase, label, icon, description }) => {
            const done    = triggeredPhases.has(phase);
            const working = buildupWorking === phase;
            return (
              <button
                key={phase}
                style={{
                  ...styles.buildupBtn,
                  ...(done    ? styles.buildupBtnDone    : {}),
                  ...(working ? styles.buildupBtnWorking : {}),
                }}
                onClick={() => handleBuildup(phase)}
                disabled={done || buildupWorking !== null}
                title={description}
              >
                <span style={styles.buildupIcon}>{done ? '\u2713' : icon}</span>
                <span style={styles.buildupLabel}>
                  {working ? 'Sending...' : label}
                </span>
                <span style={styles.buildupPhase}>Phase {phase}</span>
              </button>
            );
          })}
        </div>
      </Section>

      {/* ── Boss Fight Control ────────────────────────────────────────────── */}
      <Section title="Boss Fight Control" icon={'\u2694\uFE0F'}>
        <p style={styles.sectionDesc}>
          Start the boss fight — all players will be pushed to the fight screen immediately.
        </p>
        <button
          style={{
            ...styles.bossStartBtn,
            ...(bossStarted || bossStarting ? styles.bossStartBtnDisabled : {}),
          }}
          onClick={handleBossStart}
          disabled={bossStarted || bossStarting}
          class={!bossStarted && !bossStarting ? 'admin-pulsing' : ''}
        >
          {bossStarting ? 'STARTING...' : bossStarted ? 'BOSS FIGHT ACTIVE' : 'START BOSS FIGHT'}
        </button>

        {bossStarted && boss && bossStatus === 'active' && (
          <div style={styles.liveBossInfo}>
            <div style={styles.hpLabel}>
              <span>Live HP</span>
              <span style={{ color: hpPct < 25 ? '#f87171' : '#4ade80' }}>
                {boss.hp} / {boss.max_hp}
              </span>
            </div>
            <div style={styles.hpBarBg}>
              <div
                style={{
                  ...styles.hpBarFill,
                  width: `${hpPct}%`,
                  background: hpPct < 25
                    ? 'linear-gradient(90deg, #ef4444, #f87171)'
                    : hpPct < 50
                      ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                      : 'linear-gradient(90deg, #16a34a, #4ade80)',
                }}
              />
            </div>
          </div>
        )}

        {bossStarted && bossStatus === 'defeated' && (
          <p style={{ ...styles.muted, color: '#4ade80', marginTop: '10px', fontWeight: 'bold' }}>
            Boss defeated!
          </p>
        )}

        {bossStarted && bossStatus === 'active' && (
          <button
            style={{
              ...styles.bossStopBtn,
              ...(bossStopping ? styles.bossStopBtnDisabled : {}),
            }}
            onClick={handleBossStop}
            disabled={bossStopping}
          >
            {bossStopping ? 'STOPPING...' : 'STOP BOSS FIGHT'}
          </button>
        )}
      </Section>

      {/* ── Announcements Section ─────────────────────────────────────────── */}
      <Section title="Announcements" icon={'\uD83D\uDCE2'}>
        <p style={styles.sectionDesc}>
          Post an announcement to the live feed for all players.
        </p>
        <form onSubmit={handleAnnounce} style={styles.announceForm}>
          <input
            type="text"
            value={announceMsg}
            onInput={e => setAnnounceMsg(e.target.value)}
            placeholder="Type your announcement..."
            style={styles.announceInput}
            maxLength={200}
            disabled={announceSending}
          />
          <button
            type="submit"
            style={{
              ...styles.announceBtn,
              ...(announceSending || !announceMsg.trim() ? styles.announceBtnDisabled : {}),
            }}
            disabled={announceSending || !announceMsg.trim()}
          >
            {announceSending ? 'Sending...' : 'Send'}
          </button>
        </form>
        {announceConfirm && (
          <p style={{
            ...styles.confirmText,
            color: announceConfirm.startsWith('Error') ? '#f87171' : '#4ade80',
          }}>
            {announceConfirm}
          </p>
        )}
      </Section>

      {/* ── Give Tamed Dino ───────────────────────────────────────────────── */}
      <Section title="Give Tamed Dino" icon={'\uD83E\uDD95'}>
        <GiveDinoForm players={dashboard?.player_list || []} />
      </Section>

      {/* ── Player List ───────────────────────────────────────────────────── */}
      <Section title="Players" icon={'\uD83D\uDC65'}>
        {dashLoading && <p style={styles.muted}>Loading...</p>}
        {!dashLoading && !dashboard?.player_list?.length && (
          <p style={styles.muted}>No players registered yet.</p>
        )}
        {dashboard?.player_list?.length > 0 && (
          <div style={styles.playerList}>
            {dashboard.player_list.map(p => (
              <div key={p.id} style={styles.playerRow}>
                <span style={styles.playerName}>{p.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={styles.playerDinos}>
                    {p.dino_count} dino{p.dino_count !== 1 ? 's' : ''}
                  </span>
                  <button
                    style={{
                      ...styles.giveAllBtn,
                      ...(givingTo === p.id ? styles.giveAllBtnBusy : {}),
                    }}
                    onClick={() => handleGiveAllItems(p.id)}
                    disabled={!!givingTo}
                  >
                    {givingTo === p.id ? '...' : 'Give All'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function Section({ title, icon, children }) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <span style={styles.sectionIcon}>{icon}</span>
        <h2 style={styles.sectionTitle}>{title}</h2>
      </div>
      <div style={styles.sectionBody}>{children}</div>
    </div>
  );
}

// ── Give Tamed Dino form ────────────────────────────────────────────────────
// Species list excludes secret species (godzilla is obtained via boss defeat).
const GIVEABLE_SPECIES = Object.values(SPECIES).filter(s => !s.secret);

function randomColors(regions) {
  const out = {};
  regions.forEach(r => { out[r] = Math.floor(Math.random() * 360); });
  return out;
}

function GiveDinoForm({ players }) {
  const [playerId,   setPlayerId]   = useState('');
  const [species,    setSpecies]    = useState(GIVEABLE_SPECIES[0]?.id || 'trex');
  const [level,      setLevel]      = useState(1);
  const [shiny,      setShiny]      = useState(false);
  const [hat,        setHat]        = useState('');
  const [setPartner, setSetPartner] = useState(false);
  const [name,       setName]       = useState('');
  const [colors,     setColors]     = useState(() => randomColors(SPECIES[GIVEABLE_SPECIES[0]?.id || 'trex'].regions));

  const [busy,     setBusy]     = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Reshuffle preview colors when species changes
  useEffect(() => {
    const s = SPECIES[species];
    if (s) setColors(randomColors(s.regions));
  }, [species]);

  async function handleGive() {
    if (!playerId || !species || busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      await api.adminGiveDino(playerId, species, {
        level,
        shiny,
        hat: hat || undefined,
        name: name.trim() || undefined,
        colors,
        set_partner: setPartner,
      });
      const playerName = players.find(p => p.id === playerId)?.name || 'player';
      const speciesName = SPECIES[species]?.name || species;
      setFeedback({
        ok: true,
        msg: `Gave ${shiny ? '✨ ' : ''}${speciesName} (Lv ${level}) to ${playerName}`,
      });
      // Clear form but keep player/species selections
      setName('');
    } catch (err) {
      setFeedback({ ok: false, msg: err.message || 'Failed to give dino' });
    } finally {
      setBusy(false);
      setTimeout(() => setFeedback(null), 4500);
    }
  }

  return (
    <div style={giveStyles.wrap}>
      {/* Preview */}
      <div style={giveStyles.previewBox}>
        <DinoSprite species={species} colors={colors} scale={3} hat={hat || null} />
        {shiny && <div style={giveStyles.shinyTag}>✨ SHINY</div>}
        <button
          type="button"
          style={giveStyles.reshuffleBtn}
          onClick={() => setColors(randomColors(SPECIES[species].regions))}
          title="Reshuffle colors"
        >
          ↻
        </button>
      </div>

      {/* Form rows */}
      <div style={giveStyles.row}>
        <label style={giveStyles.label}>Player</label>
        <select
          value={playerId}
          onChange={e => setPlayerId(e.target.value)}
          style={giveStyles.select}
        >
          <option value="">— Select player —</option>
          {players.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.dino_count} dino{p.dino_count !== 1 ? 's' : ''})
            </option>
          ))}
        </select>
      </div>

      <div style={giveStyles.row}>
        <label style={giveStyles.label}>Species</label>
        <select
          value={species}
          onChange={e => setSpecies(e.target.value)}
          style={giveStyles.select}
        >
          {GIVEABLE_SPECIES.map(s => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.diet})
            </option>
          ))}
        </select>
      </div>

      <div style={giveStyles.row}>
        <label style={giveStyles.label}>Level</label>
        <div style={giveStyles.levelRow}>
          <input
            type="range"
            min="1" max="5" step="1"
            value={level}
            onInput={e => setLevel(Number(e.target.value))}
            style={giveStyles.range}
          />
          <span style={giveStyles.levelVal}>Lv {level}</span>
        </div>
      </div>

      <div style={giveStyles.row}>
        <label style={giveStyles.label}>Hat</label>
        <select
          value={hat}
          onChange={e => setHat(e.target.value)}
          style={giveStyles.select}
        >
          <option value="">— None —</option>
          {HATS.map(h => (
            <option key={h.id} value={h.id}>
              {h.name} ({h.rarity})
            </option>
          ))}
        </select>
      </div>

      <div style={giveStyles.row}>
        <label style={giveStyles.label}>Name</label>
        <input
          type="text"
          value={name}
          onInput={e => setName(e.target.value)}
          placeholder="(optional)"
          maxLength={24}
          style={giveStyles.input}
        />
      </div>

      <div style={giveStyles.toggleRow}>
        <label style={giveStyles.toggleLabel}>
          <input
            type="checkbox"
            checked={shiny}
            onChange={e => setShiny(e.target.checked)}
          />
          <span>Shiny ✨</span>
        </label>
        <label style={giveStyles.toggleLabel}>
          <input
            type="checkbox"
            checked={setPartner}
            onChange={e => setSetPartner(e.target.checked)}
          />
          <span>Set as Partner</span>
        </label>
      </div>

      <button
        onClick={handleGive}
        disabled={busy || !playerId}
        style={{
          ...giveStyles.giveBtn,
          ...(busy || !playerId ? giveStyles.giveBtnDisabled : {}),
        }}
      >
        {busy ? 'Giving...' : 'Give Dino'}
      </button>

      {feedback && (
        <p style={{
          ...giveStyles.feedback,
          color: feedback.ok ? '#4ade80' : '#f87171',
        }}>
          {feedback.msg}
        </p>
      )}
    </div>
  );
}

const giveStyles = {
  wrap: { display: 'flex', flexDirection: 'column', gap: '10px' },
  previewBox: {
    position: 'relative',
    height: '140px',
    background: 'radial-gradient(ellipse at center, #1a1a2e 0%, #0d1117 70%)',
    border: '1px solid #2a2a2a',
    borderRadius: '10px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  shinyTag: {
    position: 'absolute', top: '6px', left: '6px',
    fontSize: '11px', fontWeight: '700',
    background: '#422006', color: '#facc15',
    padding: '2px 8px', borderRadius: '6px',
    border: '1px solid #92400e',
  },
  reshuffleBtn: {
    position: 'absolute', top: '6px', right: '6px',
    width: '28px', height: '28px',
    background: 'rgba(0,0,0,0.6)',
    border: '1px solid #374151',
    borderRadius: '6px',
    color: '#e5e7eb',
    fontSize: '16px',
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  row: { display: 'flex', alignItems: 'center', gap: '10px' },
  label: {
    width: '70px', flexShrink: 0,
    fontSize: '12px', fontWeight: '600', color: '#9ca3af',
    textTransform: 'uppercase', letterSpacing: '0.5px',
  },
  select: {
    flex: 1,
    padding: '8px 10px',
    background: '#1f2937',
    border: '1px solid #374151',
    borderRadius: '8px',
    color: '#f0f0f0',
    fontSize: '13px',
    outline: 'none',
  },
  input: {
    flex: 1,
    padding: '8px 10px',
    background: '#1f2937',
    border: '1px solid #374151',
    borderRadius: '8px',
    color: '#f0f0f0',
    fontSize: '13px',
    outline: 'none',
  },
  levelRow: { flex: 1, display: 'flex', alignItems: 'center', gap: '10px' },
  range: { flex: 1, accentColor: '#6366f1' },
  levelVal: {
    minWidth: '44px', textAlign: 'right',
    fontSize: '13px', fontWeight: '700', color: '#facc15',
  },
  toggleRow: {
    display: 'flex', gap: '16px', flexWrap: 'wrap',
    paddingLeft: '80px',
  },
  toggleLabel: {
    display: 'flex', alignItems: 'center', gap: '6px',
    fontSize: '13px', color: '#d1d5db', cursor: 'pointer',
  },
  giveBtn: {
    marginTop: '4px',
    padding: '12px',
    background: 'linear-gradient(135deg, #065f46, #10b981)',
    border: '1px solid #34d399',
    borderRadius: '10px',
    color: '#fff',
    fontSize: '15px',
    fontWeight: '700',
    letterSpacing: '1px',
    cursor: 'pointer',
  },
  giveBtnDisabled: {
    background: '#1f2937',
    border: '1px solid #374151',
    color: '#6b7280',
    cursor: 'not-allowed',
  },
  feedback: {
    margin: '4px 0 0',
    fontSize: '13px',
    fontWeight: '600',
    textAlign: 'center',
  },
};

function StatCard({ label, value, icon, valueColor }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statIcon}>{icon}</div>
      <div style={{ ...styles.statValue, color: valueColor || '#facc15' }}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = {
  section: {
    margin: '12px 12px 0',
    background: '#111111',
    borderRadius: '12px',
    border: '1px solid #222',
    overflow: 'hidden',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 16px',
    background: '#1a1a1a',
    borderBottom: '1px solid #222',
  },
  sectionIcon: {
    fontSize: '20px',
  },
  sectionTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '700',
    color: '#e5e7eb',
    letterSpacing: '0.5px',
  },
  sectionBody: {
    padding: '14px 16px',
  },
  sectionDesc: {
    margin: '0 0 12px',
    fontSize: '13px',
    color: '#9ca3af',
    lineHeight: '1.5',
  },

  // Stats grid
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '8px',
    marginBottom: '12px',
  },
  statCard: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '10px',
    padding: '12px',
    textAlign: 'center',
  },
  statIcon: {
    fontSize: '22px',
    marginBottom: '4px',
  },
  statValue: {
    fontSize: '20px',
    fontWeight: '800',
    color: '#facc15',
  },
  statLabel: {
    fontSize: '11px',
    color: '#6b7280',
    marginTop: '2px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  autoRefreshNote: {
    margin: '6px 0 0',
    fontSize: '11px',
    color: '#374151',
    fontStyle: 'italic',
    textAlign: 'right',
  },

  // HP bar
  hpWrapper: {
    marginTop: '8px',
  },
  hpLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    fontWeight: '600',
    color: '#d1d5db',
    marginBottom: '5px',
  },
  hpBarBg: {
    width: '100%',
    height: '16px',
    background: 'rgba(255,255,255,0.08)',
    borderRadius: '8px',
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  hpBarFill: {
    height: '100%',
    borderRadius: '8px',
    transition: 'width 0.5s ease-out',
  },

  // Buildup
  buildupRow: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  buildupBtn: {
    flex: '1 1 80px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    padding: '14px 8px',
    background: '#1f2937',
    border: '2px solid #374151',
    borderRadius: '10px',
    color: '#f0f0f0',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    minWidth: '80px',
  },
  buildupBtnDone: {
    background: '#052e16',
    border: '2px solid #15803d',
    color: '#4ade80',
    cursor: 'not-allowed',
  },
  buildupBtnWorking: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  buildupIcon: {
    fontSize: '24px',
  },
  buildupLabel: {
    fontSize: '13px',
    fontWeight: '700',
  },
  buildupPhase: {
    fontSize: '11px',
    color: '#6b7280',
  },

  // Boss start
  bossStartBtn: {
    width: '100%',
    padding: '18px',
    fontSize: '22px',
    fontWeight: '900',
    letterSpacing: '2px',
    background: 'linear-gradient(135deg, #7f1d1d, #dc2626)',
    border: '2px solid #ef4444',
    borderRadius: '12px',
    color: '#ffffff',
    cursor: 'pointer',
    textShadow: '0 0 10px rgba(255,255,255,0.3)',
    boxShadow: '0 0 20px rgba(239,68,68,0.3)',
    transition: 'all 0.15s ease',
  },
  bossStartBtnDisabled: {
    background: '#1f2937',
    border: '2px solid #374151',
    color: '#6b7280',
    cursor: 'not-allowed',
    boxShadow: 'none',
    textShadow: 'none',
  },
  liveBossInfo: {
    marginTop: '14px',
  },
  bossStopBtn: {
    width: '100%',
    marginTop: '10px',
    padding: '14px',
    fontSize: '16px',
    fontWeight: '700',
    letterSpacing: '1px',
    background: '#1a0000',
    border: '2px solid #7f1d1d',
    borderRadius: '12px',
    color: '#f87171',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  bossStopBtnDisabled: {
    background: '#1f2937',
    border: '2px solid #374151',
    color: '#6b7280',
    cursor: 'not-allowed',
  },

  // Announce
  announceForm: {
    display: 'flex',
    gap: '8px',
  },
  announceInput: {
    flex: 1,
    padding: '10px 12px',
    background: '#1f2937',
    border: '1px solid #374151',
    borderRadius: '8px',
    color: '#f0f0f0',
    fontSize: '14px',
    outline: 'none',
  },
  announceBtn: {
    padding: '10px 18px',
    background: '#1d4ed8',
    border: '1px solid #2563eb',
    borderRadius: '8px',
    color: '#fff',
    fontWeight: '700',
    fontSize: '14px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  announceBtnDisabled: {
    background: '#1f2937',
    border: '1px solid #374151',
    color: '#6b7280',
    cursor: 'not-allowed',
  },
  confirmText: {
    margin: '8px 0 0',
    fontSize: '13px',
    fontWeight: '600',
  },

  // Player list
  playerList: {
    maxHeight: '300px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  playerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 10px',
    background: '#1a1a1a',
    borderRadius: '6px',
  },
  playerName: {
    fontSize: '14px',
    color: '#e5e7eb',
    fontWeight: '500',
  },
  playerDinos: {
    fontSize: '12px',
    color: '#6b7280',
  },

  giveAllBtn: {
    padding: '4px 10px',
    fontSize: '11px',
    fontWeight: '700',
    background: '#1d4ed8',
    border: '1px solid #2563eb',
    borderRadius: '6px',
    color: '#fff',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  giveAllBtnBusy: {
    background: '#1f2937',
    border: '1px solid #374151',
    color: '#6b7280',
    cursor: 'not-allowed',
  },
  muted: {
    color: '#6b7280',
    fontSize: '13px',
    margin: 0,
  },
  errorText: {
    color: '#f87171',
    fontSize: '13px',
    margin: 0,
  },
};
