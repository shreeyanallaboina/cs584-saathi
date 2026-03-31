import { Link } from 'react-router-dom'
import { useAuth } from '../auth'

export default function Home() {
  const { user } = useAuth()

  return (
    <div className="page-pad outlet-scroll">
      <h2 style={{ marginTop: 0 }}>Welcome{user ? `, ${user.username}` : ''}</h2>
      <p>
        Saathi answers common questions from a curated health library. If we are less than 75% sure,
        your question can be shared — anonymously — with the community forum.
      </p>

      <div className="card" style={{ marginTop: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Topics we support</h3>
        <ul style={{ paddingLeft: '1.1rem', marginBottom: 0 }}>
          <li>Contraception</li>
          <li>Menstrual Health</li>
          <li>Abortion</li>
        </ul>
      </div>

      <div style={{ display: 'grid', gap: '0.65rem', marginTop: '1.25rem' }}>
        <Link className="btn btn-primary" to="/app/chat" style={{ textDecoration: 'none' }}>
          Talk to Saathi
        </Link>
        <Link className="btn btn-secondary" to="/app/forum" style={{ textDecoration: 'none' }}>
          Browse community forum
        </Link>
      </div>
    </div>
  )
}
