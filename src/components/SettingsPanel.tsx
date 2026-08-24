import { useEffect, useState } from 'react'
import type { AppSettings } from '../hooks/useSettings'
import { formatCents } from '../lib/money'
import { revenuQuatreTrimestresCents, SEUIL_PETIT_FOURNISSEUR_CENTS } from '../lib/petitFournisseur'
import { applyTheme, getStoredTheme, THEMES, type ThemeId } from '../lib/theme'
import { checkForUpdate, getAppVersion, installPendingUpdate, isTauriRuntime } from '../lib/updater'
import { CONTEXT_NAMES } from '../types'

export function SettingsPanel({
  settings,
  onUpdate,
}: {
  settings: AppSettings
  onUpdate: (partial: Partial<AppSettings>) => Promise<void>
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        className="settings-toggle"
        onClick={() => setOpen(true)}
        aria-label="Paramètres"
        title="Paramètres"
      >
        ⚙️
      </button>
      {open && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false)
          }}
        >
          <div className="modal-box detail-box">
            <button type="button" className="modal-close" onClick={() => setOpen(false)}>
              ✕
            </button>
            <SettingsForm settings={settings} onUpdate={onUpdate} />
          </div>
        </div>
      )}
    </>
  )
}

function SettingsForm({
  settings,
  onUpdate,
}: {
  settings: AppSettings
  onUpdate: (partial: Partial<AppSettings>) => Promise<void>
}) {
  const [theme, setTheme] = useState<ThemeId>(getStoredTheme)
  const [userName, setUserName] = useState(settings.userName)
  const [geo360Name, setGeo360Name] = useState(settings.contextNames.geo360)
  const [manutentionName, setManutentionName] = useState(settings.contextNames.manutention)
  const [newCategory, setNewCategory] = useState('')
  const [savedNote, setSavedNote] = useState(false)
  const [seuil, setSeuil] = useState<{ revenuCents: number } | null>(null)
  const [appVersion, setAppVersion] = useState<string | null>(null)
  const [updateState, setUpdateState] = useState<
    'idle' | 'checking' | 'upToDate' | 'available' | 'downloading' | 'error'
  >('idle')
  const [updateInfo, setUpdateInfo] = useState<{ version: string; notes?: string } | null>(null)
  const [updateProgress, setUpdateProgress] = useState<number | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    revenuQuatreTrimestresCents().then((revenuCents) => {
      if (!cancelled) setSeuil({ revenuCents })
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isTauriRuntime()) return
    getAppVersion().then(setAppVersion)
  }, [])

  function chooseTheme(id: ThemeId) {
    setTheme(id)
    applyTheme(id)
  }

  function flashSaved() {
    setSavedNote(true)
    setTimeout(() => setSavedNote(false), 1500)
  }

  async function saveIdentite() {
    await onUpdate({
      userName: userName.trim() || 'Tristan Haese',
      contextNames: {
        geo360: geo360Name.trim() || CONTEXT_NAMES.geo360,
        manutention: manutentionName.trim() || CONTEXT_NAMES.manutention,
      },
    })
    flashSaved()
  }

  async function toggleInscrit() {
    await onUpdate({ taxesInscrit: !settings.taxesInscrit })
  }

  async function addCategory() {
    const value = newCategory.trim()
    if (!value || settings.categories.includes(value)) return
    await onUpdate({ categories: [...settings.categories, value] })
    setNewCategory('')
  }

  async function removeCategory(cat: string) {
    await onUpdate({ categories: settings.categories.filter((c) => c !== cat) })
  }

  async function handleCheckUpdate() {
    setUpdateState('checking')
    setUpdateError(null)
    try {
      const result = await checkForUpdate()
      if (result.available && result.version) {
        setUpdateInfo({ version: result.version, notes: result.notes })
        setUpdateState('available')
      } else {
        setUpdateState('upToDate')
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      setUpdateError(`Impossible de vérifier les mises à jour : ${detail}`)
      setUpdateState('error')
    }
  }

  async function handleInstallUpdate() {
    setUpdateState('downloading')
    setUpdateProgress(null)
    try {
      await installPendingUpdate(setUpdateProgress)
    } catch {
      setUpdateError("Échec du téléchargement ou de l'installation de la mise à jour.")
      setUpdateState('error')
    }
  }

  const pct = seuil ? Math.min(100, Math.round((seuil.revenuCents / SEUIL_PETIT_FOURNISSEUR_CENTS) * 100)) : 0
  const proche = seuil ? seuil.revenuCents / SEUIL_PETIT_FOURNISSEUR_CENTS >= 0.8 : false
  const depasse = seuil ? seuil.revenuCents >= SEUIL_PETIT_FOURNISSEUR_CENTS : false

  return (
    <div>
      <h3 className="detail-title">Paramètres</h3>

      {isTauriRuntime() && (
        <section style={{ marginBottom: 22 }}>
          <div className="settings-section-title">Mises à jour</div>
          {appVersion && (
            <p className="status-msg" style={{ margin: '2px 0 8px' }}>
              Version actuelle : <b className="mono">{appVersion}</b>
            </p>
          )}
          {(updateState === 'idle' || updateState === 'upToDate' || updateState === 'error') && (
            <button type="button" className="btn secondary btn-sm" onClick={handleCheckUpdate}>
              Vérifier les mises à jour
            </button>
          )}
          {updateState === 'checking' && <p className="status-msg">Vérification…</p>}
          {updateState === 'upToDate' && (
            <p className="status-msg" style={{ marginTop: 6 }}>
              ✓ Tu as déjà la dernière version.
            </p>
          )}
          {updateState === 'available' && updateInfo && (
            <>
              <p className="status-msg" style={{ marginTop: 6 }}>
                Nouvelle version disponible : <b>{updateInfo.version}</b>
              </p>
              {updateInfo.notes && (
                <p className="status-msg" style={{ whiteSpace: 'pre-wrap' }}>
                  {updateInfo.notes}
                </p>
              )}
              <div className="btn-row">
                <button type="button" className="btn btn-sm" onClick={handleInstallUpdate}>
                  Installer et redémarrer
                </button>
              </div>
            </>
          )}
          {updateState === 'downloading' && (
            <p className="status-msg" style={{ marginTop: 6 }}>
              Téléchargement{updateProgress != null ? ` : ${updateProgress} %` : '…'}
            </p>
          )}
          {updateState === 'error' && updateError && (
            <p className="status-msg err" style={{ marginTop: 6 }}>
              {updateError}
            </p>
          )}
        </section>
      )}

      <section style={{ marginBottom: 22 }}>
        <div className="settings-section-title">Thème</div>
        <div className="field" style={{ maxWidth: 220 }}>
          <select value={theme} onChange={(e) => chooseTheme(e.target.value as ThemeId)}>
            {THEMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section style={{ marginBottom: 22 }}>
        <div className="settings-section-title">Identité</div>
        <div className="form-row">
          <div className="field">
            <label>Nom de l'usager</label>
            <input type="text" value={userName} onChange={(e) => setUserName(e.target.value)} />
          </div>
        </div>
        <div className="form-row">
          <div className="field">
            <label>Nom du contexte 1</label>
            <input type="text" value={geo360Name} onChange={(e) => setGeo360Name(e.target.value)} />
          </div>
          <div className="field">
            <label>Nom du contexte 2</label>
            <input
              type="text"
              value={manutentionName}
              onChange={(e) => setManutentionName(e.target.value)}
            />
          </div>
        </div>
        <div className="btn-row">
          <button type="button" className="btn secondary btn-sm" onClick={saveIdentite}>
            {savedNote ? '✓ Enregistré' : 'Enregistrer'}
          </button>
        </div>
      </section>

      <section style={{ marginBottom: 22 }}>
        <div className="settings-section-title">Taxes (TPS/TVQ)</div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, margin: '8px 0' }}>
          <input type="checkbox" checked={settings.taxesInscrit} onChange={toggleInscrit} />
          Inscrit aux fichiers de la TPS et de la TVQ
        </label>
        <p className="status-msg" style={{ margin: '2px 0 10px' }}>
          {settings.taxesInscrit
            ? "Les champs TPS/TVQ des factures et dépenses se remplissent automatiquement (5 % / 9,975 %)."
            : "Les champs TPS/TVQ sont désactivés — tu n'es pas autorisé à charger de taxes sans être inscrit."}
        </p>

        <div className="settings-section-title" style={{ marginTop: 14 }}>
          Seuil de petit fournisseur (30 000 $)
        </div>
        {seuil ? (
          <>
            <p className="status-msg" style={{ margin: '4px 0' }}>
              Revenus des 4 derniers trimestres civils (Géo360 + Manutention) :{' '}
              <b>{formatCents(seuil.revenuCents)}</b> / {formatCents(SEUIL_PETIT_FOURNISSEUR_CENTS)}
            </p>
            <div className="seuil-bar">
              <div
                className={`seuil-bar-fill${depasse ? ' over' : proche ? ' warn' : ''}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {depasse && (
              <p className="status-msg err" style={{ marginTop: 6 }}>
                Seuil dépassé — l'inscription à la TPS/TVQ est obligatoire.
              </p>
            )}
            {!depasse && proche && (
              <p className="status-msg" style={{ marginTop: 6 }}>
                Tu approches du seuil — prévois ton inscription.
              </p>
            )}
          </>
        ) : (
          <p className="status-msg">Calcul en cours…</p>
        )}
      </section>

      <section>
        <div className="settings-section-title">Catégories de dépenses</div>
        <div className="cat-list">
          {settings.categories.map((c) => (
            <span key={c} className="cat-chip">
              {c}
              <button type="button" onClick={() => removeCategory(c)} aria-label={`Retirer ${c}`}>
                ✕
              </button>
            </span>
          ))}
        </div>
        <div className="form-row" style={{ marginTop: 10 }}>
          <div className="field">
            <label>Nouvelle catégorie</label>
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addCategory()
                }
              }}
            />
          </div>
        </div>
        <div className="btn-row">
          <button type="button" className="btn secondary btn-sm" onClick={addCategory}>
            Ajouter
          </button>
        </div>
      </section>
    </div>
  )
}
