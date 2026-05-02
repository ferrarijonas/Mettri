import type { OfferSuggestion, Opportunity, OpportunityContext } from './types';

export interface ExplicarSugestaoInput {
  context: OpportunityContext;
  ranked: Opportunity[];
  persona?: string;
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function resolveCampanha(
  context: OpportunityContext,
  campanhaId?: string
): { campanhaId: string; nome: string } | undefined {
  if (!campanhaId) return undefined;
  const hit = context.campanhasAtivasElegiveis.find(x => x.campaign.campaignId === campanhaId);
  if (!hit) return undefined;
  return { campanhaId: hit.campaign.campaignId, nome: hit.campaign.nome };
}

function pickTopTwoFactorLabels(opp: Opportunity): string[] {
  const pairs: [string, number][] = [
    ['urgência de validade', opp.urgenciaValidadeScore],
    ['força da campanha', opp.campanhaPrioridadeScore],
    ['margem', opp.margemScore],
    ['pressão de estoque', opp.pressaoEstoqueScore],
    ['vantagem logística', opp.vantagemLogisticaScore],
    ['aderência ao perfil do cliente', opp.aderenciaClienteScore],
  ];
  pairs.sort((a, b) => b[1] - a[1]);
  return [pairs[0][0], pairs[1][0]];
}

/**
 * Converte a melhor oportunidade em texto para o humano enviar (sem autoenvio).
 * ZenSpec: explicar-sugestao.zenspec.md
 */
export function explicarSugestao(input: ExplicarSugestaoInput): OfferSuggestion | null {
  if (!input.context || !Array.isArray(input.ranked)) {
    throw new Error('INVALID_INPUT');
  }
  const top = input.ranked[0];
  if (!top) return null;

  const reco = input.context.vitrine.recomendacoes.find(r => r.sku === top.sku);
  const preco = reco?.preco ?? null;
  const campanhaMeta = resolveCampanha(input.context, top.campanhaId);

  const formal = (input.persona || '').toLowerCase().includes('formal');
  const saudacao = formal ? 'Olá!' : 'Oi!';
  const precoTxt = preco != null ? formatBRL(preco) : 'consulte o preço atualizado';

  let corpo: string;
  if (campanhaMeta) {
    corpo = `${saudacao} Posso te falar do ${top.titulo} (${precoTxt}) com destaque na campanha "${campanhaMeta.nome}" — combina com o que você buscou?`;
  } else {
    corpo = `${saudacao} Posso te sugerir o ${top.titulo} (${precoTxt}) pelo encaixe com estoque e perfil — faz sentido pra você?`;
  }

  const [f1, f2] = pickTopTwoFactorLabels(top);
  let explicacao = `Subiu no ranking principalmente por ${f1} e ${f2} (pontuação combinada ${top.rankingScore.toFixed(3)}).`;
  if (top.urgenciaValidadeScore > 0.5 && top.aderenciaClienteScore < 0.35) {
    explicacao += ' Atenção: urgência alta, mas aderência ao cliente mais baixa — vale calibrar o tom antes de enviar.';
  }

  return {
    chatId: input.context.chatId,
    opportunityId: top.opportunityId,
    textoSugerido: corpo,
    explicacaoCurta: explicacao,
    campanhaAplicada: campanhaMeta,
    guardrails: {
      requireHumanSend: true,
      autoSendAllowed: false,
    },
  };
}
