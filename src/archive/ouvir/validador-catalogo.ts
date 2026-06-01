import type { CampoExtraido, CampoValidado } from './types'

const FORMAS_PAGAMENTO_VALIDAS = ['PIX', 'crédito', 'débito', 'dinheiro', 'boleto', 'transferência']

export interface ValidadorDeps {
  produtos: Array<{ nome: string; productId: string }>
}

function normalize(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function buscarProduto(texto: string, produtos: Array<{ nome: string; productId: string }>): { itemId: string; tipo: 'exato' | 'contem' | 'parcial' } | null {
  // Remove "(Nx)" antes de buscar no catálogo para que "100% integral (1x)" case com "100% integral"
  const norm = normalize(texto).replace(/\s*\(\d+x\)\s*/gi, '').trim()
  for (const p of produtos) {
    const nomeNorm = normalize(p.nome)
    if (norm === nomeNorm) return { itemId: p.productId, tipo: 'exato' }
    if (nomeNorm.includes(norm) || norm.includes(nomeNorm)) return { itemId: p.productId, tipo: 'contem' }
  }
  for (const p of produtos) {
    const nomeNorm = normalize(p.nome)
    const palavras = norm.split(/\s+/).filter(w => w.length > 3)
    const matchCount = palavras.filter(w => nomeNorm.includes(w)).length
    if (palavras.length > 0 && matchCount / palavras.length >= 0.5) {
      return { itemId: p.productId, tipo: 'parcial' }
    }
  }
  return null
}

function validarFormaPagamento(valor: string | string[]): { valido: boolean; normalizado?: string } {
  const valores = Array.isArray(valor) ? valor : [valor]
  for (const v of valores) {
    const norm = normalize(v)
    for (const fp of FORMAS_PAGAMENTO_VALIDAS) {
      const fpNorm = normalize(fp)
      if (norm === fpNorm || norm.includes(fpNorm) || fpNorm.includes(norm)) {
        return { valido: true, normalizado: fp }
      }
    }
  }
  return { valido: false }
}

function converterConfiancaParaNumero(confianca: CampoExtraido['confianca']): number {
  const mapa: Record<string, number> = { alta: 0.9, media: 0.6, baixa: 0.3, desconhecido: 0.1 }
  return mapa[confianca] ?? 0.1
}

export function validadorCatalogo(
  input: { campos: CampoExtraido[] },
  deps?: ValidadorDeps,
): { campos: CampoValidado[] } {
  const produtos = deps?.produtos ?? []
  const resultados: CampoValidado[] = []

  for (const campo of input.campos) {
    const base: CampoValidado = {
      campo: campo.campo,
      valor: campo.valor,
      confiancaOriginal: campo.confianca,
      confiancaAjustada: converterConfiancaParaNumero(campo.confianca),
      valido: true,
      fonte: campo.fonte,
      evidencias: campo.evidencias,
    }

    switch (campo.campo) {
      case 'preferenciasProduto': {
        const valores = Array.isArray(campo.valor) ? campo.valor : [campo.valor]
        const match = buscarProduto(valores.join(' '), produtos)
        if (match) {
          const bonus = match.tipo === 'exato' ? 0.3 : match.tipo === 'contem' ? 0.2 : 0.1
          base.confiancaAjustada = Math.min(1, converterConfiancaParaNumero(campo.confianca) + bonus)
          base.valido = true
          base.normalizado = valores.join(', ')
          base.catalogoMatch = { tipo: 'produto', itemId: match.itemId }
        } else {
          base.confiancaAjustada = Math.max(0.1, converterConfiancaParaNumero(campo.confianca) * 0.5)
          base.valido = true
        }
        break
      }

      case 'aversoesProduto': {
        const valores = Array.isArray(campo.valor) ? campo.valor : [campo.valor]
        const match = buscarProduto(valores.join(' '), produtos)
        if (match) {
          base.confiancaAjustada = Math.min(1, converterConfiancaParaNumero(campo.confianca) + 0.2)
          base.valido = true
          base.catalogoMatch = { tipo: 'produto', itemId: match.itemId }
        } else {
          base.confiancaAjustada = Math.max(0.1, converterConfiancaParaNumero(campo.confianca) * 0.5)
          base.valido = true
        }
        break
      }

      case 'formaPagamentoPreferida': {
        const result = validarFormaPagamento(campo.valor)
        if (result.valido) {
          base.confiancaAjustada = 1.0
          base.valido = true
          base.normalizado = result.normalizado
        } else {
          base.confiancaAjustada = Math.max(0.1, converterConfiancaParaNumero(campo.confianca) * 0.5)
          base.valido = true
        }
        break
      }

      case 'enderecoEntrega': {
        const temCep = /\d{5}-?\d{3}/.test(String(campo.valor))
        if (temCep) {
          base.confiancaAjustada = Math.min(1, converterConfiancaParaNumero(campo.confianca) + 0.1)
        }
        base.valido = true
        break
      }

      default:
        base.valido = true
        break
    }

    resultados.push(base)
  }

  return { campos: resultados }
}
