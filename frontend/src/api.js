import { API_URL } from './config.js';

async function request(method, path, body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);

  const resp = await fetch(`${API_URL}${path}`, opts);
  const data = await resp.json();

  if (!resp.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  createPlayer: (id, name, photoUrl) =>
    request('POST', '/player', { id, name, photo_url: photoUrl }),

  getPlayer: (id) =>
    request('GET', `/player/${id}`),

  scanDino: (playerId, species) =>
    request('POST', `/scan/dino/${species}`, { player_id: playerId }),

  scanFood: (playerId, type, species) =>
    request('POST', `/scan/food/${type}`, { player_id: playerId, species }),

  scanEvent: (playerId, type, description) =>
    request('POST', `/scan/event/${type}`, { player_id: playerId, description }),

  scanInspiration: (playerId) =>
    request('POST', '/scan/inspiration', { player_id: playerId }),

  scanNote: (playerId, noteId) =>
    request('POST', `/scan/note/${noteId}`, { player_id: playerId }),

  createLobby: (playerId) =>
    request('POST', '/lobby', { player_id: playerId }),

  joinLobby: (playerId, code) =>
    request('POST', `/lobby/${code}/join`, { player_id: playerId }),

  answerTrivia: (playerId, code, answerIndex) =>
    request('POST', `/lobby/${code}/answer`, { player_id: playerId, answer: answerIndex }),

  customizeDino: (playerId, species, updates) =>
    request('PUT', `/dino/${species}/customize`, { player_id: playerId, ...updates }),

  setPartner: (playerId, species) =>
    request('PUT', `/dino/${species}/partner`, { player_id: playerId }),

  bossTap: (playerId) =>
    request('POST', '/boss/tap', { player_id: playerId }),

  adminBossBuildup: () =>
    request('POST', '/admin/boss/buildup'),

  adminBossStart: () =>
    request('POST', '/admin/boss/start'),

  adminAnnounce: (message) =>
    request('POST', '/admin/announce', { message }),

  adminDashboard: () =>
    request('GET', '/admin/dashboard'),

  getPlaza: () => request('GET', '/plaza'),

  getFeed: () => request('GET', '/feed'),
};
