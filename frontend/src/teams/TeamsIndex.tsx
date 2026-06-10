import { Navigate } from 'react-router-dom'
import { useTeams } from './TeamsProvider'
import { EmptyState, Skeleton } from '../ui'

export default function TeamsIndex() {
  const { teams, loading } = useTeams()
  if (loading) return <Skeleton rows={4} />
  if (teams.length === 0) return <EmptyState icon="🏟">尚無球隊——用右上角「建立球隊」開始</EmptyState>
  return <Navigate to={`/teams/${teams[0].teamId}/players`} replace />
}
