import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { api, getToken, clearToken } from './api/client'
import { TeamsProvider } from './teams/TeamsProvider'
import AppShell from './layout/AppShell'
import WorkspaceLayout from './layout/WorkspaceLayout'
import TeamsIndex from './teams/TeamsIndex'
import TeamLayout from './layout/TeamLayout'
import GameLayout from './layout/GameLayout'
import Placeholder from './layout/Placeholder'
import LoginPage from './pages/LoginPage'
import PlayersTab from './pages/team/PlayersTab'
import GamesTab from './pages/team/GamesTab'
import GameCreatePage from './pages/GameCreatePage'
import InfoTab from './pages/game/InfoTab'
import LineupTab from './pages/game/LineupTab'
import RecordTab from './pages/game/RecordTab'
import TimelineTab from './pages/game/TimelineTab'

export default function App() {
  const [me, setMe] = useState<any>(null)
  const [ready, setReady] = useState(false)
  const load = () => api.me().then(setMe).catch(() => setMe(null)).finally(() => setReady(true))
  useEffect(() => { if (getToken()) load(); else setReady(true) }, [])
  function logout() { clearToken(); setMe(null) }
  if (!ready) return null
  if (!me) return <LoginPage onAuthed={load} />
  return (
    <TeamsProvider>
      <AppShell userName={me.displayName} onLogout={logout}>
        <Routes>
          <Route path="/" element={<Navigate to="/teams" replace />} />
          <Route path="/overview" element={<Placeholder name="總覽" />} />
          <Route path="/calendar" element={<Placeholder name="行事曆" />} />
          <Route path="/stats" element={<Placeholder name="統計" />} />
          <Route element={<WorkspaceLayout />}>
            <Route path="/teams" element={<TeamsIndex />} />
            <Route path="/teams/:teamId" element={<TeamLayout />}>
              <Route index element={<Navigate to="players" replace />} />
              <Route path="players" element={<PlayersTab />} />
              <Route path="games" element={<GamesTab />} />
              <Route path="games/new" element={<GameCreatePage />} />
              <Route path="overview" element={<Placeholder name="總覽" />} />
              <Route path="calendar" element={<Placeholder name="行事曆" />} />
              <Route path="stats" element={<Placeholder name="統計" />} />
              <Route path="settings" element={<Placeholder name="設定" />} />
            </Route>
            <Route path="/games/:gameId" element={<GameLayout />}>
              <Route index element={<Navigate to="lineup" replace />} />
              <Route path="info" element={<InfoTab />} />
              <Route path="lineup" element={<LineupTab />} />
              <Route path="record" element={<RecordTab />} />
              <Route path="scoreboard" element={<Placeholder name="計分板" />} />
              <Route path="box" element={<Placeholder name="數據" />} />
              <Route path="timeline" element={<TimelineTab />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/teams" replace />} />
        </Routes>
      </AppShell>
    </TeamsProvider>
  )
}
