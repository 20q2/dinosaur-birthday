import { useEffect } from 'preact/hooks';
import { store } from './store.js';
import { ws } from './ws.js';
import { useStore } from './router.jsx';
import { Onboarding } from './components/Onboarding.jsx';
import { BottomNav } from './components/BottomNav.jsx';
import { DinoEncounter } from './components/DinoEncounter.jsx';
import { DinoTaming } from './components/DinoTaming.jsx';
import { MyDinos } from './components/MyDinos.jsx';
import { DinoDetail } from './components/DinoDetail.jsx';
import { Plaza } from './components/Plaza.jsx';
import { PlayMenu } from './components/PlayMenu.jsx';
import { PlayLobby } from './components/PlayLobby.jsx';
import { PlayTrivia } from './components/PlayTrivia.jsx';
import { FeedScreen } from './components/FeedScreen.jsx';

export function App() {
  const { loading, player, route } = useStore();

  useEffect(() => {
    store.init();

    ws.connect();

    // Wire feed handler
    ws.on('feed', 'new_entry', (data) => {
      store.addFeedEntry(data);
    });

    // Wire boss handlers
    ws.on('boss', 'boss_start', (data) => {
      store.setBossState({ status: 'active', ...data });
    });
    ws.on('boss', 'hp_update', (data) => {
      if (store.bossState) {
        store.bossState = { ...store.bossState, ...data };
        store.notify();
      }
    });
    ws.on('boss', 'boss_defeated', (data) => {
      store.setBossState({ status: 'defeated', ...data });
    });
  }, []);

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

  // Play routes
  const playLobby = route.match(/^\/play\/lobby\/([^/]+)$/);
  if (playLobby) return <PlayLobby code={playLobby[1]} />;

  const playTrivia = route.match(/^\/play\/trivia\/([^/]+)$/);
  if (playTrivia) return <PlayTrivia code={playTrivia[1]} />;

  // Main screens
  switch (route) {
    case '/plaza': return <Plaza />;
    case '/dinos': return <MyDinos />;
    case '/play': return <PlayMenu />;
    case '/feed': return <FeedScreen />;
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
