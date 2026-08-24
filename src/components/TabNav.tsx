import { TABS, type TabId } from '../types'

export function TabNav({
  active,
  onChange,
}: {
  active: TabId
  onChange: (tab: TabId) => void
}) {
  return (
    <>
      <nav className="tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={tab.id === active ? 'active' : ''}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </>
  )
}
