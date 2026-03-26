import { useEffect, useState } from 'preact/hooks';
import { store } from './store.js';

export function useStore() {
  const [, setTick] = useState(0);
  useEffect(() => store.subscribe(() => setTick(t => t + 1)), []);
  return store;
}
