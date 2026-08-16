import { CONFIG_VERSION, DEFAULT_CONFIG, DEFAULT_SETTINGS, type Config } from './types'

// `local` is the source of truth (no size quota concerns for a growing rule
// list); `sync` is a best-effort mirror so a user's terms follow them across
// signed-in browsers, per the doc's storage.sync/local split (§4).
const STORAGE_KEY = 'redactorConfig'

function normalizeConfig(raw: unknown): Config {
  const partial = (raw ?? {}) as Partial<Config>
  return {
    version: partial.version ?? CONFIG_VERSION,
    rules: Array.isArray(partial.rules) ? partial.rules : [],
    settings: { ...DEFAULT_SETTINGS, ...partial.settings },
  }
}

export async function getConfig(): Promise<Config> {
  const local = await chrome.storage.local.get(STORAGE_KEY)
  if (local[STORAGE_KEY]) return normalizeConfig(local[STORAGE_KEY])

  const synced = await chrome.storage.sync.get(STORAGE_KEY)
  if (synced[STORAGE_KEY]) {
    const config = normalizeConfig(synced[STORAGE_KEY])
    await chrome.storage.local.set({ [STORAGE_KEY]: config })
    return config
  }

  return DEFAULT_CONFIG
}

export async function setConfig(config: Config): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: config })
  try {
    await chrome.storage.sync.set({ [STORAGE_KEY]: config })
  } catch {
    // sync quota (100KB total / 8KB per item) can be exceeded by a large
    // rule list — local remains authoritative, so this is safe to ignore.
  }
}

export function onConfigChanged(callback: (config: Config) => void): () => void {
  const listener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: chrome.storage.AreaName
  ) => {
    if (areaName !== 'local') return
    const change = changes[STORAGE_KEY]
    if (!change) return
    callback(normalizeConfig(change.newValue))
  }
  chrome.storage.onChanged.addListener(listener)
  return () => chrome.storage.onChanged.removeListener(listener)
}
