import { useState } from 'react'
import type { ContextId } from '../types'

const CONTEXTS: ContextId[] = ['geo360', 'manutention']

export function ContextSwitcher({
  context,
  contextNames,
  onChange,
  onManualSave,
}: {
  context: ContextId
  contextNames: Record<ContextId, string>
  onChange: (ctx: ContextId) => void
  onManualSave: () => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    await onManualSave()
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="context-switcher">
      <div className="ctx-btn-group">
        {CONTEXTS.map((ctx) => (
          <button
            key={ctx}
            type="button"
            className={`ctx-btn${ctx === context ? ' active' : ''}`}
            onClick={() => ctx !== context && onChange(ctx)}
          >
            {contextNames[ctx]}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="btn secondary btn-sm"
        disabled={saving}
        onClick={handleSave}
      >
        {saved ? '✓ Enregistré' : saving ? 'Enregistrement…' : '💾 Enregistrer'}
      </button>
    </div>
  )
}
