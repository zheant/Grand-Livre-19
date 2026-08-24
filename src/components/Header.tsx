import type { ContextId } from '../types'

const today = new Date().toLocaleDateString('fr-CA', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

export function Header({
  context,
  userName,
  contextNames,
}: {
  context: ContextId
  userName: string
  contextNames: Record<ContextId, string>
}) {
  return (
    <header className="top">
      <div>
        <h1>
          Grand Livre <span>19</span>
        </h1>
        <div className="sub">Suivi {userName} — {contextNames[context]}</div>
      </div>
      <div className="date">{today}</div>
    </header>
  )
}
