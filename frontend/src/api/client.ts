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
  },
  roster: {
    get: (gameId: string) => req(`/api/games/${gameId}/roster`),
    put: (gameId: string, d: object) => req(`/api/games/${gameId}/roster`, { method: 'PUT', body: JSON.stringify(d) }),
    validate: (gameId: string) => req(`/api/games/${gameId}/roster:validate`, { method: 'POST' }),
  },
}
