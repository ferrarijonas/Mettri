import type { ThrottleState, CursorState } from './types'

const THROTTLE_INTERVAL_MS = 5000
const THROTTLE_MAX_BURST = 3
const THROTTLE_WINDOW_MS = 60000

const throttleMap = new Map<string, ThrottleState>()
const cursorMap = new Map<string, CursorState>()

/** Verifica se a mensagem pode passar pelo throttle (rate-limit por chatId). */
export function checkThrottle(chatId: string, timestamp: number): boolean {
  const state = throttleMap.get(chatId)
  const now = timestamp

  if (!state) {
    throttleMap.set(chatId, { chatId, timestamps: [now] })
    return true
  }

  const recent = state.timestamps.filter(t => now - t < THROTTLE_WINDOW_MS)

  if (recent.length >= THROTTLE_MAX_BURST) {
    const elapsed = now - (recent[recent.length - 1] ?? now)
    if (elapsed < THROTTLE_INTERVAL_MS) {
      return false
    }
  }

  recent.push(now)
  state.timestamps = recent.slice(-10)
  return true
}

/** Verifica se a mensagem já foi processada (cursor de timestamp). */
export function checkCursor(chatId: string, timestamp: number): boolean {
  const last = cursorMap.get(chatId)?.ultimaMensagemProcessada
  if (last !== undefined && timestamp <= last) {
    return false
  }
  cursorMap.set(chatId, { chatId, ultimaMensagemProcessada: timestamp })
  return true
}

/** Limpa todos os estados de throttle e cursor (ex: ao desregistrar listeners). */
export function limparLimitadores(): void {
  throttleMap.clear()
  cursorMap.clear()
}
