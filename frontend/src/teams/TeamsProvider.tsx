import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from '../api/client'

type Ctx = { teams: any[]; loading: boolean; reload: () => Promise<void> }
const TeamsCtx = createContext<Ctx>({ teams: [], loading: true, reload: async () => {} })
export const useTeams = () => useContext(TeamsCtx)

export function TeamsProvider({ children }: { children: React.ReactNode }) {
  const [teams, setTeams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const reload = useCallback(async () => {
    setLoading(true)
    try { setTeams(await api.teams.list()) } catch { /* ignore */ } finally { setLoading(false) }
  }, [])
  useEffect(() => { reload() }, [reload])
  return <TeamsCtx.Provider value={{ teams, loading, reload }}>{children}</TeamsCtx.Provider>
}
