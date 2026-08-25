import { useEffect, useState } from 'react'
import { getConfig, onConfigChanged } from '../../shared/storage'
import { DEFAULT_CONFIG, type Config } from '../../shared/types'

/** Loads the current config and keeps it live via storage.onChanged — updates made through the
* background worker's validated write path (see shared/messaging.ts) are reflected automatically. */
export function useConfig(): { config: Config; loading: boolean } {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getConfig().then((loaded) => {
      if (cancelled) return
      setConfig(loaded)
      setLoading(false)
    })
    return onConfigChanged((next) => setConfig(next))
  }, [])

  return { config, loading }
}
