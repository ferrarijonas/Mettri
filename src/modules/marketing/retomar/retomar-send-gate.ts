/**
 * Poka-yoke antes de enviar Retomar na fila: contador + última mensagem TROCADA (nossa ou do cliente)
 * lida no Store do WhatsApp (anti-loop, fail-closed: "não verificado" nunca vira "nunca enviei").
 */

import { getLastMessageDatesFromWhatsAppStore } from '../../../infrastructure/services';
import * as retomarContador from './retomar-contador';
import { daysBetweenByCalendar, getMinDistanceForType, type RelationType } from './inactive-days';

export type RetomarSendGateResult = { ok: true } | { ok: false; reason: string };

/**
 * Regras puras (testável). `lastOutgoingFromWhatsApp` = data da última msg trocada lida do WA
 * (ou null = sem dado verificável — com contador > 0 isso vira bloqueio fail-closed).
 */
export function evaluateRetomarSendGate(params: {
  now: Date;
  contador: number;
  pendingRangeIndex: number;
  minDistance: number;
  lastOutgoingFromWhatsApp: Date | null;
}): RetomarSendGateResult {
  const { now, contador, pendingRangeIndex, minDistance, lastOutgoingFromWhatsApp } = params;

  if (!Number.isInteger(pendingRangeIndex) || pendingRangeIndex < 0 || pendingRangeIndex > 3) {
    return { ok: false, reason: 'Índice de ciclo inválido na fila.' };
  }

  if (contador === 4) {
    return { ok: false, reason: 'Ciclo de retomada já completo (4 envios).' };
  }

  if (contador > 0 && pendingRangeIndex !== contador) {
    return {
      ok: false,
      reason: `Fila desatualizada: contador=${contador} exige ciclo índice ${contador}, mas a fila tem ${pendingRangeIndex}. Atualize a lista.`,
    };
  }

  // Fail-closed: já enviamos antes (contador > 0), mas não conseguimos confirmar quando no WhatsApp.
  // Nunca interpretar "não verificado" como "nunca enviei" — senão reenviamos quem já recebeu msg recente.
  if (!lastOutgoingFromWhatsApp && contador > 0) {
    return {
      ok: false,
      reason:
        'Não foi possível confirmar no WhatsApp a última mensagem deste chat (contador aponta envio anterior). Abra a conversa no WhatsApp e tente de novo.',
    };
  }

  if (lastOutgoingFromWhatsApp) {
    const daysSince = daysBetweenByCalendar(now, lastOutgoingFromWhatsApp);
    if (daysSince < minDistance) {
      return {
        ok: false,
        reason: `Respiro mínimo entre envios: faltam dias (último envio há ${daysSince}d, mínimo ${minDistance}d).`,
      };
    }
  }

  return { ok: true };
}

export interface VerifyRetomarPreSendParams {
  accountId: string;
  chatId: string;
  pendingRangeIndex: number;
  relationType: RelationType;
  customRelationIntervalDays?: number | null;
  /** Testes: não chama o WA; trata última mensagem trocada como ausente. */
  skipWhatsAppRead?: boolean;
}

/**
 * Última mensagem TROCADA: **apenas** consulta ao Store/modelo do WhatsApp para este chat (`@c.us`).
 */
export async function verifyRetomarPreSend(
  params: VerifyRetomarPreSendParams
): Promise<RetomarSendGateResult> {
  const now = new Date();
  const minDistance = getMinDistanceForType(
    params.relationType,
    params.customRelationIntervalDays ?? null
  );
  const contador = await retomarContador.getContador(params.accountId, params.chatId);

  if (!params.chatId.endsWith('@c.us')) {
    return {
      ok: false,
      reason: 'Confirmação no WhatsApp (anti-loop) aplica-se a contatos @c.us.',
    };
  }

  let lastOutgoingFromWhatsApp: Date | null = null;

  if (params.skipWhatsAppRead) {
    lastOutgoingFromWhatsApp = null;
  } else {
    try {
      const waMap = await getLastMessageDatesFromWhatsAppStore([params.chatId]);
      lastOutgoingFromWhatsApp = waMap.get(params.chatId) ?? null;
    } catch {
      return {
        ok: false,
        reason:
          'Não foi possível ler no WhatsApp a última mensagem deste chat. Abra a conversa e tente de novo.',
      };
    }
  }

  return evaluateRetomarSendGate({
    now,
    contador,
    pendingRangeIndex: params.pendingRangeIndex,
    minDistance,
    lastOutgoingFromWhatsApp,
  });
}
