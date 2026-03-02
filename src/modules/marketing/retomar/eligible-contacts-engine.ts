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
 * Motor determinístico de elegibilidade do Retomar.
 * Metáfora: recebe uma "planilha pronta" e só aplica as regras da régua.
 */
export function computeEligibleContacts(input: ComputeEligibleContactsInput): EligibleContact[] {
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

  for (const activity of lastActivityByChat.values()) {
    if (excluded.has(activity.chatId)) {
      continue;
    }

    const daysInactive = daysBetweenByCalendar(now, activity.date);
    if (daysInactive < 0) {
      continue;
    }

    const rangeIndex = ranges.findIndex(range => isInRange(daysInactive, range));
    if (rangeIndex === -1) {
      continue;
    }

    const contadorAtual = contadorByChat[activity.chatId] ?? 0;
    if (contadorAtual === 4 || contadorAtual !== rangeIndex) {
      continue;
    }

    const outgoing = lastOutgoingByContact.get(activity.chatId);
    if (outgoing) {
      const daysSinceOutgoing = daysBetweenByCalendar(now, outgoing.lastOutgoingAt);
      if (daysSinceOutgoing < minDistance) {
        continue;
      }
    }

    eligible.push({
      chatId: activity.chatId,
      chatName: activity.chatName,
      daysInactive,
      rangeIndex,
    });
  }

  eligible.sort((a, b) => b.daysInactive - a.daysInactive);
  return eligible;
}
