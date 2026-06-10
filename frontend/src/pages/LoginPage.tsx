import { useState } from 'react'
import { api, setToken } from '../api/client'
import { Button, Input } from '../ui'
import './LoginPage.css'

export default function LoginPage({ onAuthed }: { onAuthed: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setName] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(kind: 'login' | 'register') {
    setErr('')
    setBusy(true)
    try {
      const d = kind === 'register' ? { displayName, email, password } : { email, password }
      const r = await api[kind](d)
      setToken(r.token)
      onAuthed()
    } catch {
      setErr('帳號或密碼錯誤 / 此 email 已被註冊')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-wrap">
      <section className="auth-card" aria-labelledby="auth-title">
        <header className="auth-brand">
          <span className="auth-logo" aria-hidden="true">⚾</span>
          <h1 id="auth-title" className="auth-title">棒壘球紀錄平台</h1>
          <p className="auth-sub">登入或註冊以開始記錄你的球賽</p>
        </header>

        <form className="auth-form" onSubmit={e => { e.preventDefault(); submit('login') }}>
          <Input
            className="auth-input"
            placeholder="顯示名稱(註冊用)"
            aria-label="顯示名稱（註冊用）"
            autoComplete="nickname"
            value={displayName}
            onChange={e => setName(e.target.value)}
          />
          <Input
            className="auth-input"
            placeholder="email"
            aria-label="電子郵件"
            type="email"
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <Input
            className="auth-input"
            placeholder="密碼"
            aria-label="密碼"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />

          <div className="auth-actions">
            <Button type="submit" disabled={busy}>登入</Button>
            <Button variant="ghost" type="button" disabled={busy} onClick={() => submit('register')}>註冊</Button>
          </div>

          {err && <p role="alert" className="auth-error">{err}</p>}
        </form>
      </section>
    </main>
  )
}
