import { Outlet, NavLink } from 'react-router-dom';

// Frame for the pages anyone can open without signing in (leaderboard, results): a header with links, no player menu.
const links = [
  { to: '/leaderboard', label: 'Leaderboard' },
  { to: '/history', label: 'Results' },
  { to: '/schedule', label: 'Schedule' },
];

export default function PublicShell() {
  return (
    <div className="fade-in" style={{ maxWidth: 1000, margin: '0 auto', padding: '16px 16px 40px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22 }}>BARNBOY GROUP</div>
        <nav aria-label="Pages" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {links.map(l => (
            <NavLink key={l.to} to={l.to} className="btn btn-secondary btn-sm" style={({ isActive }) => ({ minHeight: 44, justifyContent: 'center', ...(isActive ? { background: 'var(--green-light)' } : {}) })}>{l.label}</NavLink>
          ))}
          <a href="/login" className="btn btn-primary btn-sm" style={{ minHeight: 44, justifyContent: 'center' }}>Sign in</a>
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
