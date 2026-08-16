import { getConfig, setConfig, onConfigChanged } from '../shared/storage'
import { DEFAULT_CONFIG, DEFAULT_SETTINGS } from '../shared/types'
import type { Config, Rule } from '../shared/types'
import type { Message, MessageResponse, SelectionChangedMessage } from '../shared/messaging'

function ok(config: Config): MessageResponse {
  return { ok: true, config }
}

function fail(error: string): MessageResponse {
  return { ok: false, error }
}

const ADD_SELECTION_MENU_ID = 'redactor-add-selection'
const TOGGLE_SELECTION_MENU_ID = 'redactor-toggle-selection'

function findRuleForSelection(config: Config, value: string): Rule | undefined {
  const normalized = value.toLowerCase()
  return config.rules.find((r) => r.type === 'keyword' && r.value.toLowerCase() === normalized)
}

function buildKeywordRule(value: string): Rule {
  return {
    id: `r_${crypto.randomUUID().slice(0, 8)}`,
    type: 'keyword',
    value,
    caseSensitive: false,
    // Arbitrary selected page text often carries trailing punctuation, which
    // would break a \b word-boundary match — a plain substring match is what
    // reliably covers exactly what the user highlighted.
    wholeWord: false,
    enabled: true,
    scope: 'global',
    domains: [],
    createdAt: Date.now(),
  }
}

async function handleMessage(message: Message): Promise<MessageResponse> {
  const config = await getConfig()

  switch (message.type) {
    case 'UPSERT_RULE': {
      const { rule } = message
      let rules: Rule[]
      if (rule.id) {
        const existing = config.rules.find((r) => r.id === rule.id)
        if (!existing) return fail(`Rule ${rule.id} not found`)
        rules = config.rules.map((r) => (r.id === rule.id ? { ...existing, ...rule } : r))
      } else {
        const newRule: Rule = { ...rule, id: `r_${crypto.randomUUID().slice(0, 8)}`, createdAt: Date.now() }
        rules = [...config.rules, newRule]
      }
      const next = { ...config, rules }
      await setConfig(next)
      return ok(next)
    }

    case 'DELETE_RULE': {
      const next = { ...config, rules: config.rules.filter((r) => r.id !== message.ruleId) }
      await setConfig(next)
      return ok(next)
    }

    case 'TOGGLE_RULE': {
      const next = {
        ...config,
        rules: config.rules.map((r) => (r.id === message.ruleId ? { ...r, enabled: message.enabled } : r)),
      }
      await setConfig(next)
      return ok(next)
    }

    case 'SET_ALL_RULES_ENABLED': {
      const next = { ...config, rules: config.rules.map((r) => ({ ...r, enabled: message.enabled })) }
      await setConfig(next)
      return ok(next)
    }

    case 'UPDATE_SETTINGS': {
      const next = { ...config, settings: { ...config.settings, ...message.settings } }
      await setConfig(next)
      return ok(next)
    }

    case 'CONFIG_UPDATED':
      // Broadcast-only message; the background worker never receives its own broadcasts.
      return ok(config)
  }
}

// Makes the toolbar icon open the side panel directly instead of a popup dropdown.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {})

chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch((err) => sendResponse(fail(err instanceof Error ? err.message : String(err))))
  return true // keep the message channel open for the async response
})

async function updateBadge(config: Config) {
  const activeCount = config.rules.filter((r) => r.enabled).length
  await chrome.action.setBadgeText({ text: activeCount > 0 ? String(activeCount) : '' })
  await chrome.action.setBadgeBackgroundColor({ color: '#2B3A55' }) // Fog Indigo
}

async function broadcastConfig(config: Config) {
  const tabs = await chrome.tabs.query({})
  const message: Message = { type: 'CONFIG_UPDATED', config }
  for (const tab of tabs) {
    if (tab.id === undefined) continue
    chrome.tabs.sendMessage(tab.id, message).catch(() => {
      // No content script listening in this tab (chrome:// pages, etc.) — ignore.
    })
  }
}

// Last text reported by the content script's selection tracker — used to
// decide which of the two selection-context menu items to show, ahead of the
// actual right-click (Chrome has no "menu about to open" hook to compute
// this lazily). Best-effort only: the click handler below always re-checks
// the real config rather than trusting this cache, so staleness here (e.g.
// after a service worker restart, or switching tabs without a new selection)
// can at worst show the wrong menu label, never the wrong action.
let lastSelectionText = ''

async function updateSelectionMenu() {
  const text = lastSelectionText
  const config = text ? await getConfig() : null
  const existing = config ? findRuleForSelection(config, text) : undefined

  chrome.contextMenus.update(
    ADD_SELECTION_MENU_ID,
    { visible: !!text && !existing },
    () => void chrome.runtime.lastError
  )
  chrome.contextMenus.update(
    TOGGLE_SELECTION_MENU_ID,
    {
      visible: !!text && !!existing,
      title: existing?.enabled === false ? 'Enable “%s” in Redactor rules' : 'Disable “%s” in Redactor rules',
    },
    () => void chrome.runtime.lastError
  )
}

chrome.runtime.onMessage.addListener((message: SelectionChangedMessage) => {
  if (message.type !== 'SELECTION_CHANGED') return
  lastSelectionText = message.text
  void updateSelectionMenu()
})

onConfigChanged((config) => {
  void updateBadge(config)
  void broadcastConfig(config)
  void updateSelectionMenu()
})

chrome.runtime.onInstalled.addListener(async () => {
  // removeAll first so re-registering on an update doesn't hit a duplicate-id error.
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create(
      {
        id: ADD_SELECTION_MENU_ID,
        title: 'Add “%s” to Redactor rules',
        contexts: ['selection'],
      },
      () => void chrome.runtime.lastError
    )
    chrome.contextMenus.create(
      {
        id: TOGGLE_SELECTION_MENU_ID,
        title: 'Disable “%s” in Redactor rules',
        contexts: ['selection'],
        visible: false,
      },
      () => void chrome.runtime.lastError
    )
  })

  const config = await getConfig()
  if (config.version !== DEFAULT_CONFIG.version) {
    await setConfig({ ...DEFAULT_CONFIG, settings: { ...DEFAULT_SETTINGS, ...config.settings }, rules: config.rules })
  }
  await updateBadge(config)
})

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== ADD_SELECTION_MENU_ID && info.menuItemId !== TOGGLE_SELECTION_MENU_ID) return
  const value = info.selectionText?.trim()
  if (!value) return

  const config = await getConfig()
  const existing = findRuleForSelection(config, value)

  const next = existing
    ? { ...config, rules: config.rules.map((r) => (r.id === existing.id ? { ...r, enabled: !r.enabled } : r)) }
    : { ...config, rules: [...config.rules, buildKeywordRule(value)] }

  await setConfig(next)

  if (tab?.id !== undefined) {
    chrome.sidePanel.open({ tabId: tab.id }).catch(() => {})
  }
})
