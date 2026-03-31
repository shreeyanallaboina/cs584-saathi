import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'

export default function AppShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/', { replace: true })
  }

  return (
    <div className="app-shell">
      <header
        style={{
          padding: '0.65rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          background: 'linear-gradient(180deg, rgba(248,131,137,0.35) 0%, transparent 100%)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <img
            src="/logo.png"
            alt="Saathi"
            style={{
              width: 110,
              height: 'auto',
              display: 'block',
            }}
          />
          {user && (
            <div className="muted" style={{ fontSize: '0.75rem' }}>
              Forum name: {user.anonymous_handle}
            </div>
          )}
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ padding: '0.35rem 0.65rem', position: 'absolute', right: '1rem' }}
          onClick={handleLogout}
        >
          Log out
        </button>
      </header>

      <main className="app-main">
        <div className="outlet-fill">
          <Outlet />
        </div>
      </main>

      <nav className="bottom-ribbon" aria-label="Main">
        <NavLink to="/app" end className={({ isActive }) => (isActive ? 'active' : '')}>
          Home
        </NavLink>
        <NavLink to="/app/chat" className={({ isActive }) => (isActive ? 'active' : '')}>
          Chatbot
        </NavLink>
        <NavLink to="/app/forum" className={({ isActive }) => (isActive ? 'active' : '')}>
          Forum
        </NavLink>
      </nav>
    </div>
  )
}
