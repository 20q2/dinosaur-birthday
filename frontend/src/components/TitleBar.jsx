import { store } from '../store.js';

export function TitleBar({ title, subtitle, back, transparent }) {
  return (
    <div style={{
      ...styles.bar,
      ...(transparent ? styles.transparent : {}),
    }}>
      <div style={styles.left}>
        {back && (
          <button onClick={() => store.navigate(back)} style={styles.backBtn}>
            ‹
          </button>
        )}
      </div>
      <div style={styles.center}>
        <div style={styles.title}>{title}</div>
        {subtitle && <div style={styles.subtitle}>{subtitle}</div>}
      </div>
      <div style={styles.right} />
    </div>
  );
}

const styles = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 12px',
    background: '#0d1117',
    borderBottom: '1px solid #222',
    flexShrink: 0,
    minHeight: '48px',
    zIndex: 10,
  },
  transparent: {
    background: 'rgba(0,0,0,0.45)',
    borderBottom: 'none',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  left: {
    width: '48px',
    flexShrink: 0,
  },
  center: {
    flex: 1,
    textAlign: 'center',
  },
  right: {
    width: '48px',
    flexShrink: 0,
  },
  title: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#e0e0e0',
    letterSpacing: '0.5px',
  },
  subtitle: {
    fontSize: '11px',
    color: '#888',
    marginTop: '1px',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: '#4ade80',
    fontSize: '28px',
    cursor: 'pointer',
    padding: '0 4px',
    lineHeight: 1,
  },
};
