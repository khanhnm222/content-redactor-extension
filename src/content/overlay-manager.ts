import type { Settings } from '../shared/types'

export interface MaskTarget {
  /** Stable identity for one matched span — used to diff scans against currently-mounted masks. */
  key: string
  ruleId: string
  /** Element ResizeObserver/IntersectionObserver watch to detect layout shifts and visibility. */
  observedElement: Element
  /** Recomputes the current viewport rect for this match; null means the match is gone (unmount). */
  getRect(): DOMRect | null
}

interface ActiveMask {
  box: HTMLDivElement
  ruleId: string
  observedElement: Element
  getRect: () => DOMRect | null
}

// Extra breathing room around the matched text's tight bounding box, so the
// mask fully covers descenders/ascenders and italic slant instead of clipping
// right against the glyphs.
const MASK_PADDING_X = 4
const MASK_PADDING_Y = 3

const MASK_STYLE_BACKGROUND: Record<Settings['maskStyle'], string> = {
  frosted: 'rgba(184, 196, 217, 0.35)', // Glass Mist
  solid: 'rgba(27, 36, 48, 0.95)', // Slate Ink
  pixelated: 'rgba(184, 196, 217, 0.55)',
}

/**
* Owns the closed-ShadowRoot mask layer: mounts/unmounts overlay boxes and
* keeps their position/size synced to the live content they cover.
* `backdrop-filter` blurs whatever is visually beneath the box, so it stays
* correct against any page background without cloning the covered content.
*/
export class OverlayManager {
  #active = new Map<string, ActiveMask>()
  #shadowHost: HTMLElement
  #shadowRoot: ShadowRoot
  #styleEl: HTMLStyleElement
  #settings: Settings

  #resizeObserver: ResizeObserver
  #resizeRefCounts = new Map<Element, number>()

  #intersectionObserver: IntersectionObserver
  #visible = new Set<Element>()

  /** `doc` defaults to the top-level page; pass an embedded frame's own document
   * (see embedded-frames.ts) to mount a mask layer scoped to that frame instead. */
  constructor(settings: Settings, doc: Document = document) {
    this.#settings = settings

    this.#shadowHost = doc.createElement('div')
    this.#shadowHost.setAttribute('data-redactor-host', '')
    Object.assign(this.#shadowHost.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '0',
      height: '0',
      zIndex: '2147483647',
    })
    this.#shadowRoot = this.#shadowHost.attachShadow({ mode: 'closed' })
    this.#styleEl = doc.createElement('style')
    this.#shadowRoot.appendChild(this.#styleEl)
    this.#applyStyles()
    ;(doc.documentElement ?? doc.body).appendChild(this.#shadowHost)

    this.#resizeObserver = new ResizeObserver(() => this.syncAll())
    this.#intersectionObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) this.#visible.add(entry.target)
        else this.#visible.delete(entry.target)
      }
    })
  }

  updateSettings(settings: Settings): void {
    this.#settings = settings
    this.#applyStyles()
  }

  mount(target: MaskTarget): void {
    if (this.#active.has(target.key)) return

    const box = document.createElement('div')
    box.className = 'redactor-mask'
    box.dataset.ruleId = target.ruleId
    this.#shadowRoot.appendChild(box)

    const active: ActiveMask = {
      box,
      ruleId: target.ruleId,
      observedElement: target.observedElement,
      getRect: target.getRect,
    }
    this.#active.set(target.key, active)

    this.#observe(target.observedElement)
    this.#sync(active)
  }

  unmount(key: string): void {
    const active = this.#active.get(key)
    if (!active) return
    active.box.remove()
    this.#unobserve(active.observedElement)
    this.#active.delete(key)
  }

  /** Removes masks belonging to rules that are no longer enabled (disabled, deleted, or newly out of scope). */
  pruneDisabledRules(enabledRuleIds: Set<string>): void {
    for (const [key, active] of this.#active) {
      if (!enabledRuleIds.has(active.ruleId)) this.unmount(key)
    }
  }

  syncAll(): void {
    for (const [key, active] of this.#active) {
      const rect = active.getRect()
      if (!rect) {
        this.unmount(key)
        continue
      }
      this.#paint(active, rect)
    }
  }

  #sync(active: ActiveMask): void {
    const rect = active.getRect()
    if (!rect) return
    this.#paint(active, rect)
  }

  #paint(active: ActiveMask, rect: DOMRect): void {
    const visible = this.#visible.has(active.observedElement)
    if (!visible || (rect.width === 0 && rect.height === 0)) {
      active.box.style.display = 'none'
      return
    }
    active.box.style.display = ''
    active.box.style.transform = `translate(${rect.left - MASK_PADDING_X}px, ${rect.top - MASK_PADDING_Y}px)`
    active.box.style.width = `${rect.width + MASK_PADDING_X * 2}px`
    active.box.style.height = `${rect.height + MASK_PADDING_Y * 2}px`
  }

  #observe(el: Element): void {
    const count = this.#resizeRefCounts.get(el) ?? 0
    if (count === 0) {
      this.#resizeObserver.observe(el)
      this.#intersectionObserver.observe(el)
      this.#visible.add(el) // assume visible until the first IntersectionObserver callback corrects it
    }
    this.#resizeRefCounts.set(el, count + 1)
  }

  #unobserve(el: Element): void {
    const count = this.#resizeRefCounts.get(el) ?? 0
    if (count <= 1) {
      this.#resizeObserver.unobserve(el)
      this.#intersectionObserver.unobserve(el)
      this.#resizeRefCounts.delete(el)
      this.#visible.delete(el)
    } else {
      this.#resizeRefCounts.set(el, count - 1)
    }
  }

  #applyStyles(): void {
    const { blurStrength, maskStyle } = this.#settings
    const background = MASK_STYLE_BACKGROUND[maskStyle]
    const backdropFilter = maskStyle === 'solid' ? 'none' : `blur(${blurStrength}px) saturate(1.1)`
    this.#styleEl.textContent = `
      .redactor-mask {
        position: absolute;
        top: 0;
        left: 0;
        /* Click/hold-to-reveal isn't wired up yet, so the mask must never
           intercept clicks or scrolling on the underlying page. */
        pointer-events: none;
        border-radius: 4px;
        backdrop-filter: ${backdropFilter};
        -webkit-backdrop-filter: ${backdropFilter};
        background: ${background};
        transition: opacity 120ms ease;
      }
    `
  }
}
