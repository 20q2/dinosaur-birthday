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
import { EventScan } from './components/EventScan.jsx';
import { InspirationScan } from './components/InspirationScan.jsx';
import { NoteScan } from './components/NoteScan.jsx';
import { BossBanner } from './components/BossBanner.jsx';
import { BossFight } from './components/BossFight.jsx';
import { BossVictory } from './components/BossVictory.jsx';
import { AdminPanel } from './components/AdminPanel.jsx';

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
      store.navigate('/boss');
    });
    ws.on('boss', 'hp_update', (data) => {
      if (store.bossState) {
        store.bossState = { ...store.bossState, ...data };
        store.notify();
      }
    });
    ws.on('boss', 'boss_defeated', (data) => {
      store.setBossState({ status: 'defeated', ...data });
      store.navigate('/boss/victory');
    });
  }, []);

  // Admin panel is a secret page — no player auth required, no nav
  if (route === '/admin') {
    return (
      <div style={styles.app}>
        <div style={styles.content}>
          <AdminPanel />
        </div>
      </div>
    );
  }

  if (loading) {
    return <div style={styles.loading}><p>Loading...</p></div>;
  }

  if (!player) {
    if (route.startsWith('/scan/')) store.setPendingRoute(route);
    return <Onboarding />;
  }

  const isBossRoute = route === '/boss' || route === '/boss/victory';

  return (
    <div style={styles.app}>
      {/* Global boss buildup overlay — renders on any screen */}
      <BossBanner />
      <div style={styles.content}>
        <Screen route={route} />
      </div>
      {!route.startsWith('/scan/') && !isBossRoute && <BottomNav />}
    </div>
  );
}

function Screen({ route }) {
  // Scan routes
  const scanDino = route.match(/^\/scan\/dino\/(\w+)/);
  if (scanDino) return <DinoEncounter species={scanDino[1]} />;

  const scanFood = route.match(/^\/scan\/food\/(\w+)/);
  if (scanFood) return <DinoTaming foodType={scanFood[1]} />;

  const scanEvent = route.match(/^\/scan\/event\/(\w+)/);
  if (scanEvent) return <EventScan eventType={scanEvent[1]} />;

  if (route === '/scan/inspiration') return <InspirationScan />;

  const scanNote = route.match(/^\/scan\/note\/(\w+)/);
  if (scanNote) return <NoteScan noteId={scanNote[1]} />;

  // Dino detail route: /dinos/:species
  const dinoDetail = route.match(/^\/dinos\/(\w+)/);
  if (dinoDetail) return <DinoDetail species={dinoDetail[1]} />;

  // Play routes
  const playLobby = route.match(/^\/play\/lobby\/([^/]+)$/);
  if (playLobby) return <PlayLobby code={playLobby[1]} />;

  const playTrivia = route.match(/^\/play\/trivia\/([^/]+)$/);
  if (playTrivia) return <PlayTrivia code={playTrivia[1]} />;

  // Boss routes
  if (route === '/boss') return <BossFight />;
  if (route === '/boss/victory') return <BossVictory />;

  // Main screens
  switch (route) {
    case '/plaza': return <Plaza />;
    case '/dinos': return <MyDinos />;
    case '/play': return <PlayMenu />;
    case '/feed': return <FeedScreen />;
    case '/profile': return <Placeholder name="Profile" />;
    case '/admin': return <AdminPanel />;
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
