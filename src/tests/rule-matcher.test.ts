import { describe, expect, it } from 'vitest'
import { compileRules, dedupeMatches, isValidRuleValue, rulesForHostname } from '../shared/rule-matcher'
import type { Rule } from '../shared/types'

function makeRule(overrides: Partial<Rule>): Rule {
  return {
    id: overrides.id ?? 'r_test',
    type: 'keyword',
    value: 'acme',
    caseSensitive: false,
    wholeWord: true,
    enabled: true,
    scope: 'global',
    domains: [],
    createdAt: 0,
    ...overrides,
  }
}

describe('compileRules — keyword matching', () => {
  it('matches case-insensitively by default', () => {
    const rules = [makeRule({ id: 'r1', value: 'acme' })]
    const matchers = compileRules(rules)
    const matches = matchers.flatMap((m) => m.findMatches('Contact ACME Corp today'))
    expect(matches).toEqual([{ ruleId: 'r1', start: 8, end: 12 }])
  })

  it('respects caseSensitive: true', () => {
    const rules = [makeRule({ id: 'r1', value: 'acme', caseSensitive: true })]
    const matchers = compileRules(rules)
    expect(matchers.flatMap((m) => m.findMatches('ACME corp'))).toEqual([])
    expect(matchers.flatMap((m) => m.findMatches('acme corp'))).toEqual([{ ruleId: 'r1', start: 0, end: 4 }])
  })

  it('respects wholeWord boundaries', () => {
    const rules = [makeRule({ id: 'r1', value: 'cat', wholeWord: true })]
    const matchers = compileRules(rules)
    expect(matchers.flatMap((m) => m.findMatches('concatenate'))).toEqual([])
    expect(matchers.flatMap((m) => m.findMatches('the cat sat'))).toEqual([{ ruleId: 'r1', start: 4, end: 7 }])
  })

  it('matches substrings when wholeWord is false', () => {
    const rules = [makeRule({ id: 'r1', value: 'cat', wholeWord: false })]
    const matchers = compileRules(rules)
    expect(matchers.flatMap((m) => m.findMatches('concatenate'))).toEqual([{ ruleId: 'r1', start: 3, end: 6 }])
  })

  it('combines multiple keyword rules sharing flags into one pass but keeps ruleIds distinct', () => {
    const rules = [makeRule({ id: 'r1', value: 'acme' }), makeRule({ id: 'r2', value: 'globex' })]
    const matchers = compileRules(rules)
    const matches = matchers.flatMap((m) => m.findMatches('acme and globex merged'))
    expect(matches.map((m) => m.ruleId).sort()).toEqual(['r1', 'r2'])
  })

  it('skips disabled rules', () => {
    const rules = [makeRule({ id: 'r1', value: 'acme', enabled: false })]
    expect(compileRules(rules).flatMap((m) => m.findMatches('acme'))).toEqual([])
  })
})

describe('compileRules — regex matching', () => {
  it('compiles and matches a valid regex rule', () => {
    const rules = [makeRule({ id: 'r1', type: 'regex', value: '\\b\\d{3}-\\d{2}-\\d{4}\\b', caseSensitive: true })]
    const matches = compileRules(rules).flatMap((m) => m.findMatches('SSN: 123-45-6789 on file'))
    expect(matches).toEqual([{ ruleId: 'r1', start: 5, end: 16 }])
  })

  it('silently skips an invalid regex rule instead of throwing', () => {
    const rules = [makeRule({ id: 'r1', type: 'regex', value: '(unclosed' })]
    expect(() => compileRules(rules)).not.toThrow()
    expect(compileRules(rules)).toEqual([])
  })
})

describe('isValidRuleValue', () => {
  it('accepts any non-empty keyword', () => {
    expect(isValidRuleValue({ type: 'keyword', value: 'anything' })).toBe(true)
  })

  it('rejects an empty value', () => {
    expect(isValidRuleValue({ type: 'keyword', value: '   ' })).toBe(false)
  })

  it('accepts a syntactically valid regex', () => {
    expect(isValidRuleValue({ type: 'regex', value: '^\\d+$' })).toBe(true)
  })

  it('rejects a syntactically invalid regex', () => {
    expect(isValidRuleValue({ type: 'regex', value: '(unclosed' })).toBe(false)
  })
})

describe('dedupeMatches', () => {
  it('keeps non-overlapping matches', () => {
    const matches = [
      { ruleId: 'a', start: 0, end: 4 },
      { ruleId: 'b', start: 10, end: 14 },
    ]
    expect(dedupeMatches(matches)).toEqual(matches)
  })

  it('prefers the widest span when matches overlap', () => {
    const matches = [
      { ruleId: 'narrow', start: 2, end: 4 },
      { ruleId: 'wide', start: 0, end: 6 },
    ]
    expect(dedupeMatches(matches)).toEqual([{ ruleId: 'wide', start: 0, end: 6 }])
  })
})

describe('rulesForHostname', () => {
  const global = makeRule({ id: 'global', scope: 'global' })
  const domainScoped = makeRule({ id: 'scoped', scope: 'domain', domains: ['example.com'] })

  it('always includes global rules', () => {
    expect(rulesForHostname([global], 'anything.test')).toEqual([global])
  })

  it('includes domain-scoped rules only on a matching hostname or subdomain', () => {
    expect(rulesForHostname([domainScoped], 'example.com').map((r) => r.id)).toEqual(['scoped'])
    expect(rulesForHostname([domainScoped], 'mail.example.com').map((r) => r.id)).toEqual(['scoped'])
    expect(rulesForHostname([domainScoped], 'other.com')).toEqual([])
  })
})
