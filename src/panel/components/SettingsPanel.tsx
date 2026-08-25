import type { Settings } from '../../shared/types'
import { updateSettings } from '../../shared/messaging'
import { Select } from './Select'

interface Props {
  settings: Settings
}

export function SettingsPanel({ settings }: Props) {
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <h2 className="font-display text-xs font-semibold tracking-wide text-fog-indigo/70 uppercase">
        Mask appearance
      </h2>

      <label className="mt-3 flex items-center gap-3 text-sm">
        <span className="w-24 shrink-0 text-slate-ink/70">Blur strength</span>
        <input
          type="range"
          min={2}
          max={20}
          value={settings.blurStrength}
          onChange={(e) => updateSettings({ blurStrength: Number(e.target.value) })}
          className="flex-1 accent-reveal-amber"
        />
        <span className="w-9 shrink-0 text-right font-mono text-xs text-slate-ink/70">
          {settings.blurStrength}px
        </span>
      </label>

      <label className="mt-3 flex items-center gap-3 text-sm">
        <span className="w-24 shrink-0 text-slate-ink/70">Mask style</span>
        <Select
          value={settings.maskStyle}
          onChange={(v) => updateSettings({ maskStyle: v as Settings['maskStyle'] })}
          aria-label="Mask style"
          options={[
            { value: 'frosted', label: 'Frosted' },
            { value: 'solid', label: 'Solid' },
            { value: 'pixelated', label: 'Pixelated' },
          ]}
        />
      </label>
    </div>
  )
}
