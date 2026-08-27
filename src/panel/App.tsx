import { useEffect, useState } from 'react'
import { useConfig } from './hooks/useConfig'
import { RuleList } from './components/RuleList'
import { AddRuleForm } from './components/AddRuleForm'
import { SettingsPanel } from './components/SettingsPanel'

type Tab = 'rules' | 'settings'
const TABS: Tab[] = ['rules', 'settings']

export function App() {
  const { config, loading } = useConfig()
  const [activeHostname, setActiveHostname] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('rules')

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([activeTab]) => {
      if (!activeTab?.url) return
      try {
        setActiveHostname(new URL(activeTab.url).hostname)
      } catch {
        setActiveHostname(null)
      }
    })
  }, [])

  const activeCount = config.rules.filter((r) => r.enabled).length

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center justify-between bg-fog-indigo px-4 py-3 text-paper">
        <h1 className="font-display text-base font-semibold tracking-tight">Redactor</h1>
        <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium">{activeCount} active</span>
      </header>

      <nav className="flex shrink-0 border-b border-slate-ink/10 bg-white px-2">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`relative px-3 py-2.5 text-sm font-medium capitalize transition-colors ${
              tab === t ? 'text-fog-indigo' : 'text-slate-ink/50 hover:text-slate-ink/80'
            }`}
          >
            {t}
            {tab === t && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-reveal-amber" />}
          </button>
        ))}
      </nav>

      {loading ? (
        <p className="flex-1 p-6 text-center text-sm text-slate-ink/50">Loading…</p>
      ) : (
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-paper">
          {tab === 'rules' ? (
            <>
              <AddRuleForm activeHostname={activeHostname} />
              <RuleList rules={config.rules} />
            </>
          ) : (
            <SettingsPanel settings={config.settings} />
          )}
        </main>
      )}
    </div>
  )
}
