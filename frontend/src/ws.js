import { WS_URL } from './config.js';

let socket = null;
let reconnectTimer = null;
let reconnectDelay = 1000;
const MAX_RECONNECT_DELAY = 30000;
const messageHandlers = new Map();
const pendingSubscriptions = new Set();

export const ws = {
  connect() {
    if (socket && socket.readyState === WebSocket.OPEN) return;

    try {
      socket = new WebSocket(WS_URL);
    } catch {
      this.scheduleReconnect();
      return;
    }

    socket.onopen = () => {
      console.log('[WS] Connected');
      reconnectDelay = 1000;
      // Replay any subscriptions that were requested while disconnected
      for (const channel of pendingSubscriptions) {
        socket.send(JSON.stringify({ action: 'subscribe', channel }));
      }
      pendingSubscriptions.clear();
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const { channel, type, data } = msg;
        const key = `${channel}:${type}`;
        console.log('[WS] msg received:', key, 'handlers:', (messageHandlers.get(key) || []).length);

        // Call specific handlers
        const handlers = messageHandlers.get(key) || [];
        handlers.forEach(fn => fn(data));

        // Call wildcard channel handlers
        const wildcardHandlers = messageHandlers.get(`${channel}:*`) || [];
        wildcardHandlers.forEach(fn => fn(type, data));
      } catch (err) {
        console.warn('[WS] Bad message:', err);
      }
    };

    socket.onclose = () => {
      console.log('[WS] Disconnected');
      this.scheduleReconnect();
    };

    socket.onerror = () => {
      socket.close();
    };
  },

  scheduleReconnect() {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
      this.connect();
    }, reconnectDelay);
  },

  subscribe(channel) {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ action: 'subscribe', channel }));
    } else {
      pendingSubscriptions.add(channel);
    }
  },

  unsubscribe(channel) {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ action: 'unsubscribe', channel }));
    }
  },

  on(channel, type, handler) {
    const key = `${channel}:${type}`;
    if (!messageHandlers.has(key)) messageHandlers.set(key, []);
    messageHandlers.get(key).push(handler);
    return () => {
      const handlers = messageHandlers.get(key);
      if (handlers) {
        const idx = handlers.indexOf(handler);
        if (idx >= 0) handlers.splice(idx, 1);
      }
    };
  },

  off(channel, type) {
    messageHandlers.delete(`${channel}:${type}`);
  },

  disconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (socket) {
      socket.close();
      socket = null;
    }
  },
};
