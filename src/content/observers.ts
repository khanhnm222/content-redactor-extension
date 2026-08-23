const RESCAN_DEBOUNCE_MS = 75

export interface ObserverCallbacks {
  /** Called (via requestAnimationFrame, batched to one paint per frame) after scroll/resize. */
  onSync: () => void
  /** Called with a debounced batch of DOM mutations so new/changed content can be rescanned. */
  onMutations: (mutations: MutationRecord[]) => void
}

/** Wires scroll/resize/DOM-mutation tracking for `doc` (defaults to the top-level page — pass an
* embedded frame's own document, see embedded-frames.ts, to track that frame instead). Returns a
* cleanup function that tears down all listeners. */
export function startObservers({ onSync, onMutations }: ObserverCallbacks, doc: Document = document): () => void {
  const win = doc.defaultView ?? window

  let rafScheduled = false
  const scheduleSync = () => {
    if (rafScheduled) return
    rafScheduled = true
    win.requestAnimationFrame(() => {
      rafScheduled = false
      onSync()
    })
  }

  // `capture: true` intercepts scroll events from any scrollable ancestor
  // during the capture phase, not just window-level scrolling.
  win.addEventListener('scroll', scheduleSync, { capture: true, passive: true })
  win.addEventListener('resize', scheduleSync, { passive: true })

  let pending: MutationRecord[] = []
  let debounceTimer: ReturnType<typeof setTimeout> | undefined
  const mutationObserver = new MutationObserver((mutations) => {
    pending.push(...mutations)
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      const batch = pending
      pending = []
      onMutations(batch)
      scheduleSync()
    }, RESCAN_DEBOUNCE_MS)
  })
  // Our own mask layer lives under <html>, outside <body>, so its DOM
  // changes never reach this observer — no feedback loop to filter out.
  mutationObserver.observe(doc.body, { childList: true, characterData: true, subtree: true })

  return () => {
    win.removeEventListener('scroll', scheduleSync, true)
    win.removeEventListener('resize', scheduleSync)
    mutationObserver.disconnect()
    clearTimeout(debounceTimer)
  }
}
