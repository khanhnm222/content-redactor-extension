import { useState, type FormEvent } from 'react'
import { upsertRule } from '../../shared/messaging'
import { isValidRuleValue } from '../../shared/rule-matcher'
import type { RuleScope, RuleType } from '../../shared/types'
import { Checkbox } from './Checkbox'
import { Select } from './Select'

const REGEX_METACHARS = /[.*+?^${}()|[\]\\]/

interface Props {
  activeHostname: string | null
}

export function AddRuleForm({ activeHostname }: Props) {
  const [value, setValue] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [wholeWord, setWholeWord] = useState(true)
  const [scope, setScope] = useState<RuleScope>('global')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const detectedType: RuleType = REGEX_METACHARS.test(value) ? 'regex' : 'keyword'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const rule = {
      type: detectedType,
      value: value.trim(),
      caseSensitive,
      wholeWord: detectedType === 'keyword' && wholeWord,
      enabled: true,
      scope,
      domains: scope === 'domain' && activeHostname ? [activeHostname] : [],
    }

    if (!isValidRuleValue(rule)) {
      setError(detectedType === 'regex' ? 'Invalid regular expression' : 'Enter a term')
      return
    }

    setSubmitting(true)
    const res = await upsertRule(rule)
    setSubmitting(false)

    if (!res.ok) {
      setError(res.error)
      return
    }
    setValue('')
  }

  return (
    <form onSubmit={handleSubmit} className="shrink-0 border-b border-slate-ink/10 bg-white p-4">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Add a term or regex pattern"
          aria-label="New rule value"
          className="flex-1 rounded-md border border-slate-ink/20 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-ink outline-none focus:border-reveal-amber focus:ring-2 focus:ring-reveal-amber/30"
        />
        <span className="shrink-0 rounded bg-fog-indigo/8 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-fog-indigo uppercase">
          {detectedType}
        </span>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-ink/70">
        <Checkbox checked={caseSensitive} onChange={setCaseSensitive} label="Case sensitive" />
        {detectedType === 'keyword' && (
          <Checkbox checked={wholeWord} onChange={setWholeWord} label="Whole word" />
        )}
        <Select
          value={scope}
          onChange={(v) => setScope(v as RuleScope)}
          disabled={!activeHostname}
          aria-label="Rule scope"
          className="flex-none!"
          options={[
            { value: 'global', label: 'All sites' },
            { value: 'domain', label: `This site${activeHostname ? ` (${activeHostname})` : ''}` },
          ]}
        />
      </div>

      {error && <p className="mt-2 text-xs font-medium text-signal-coral">{error}</p>}

      <button
        type="submit"
        disabled={submitting || !value.trim()}
        className="mt-3 rounded-md bg-reveal-amber px-3 py-1.5 text-xs font-semibold text-slate-ink transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        Add rule
      </button>
    </form>
  )
}
