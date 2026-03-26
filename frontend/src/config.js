// Replace these after SAM deploy
export const API_URL = import.meta.env.VITE_API_URL || 'https://YOUR_API_ID.execute-api.REGION.amazonaws.com/prod';
export const WS_URL = import.meta.env.VITE_WS_URL || 'wss://YOUR_WS_ID.execute-api.REGION.amazonaws.com/prod';
export const PHOTO_BUCKET = import.meta.env.VITE_PHOTO_BUCKET || 'dino-party-photos-ACCOUNT_ID';
