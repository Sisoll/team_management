import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { api, getToken, clearToken } from './api/client'
import LoginPage from './pages/LoginPage'
import TeamsPage from './pages/TeamsPage'
import TeamPage from './pages/TeamPage'

export default function App() {
  const [me, setMe] = useState<any>(null)
  const [ready, setReady] = useState(false)
  const load = () => api.me().then(setMe).catch(() => setMe(null)).finally(() => setReady(true))
  useEffect(() => { if (getToken()) load(); else setReady(true) }, [])

  function logout() { clearToken(); setMe(null) }
  if (!ready) return null
  if (!me) return <LoginPage onAuthed={load} />
  return (
    <Routes>
      <Route path="/" element={<TeamsPage me={me} onLogout={logout} />} />
      <Route path="/teams/:teamId" element={<TeamPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
