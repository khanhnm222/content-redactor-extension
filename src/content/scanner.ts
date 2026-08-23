import { compileRules, dedupeMatches, rulesForHostname } from '../shared/rule-matcher'
import type { Rule } from '../shared/types'
import type { MaskTarget } from './overlay-manager'

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'NOSCRIPT', 'IFRAME'])

// Stable per-text-node id so re-scans of unchanged nodes produce the same
// MaskTarget key, letting the caller diff against already-mounted masks
// instead of tearing down and remounting on every rescan.
const textNodeIds = new WeakMap<Text, string>()
let nextId = 0
function idFor(node: Text): string {
  let id = textNodeIds.get(node)
  if (!id) {
    id = `t${nextId++}`
    textNodeIds.set(node, id)
  }
  return id
}

function isSkippable(element: Element | null): boolean {
  let el = element
  while (el) {
    if (SKIP_TAGS.has(el.tagName) || (el instanceof HTMLElement && el.isContentEditable)) return true
    el = el.parentElement
  }
  return false
}

/** Walks `root` for text matching any enabled rule scoped to `hostname` and returns mask targets for each match.
* Uses `root`'s own document rather than the ambient global `document`, so this also works when `root` belongs
* to an embedded frame's document (see embedded-frames.ts) rather than the top-level page. */
export function scan(root: Node, rules: Rule[], hostname: string): MaskTarget[] {
  const scoped = rulesForHostname(rules, hostname)
  const matchers = compileRules(scoped)
  if (matchers.length === 0) return []

  const doc = root.ownerDocument ?? (root as Document)
  const targets: MaskTarget[] = []
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.textContent?.trim()) return NodeFilter.FILTER_REJECT
      return isSkippable(node.parentElement) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    },
  })

  let node: Node | null
  while ((node = walker.nextNode())) {
    const textNode = node as Text
    const parent = textNode.parentElement
    if (!parent) continue

    const text = textNode.textContent ?? ''
    const matches = dedupeMatches(matchers.flatMap((m) => m.findMatches(text)))

    for (const match of matches) {
      targets.push({
        key: `${idFor(textNode)}:${match.start}:${match.end}`,
        ruleId: match.ruleId,
        observedElement: parent,
        getRect: () => {
          const currentText = textNode.textContent
          if (!textNode.isConnected || currentText === null || match.end > currentText.length) return null
          const range = doc.createRange()
          range.setStart(textNode, match.start)
          range.setEnd(textNode, match.end)
          return range.getBoundingClientRect()
        },
      })
    }
  }

  return targets
}
