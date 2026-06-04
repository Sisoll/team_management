import { useEffect, useState } from 'react'
import { api, getToken, clearToken } from './api/client'
import LoginPage from './pages/LoginPage'
import './pages/LoginPage.css'

export default function App() {
  const [me, setMe] = useState<any>(null)
  const load = () => api.me().then(setMe).catch(() => setMe(null))
  useEffect(() => { if (getToken()) load() }, [])

  function logout() {
    clearToken()
    setMe(null)
  }

  if (!me) return <LoginPage onAuthed={load} />
  return (
    <main className="auth-wrap">
      <section className="auth-card home-card">
        <span className="auth-logo" aria-hidden="true">⚾</span>
        <h1 className="auth-title">嗨，{me.displayName}</h1>
        <p className="auth-sub">{me.email}</p>
        <button type="button" className="btn btn-ghost" onClick={logout}>登出</button>
      </section>
    </main>
  )
}
