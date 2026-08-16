export type RuleType = 'keyword' | 'regex'
export type RuleScope = 'global' | 'domain'
export type MaskStyle = 'frosted' | 'solid' | 'pixelated'

export interface Rule {
  id: string
  type: RuleType
  value: string
  caseSensitive: boolean
  wholeWord: boolean
  enabled: boolean
  scope: RuleScope
  domains: string[]
  createdAt: number
}

export interface Settings {
  blurStrength: number
  clickToReveal: boolean
  revealTimeoutMs: number
  maskStyle: MaskStyle
}

export interface Config {
  version: number
  rules: Rule[]
  settings: Settings
}

export const CONFIG_VERSION = 1

export const DEFAULT_SETTINGS: Settings = {
  blurStrength: 8,
  clickToReveal: true,
  revealTimeoutMs: 3000,
  maskStyle: 'frosted',
}

export const DEFAULT_CONFIG: Config = {
  version: CONFIG_VERSION,
  rules: [],
  settings: DEFAULT_SETTINGS,
}

export type NewRuleInput = Omit<Rule, 'id' | 'createdAt'>
