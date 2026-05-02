import type { CampaignEligibilityGates, CampaignEligibilityInput, CampaignEligibilityOutput } from './types';

function allGatesBlocked(reason: string): CampaignEligibilityOutput {
  return {
    eligible: false,
    reasons: [reason],
    gates: {
      statusGate: 'blocked',
      modeGate: 'blocked',
      audienceGate: 'blocked',
      frequencyGate: 'blocked',
      humanGate: 'blocked',
    },
  };
}

function hasTag(tags: string[], wanted: string): boolean {
  return tags.some(t => t.toLowerCase() === wanted.toLowerCase());
}

function hoursBetween(aIso: string, bIso: string): number {
  return (Date.parse(bIso) - Date.parse(aIso)) / (1000 * 60 * 60);
}

/** ZenSpec: avaliar-elegibilidade-de-campanha.zenspec.md */
export function avaliarElegibilidadeDeCampanha(input: CampaignEligibilityInput): CampaignEligibilityOutput {
  const reasons: string[] = [];
  const gates: CampaignEligibilityGates = {
    statusGate: 'ok',
    modeGate: 'ok',
    audienceGate: 'ok',
    frequencyGate: 'ok',
    humanGate: 'ok',
  };

  if (!input.nowIso || Number.isNaN(Date.parse(input.nowIso))) {
    return allGatesBlocked('Instante nowIso inválido.');
  }

  const { campaign } = input;

  if (campaign.status !== 'active') {
    gates.statusGate = 'blocked';
    reasons.push('Campanha não está ativa.');
  }

  if (campaign.modo === 'periodo') {
    const j = campaign.janela;
    if (!j) {
      gates.modeGate = 'blocked';
      reasons.push('Campanha em período sem janela definida.');
    } else {
      const now = Date.parse(input.nowIso);
      const start = Date.parse(j.startsAtIso);
      const end = Date.parse(j.endsAtIso);
      if (now < start || now > end) {
        gates.modeGate = 'blocked';
        reasons.push('Fora da janela da campanha.');
      }
    }
  }

  if (input.contactSnapshot.blocked === true) {
    gates.audienceGate = 'blocked';
    reasons.push('Contato bloqueado.');
  }

  const { publico } = campaign;
  if (publico.excludeTags?.length) {
    for (const tag of publico.excludeTags) {
      if (hasTag(input.contactSnapshot.tags, tag)) {
        gates.audienceGate = 'blocked';
        reasons.push(`Tag excluída presente: ${tag}.`);
        break;
      }
    }
  }
  if (publico.includeTags?.length) {
    const ok = publico.includeTags.some(t => hasTag(input.contactSnapshot.tags, t));
    if (!ok) {
      gates.audienceGate = 'blocked';
      reasons.push('Nenhuma tag obrigatória presente no contato.');
    }
  }
  if (publico.bairrosPermitidos?.length) {
    const b = input.contactSnapshot.bairro?.trim();
    if (!b) {
      gates.audienceGate = 'blocked';
      reasons.push('Bairro do contato ausente para campanha hiperlocal.');
    } else if (!publico.bairrosPermitidos.some(x => x.toLowerCase() === b.toLowerCase())) {
      gates.audienceGate = 'blocked';
      reasons.push('Bairro fora da lista permitida.');
    }
  }
  if (publico.minDaysInactive !== undefined) {
    const d = input.contactSnapshot.daysInactive;
    if (d === undefined) {
      gates.audienceGate = 'blocked';
      reasons.push('Inatividade do contato ausente.');
    } else if (d < publico.minDaysInactive) {
      gates.audienceGate = 'blocked';
      reasons.push('Inatividade abaixo do mínimo da campanha.');
    }
  }
  if (publico.maxDaysInactive !== undefined) {
    const d = input.contactSnapshot.daysInactive;
    if (d === undefined) {
      gates.audienceGate = 'blocked';
      reasons.push('Inatividade do contato ausente.');
    } else if (d > publico.maxDaysInactive) {
      gates.audienceGate = 'blocked';
      reasons.push('Inatividade acima do máximo da campanha.');
    }
  }
  if (publico.minRecencyDaysFromPurchase !== undefined) {
    const d = input.contactSnapshot.daysFromLastPurchase;
    if (d === undefined) {
      gates.audienceGate = 'blocked';
      reasons.push('Recência de compra ausente.');
    } else if (d < publico.minRecencyDaysFromPurchase) {
      gates.audienceGate = 'blocked';
      reasons.push('Recência de compra abaixo do mínimo.');
    }
  }
  if (publico.maxRecencyDaysFromPurchase !== undefined) {
    const d = input.contactSnapshot.daysFromLastPurchase;
    if (d === undefined) {
      gates.audienceGate = 'blocked';
      reasons.push('Recência de compra ausente.');
    } else if (d > publico.maxRecencyDaysFromPurchase) {
      gates.audienceGate = 'blocked';
      reasons.push('Recência de compra acima do máximo.');
    }
  }

  const contador = input.retomarSnapshot?.contadorAtual;
  if (contador === 4) {
    gates.audienceGate = 'blocked';
    reasons.push('Contato desistente no Retomar (contador 4).');
  }

  const freq = input.frequencySnapshot;
  if (freq) {
    if (freq.sendsInPeriod >= campaign.guardrails.maxSendsPerChatInPeriod) {
      gates.frequencyGate = 'blocked';
      reasons.push('Limite de envios no período atingido para este chat.');
    }
    if (freq.lastSendAtIso && Number.isFinite(Date.parse(freq.lastSendAtIso))) {
      const h = hoursBetween(freq.lastSendAtIso, input.nowIso);
      if (h >= 0 && h < campaign.guardrails.dedupeByChatWindowHours) {
        gates.frequencyGate = 'blocked';
        reasons.push('Dentro da janela de deduplicação desde o último envio.');
      }
    }
  }

  if (campaign.guardrails.requireHumanApproval !== true) {
    gates.humanGate = 'blocked';
    reasons.push('Configuração inválida: aprovação humana obrigatória.');
  }

  const snap = input.atendimentoSnapshot;
  if (snap && snap.operadorDisponivel !== true) {
    gates.humanGate = 'blocked';
    reasons.push('Operador indisponível para disparo assistido.');
  }

  const eligible =
    gates.statusGate === 'ok' &&
    gates.modeGate === 'ok' &&
    gates.audienceGate === 'ok' &&
    gates.frequencyGate === 'ok' &&
    gates.humanGate === 'ok';

  return {
    eligible,
    reasons: eligible ? [] : reasons,
    gates,
  };
}
