const TOKEN_KEY = 'br_token'
export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

async function req(path: string, opts: RequestInit = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(opts.headers as any) }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(path, { ...opts, headers })
  if (!res.ok) {
    let body: any = null
    try { body = await res.json() } catch { /* no body */ }
    const err: any = new Error(`${res.status}`)
    err.status = res.status
    err.body = body
    throw err
  }
  return res.status === 204 ? null : res.json()
}
export const api = {
  register: (d: object) => req('/api/auth/register', { method: 'POST', body: JSON.stringify(d) }),
  login: (d: object) => req('/api/auth/login', { method: 'POST', body: JSON.stringify(d) }),
  me: () => req('/api/auth/me'),
  teams: {
    list: () => req('/api/teams'),
    create: (d: object) => req('/api/teams', { method: 'POST', body: JSON.stringify(d) }),
    get: (id: string) => req(`/api/teams/${id}`),
  },
  players: {
    list: (teamId: string, qs = '') => req(`/api/teams/${teamId}/players${qs}`),
    create: (teamId: string, d: object) => req(`/api/teams/${teamId}/players`, { method: 'POST', body: JSON.stringify(d) }),
    update: (teamId: string, pid: string, d: object) => req(`/api/teams/${teamId}/players/${pid}`, { method: 'PATCH', body: JSON.stringify(d) }),
    remove: (teamId: string, pid: string) => req(`/api/teams/${teamId}/players/${pid}`, { method: 'DELETE' }),
    history: (teamId: string, pid: string) => req(`/api/teams/${teamId}/players/${pid}/history`),
  },
  rulePresets: {
    list: (qs = '') => req(`/api/rule-presets${qs}`),
  },
  games: {
    list: (teamId: string, qs = '') => req(`/api/teams/${teamId}/games${qs}`),
    create: (teamId: string, d: object) => req(`/api/teams/${teamId}/games`, { method: 'POST', body: JSON.stringify(d) }),
    get: (gameId: string) => req(`/api/games/${gameId}`),
    update: (gameId: string, d: object) => req(`/api/games/${gameId}`, { method: 'PATCH', body: JSON.stringify(d) }),
    opponents: (teamId: string, q: string) => req(`/api/teams/${teamId}/opponents?q=${encodeURIComponent(q)}`),
    start: (gameId: string, d: object) => req(`/api/games/${gameId}`, { method: 'PATCH', body: JSON.stringify({ gameStatus: 'live', ...d }) }),
    pause: (gameId: string) => req(`/api/games/${gameId}`, { method: 'PATCH', body: JSON.stringify({ gameStatus: 'paused' }) }),
    resume: (gameId: string) => req(`/api/games/${gameId}`, { method: 'PATCH', body: JSON.stringify({ gameStatus: 'live' }) }),
    complete: (gameId: string) => req(`/api/games/${gameId}`, { method: 'PATCH', body: JSON.stringify({ gameStatus: 'completed' }) }),
    state: (gameId: string) => req(`/api/games/${gameId}/state`),
    boxScore: (gameId: string) => req(`/api/games/${gameId}/box-score`),
    setEr: (gameId: string, playerId: string, er: number) =>
      req(`/api/games/${gameId}/pitchers/${playerId}/er`, { method: 'PUT', body: JSON.stringify({ er }) }),
  },
  roster: {
    get: (gameId: string) => req(`/api/games/${gameId}/roster`),
    put: (gameId: string, d: object) => req(`/api/games/${gameId}/roster`, { method: 'PUT', body: JSON.stringify(d) }),
    validate: (gameId: string) => req(`/api/games/${gameId}/roster:validate`, { method: 'POST' }),
  },
  signups: {
    get: (gameId: string) => req(`/api/games/${gameId}/signups`),
    put: (gameId: string, d: object) => req(`/api/games/${gameId}/signups`, { method: 'PUT', body: JSON.stringify(d) }),
  },
  events: {
    list: (gameId: string) => req(`/api/games/${gameId}/events`),
    record: (gameId: string, d: object) => req(`/api/games/${gameId}/events`, { method: 'POST', body: JSON.stringify(d) }),
    update: (gameId: string, eventId: string, d: object) => req(`/api/games/${gameId}/events/${eventId}`, { method: 'PATCH', body: JSON.stringify(d) }),
    remove: (gameId: string, eventId: string) => req(`/api/games/${gameId}/events/${eventId}`, { method: 'DELETE' }),
    // 訂閱 SSE 計分板：回傳停止函式。payload = GameStateResponse（{ state }）。
    stream: (gameId: string, onState: (r: any) => void, onError?: (e: any) => void) => {
      const ctrl = new AbortController()
      const token = getToken()
      fetch(`/api/games/${gameId}/stream`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: ctrl.signal,
      }).then(async res => {
        if (!res.ok || !res.body) { onError?.(new Error(String(res.status))); return }
        const reader = res.body.getReader()
        const dec = new TextDecoder()
        let buf = ''
        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          buf += dec.decode(value, { stream: true })
          let i
          while ((i = buf.indexOf('\n\n')) >= 0) {
            const frame = buf.slice(0, i); buf = buf.slice(i + 2)
            const data = frame.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).join('')
            if (data) { try { onState(JSON.parse(data)) } catch { /* 忽略非 JSON frame */ } }
          }
        }
      }).catch(err => { if (!ctrl.signal.aborted) onError?.(err) })
      return () => ctrl.abort()
    },
  },
}
