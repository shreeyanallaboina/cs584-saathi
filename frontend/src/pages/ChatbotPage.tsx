import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { sendChat } from '../api'

type Msg = { role: 'user' | 'assistant'; text: string; confidence?: number }

const TOPICS = [
  { value: '', label: 'Any of the three topics' },
  { value: 'contraception', label: 'Contraception' },
  { value: 'abortion', label: 'Abortion' },
  { value: 'menstrual_health', label: 'Menstrual Health' },
]

export default function ChatbotPage() {
  const navigate = useNavigate()
  const [topic, setTopic] = useState('')
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'assistant',
      text: 'Ask about contraception, periods, or general abortion information. If I am under 75% confident, I will help you post anonymously to the forum.',
    },
  ])
  const [busy, setBusy] = useState(false)
  const [lastLowConfidence, setLastLowConfidence] = useState<{
    text: string
    confidence: number
    matched?: string | null
  } | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  const topicLabel = useMemo(
    () => TOPICS.find((t) => t.value === topic)?.label ?? '',
    [topic]
  )

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || busy) return
    setInput('')
    setLastLowConfidence(null)
    setMessages((m) => [...m, { role: 'user', text }])
    setBusy(true)
    try {
      const res = await sendChat(text, topic || null)
      if (res.can_answer && res.answer) {
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            text: res.answer!,
            confidence: res.confidence,
          },
        ])
      } else {
        setLastLowConfidence({
          text,
          confidence: res.confidence,
          matched: res.matched_topic,
        })
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            text:
              "I'm not confident enough to answer that from our trusted library (below 75% confidence). " +
              'You can post this question anonymously to the community forum so other women can share experiences. ' +
              'This is not a substitute for a health worker.',
            confidence: res.confidence,
          },
        ])
      }
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          text: 'Something went wrong. Check your connection and try again.',
        },
      ])
    } finally {
      setBusy(false)
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }))
    }
  }

  function postToForum() {
    if (!lastLowConfidence) return
    navigate('/app/forum/new', {
      state: {
        body: lastLowConfidence.text,
        topic:
          lastLowConfidence.matched &&
          ['contraception', 'abortion', 'menstrual_health'].includes(lastLowConfidence.matched)
            ? lastLowConfidence.matched
            : 'menstrual_health',
      },
    })
  }

  return (
    <div className="chatbot-page">
      <div className="chatbot-page__header">
        <h2 className="chatbot-page__title">Saathi Chatbot</h2>
        <div className="field chatbot-page__topic">
          <label htmlFor="chat-topic">Topic (optional)</label>
          <select id="chat-topic" value={topic} onChange={(e) => setTopic(e.target.value)}>
            {TOPICS.map((t) => (
              <option key={t.value || 'any'} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        {topic ? (
          <p className="muted chatbot-page__topic-hint">{topicLabel}</p>
        ) : null}
      </div>

      <div className="chatbot-page__messages">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`chat-row ${msg.role === 'user' ? 'chat-row--user' : 'chat-row--bot'}`}
          >
            {msg.role === 'assistant' ? (
              <img className="chat-avatar" src="/saathi-character.png" alt="Saathi" />
            ) : null}
            <div className={`chat-bubble chat-bubble--compact ${msg.role === 'user' ? 'user' : 'bot'}`}>
              {msg.text}
              {msg.confidence != null && (
                <div className="confidence-meter">
                  Confidence from library match: {(msg.confidence * 100).toFixed(1)}%
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {lastLowConfidence ? (
        <div className="card chatbot-page__forum-card">
          <strong>Share with the forum?</strong>
          <p className="muted" style={{ margin: '0.35rem 0 0.65rem' }}>
            Your login name stays hidden; only your anonymous forum name appears.
          </p>
          <button type="button" className="btn btn-primary" onClick={postToForum}>
            Post this question to the forum
          </button>
        </div>
      ) : null}

      <form className="chatbot-page__composer" onSubmit={handleSend}>
        <div className="field" style={{ marginBottom: '0.45rem' }}>
          <label htmlFor="chat-input" className="visually-hidden">
            Your question
          </label>
          <textarea
            id="chat-input"
            className="chatbot-page__input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your question…"
            rows={2}
          />
        </div>
        <button className="btn btn-primary" type="submit" disabled={busy || !input.trim()} style={{ width: '100%' }}>
          {busy ? 'Thinking…' : 'Send'}
        </button>
      </form>
    </div>
  )
}
