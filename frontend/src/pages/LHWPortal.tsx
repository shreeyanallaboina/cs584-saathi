import { useState } from 'react'
import { Link } from 'react-router-dom'
import { generateReferralCode, lhwLogin } from '../api'

export default function LHWPortal() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loggedIn, setLoggedIn] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [lastCode, setLastCode] = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await lhwLogin(username.trim(), password)
      setLoggedIn(true)
      setLastCode(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleGenerate() {
    setError(null)
    setBusy(true)
    try {
      const { code } = await generateReferralCode(username.trim(), password)
      setLastCode(code)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate code')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-pad">
      <p>
        <Link to="/">← Back to Saathi home</Link>
      </p>
      <h1 className="landing-title" style={{ fontSize: '1.2rem' }}>
        LHW portal
      </h1>
      <p className="landing-sub">Log in to create single-use referral codes for new users.</p>

      <div className="card">
        {!loggedIn ? (
          <>
            {error && <div className="error-banner">{error}</div>}
            <form onSubmit={handleLogin}>
              <div className="field">
                <label htmlFor="lhw-user">LHW username</label>
                <input
                  id="lhw-user"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="lhw-pass">Password</label>
                <input
                  id="lhw-pass"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%' }}>
                {busy ? 'Please wait…' : 'Log in as LHW'}
              </button>
            </form>
          </>
        ) : (
          <>
            {error && <div className="error-banner">{error}</div>}
            <p>
              Signed in as <strong>{username}</strong>
            </p>
            <button
              className="btn btn-primary"
              type="button"
              onClick={handleGenerate}
              disabled={busy}
              style={{ width: '100%', marginBottom: '0.75rem' }}
            >
              {busy ? 'Generating…' : 'Generate new referral code'}
            </button>
            {lastCode && (
              <div
                style={{
                  padding: '0.75rem',
                  borderRadius: 12,
                  background: 'rgba(0, 80, 48, 0.08)',
                  textAlign: 'center',
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                }}
              >
                {lastCode}
              </div>
            )}
            <p className="muted">Share this code once with one woman. It is marked used after signup.</p>
            <button
              className="btn btn-ghost"
              type="button"
              style={{ width: '100%', marginTop: '0.5rem' }}
              onClick={() => {
                setLoggedIn(false)
                setLastCode(null)
                setPassword('')
              }}
            >
              Sign out
            </button>
          </>
        )}
      </div>
    </div>
  )
}
