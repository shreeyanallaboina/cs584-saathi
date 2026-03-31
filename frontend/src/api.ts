const jsonHeaders = { 'Content-Type': 'application/json' }

async function parseJson(res: Response) {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = (data as { error?: string }).error || res.statusText
    throw new Error(msg)
  }
  return data
}

export type User = {
  id: number
  username: string
  anonymous_handle: string
}

export async function login(username: string, password: string): Promise<{ user: User }> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ username, password }),
  })
  return parseJson(res) as Promise<{ user: User }>
}

export async function register(
  username: string,
  password: string,
  referral_code: string
): Promise<{ user: User }> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ username, password, referral_code }),
  })
  return parseJson(res) as Promise<{ user: User }>
}

export async function lhwLogin(username: string, password: string) {
  const res = await fetch('/api/lhw/login', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ username, password }),
  })
  return parseJson(res) as Promise<{ lhw: { id: number; username: string } }>
}

export async function generateReferralCode(username: string, password: string) {
  const res = await fetch('/api/lhw/referral-codes', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ username, password }),
  })
  return parseJson(res) as Promise<{ code: string }>
}

export type ForumPost = {
  id: number
  topic: string
  title: string
  body: string
  author_handle: string
  created_at: string
  source: string
  like_count: number
  liked: boolean
}

export type ForumReply = {
  id: number
  body: string
  author_handle: string
  created_at: string
  like_count: number
  liked: boolean
}

export async function fetchForumPosts(userId?: number): Promise<{ posts: ForumPost[] }> {
  const q = userId != null ? `?user_id=${encodeURIComponent(String(userId))}` : ''
  const res = await fetch(`/api/forum/posts${q}`)
  return parseJson(res) as Promise<{ posts: ForumPost[] }>
}

export async function createForumPost(payload: {
  user_id: number
  topic: string
  title: string
  body: string
  source?: string
}) {
  const res = await fetch('/api/forum/posts', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  })
  return parseJson(res) as Promise<{ post: ForumPost }>
}

export async function fetchReplies(postId: number, userId?: number) {
  const q = userId != null ? `?user_id=${encodeURIComponent(String(userId))}` : ''
  const res = await fetch(`/api/forum/posts/${postId}/replies${q}`)
  return parseJson(res) as Promise<{ replies: ForumReply[] }>
}

export async function togglePostLike(postId: number, userId: number) {
  const res = await fetch(`/api/forum/posts/${postId}/like`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ user_id: userId }),
  })
  return parseJson(res) as Promise<{ liked: boolean; like_count: number }>
}

export async function toggleReplyLike(replyId: number, userId: number) {
  const res = await fetch(`/api/forum/replies/${replyId}/like`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ user_id: userId }),
  })
  return parseJson(res) as Promise<{ liked: boolean; like_count: number }>
}

export async function postReply(postId: number, user_id: number, body: string) {
  const res = await fetch(`/api/forum/posts/${postId}/replies`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ user_id, body }),
  })
  return parseJson(res)
}

export type ChatResponse = {
  confidence: number
  can_answer: boolean
  answer: string | null
  matched_topic: string | null
  suggest_forum: boolean
  forum_prefill: string | null
}

export async function sendChat(message: string, topic: string | null): Promise<ChatResponse> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ message, topic }),
  })
  return parseJson(res) as Promise<ChatResponse>
}

export async function fetchTopics(): Promise<{ topics: string[] }> {
  const res = await fetch('/api/forum/topics')
  return parseJson(res) as Promise<{ topics: string[] }>
}
