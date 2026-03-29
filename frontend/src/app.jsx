import { useEffect } from 'preact/hooks';
import { store } from './store.js';
import { ws } from './ws.js';
import { useStore } from './router.jsx';
import { preloadAll } from './utils/spriteEngine.js';
import { Onboarding } from './components/Onboarding.jsx';
import { BottomNav } from './components/BottomNav.jsx';
import { DinoEncounter } from './components/DinoEncounter.jsx';
import { DinoTaming } from './components/DinoTaming.jsx';
import { FoodHarvest } from './components/FoodHarvest.jsx';
import { MyDinos } from './components/MyDinos.jsx';
import { DinoDetail } from './components/DinoDetail.jsx';
import { Plaza } from './components/Plaza.jsx';
import { PlayTogether } from './components/PlayTogether.jsx';
import { Inventory } from './components/Inventory.jsx';
import { EventScan } from './components/EventScan.jsx';
import { InspirationScan } from './components/InspirationScan.jsx';
import { NoteScan } from './components/NoteScan.jsx';
import { BossBanner } from './components/BossBanner.jsx';
import { BossFight } from './components/BossFight.jsx';
import { BossVictory } from './components/BossVictory.jsx';
import { AdminPanel } from './components/AdminPanel.jsx';
import { Profile } from './components/Profile.jsx';
import { PartnerFloat } from './components/PartnerFloat.jsx';

export function App() {
  const { loading, player, route, bossState } = useStore();

  useEffect(() => {
    store.init();
    preloadAll();

    ws.connect();

    // Wire feed handler
    ws.on('feed', 'new_entry', (data) => {
      store.addFeedEntry(data);
    });

    // Wire boss handlers (listen on both 'boss' and 'all' channels)
    const onBossStart = (data) => {
      store.setBossState({ status: 'active', ...data });
      store.navigate('/boss');
    };
    const onHpUpdate = (data) => {
      if (store.bossState) {
        store.bossState = { ...store.bossState, ...data };
        store.notify();
      }
    };
    const onBossDefeated = (data) => {
      store.setBossState({ status: 'defeated', ...data });
      // Navigation handled by BossFight.jsx after defeat animation plays
    };
    const onBossStopped = () => {
      store.setBossState({ status: 'idle' });
      store.navigate('/plaza');
    };
    ws.on('boss', 'boss_start', onBossStart);
    ws.on('boss', 'hp_update', onHpUpdate);
    ws.on('boss', 'boss_defeated', onBossDefeated);
    ws.on('boss', 'boss_stopped', onBossStopped);
    ws.on('all', 'boss_start', onBossStart);
    ws.on('all', 'hp_update', onHpUpdate);
    ws.on('all', 'boss_defeated', onBossDefeated);
    ws.on('all', 'boss_stopped', onBossStopped);
  }, []);

  // Hard-lock: redirect to /boss whenever a fight is active
  useEffect(() => {
    if (bossState?.status === 'active' && route !== '/boss' && route !== '/boss/victory' && route !== '/admin') {
      store.navigate('/boss');
    }
  }, [bossState, route]);

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
      {(route === '/plaza' || route === '/') && <PartnerFloat />}
      {!route.startsWith('/scan/') && !isBossRoute && <BottomNav />}
    </div>
  );
}

function Screen({ route }) {
  // Scan routes
  const scanDino = route.match(/^\/scan\/dino\/(\w+)/);
  if (scanDino) return <DinoEncounter species={scanDino[1]} />;

  const scanFood = route.match(/^\/scan\/food\/(\w+)/);
  if (scanFood) return <FoodHarvest foodType={scanFood[1]} />;

  const scanEvent = route.match(/^\/scan\/event\/(\w+)/);
  if (scanEvent) return <EventScan eventType={scanEvent[1]} />;

  if (route === '/scan/inspiration') return <InspirationScan />;

  const scanNote = route.match(/^\/scan\/note\/(\w+)/);
  if (scanNote) return <NoteScan noteId={scanNote[1]} />;

  // Dino detail route: /dinos/:species
  const dinoDetail = route.match(/^\/dinos\/(\w+)/);
  if (dinoDetail) return <DinoDetail species={dinoDetail[1]} />;

  // Play routes — all handled by PlayTogether
  if (route.startsWith('/play')) return <PlayTogether />;

  // Boss routes
  if (route === '/boss') return <BossFight />;
  if (route === '/boss/victory') return <BossVictory />;

  // Main screens
  switch (route) {
    case '/plaza': return <Plaza />;
    case '/dinos': return <MyDinos />;
    case '/inventory': return <Inventory />;
    case '/profile': return <Profile />;
    case '/admin': return <AdminPanel />;
    default: return <Plaza />;
  }
}


const styles = {
  loading: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh' },
  app: { display: 'flex', flexDirection: 'column', minHeight: '100dvh' },
  content: { flex: 1, overflow: 'auto', position: 'relative', minHeight: 0 },
};
