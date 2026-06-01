import type { ReleaseSignal, CampoConfianca } from './types'

interface ReleaseRule {
  campo: string
  sinal: RegExp
  novaConfianca: CampoConfianca
  forca: 'RESET' | 'DOWNGRADE' | 'REPLACE'
  reextrair: boolean
}

const RELEASE_RULES: ReleaseRule[] = [
  { campo: 'preferenciasProduto', sinal: /\bna verdade\b/i, novaConfianca: 'baixa', forca: 'DOWNGRADE', reextrair: true },
  { campo: 'preferenciasProduto', sinal: /\bmudei de ideia\b/i, novaConfianca: 'baixa', forca: 'DOWNGRADE', reextrair: true },
  { campo: 'preferenciasProduto', sinal: /\bem vez disso\b/i, novaConfianca: 'baixa', forca: 'REPLACE', reextrair: true },
  { campo: 'preferenciasProduto', sinal: /\bnão,\s*eu disse\b/i, novaConfianca: 'baixa', forca: 'DOWNGRADE', reextrair: true },
  { campo: 'preferenciasProduto', sinal: /\besquece\b/i, novaConfianca: 'desconhecido', forca: 'RESET', reextrair: true },
  { campo: 'preferenciasProduto', sinal: /\bmas\s+quero\b/i, novaConfianca: 'baixa', forca: 'DOWNGRADE', reextrair: true },
  { campo: 'preferenciasProduto', sinal: /\bna verdade quero\b/i, novaConfianca: 'baixa', forca: 'DOWNGRADE', reextrair: true },
  { campo: 'aversoesProduto', sinal: /\bna verdade\b/i, novaConfianca: 'baixa', forca: 'DOWNGRADE', reextrair: true },
  { campo: 'enderecoEntrega', sinal: /\bmudei de endereço\b/i, novaConfianca: 'baixa', forca: 'DOWNGRADE', reextrair: true },
  { campo: 'enderecoEntrega', sinal: /\boutro endereço\b/i, novaConfianca: 'baixa', forca: 'DOWNGRADE', reextrair: true },
  { campo: 'enderecoEntrega', sinal: /\bnão,\s*é\b/i, novaConfianca: 'baixa', forca: 'DOWNGRADE', reextrair: true },
  { campo: 'formaPagamentoPreferida', sinal: /\bvou pagar de outro jeito\b/i, novaConfianca: 'baixa', forca: 'DOWNGRADE', reextrair: true },
  { campo: 'formaPagamentoPreferida', sinal: /\bem vez de\b/i, novaConfianca: 'baixa', forca: 'REPLACE', reextrair: true },
  { campo: 'urgenciaEntrega', sinal: /\bné,\s*não\b/i, novaConfianca: 'baixa', forca: 'DOWNGRADE', reextrair: true },
]

const FORCA_SCORE: Record<string, number> = {
  RESET: 3,
  DOWNGRADE: 2,
  REPLACE: 1,
}

export function sinaisRelease(
  input: { mensagem: string },
): { sinais: ReleaseSignal[] } {
  const sinais: ReleaseSignal[] = []
  const mapPorCampo = new Map<string, ReleaseRule>()

  for (const rule of RELEASE_RULES) {
    if (rule.sinal.test(input.mensagem)) {
      const existing = mapPorCampo.get(rule.campo)
      if (!existing || FORCA_SCORE[rule.forca] > FORCA_SCORE[existing.forca]) {
        mapPorCampo.set(rule.campo, rule)
      }
    }
  }

  for (const [campo, rule] of mapPorCampo) {
    sinais.push({
      campo,
      sinal: rule.sinal.source,
      novaConfiancaOriginal: rule.novaConfianca,
      forca: rule.forca,
      reextrair: rule.reextrair,
    })
  }

  return { sinais }
}
