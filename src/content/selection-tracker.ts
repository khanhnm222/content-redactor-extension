import { reportSelectionChanged } from '../shared/messaging'

const DEBOUNCE_MS = 150

/** Keeps the background worker's context-menu items in sync with whatever
* text is currently selected, so by the time the user right-clicks, the menu
* already reflects whether that text matches an existing rule. */
export function startSelectionTracking(): () => void {
  let lastSent = ''
  let timer: ReturnType<typeof setTimeout> | undefined

  const report = () => {
    const text = window.getSelection()?.toString().trim() ?? ''
    if (text === lastSent) return
    lastSent = text
    reportSelectionChanged(text)
  }

  const scheduleReport = () => {
    clearTimeout(timer)
    timer = setTimeout(report, DEBOUNCE_MS)
  }

  document.addEventListener('selectionchange', scheduleReport)

  return () => {
    document.removeEventListener('selectionchange', scheduleReport)
    clearTimeout(timer)
  }
}
