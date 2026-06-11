let sendEnabled = false

export function isSendEnabled(): boolean {
  return sendEnabled
}

export function setSendEnabled(v: boolean): void {
  sendEnabled = v
}

export function loadSendEnabled(): void {
  // apenas memória por enquanto
}
