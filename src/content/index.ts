import { getConfig, onConfigChanged } from '../shared/storage'
import type { Config } from '../shared/types'
import type { Message } from '../shared/messaging'
import { OverlayManager } from './overlay-manager'
import { scan } from './scanner'
import { startObservers } from './observers'
import { startSelectionTracking } from './selection-tracker'
import { discoverEmbeddedFrames, reconcileEmbeddedFrames } from './embedded-frames'

let config: Config
let overlayManager: OverlayManager

function fullScan(): void {
  const hostname = location.hostname
  for (const target of scan(document.body, config.rules, hostname)) {
    overlayManager.mount(target)
  }
  discoverEmbeddedFrames(document.body, config)
}

function collectMutationRoots(mutations: MutationRecord[]): Element[] {
  const roots = new Set<Element>()
  for (const mutation of mutations) {
    if (mutation.type === 'childList') {
      mutation.addedNodes.forEach((node) => {
        const root = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element)
        if (root) roots.add(root)
      })
    } else if (mutation.type === 'characterData') {
      const parent = mutation.target.parentElement
      if (parent) roots.add(parent)
    }
  }
  return [...roots]
}

function rescan(mutations: MutationRecord[]): void {
  const hostname = location.hostname
  for (const root of collectMutationRoots(mutations)) {
    for (const target of scan(root, config.rules, hostname)) {
      overlayManager.mount(target)
    }
    discoverEmbeddedFrames(root, config)
  }
}

/** Prunes masks for rules that are no longer enabled, then re-scans the page (and any embedded frames) for newly-active rules. */
function reconcileWithConfig(next: Config): void {
  config = next
  overlayManager.updateSettings(config.settings)
  const enabledIds = new Set(config.rules.filter((r) => r.enabled).map((r) => r.id))
  overlayManager.pruneDisabledRules(enabledIds)
  fullScan()
  reconcileEmbeddedFrames(config)
}

async function init(): Promise<void> {
  config = await getConfig()
  overlayManager = new OverlayManager(config.settings)

  const runInitialScan = () => fullScan()
  if ('requestIdleCallback' in window) {
    requestIdleCallback(runInitialScan)
  } else {
    setTimeout(runInitialScan, 0)
  }

  startObservers({
    onSync: () => overlayManager.syncAll(),
    onMutations: rescan,
  })

  startSelectionTracking()

  // Config changes made from an already-open tab's own popup land here via storage.onChanged...
  onConfigChanged(reconcileWithConfig)

  // ...while changes made from other tabs arrive via the background worker's broadcast.
  chrome.runtime.onMessage.addListener((message: Message) => {
    if (message.type === 'CONFIG_UPDATED') reconcileWithConfig(message.config)
  })
}

void init()
