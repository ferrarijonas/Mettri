import { daysBetweenByCalendar, isInRange, type ReguaRange } from './inactive-days';

export interface LastActivityEntry {
  chatId: string;
  chatName: string;
  date: Date;
}

export interface LastOutgoingEntry {
  lastOutgoingAt: Date;
}

export interface EligibleContact {
  chatId: string;
  chatName: string;
  daysInactive: number;
  rangeIndex: number;
}

export interface ComputeEligibleContactsInput {
  now: Date;
  lastActivityByChat: Map<string, LastActivityEntry>;
  lastOutgoingByContact: Map<string, LastOutgoingEntry>;
  contadorByChat: Record<string, number>;
  ranges: ReguaRange[];
  minDistance: number;
  chatIdsInLists?: Set<string> | string[];
}

/**
 * Contagem por “cancela”: por que cada contacto do mapa não entrou na lista elegível.
 * Metáfora: cada motivo é uma fila que parou a pessoa antes do balde certo.
 */
export interface EligibilityExclusionStats {
  totalScanned: number;
  excludedInList: number;
  excludedNegativeDays: number;
  excludedOutsideRegua: number;
  excludedContadorComplete: number;
  excludedContadorMismatch: number;
  excludedRecentOutgoing: number;
  /** Bloqueados por “fala” recente, por índice de faixa (0 = 1.ª tentativa, …). */
  recentOutgoingBlockedPerRange: number[];
  included: number;
}

function emptyStats(rangeCount: number): EligibilityExclusionStats {
  return {
    totalScanned: 0,
    excludedInList: 0,
    excludedNegativeDays: 0,
    excludedOutsideRegua: 0,
    excludedContadorComplete: 0,
    excludedContadorMismatch: 0,
    excludedRecentOutgoing: 0,
    recentOutgoingBlockedPerRange: Array.from({ length: rangeCount }, () => 0),
    included: 0,
  };
}

/**
 * Igual a `computeEligibleContacts`, mas devolve estatísticas de exclusão (para debug).
 */
export function computeEligibleContactsDiagnostics(
  input: ComputeEligibleContactsInput
): { eligible: EligibleContact[]; stats: EligibilityExclusionStats } {
  const {
    now,
    lastActivityByChat,
    lastOutgoingByContact,
    contadorByChat,
    ranges,
    minDistance,
    chatIdsInLists,
  } = input;

  const excluded = Array.isArray(chatIdsInLists) ? new Set(chatIdsInLists) : (chatIdsInLists ?? new Set<string>());
  const eligible: EligibleContact[] = [];
  const stats = emptyStats(ranges.length);

  for (const activity of lastActivityByChat.values()) {
    stats.totalScanned += 1;

    if (excluded.has(activity.chatId)) {
      stats.excludedInList += 1;
      continue;
    }

    const daysInactive = daysBetweenByCalendar(now, activity.date);
    if (daysInactive < 0) {
      stats.excludedNegativeDays += 1;
      continue;
    }

    const rangeIndex = ranges.findIndex(range => isInRange(daysInactive, range));
    if (rangeIndex === -1) {
      stats.excludedOutsideRegua += 1;
      continue;
    }

    const contadorAtual = contadorByChat[activity.chatId] ?? 0;
    if (contadorAtual === 4) {
      stats.excludedContadorComplete += 1;
      continue;
    }
    if (contadorAtual > 0 && contadorAtual !== rangeIndex) {
      stats.excludedContadorMismatch += 1;
      continue;
    }

    const outgoing = lastOutgoingByContact.get(activity.chatId);
    if (outgoing) {
      const daysSinceOutgoing = daysBetweenByCalendar(now, outgoing.lastOutgoingAt);
      if (daysSinceOutgoing < minDistance) {
        stats.excludedRecentOutgoing += 1;
        stats.recentOutgoingBlockedPerRange[rangeIndex] += 1;
        continue;
      }
    }

    stats.included += 1;
    eligible.push({
      chatId: activity.chatId,
      chatName: activity.chatName,
      daysInactive,
      rangeIndex,
    });
  }

  eligible.sort((a, b) => b.daysInactive - a.daysInactive);
  return { eligible, stats };
}

/**
 * Motor determinístico de elegibilidade do Retomar.
 * Metáfora: recebe uma "planilha pronta" e só aplica as regras da régua.
 */
export function computeEligibleContacts(input: ComputeEligibleContactsInput): EligibleContact[] {
  return computeEligibleContactsDiagnostics(input).eligible;
}
