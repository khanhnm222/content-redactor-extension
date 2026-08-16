import type { Config, NewRuleInput, Rule, Settings } from './types'

export type Message =
  | { type: 'UPSERT_RULE'; rule: NewRuleInput & { id?: string } }
  | { type: 'DELETE_RULE'; ruleId: string }
  | { type: 'TOGGLE_RULE'; ruleId: string; enabled: boolean }
  | { type: 'SET_ALL_RULES_ENABLED'; enabled: boolean }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<Settings> }
  | { type: 'CONFIG_UPDATED'; config: Config }

export type MessageResponse =
  | { ok: true; config: Config }
  | { ok: false; error: string }

export function sendMessage(message: Message): Promise<MessageResponse> {
  return chrome.runtime.sendMessage(message)
}

// Fire-and-forget notification from the content script to the background
// worker, kept separate from the request/response Message union above since
// it expects no reply — it just lets the context menu track the current
// on-page text selection ahead of a right-click.
export interface SelectionChangedMessage {
  type: 'SELECTION_CHANGED'
  text: string
}

export function reportSelectionChanged(text: string): void {
  chrome.runtime.sendMessage({ type: 'SELECTION_CHANGED', text } satisfies SelectionChangedMessage).catch(() => {})
}

export function upsertRule(rule: NewRuleInput & { id?: string }) {
  return sendMessage({ type: 'UPSERT_RULE', rule })
}

export function deleteRule(ruleId: string) {
  return sendMessage({ type: 'DELETE_RULE', ruleId })
}

export function toggleRule(ruleId: string, enabled: boolean) {
  return sendMessage({ type: 'TOGGLE_RULE', ruleId, enabled })
}

export function setAllRulesEnabled(enabled: boolean) {
  return sendMessage({ type: 'SET_ALL_RULES_ENABLED', enabled })
}

export function updateSettings(settings: Partial<Settings>) {
  return sendMessage({ type: 'UPDATE_SETTINGS', settings })
}

export type { Rule }
