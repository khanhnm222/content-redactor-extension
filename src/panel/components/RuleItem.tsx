import { useState, type KeyboardEvent, type ReactNode, type SVGProps } from 'react'
import type { Rule } from '../../shared/types'
import { deleteRule, toggleRule, upsertRule } from '../../shared/messaging'
import { isValidRuleValue } from '../../shared/rule-matcher'

interface Props {
  rule: Rule
}

export function RuleItem({ rule }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(rule.value)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function startEditing() {
    setDraft(rule.value)
    setError(null)
    setEditing(true)
  }

  function cancelEditing() {
    setEditing(false)
    setError(null)
  }

  async function saveEditing() {
    const value = draft.trim()
    if (!isValidRuleValue({ type: rule.type, value })) {
      setError(rule.type === 'regex' ? 'Invalid regular expression' : 'Enter a term')
      return
    }
    if (value === rule.value) {
      setEditing(false)
      return
    }

    setSaving(true)
    const res = await upsertRule({ ...rule, value })
    setSaving(false)

    if (!res.ok) {
      setError(res.error)
      return
    }
    setEditing(false)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      void saveEditing()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelEditing()
    }
  }

  return (
    <li className="group flex items-start gap-3 border-b border-slate-ink/8 px-4 py-3 last:border-b-0 hover:bg-slate-ink/3">
      <button
        type="button"
        role="switch"
        aria-checked={rule.enabled}
        aria-label={rule.enabled ? `Disable ${rule.value}` : `Enable ${rule.value}`}
        onClick={() => toggleRule(rule.id, !rule.enabled)}
        className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors ${
          rule.enabled ? 'bg-reveal-amber' : 'bg-slate-ink/15'
        }`}
      >
        <span
          className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${
            rule.enabled ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>

      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            autoFocus
            type="text"
            value={draft}
            disabled={saving}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={saveEditing}
            aria-label={`Edit ${rule.value}`}
            className="w-full rounded border border-reveal-amber bg-white px-1.5 py-0.5 font-mono text-xs text-slate-ink outline-none focus:ring-2 focus:ring-reveal-amber/30"
          />
        ) : (
          <code
            onDoubleClick={startEditing}
            className="block truncate font-mono text-xs text-slate-ink"
            title="Double-click to edit"
          >
            {rule.value}
          </code>
        )}
        {error && <p className="mt-1 text-[11px] font-medium text-signal-coral">{error}</p>}
        <div className="mt-1 flex flex-wrap gap-1">
          <Tag>{rule.type}</Tag>
          <Tag>{rule.scope === 'domain' ? (rule.domains[0] ?? 'this site') : 'all sites'}</Tag>
          {rule.caseSensitive && <Tag>Aa</Tag>}
          {rule.type === 'keyword' && rule.wholeWord && <Tag>whole word</Tag>}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        {editing ? (
          <>
            <button
              type="button"
              aria-label="Save"
              onMouseDown={(e) => e.preventDefault()}
              onClick={saveEditing}
              disabled={saving}
              className="rounded p-1 text-fog-indigo transition-colors hover:bg-fog-indigo/10 disabled:opacity-50"
            >
              <CheckIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Cancel"
              onMouseDown={(e) => e.preventDefault()}
              onClick={cancelEditing}
              className="rounded p-1 text-slate-ink/50 transition-colors hover:bg-slate-ink/10"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              aria-label={`Edit ${rule.value}`}
              onClick={startEditing}
              className="rounded p-1 text-slate-ink/50 opacity-0 transition-opacity hover:bg-slate-ink/10 focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
            >
              <PencilIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label={`Delete ${rule.value}`}
              onClick={() => deleteRule(rule.id)}
              className="rounded p-1 text-signal-coral opacity-0 transition-opacity hover:bg-signal-coral/10 focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </li>
  )
}

function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded bg-fog-indigo/8 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-fog-indigo uppercase">
      {children}
    </span>
  )
}

function PencilIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path
        d="M13.5 3.5 16.5 6.5 7 16H4v-3l9.5-9.5Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M4.5 10.5l3.5 3.5 7.5-8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function XIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M5 5l10 10M15 5 5 15" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function TrashIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path
        d="M4 6h12M8 6V4.5A1.5 1.5 0 0 1 9.5 3h1A1.5 1.5 0 0 1 12 4.5V6m-6 0 .6 9.4A1.5 1.5 0 0 0 8.1 17h3.8a1.5 1.5 0 0 0 1.5-1.6L14 6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}