/**
 * Máquina A/B — divide chatIds entre Texto A e Texto B (~50/50).
 *
 * O split é determinístico: mesmo chatId sempre cai na mesma variante
 * dentro da mesma execução (hash estável baseado no chatId).
 */

export interface ABItem {
  chatId: string;
  text: string;
  variant: 'A' | 'B';
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}

export function splitAB(
  chatIds: string[],
  textA: string,
  textB: string,
): ABItem[] {
  return chatIds.map(chatId => {
    const isB = (Math.abs(hashCode(chatId)) % 2) === 1;
    return {
      chatId,
      text: isB ? textB : textA,
      variant: isB ? 'B' : 'A',
    };
  });
}
