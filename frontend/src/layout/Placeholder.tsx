import EmptyState from '../ui/EmptyState'
export default function Placeholder({ name }: { name: string }) {
  return <EmptyState icon="🚧">「{name}」即將推出</EmptyState>
}
