import type { Rule } from '../../shared/types'
import { setAllRulesEnabled } from '../../shared/messaging'
import { RuleItem } from './RuleItem'

interface Props {
  rules: Rule[]
}

export function RuleList({ rules }: Props) {
  if (rules.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-1 px-6 py-16 text-center">
        <p className="text-sm text-slate-ink/50">No rules yet.</p>
        <p className="text-xs text-slate-ink/40">Add a term above to start masking it on the page.</p>
      </div>
    )
  }

  const allEnabled = rules.every((r) => r.enabled)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-ink/10 bg-slate-ink/3 px-4 py-1.5 text-xs">
        <span className="text-slate-ink/50">
          {rules.length} rule{rules.length === 1 ? '' : 's'}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={allEnabled}
          onClick={() => setAllRulesEnabled(!allEnabled)}
          className="flex items-center gap-2"
        >
          <span className="font-medium text-fog-indigo">{allEnabled ? 'Disable all' : 'Enable all'}</span>
          <span
            className={`flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition-colors ${
              allEnabled ? 'bg-reveal-amber' : 'bg-slate-ink/15'
            }`}
          >
            <span
              className={`h-3 w-3 rounded-full bg-white shadow transition-transform ${
                allEnabled ? 'translate-x-3' : 'translate-x-0'
              }`}
            />
          </span>
        </button>
      </div>

      <ul className="flex-1 overflow-y-auto">
        {rules.map((rule) => (
          <RuleItem key={rule.id} rule={rule} />
        ))}
      </ul>
    </div>
  )
}
