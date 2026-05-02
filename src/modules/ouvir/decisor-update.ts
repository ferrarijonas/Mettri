import type { CampoValidado, DecisaoUpdate, TipoUpdate, ReleaseSignal } from './types'

interface CampoRule {
  tipoDefault: TipoUpdate
  condicaoMemoria: (confianca: number, urgencia: 'alta' | 'media' | 'baixa') => boolean
}

const CAMPO_RULES: Record<string, CampoRule> = {
  nome: {
    tipoDefault: 'memoria',
    condicaoMemoria: (conf) => conf >= 0.6,
  },
  telefone: {
    tipoDefault: 'memoria',
    condicaoMemoria: (conf) => conf >= 0.6,
  },
  preferenciasProduto: {
    tipoDefault: 'contexto_venda',
    condicaoMemoria: (conf, urg) => urg === 'alta' || conf >= 0.9,
  },
  aversoesProduto: {
    tipoDefault: 'contexto_venda',
    condicaoMemoria: (conf) => conf >= 0.9,
  },
  enderecoEntrega: {
    tipoDefault: 'contexto_venda',
    condicaoMemoria: (conf) => conf >= 0.9,
  },
  formaPagamentoPreferida: {
    tipoDefault: 'memoria',
    condicaoMemoria: (conf) => conf >= 0.6,
  },
  urgenciaEntrega: {
    tipoDefault: 'contexto_venda',
    condicaoMemoria: () => false,
  },
  observacoesLogisticas: {
    tipoDefault: 'contexto_venda',
    condicaoMemoria: (conf) => conf >= 0.9,
  },
}

function numeroParaPrioridade(confianca: number): 'alta' | 'media' | 'baixa' {
  if (confianca >= 0.7) return 'alta'
  if (confianca >= 0.4) return 'media'
  return 'baixa'
}

export function decisorUpdate(
  input: {
    camposExtraidos: CampoValidado[]
    urgencia: 'alta' | 'media' | 'baixa'
    sinaisRelease?: ReleaseSignal[]
  },
): { atualizacoes: DecisaoUpdate[] } {
  const camposComRelease = new Map<string, ReleaseSignal>()
  if (input.sinaisRelease) {
    for (const s of input.sinaisRelease) {
      const existing = camposComRelease.get(s.campo)
      if (!existing || s.forca === 'RESET') {
        camposComRelease.set(s.campo, s)
      }
    }
  }

  const atualizacoes: DecisaoUpdate[] = []

  for (const campo of input.camposExtraidos) {
    if (!campo.valido && campo.confiancaAjustada < 0.2) continue
    if (campo.confiancaAjustada < 0.2) continue

    const release = camposComRelease.get(campo.campo)

    if (release?.forca === 'RESET') {
      continue
    }

    const rule = CAMPO_RULES[campo.campo]
    if (!rule) continue

    let tipo: TipoUpdate = rule.tipoDefault

    if (release && (release.forca === 'DOWNGRADE' || release.forca === 'REPLACE')) {
      tipo = 'memoria'
    } else if (rule.condicaoMemoria(campo.confiancaAjustada, input.urgencia)) {
      tipo = 'memoria'
    }

    if (input.urgencia === 'alta' && tipo !== 'memoria') {
      tipo = 'contexto_venda'
    }

    const prioridade = numeroParaPrioridade(campo.confiancaAjustada)

    atualizacoes.push({
      campo: campo.campo,
      tipo,
      valor: campo.normalizado
        ? (Array.isArray(campo.valor) ? campo.valor : campo.valor)
        : campo.valor,
      confianca: campo.confiancaAjustada,
      prioridade,
    })
  }

  return { atualizacoes }
}
