import { useEffect } from 'preact/hooks';
import { store } from './store.js';
import { useStore } from './router.jsx';
import { Onboarding } from './components/Onboarding.jsx';

export function App() {
  const { loading, player, route } = useStore();

  useEffect(() => { store.init(); }, []);

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh' }}>
      <p>Loading...</p>
    </div>;
  }

  // Not registered — show onboarding (but save pending route if it's a scan)
  if (!player) {
    if (route.startsWith('/scan/')) {
      store.setPendingRoute(route);
    }
    return <Onboarding />;
  }

  // Placeholder for routed screens — will be filled in later tasks
  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h2>Welcome, {player.name}!</h2>
      <p>Route: {route}</p>
      <p>Dinos: {player.dinos.length}/7</p>
    </div>
  );
}
