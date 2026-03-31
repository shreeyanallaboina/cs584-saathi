import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, register } from '../api'
import { useAuth } from '../auth'

type Tab = 'returning' | 'new'

export default function Landing() {
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('returning')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [referral, setReferral] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (tab === 'returning') {
        const { user } = await login(username.trim(), password)
        setUser(user)
      } else {
        const { user } = await register(
          username.trim(),
          password,
          referral.trim().toUpperCase()
        )
        setUser(user)
      }
      navigate('/app', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="landing-screen">
      <img className="landing-logo landing-logo--compact" src="/logo.png" alt="Saathi" />

      <div className="card card--landing">
        <div className="tabs-inline">
          <button
            type="button"
            className={tab === 'returning' ? 'active' : ''}
            onClick={() => setTab('returning')}
          >
            I have an account
          </button>
          <button
            type="button"
            className={tab === 'new' ? 'active' : ''}
            onClick={() => setTab('new')}
          >
            I am new
          </button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleSubmit}>
          {tab === 'new' && (
            <div className="field">
              <label htmlFor="referral">Referral code (from your Lady Health Worker)</label>
              <input
                id="referral"
                value={referral}
                onChange={(e) => setReferral(e.target.value)}
                autoComplete="off"
                placeholder="e.g. DEMO1234"
                required
              />
            </div>
          )}
          <div className="field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={tab === 'new' ? 'new-password' : 'current-password'}
              required
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%' }}>
            {busy ? 'Please wait…' : tab === 'returning' ? 'Log in' : 'Create account'}
          </button>
        </form>

        <p className="muted landing-footnote">
          Your forum name is auto-generated; others never see your login username.
        </p>
      </div>

      <button
        type="button"
        className="btn btn-ghost landing-lhw-button"
        onClick={() => navigate('/lhw')}
      >
        Lady Health Worker portal — referral codes
      </button>
    </div>
  )
}
