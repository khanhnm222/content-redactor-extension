import type { Rule } from './types'

export interface RuleMatch {
  ruleId: string
  start: number
  end: number
}

export interface CompiledMatcher {
  ruleIds: string[]
  findMatches(text: string): RuleMatch[]
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Rejects only syntactically invalid patterns (a `try/catch new RegExp()`
* guard). Full ReDoS / catastrophic-backtracking protection is deferred. */
export function isValidRuleValue(rule: Pick<Rule, 'type' | 'value'>): boolean {
  if (rule.value.trim().length === 0) return false
  if (rule.type !== 'regex') return true
  try {
    new RegExp(rule.value)
    return true
  } catch {
    return false
  }
}

function compileKeywordGroup(rules: Rule[], caseSensitive: boolean, wholeWord: boolean): CompiledMatcher | null {
  if (rules.length === 0) return null
  const boundary = wholeWord ? '\\b' : ''
  const parts = rules.map((rule, i) => `(?<m${i}>${boundary}${escapeRegExp(rule.value)}${boundary})`)
  const regex = new RegExp(parts.join('|'), caseSensitive ? 'g' : 'gi')
  const ruleIds = rules.map((r) => r.id)

  return {
    ruleIds,
    findMatches(text: string): RuleMatch[] {
      const matches: RuleMatch[] = []
      regex.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = regex.exec(text)) !== null) {
        const groupIndex = rules.findIndex((_, i) => m!.groups?.[`m${i}`] !== undefined)
        if (groupIndex !== -1) {
          matches.push({ ruleId: rules[groupIndex].id, start: m.index, end: m.index + m[0].length })
        }
        if (m[0].length === 0) regex.lastIndex++ // avoid infinite loop on empty match
      }
      return matches
    },
  }
}

function compileRegexRule(rule: Rule): CompiledMatcher | null {
  let regex: RegExp
  try {
    regex = new RegExp(rule.value, rule.caseSensitive ? 'g' : 'gi')
  } catch {
    return null
  }
  return {
    ruleIds: [rule.id],
    findMatches(text: string): RuleMatch[] {
      const matches: RuleMatch[] = []
      regex.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = regex.exec(text)) !== null) {
        matches.push({ ruleId: rule.id, start: m.index, end: m.index + m[0].length })
        if (m[0].length === 0) regex.lastIndex++
      }
      return matches
    },
  }
}

/**
* Compiles enabled rules into matchers. Keyword rules sharing the same
* caseSensitive/wholeWord flags are combined into a single alternation regex
* (one pass per text node instead of one per keyword, per the doc's
* "compile once" performance note, §9); regex rules compile individually.
* Invalid regex rules are silently skipped (validate with isValidRuleValue
* before persisting a rule).
*/
export function compileRules(rules: Rule[]): CompiledMatcher[] {
  const enabled = rules.filter((r) => r.enabled)
  const matchers: CompiledMatcher[] = []

  const keywordGroups = new Map<string, Rule[]>()
  for (const rule of enabled) {
    if (rule.type !== 'keyword') continue
    const key = `${rule.caseSensitive}:${rule.wholeWord}`
    const group = keywordGroups.get(key) ?? []
    group.push(rule)
    keywordGroups.set(key, group)
  }
  for (const [key, group] of keywordGroups) {
    const [caseSensitive, wholeWord] = key.split(':')
    const matcher = compileKeywordGroup(group, caseSensitive === 'true', wholeWord === 'true')
    if (matcher) matchers.push(matcher)
  }

  for (const rule of enabled) {
    if (rule.type !== 'regex') continue
    const matcher = compileRegexRule(rule)
    if (matcher) matchers.push(matcher)
  }

  return matchers
}

/** Keeps only non-overlapping matches, preferring the widest span when matches overlap
* (e.g. a parent and child element/rule both matching the same text). */
export function dedupeMatches(matches: RuleMatch[]): RuleMatch[] {
  const sorted = [...matches].sort((a, b) => a.start - b.start || b.end - a.end)
  const kept: RuleMatch[] = []
  for (const match of sorted) {
    const last = kept[kept.length - 1]
    if (last && match.start < last.end) continue
    kept.push(match)
  }
  return kept
}

/** Rules scoped to specific domains only apply on those domains; global rules always apply. */
export function rulesForHostname(rules: Rule[], hostname: string): Rule[] {
  return rules.filter((rule) => {
    if (rule.scope === 'global') return true
    return rule.domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))
  })
}
