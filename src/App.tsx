import { useEffect, useState } from 'react'
import { Header } from './components/Header'
import { ContextSwitcher } from './components/ContextSwitcher'
import { SettingsPanel } from './components/SettingsPanel'
import { TabNav } from './components/TabNav'
import { DashboardPanel } from './panels/DashboardPanel'
import { DepensesPanel } from './panels/DepensesPanel'
import { FacturesPanel } from './panels/FacturesPanel'
import { KmPanel } from './panels/KmPanel'
import { DocumentsPanel } from './panels/DocumentsPanel'
import { HistoriquePanel } from './panels/HistoriquePanel'
import { useLedger } from './hooks/useLedger'
import { useDocuments } from './hooks/useDocuments'
import { useSettings } from './hooks/useSettings'
import { autoSaveOnClick, requestPermissionAndRestore, tryAutoRestoreOnStartup } from './lib/autoBackup'
import type { ContextId, TabId } from './types'

const RELOAD_GUARD_KEY = 'livre-affaire-auto-restore-reloaded'

function App() {
  const [context, setContext] = useState<ContextId>('geo360')
  const [tab, setTab] = useState<TabId>('dashboard')
  const [restoreBanner, setRestoreBanner] = useState<'none' | 'permission-needed' | 'busy'>('none')
  const ledger = useLedger(context)
  const documentsHook = useDocuments()
  const { settings, update: updateSettings } = useSettings()

  async function handleContextChange(next: ContextId) {
    await ledger.saveAll() // s'assure que le contexte quitté est bien sauvegardé
    setContext(next)
  }

  async function handleManualSave() {
    await ledger.saveAll()
    await autoSaveOnClick() // no-op silencieux si l'API File System Access n'est pas supportée
  }

  function reloadOnceAfterRestore() {
    if (sessionStorage.getItem(RELOAD_GUARD_KEY)) return
    sessionStorage.setItem(RELOAD_GUARD_KEY, '1')
    window.location.reload()
  }

  // Tentative silencieuse de restauration depuis le fichier de sauvegarde
  // automatique (s'il y en a un) à l'ouverture de l'appli.
  useEffect(() => {
    tryAutoRestoreOnStartup().then((result) => {
      if (result.kind === 'restored') reloadOnceAfterRestore()
      else if (result.kind === 'permission-needed') setRestoreBanner('permission-needed')
    })
  }, [])

  async function handleGrantAndRestore() {
    setRestoreBanner('busy')
    const result = await requestPermissionAndRestore()
    if (result.kind === 'restored') reloadOnceAfterRestore()
    else setRestoreBanner('none')
  }

  return (
    <>
      <SettingsPanel settings={settings} onUpdate={updateSettings} />
      <div className="app">
        <Header context={context} userName={settings.userName} contextNames={settings.contextNames} />
        <ContextSwitcher
          context={context}
          contextNames={settings.contextNames}
          onChange={handleContextChange}
          onManualSave={handleManualSave}
        />
        {restoreBanner === 'permission-needed' && (
          <div className="review-box" style={{ margin: '10px 0 0' }}>
            <div className="rb-title">Sauvegarde automatique trouvée</div>
            <p className="status-msg" style={{ margin: '0 0 10px' }}>
              Une sauvegarde de tes données a été trouvée sur cet ordinateur. Confirme l'accès au
              fichier pour la charger — cette confirmation est redemandée à chaque démarrage, par
              mesure de sécurité.
            </p>
            <div className="btn-row">
              <button type="button" className="btn secondary btn-sm" onClick={handleGrantAndRestore}>
                Charger la sauvegarde automatique
              </button>
            </div>
          </div>
        )}
        {restoreBanner === 'busy' && (
          <div className="review-box" style={{ margin: '10px 0 0' }}>
            <p className="status-msg" style={{ margin: 0 }}>Chargement de la sauvegarde automatique…</p>
          </div>
        )}
        <TabNav active={tab} onChange={setTab} />

        <div key={context}>
          <div style={{ display: tab === 'dashboard' ? 'block' : 'none' }}>
            <DashboardPanel ledger={ledger} settings={settings} />
          </div>
          <div style={{ display: tab === 'depenses' ? 'block' : 'none' }}>
            <DepensesPanel ledger={ledger} settings={settings} />
          </div>
          <div style={{ display: tab === 'factures' ? 'block' : 'none' }}>
            <FacturesPanel ledger={ledger} settings={settings} />
          </div>
          <div style={{ display: tab === 'km' ? 'block' : 'none' }}>
            <KmPanel ledger={ledger} />
          </div>
          <div style={{ display: tab === 'historique' ? 'block' : 'none' }}>
            <HistoriquePanel ledger={ledger} documentsHook={documentsHook} />
          </div>
        </div>

        <div style={{ display: tab === 'documents' ? 'block' : 'none' }}>
          <DocumentsPanel documentsHook={documentsHook} />
        </div>
      </div>
    </>
  )
}

export default App
