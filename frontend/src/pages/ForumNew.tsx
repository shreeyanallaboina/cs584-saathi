import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { createForumPost, fetchTopics } from '../api'
import { useAuth } from '../auth'

const LABELS: Record<string, string> = {
  contraception: 'Contraception',
  abortion: 'Abortion',
  menstrual_health: 'Menstrual Health',
}

export default function ForumNew() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation() as {
    state?: { body?: string; topic?: string }
  }
  const [topics, setTopics] = useState<string[]>([])
  const [topic, setTopic] = useState('menstrual_health')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetchTopics()
      .then((t) => setTopics(t.topics))
      .catch(() => setTopics(['contraception', 'abortion', 'menstrual_health']))
  }, [])

  useEffect(() => {
    const st = location.state
    if (st?.body) setBody(st.body)
    if (st?.topic && ['contraception', 'abortion', 'menstrual_health'].includes(st.topic)) {
      setTopic(st.topic)
    }
    if (st?.body && !title) {
      setTitle('Question from Saathi chat')
    }
  }, [location.state, title])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setError(null)
    setBusy(true)
    try {
      await createForumPost({
        user_id: user.id,
        topic,
        title: title.trim(),
        body: body.trim(),
        source: location.state?.body ? 'chatbot_redirect' : 'forum',
      })
      navigate('/app/forum', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create post')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-pad outlet-scroll">
      <p>
        <Link to="/app/forum">← Back to forum</Link>
      </p>
      <h2 style={{ marginTop: 0 }}>New anonymous post</h2>
      <p className="muted">You will appear as <strong>{user?.anonymous_handle}</strong> — not your username.</p>

      {error && <div className="error-banner">{error}</div>}

      <form className="card" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="post-topic">Topic</label>
          <select id="post-topic" value={topic} onChange={(e) => setTopic(e.target.value)} required>
            {topics.map((t) => (
              <option key={t} value={t}>
                {LABELS[t] || t}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="post-title">Title</label>
          <input id="post-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="post-body">Question</label>
          <textarea id="post-body" value={body} onChange={(e) => setBody(e.target.value)} required rows={5} />
        </div>
        <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%' }}>
          {busy ? 'Posting…' : 'Post to forum'}
        </button>
      </form>
    </div>
  )
}
