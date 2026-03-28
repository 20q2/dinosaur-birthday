import { api } from './api.js';
import { generateId } from './utils/uuid.js';

const PLAYER_ID_KEY = 'dino_party_player_id';
const PENDING_ROUTE_KEY = 'dino_party_pending_route';

const listeners = new Set();

export const store = {
  // State
  playerId: localStorage.getItem(PLAYER_ID_KEY),
  player: null,
  loading: true,
  route: window.location.hash.slice(1) || '/plaza',
  bossState: null,
  feedEntries: [],
  // Lobby / play session state (ephemeral, not persisted)
  lobbyRole: null,   // 'host' | 'guest' | null
  lobbyTrivia: null, // { question, options } set when guest joins

  // Initialize
  async init() {
    const [playerResult, bossResult] = await Promise.allSettled([
      this.playerId ? api.getPlayer(this.playerId) : Promise.resolve(null),
      api.getBossState(),
    ]);

    if (playerResult.status === 'fulfilled' && playerResult.value) {
      this.player = playerResult.value;
    }
    if (bossResult.status === 'fulfilled' && bossResult.value) {
      this.bossState = bossResult.value;
    }
    this.loading = false;
    this.notify();
  },

  // Auth
  async register(name, photoUrl) {
    const id = generateId();
    const player = await api.createPlayer(id, name, photoUrl);
    localStorage.setItem(PLAYER_ID_KEY, id);
    this.playerId = id;
    this.player = { ...player, dinos: [], items: [], notes: [], inspiration: false };
    this.notify();
    return player;
  },

  isRegistered() {
    return !!this.playerId;
  },

  // Refresh player data
  async refresh() {
    if (!this.playerId) return;
    this.player = await api.getPlayer(this.playerId);
    this.notify();
  },

  // Routing
  navigate(route) {
    this.route = route;
    window.location.hash = route;
    this.notify();
  },

  setPendingRoute(route) {
    localStorage.setItem(PENDING_ROUTE_KEY, route);
  },

  popPendingRoute() {
    const route = localStorage.getItem(PENDING_ROUTE_KEY);
    localStorage.removeItem(PENDING_ROUTE_KEY);
    return route;
  },

  // Feed
  addFeedEntry(entry) {
    if (this.feedEntries.some(e => e.id === entry.id)) return;
    this.feedEntries = [entry, ...this.feedEntries].slice(0, 100);
    this.notify();
  },

  // Boss
  setBossState(state) {
    this.bossState = state;
    this.notify();
  },

  // Subscriptions
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  notify() {
    listeners.forEach(fn => fn());
  },
};

// Listen for hash changes
window.addEventListener('hashchange', () => {
  store.route = window.location.hash.slice(1) || '/plaza';
  store.notify();
});
