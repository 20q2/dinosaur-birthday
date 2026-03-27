// Replace these after SAM deploy
export const API_URL = (import.meta.env.VITE_API_URL || 'https://r4kavavnmc.execute-api.us-east-1.amazonaws.com/prod').replace(/\/+$/, '');
export const WS_URL = import.meta.env.VITE_WS_URL || 'wss://b4p2l34a4m.execute-api.us-east-1.amazonaws.com/prod';
export const PHOTO_BUCKET = import.meta.env.VITE_PHOTO_BUCKET || 'dino-party-photos-991712158652';
