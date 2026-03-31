import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  fetchForumPosts,
  fetchReplies,
  postReply,
  togglePostLike,
  toggleReplyLike,
  type ForumPost,
  type ForumReply,
} from '../api'
import { useAuth } from '../auth'

type FilterTopic = '' | 'contraception' | 'menstrual_health' | 'abortion'

function topicLabel(t: string) {
  if (t === 'menstrual_health') return 'Menstrual Health'
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export default function ForumPage() {
  const { user } = useAuth()
  const [posts, setPosts] = useState<ForumPost[]>([])
  const [filterTopic, setFilterTopic] = useState<FilterTopic>('')
  const [replies, setReplies] = useState<Record<number, ForumReply[]>>({})
  const [replyText, setReplyText] = useState<Record<number, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [likeBusy, setLikeBusy] = useState<Record<string, boolean>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { posts: p } = await fetchForumPosts(user?.id)
      setPosts(p)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load forum')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setReplies({})
  }, [user?.id])

  async function ensureReplies(postId: number) {
    if (replies[postId]) return
    try {
      const { replies: r } = await fetchReplies(postId, user?.id)
      setReplies((prev) => ({ ...prev, [postId]: r }))
    } catch {
      setReplies((prev) => ({ ...prev, [postId]: [] }))
    }
  }

  async function submitReply(postId: number) {
    if (!user) return
    const body = (replyText[postId] || '').trim()
    if (!body) return
    setError(null)
    try {
      await postReply(postId, user.id, body)
      const { replies: r } = await fetchReplies(postId, user.id)
      setReplies((prev) => ({ ...prev, [postId]: r }))
      setReplyText((prev) => ({ ...prev, [postId]: '' }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reply failed')
    }
  }

  async function onTogglePostLike(postId: number) {
    if (!user) return
    const key = `p-${postId}`
    if (likeBusy[key]) return
    setLikeBusy((b) => ({ ...b, [key]: true }))
    try {
      const { liked, like_count } = await togglePostLike(postId, user.id)
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, liked, like_count } : p
        )
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update like')
    } finally {
      setLikeBusy((b) => ({ ...b, [key]: false }))
    }
  }

  async function onToggleReplyLike(replyId: number, postId: number) {
    if (!user) return
    const key = `r-${replyId}`
    if (likeBusy[key]) return
    setLikeBusy((b) => ({ ...b, [key]: true }))
    try {
      const { liked, like_count } = await toggleReplyLike(replyId, user.id)
      setReplies((prev) => ({
        ...prev,
        [postId]: (prev[postId] || []).map((r) =>
          r.id === replyId ? { ...r, liked, like_count } : r
        ),
      }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update like')
    } finally {
      setLikeBusy((b) => ({ ...b, [key]: false }))
    }
  }

  const visiblePosts = filterTopic ? posts.filter((p) => p.topic === filterTopic) : posts

  return (
    <div className="forum-page outlet-scroll">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <h2 style={{ margin: 0 }}>Community forum</h2>
        <Link className="btn btn-secondary" to="/app/forum/new" style={{ textDecoration: 'none', fontSize: '0.85rem' }}>
          New post
        </Link>
      </div>

      <div className="topic-filter" role="tablist" aria-label="Filter by topic">
        <button
          type="button"
          className={`topic-filter__pill ${filterTopic === '' ? 'topic-filter__pill--active' : ''}`}
          onClick={() => setFilterTopic('')}
          role="tab"
          aria-selected={filterTopic === ''}
        >
          All
        </button>
        <button
          type="button"
          className={`topic-filter__pill ${filterTopic === 'contraception' ? 'topic-filter__pill--active' : ''}`}
          onClick={() => setFilterTopic('contraception')}
          role="tab"
          aria-selected={filterTopic === 'contraception'}
        >
          Contraception
        </button>
        <button
          type="button"
          className={`topic-filter__pill ${filterTopic === 'menstrual_health' ? 'topic-filter__pill--active' : ''}`}
          onClick={() => setFilterTopic('menstrual_health')}
          role="tab"
          aria-selected={filterTopic === 'menstrual_health'}
        >
          Menstrual Health
        </button>
        <button
          type="button"
          className={`topic-filter__pill ${filterTopic === 'abortion' ? 'topic-filter__pill--active' : ''}`}
          onClick={() => setFilterTopic('abortion')}
          role="tab"
          aria-selected={filterTopic === 'abortion'}
        >
          Abortion
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {loading && <p>Loading…</p>}

      {!loading &&
        visiblePosts.map((p) => (
          <details
            key={p.id}
            className="card forum-post"
            onToggle={(e) => {
              const el = e.currentTarget
              if (el.open) void ensureReplies(p.id)
            }}
          >
            <summary className="forum-post__summary">
              <div className="forum-post__summary-main">
                <span className="topic-pill">{topicLabel(p.topic)}</span>
                {p.source === 'chatbot_redirect' && (
                  <span className="topic-pill" style={{ marginLeft: 6, background: 'rgba(0,80,48,0.12)' }}>
                    From chatbot
                  </span>
                )}
                <div style={{ fontWeight: 700, marginTop: 6 }}>{p.title}</div>
                <div className="muted">
                  {p.author_handle} · {new Date(p.created_at).toLocaleString()}
                </div>
              </div>
              <div
                className="forum-like-cell"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onKeyDown={(e) => e.stopPropagation()}
                role="presentation"
              >
                <button
                  type="button"
                  className={`forum-like-btn ${p.liked ? 'forum-like-btn--on' : ''}`}
                  disabled={!user || likeBusy[`p-${p.id}`]}
                  onClick={() => onTogglePostLike(p.id)}
                  aria-pressed={p.liked}
                  aria-label={p.liked ? 'Unlike post' : 'Like post'}
                >
                  <span aria-hidden>♥</span> {p.like_count ?? 0}
                </button>
              </div>
            </summary>
            <p style={{ marginTop: '0.65rem' }}>{p.body}</p>
            <div style={{ marginTop: '0.75rem' }}>
              <strong style={{ fontSize: '0.9rem' }}>Replies</strong>
              {(replies[p.id] || []).map((r) => (
                <div key={r.id} className="thread-reply">
                  <div className="thread-reply__row">
                    <div className="thread-reply__text">{r.body}</div>
                    <button
                      type="button"
                      className={`forum-like-btn forum-like-btn--sm ${r.liked ? 'forum-like-btn--on' : ''}`}
                      disabled={!user || likeBusy[`r-${r.id}`]}
                      onClick={() => onToggleReplyLike(r.id, p.id)}
                      aria-pressed={r.liked}
                      aria-label={r.liked ? 'Unlike reply' : 'Like reply'}
                    >
                      <span aria-hidden>♥</span> {r.like_count ?? 0}
                    </button>
                  </div>
                  <div className="muted">
                    {r.author_handle} · {new Date(r.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
              {user && (
                <div className="field" style={{ marginTop: '0.5rem' }}>
                  <label htmlFor={`reply-${p.id}`}>Your reply (shown as {user.anonymous_handle})</label>
                  <textarea
                    id={`reply-${p.id}`}
                    value={replyText[p.id] || ''}
                    onChange={(e) => setReplyText((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    rows={2}
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ marginTop: 6 }}
                    onClick={() => submitReply(p.id)}
                  >
                    Post reply
                  </button>
                </div>
              )}
            </div>
          </details>
        ))}

      {!loading && visiblePosts.length === 0 && (
        <p>{filterTopic ? 'No posts in this topic yet.' : 'No posts yet. Be the first to ask a question.'}</p>
      )}
    </div>
  )
}
