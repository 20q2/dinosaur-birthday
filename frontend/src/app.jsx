import { useEffect } from 'preact/hooks';
import { store } from './store.js';
import { useStore } from './router.jsx';
import { Onboarding } from './components/Onboarding.jsx';
import { BottomNav } from './components/BottomNav.jsx';
import { DinoEncounter } from './components/DinoEncounter.jsx';
import { DinoTaming } from './components/DinoTaming.jsx';
import { MyDinos } from './components/MyDinos.jsx';
import { DinoDetail } from './components/DinoDetail.jsx';
import { Plaza } from './components/Plaza.jsx';

export function App() {
  const { loading, player, route } = useStore();

  useEffect(() => { store.init(); }, []);

  if (loading) {
    return <div style={styles.loading}><p>Loading...</p></div>;
  }

  if (!player) {
    if (route.startsWith('/scan/')) store.setPendingRoute(route);
    return <Onboarding />;
  }

  return (
    <div style={styles.app}>
      <div style={styles.content}>
        <Screen route={route} />
      </div>
      {!route.startsWith('/scan/') && <BottomNav />}
    </div>
  );
}

function Screen({ route }) {
  // Scan routes
  const scanDino = route.match(/^\/scan\/dino\/(\w+)/);
  if (scanDino) return <DinoEncounter species={scanDino[1]} />;

  const scanFood = route.match(/^\/scan\/food\/(\w+)/);
  if (scanFood) return <DinoTaming foodType={scanFood[1]} />;

  // Dino detail route: /dinos/:species
  const dinoDetail = route.match(/^\/dinos\/(\w+)/);
  if (dinoDetail) return <DinoDetail species={dinoDetail[1]} />;

  // Main screens
  switch (route) {
    case '/plaza': return <Plaza />;
    case '/dinos': return <MyDinos />;
    case '/play': return <Placeholder name="Play" />;
    case '/feed': return <Placeholder name="Feed" />;
    case '/profile': return <Placeholder name="Profile" />;
    default: return <Plaza />;
  }
}

function Placeholder({ name }) {
  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h2>{name}</h2>
      <p style={{ color: '#888' }}>Coming soon...</p>
    </div>
  );
}

const styles = {
  loading: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh' },
  app: { display: 'flex', flexDirection: 'column', minHeight: '100dvh' },
  content: { flex: 1, overflow: 'auto' },
};
