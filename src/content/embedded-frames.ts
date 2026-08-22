import type { Config } from '../shared/types'
import { OverlayManager } from './overlay-manager'
import { scan } from './scanner'
import { startObservers } from './observers'

interface TrackedFrame {
  contentDocument: Document
  overlayManager: OverlayManager
  stopObservers: () => void
}

const tracked = new Map<HTMLIFrameElement, TrackedFrame>()

/**
* An iframe sandboxed without `allow-scripts` can run no script of its own — ours or the
* page's — so the normal `all_frames` content-script injection never reaches it. If it also has
* `allow-same-origin`, though, the parent frame can still reach its `contentDocument` directly
* and mask it externally, without any script needing to execute "inside" that document.
* Anything else (no sandbox, or sandbox with allow-scripts) is left alone here — a normal content
* script should already be running there independently, and recursing too would double-mount masks.
*/
function getRecursableDocument(iframe: HTMLIFrameElement): Document | null {
  const sandbox = iframe.getAttribute('sandbox')
  if (sandbox === null) return null
  const tokens = sandbox.trim().split(/\s+/)
  if (tokens.includes('allow-scripts')) return null
  if (!tokens.includes('allow-same-origin')) return null

  try {
    const doc = iframe.contentDocument
    return doc?.body ? doc : null
  } catch {
    return null
  }
}

function teardown(iframe: HTMLIFrameElement): void {
  const frame = tracked.get(iframe)
  if (!frame) return
  frame.stopObservers()
  tracked.delete(iframe)
}

function setup(iframe: HTMLIFrameElement, doc: Document, config: Config): void {
  const overlayManager = new OverlayManager(config.settings, doc)
  const hostname = location.hostname // a sandboxed srcdoc frame has no meaningful origin of its own

  const runScan = () => {
    for (const target of scan(doc.body, config.rules, hostname)) {
      overlayManager.mount(target)
    }
  }
  runScan()

  const stopObservers = startObservers(
    {
      onSync: () => overlayManager.syncAll(),
      onMutations: () => {
        runScan()
        discoverEmbeddedFrames(doc.body, config) // pick up further-nested iframes added later
      },
    },
    doc
  )

  tracked.set(iframe, { contentDocument: doc, overlayManager, stopObservers })
  discoverEmbeddedFrames(doc.body, config) // catch iframes already present at setup time
}

/**
* Scans `root` for embedded frames this extension can reach (see getRecursableDocument) and sets
* up independent scanning/masking for each new one found. Safe to call repeatedly — already-
* tracked, still-current documents are left alone; navigated or now-inaccessible ones are reset.
*/
export function discoverEmbeddedFrames(root: ParentNode, config: Config): void {
  for (const iframe of root.querySelectorAll('iframe')) {
    const existing = tracked.get(iframe)
    const doc = getRecursableDocument(iframe)

    if (!doc) {
      if (existing) teardown(iframe)
      continue
    }
    if (existing?.contentDocument === doc) continue
    if (existing) teardown(iframe)

    setup(iframe, doc, config)
  }
}

/** Re-applies settings/rules to every tracked embedded frame after a config change. */
export function reconcileEmbeddedFrames(config: Config): void {
  const hostname = location.hostname
  const enabledIds = new Set(config.rules.filter((r) => r.enabled).map((r) => r.id))

  for (const [iframe, frame] of tracked) {
    if (!iframe.isConnected) {
      teardown(iframe)
      continue
    }
    frame.overlayManager.updateSettings(config.settings)
    frame.overlayManager.pruneDisabledRules(enabledIds)
    for (const target of scan(frame.contentDocument.body, config.rules, hostname)) {
      frame.overlayManager.mount(target)
    }
  }
}
