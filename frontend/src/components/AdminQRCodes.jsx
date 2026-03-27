import { useState } from 'preact/hooks';

const QR_GROUPS = [
  {
    title: 'Dinos',
    color: '#f59e0b',
    items: [
      { label: 'T-Rex', route: '/scan/dino/trex', sub: 'Carnivore', subColor: '#ef4444' },
      { label: 'Spinosaurus', route: '/scan/dino/spinosaurus', sub: 'Carnivore', subColor: '#ef4444' },
      { label: 'Dilophosaurus', route: '/scan/dino/dilophosaurus', sub: 'Carnivore', subColor: '#ef4444' },
      { label: 'Pachycephalosaurus', route: '/scan/dino/pachycephalosaurus', sub: 'Herbivore', subColor: '#22c55e' },
      { label: 'Parasaurolophus', route: '/scan/dino/parasaurolophus', sub: 'Herbivore', subColor: '#22c55e' },
      { label: 'Ankylosaurus', route: '/scan/dino/ankylosaurus', sub: 'Herbivore', subColor: '#22c55e' },
      { label: 'Triceratops', route: '/scan/dino/triceratops', sub: 'Herbivore', subColor: '#22c55e' },
    ],
  },
  {
    title: 'Food',
    color: '#22c55e',
    items: [
      { label: 'Meat', route: '/scan/food/meat', sub: 'FOOD', subColor: '#ef4444' },
      { label: 'Mejoberries', route: '/scan/food/mejoberries', sub: 'FOOD', subColor: '#22c55e' },
    ],
  },
  {
    title: 'Events',
    color: '#6366f1',
    items: [
      { label: 'Cooking Pot', route: '/scan/event/cooking_pot', sub: 'EVENT', subColor: '#6366f1' },
      { label: 'Dance Floor', route: '/scan/event/dance_floor', sub: 'EVENT', subColor: '#6366f1' },
      { label: 'Photo Booth', route: '/scan/event/photo_booth', sub: 'EVENT', subColor: '#6366f1' },
      { label: 'Cake Table', route: '/scan/event/cake_table', sub: 'EVENT', subColor: '#6366f1' },
      { label: 'Mystery Chest', route: '/scan/event/mystery_chest', sub: 'EVENT', subColor: '#6366f1' },
    ],
  },
  {
    title: 'Special',
    color: '#f59e0b',
    items: [
      { label: "Alex's Inspiration", route: '/scan/inspiration', sub: 'SPECIAL', subColor: '#f59e0b' },
    ],
  },
  {
    title: 'Explorer Notes',
    color: '#888',
    items: [
      { label: 'Note #1', route: '/scan/note/1', sub: 'NOTE', subColor: '#888' },
      { label: 'Note #2', route: '/scan/note/2', sub: 'NOTE', subColor: '#888' },
      { label: 'Note #3', route: '/scan/note/3', sub: 'NOTE', subColor: '#888' },
      { label: 'Note #4', route: '/scan/note/4', sub: 'NOTE', subColor: '#888' },
      { label: 'Note #5', route: '/scan/note/5', sub: 'NOTE', subColor: '#888' },
    ],
  },
];

const SITE_BASE = import.meta.env.VITE_SITE_URL || 'https://20q2.github.io/dinosaur-birthday/';

function getQrUrl(route, size) {
  const base = SITE_BASE.replace(/\/+$/, '');
  const fullUrl = base + '/#' + route;
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(fullUrl)}&margin=4`;
}

export function AdminQRCodes() {
  const [printGroup, setPrintGroup] = useState(null);

  // Print-friendly full-page view for a single group
  if (printGroup) {
    const group = QR_GROUPS.find(g => g.title === printGroup);
    return (
      <div style={styles.printContainer}>
        <div style={styles.printHeader}>
          <button style={styles.backBtn} onClick={() => setPrintGroup(null)}>Back</button>
          <h2 style={{ margin: 0, color: group.color }}>{group.title}</h2>
          <button style={styles.printBtn} onClick={() => window.print()}>Print</button>
        </div>
        <div style={styles.printGrid}>
          {group.items.map(item => (
            <div key={item.route} style={styles.printCard}>
              <img
                src={getQrUrl(item.route, 300)}
                alt={item.label}
                style={styles.printQrImg}
              />
              <div style={styles.printLabel}>{item.label}</div>
              <div style={{ ...styles.printSub, color: item.subColor }}>{item.sub}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <p style={styles.desc}>QR codes for all scan routes. Click a group's print button to get a printable layout.</p>
      {QR_GROUPS.map(group => (
        <div key={group.title} style={styles.group}>
          <div style={styles.groupHeader}>
            <h3 style={{ ...styles.groupTitle, color: group.color }}>{group.title}</h3>
            <button style={styles.groupPrintBtn} onClick={() => setPrintGroup(group.title)}>
              Print view
            </button>
          </div>
          <div style={styles.grid}>
            {group.items.map(item => (
              <div
                key={item.route}
                style={styles.card}
                onClick={() => window.open('#' + item.route, '_blank')}
              >
                <img
                  src={getQrUrl(item.route, 200)}
                  alt={item.label}
                  style={styles.qrImg}
                  loading="lazy"
                />
                <div style={styles.label}>{item.label}</div>
                <div style={{ ...styles.sub, color: item.subColor }}>{item.sub}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const styles = {
  container: {
    padding: '16px',
  },
  desc: {
    margin: '0 0 16px',
    fontSize: '13px',
    color: '#9ca3af',
  },
  group: {
    marginBottom: '24px',
  },
  groupHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '10px',
  },
  groupTitle: {
    margin: 0,
    fontSize: '14px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  groupPrintBtn: {
    padding: '4px 12px',
    background: 'none',
    border: '1px solid #555',
    borderRadius: '6px',
    color: '#aaa',
    fontSize: '11px',
    cursor: 'pointer',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: '12px',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    padding: '12px 8px 10px',
    background: '#111',
    border: '1px solid #333',
    borderRadius: '10px',
    cursor: 'pointer',
  },
  qrImg: {
    width: '120px',
    height: '120px',
    borderRadius: '6px',
    background: '#fff',
  },
  label: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#f0f0f0',
    textAlign: 'center',
  },
  sub: {
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  // Print view styles
  printContainer: {
    padding: '16px',
  },
  printHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '20px',
  },
  backBtn: {
    padding: '6px 16px',
    background: '#333',
    border: 'none',
    borderRadius: '6px',
    color: '#f0f0f0',
    fontSize: '13px',
    cursor: 'pointer',
  },
  printBtn: {
    padding: '6px 16px',
    background: '#4ade80',
    border: 'none',
    borderRadius: '6px',
    color: '#14532d',
    fontSize: '13px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  printGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '20px',
  },
  printCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '16px 12px',
    background: '#111',
    border: '1px solid #333',
    borderRadius: '12px',
  },
  printQrImg: {
    width: '180px',
    height: '180px',
    borderRadius: '8px',
    background: '#fff',
  },
  printLabel: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#f0f0f0',
    textAlign: 'center',
  },
  printSub: {
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
};
