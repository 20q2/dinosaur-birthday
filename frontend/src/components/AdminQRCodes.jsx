import { store } from '../store.js';

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
      { label: 'Stegosaurus', route: '/scan/dino/stegosaurus', sub: 'Herbivore', subColor: '#22c55e' },
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

export function AdminQRCodes() {
  return (
    <div style={styles.container}>
      <p style={styles.desc}>Click any button to navigate to that scan route as the current player.</p>
      {QR_GROUPS.map(group => (
        <div key={group.title} style={styles.group}>
          <h3 style={{ ...styles.groupTitle, color: group.color }}>{group.title}</h3>
          <div style={styles.grid}>
            {group.items.map(item => (
              <button
                key={item.route}
                style={styles.qrBtn}
                onClick={() => store.navigate(item.route)}
              >
                <span style={styles.qrLabel}>{item.label}</span>
                <span style={{ ...styles.qrSub, color: item.subColor }}>{item.sub}</span>
              </button>
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
    marginBottom: '20px',
  },
  groupTitle: {
    margin: '0 0 8px',
    fontSize: '14px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '8px',
  },
  qrBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    padding: '14px 8px',
    background: '#111',
    border: '1px solid #333',
    borderRadius: '10px',
    color: '#f0f0f0',
    cursor: 'pointer',
  },
  qrLabel: {
    fontSize: '13px',
    fontWeight: '600',
    textAlign: 'center',
  },
  qrSub: {
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
};
