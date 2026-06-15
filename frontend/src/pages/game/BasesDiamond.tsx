type Bases = { first?: unknown; second?: unknown; third?: unknown }
export default function BasesDiamond({ bases }: { bases: Bases }) {
  const on = (v: unknown) => (v ? 'on' : '')
  return (
    <div className="diamond" aria-label="壘包狀態" role="img">
      <span className={`base base-2 ${on(bases.second)}`} />
      <span className={`base base-3 ${on(bases.third)}`} />
      <span className={`base base-1 ${on(bases.first)}`} />
      <span className="base base-h" />
    </div>
  )
}
