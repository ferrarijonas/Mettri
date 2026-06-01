import { MettriBridgeClient } from '../../content/bridge-client'
import type {
  CampoExtraido,
  CampoConfianca,
  ExtratorInput,
  ExtratorOutput,
  LlmBudgetState,
} from './types'

const STORAGE_KEY_API = 'mettri:openai:apiKey'
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = 'gpt-4o-mini'
const MAX_LLM_CALLS_PER_DAY = 100
const MIN_MESSAGE_LENGTH_FOR_LLM = 10

const budgetMap = new Map<string, LlmBudgetState>()

function hoje(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function checkBudget(chatId: string): boolean {
  const key = `${chatId}:${hoje()}`
  const state = budgetMap.get(key)
  if (!state) return true
  return state.chamadasHoje < MAX_LLM_CALLS_PER_DAY
}

function incrementBudget(chatId: string): void {
  const key = `${chatId}:${hoje()}`
  const existing = budgetMap.get(key)
  if (existing) {
    existing.chamadasHoje++
  } else {
    budgetMap.set(key, { chatId, data: hoje(), chamadasHoje: 1 })
  }
}

function normalizeMessage(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function classificarConfianca(from: number, to: number, value: number): CampoConfianca {
  if (value >= to) return 'alta'
  if (value >= from) return 'media'
  return 'baixa'
}

function extractTelefone(text: string): CampoExtraido | null {
  const m = text.match(/(\d{2})\s*9?\d{8}/)
  if (!m) return null
  return {
    campo: 'telefone',
    valor: m[0],
    confianca: 'alta',
    fonte: 'regex:telefone',
    evidencias: [m[0]],
  }
}

function extractCep(text: string): CampoExtraido | null {
  const m = text.match(/\d{5}-?\d{3}/)
  if (!m) return null
  return {
    campo: 'enderecoEntrega',
    valor: `CEP ${m[0]}`,
    confianca: 'alta',
    fonte: 'regex:cep',
    evidencias: [m[0]],
  }
}

function extractPix(text: string): CampoExtraido | null {
  const m = text.match(/[\w.-]+@[\w.-]+/)
  if (!m) return null
  return {
    campo: 'formaPagamentoPreferida',
    valor: 'PIX',
    confianca: 'alta',
    fonte: 'regex:pix',
    evidencias: [m[0]],
  }
}

function extractFormaPagamento(text: string): CampoExtraido | null {
  const patterns = [
    /\bpix\b/i,
    /\bcrédito\b/i,
    /\bdébito\b/i,
    /\bdinheiro\b/i,
    /\bboleto\b/i,
    /\btransferência\b/i,
  ]
  for (const p of patterns) {
    const m = text.match(p)
    if (m) {
      const v = m[0].toLowerCase()
      return {
        campo: 'formaPagamentoPreferida',
        valor: v === 'pix' ? 'PIX' : v.charAt(0).toUpperCase() + v.slice(1),
        confianca: 'alta',
        fonte: 'regex:forma_pagamento',
        evidencias: [m[0]],
      }
    }
  }
  return null
}

function extractUrgencia(text: string): CampoExtraido | null {
  const alta = /\b(agora|hoje|urgente|já|é para hoje)\b/i
  const media = /\b(amanhã|depois de amanhã|essa semana|quinta|sexta|sábado|domingo|segunda|terça|quarta)\b/i
  if (alta.test(text)) {
    return {
      campo: 'urgenciaEntrega',
      valor: 'alta',
      confianca: 'alta',
      fonte: 'regex:urgencia',
      evidencias: ['urgência alta'],
    }
  }
  if (media.test(text)) {
    return {
      campo: 'urgenciaEntrega',
      valor: 'media',
      confianca: 'media',
      fonte: 'regex:urgencia',
      evidencias: ['urgência média'],
    }
  }
  return null
}

function extractEndereco(text: string): CampoExtraido | null {
  const sinais = /\b(endereço|entregar|rua|avenida|travessa|praça|alameda)\b/i
  if (sinais.test(text)) {
    const sentences = text.split(/[.!?\n]+/).filter(s => sinais.test(s))
    if (sentences.length > 0) {
      return {
        campo: 'enderecoEntrega',
        valor: sentences[0].trim(),
        confianca: classificarConfianca(0.3, 0.7, 0.5),
        fonte: 'regex:endereco',
        evidencias: [sentences[0].trim()],
      }
    }
  }
  return null
}

function extractLogistica(text: string): CampoExtraido | null {
  const sinais = /\b(portaria|apto|apartamento|bloco|andar|sem acesso|interfone|campainha)\b/i
  if (sinais.test(text)) {
    const sentences = text.split(/[.!?\n]+/).filter(s => sinais.test(s))
    if (sentences.length > 0) {
      const logItems: string[] = []
      const m = text.match(/(?:portaria|apto|apartamento|bloco|andar|sem acesso|interfone)\s*[\w\d\s]+/gi)
      if (m) m.forEach(i => logItems.push(i.trim()))
      return {
        campo: 'observacoesLogisticas',
        valor: logItems.length > 0 ? logItems : [sentences[0].trim()],
        confianca: 'media',
        fonte: 'regex:logistica',
        evidencias: logItems.length > 0 ? logItems : [sentences[0].trim()],
      }
    }
  }
  return null
}

function extractNome(text: string): CampoExtraido | null {
  const patterns = [
    /(?:meu nome é|me chamo|me chamou)\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)?)/i,
    /(?:aqui é|é o|é a|da\s+)\s*([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)?)/i,
  ]
  for (const p of patterns) {
    const m = text.match(p)
    if (m && m[1]) {
      return {
        campo: 'nome',
        valor: m[1].trim(),
        confianca: 'media',
        fonte: 'regex:nome',
        evidencias: [m[0].trim()],
      }
    }
  }
  const solto = text.match(/(?:^|\s)([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)?)(?:\s|$)/)
  if (solto && solto[1] && solto[1].split(' ').length <= 2) {
    return {
      campo: 'nome',
      valor: solto[1].trim(),
      confianca: 'baixa',
      fonte: 'regex:nome_solto',
      evidencias: [solto[1].trim()],
    }
  }
  return null
}

function limparProduto(texto: string): string {
  return texto
    .replace(/^(um|uma|uns|umas|o|a|os|as|de|do|da|dos|das)\s+/i, '')
    .replace(/\s+(por favor|pfv|pf|obrigado|obrigada)$/i, '')
    .trim()
}

/** Padrões de filler/hesitação comuns em transcrições de áudio */
const FILLER_WORDS = new Set([
  'ahn', 'hmm', 'aham', 'uhum', 'hum', 'ah', 'oh', 'eh',
  'sim', 'nao', 'ok', 'tá', 'então', 'bom', 'entao',
  'ver', 'saber', 'coisa', 'querer', 'pedir', 'falar',
  'olha', 'olhe', 'veja', 'dizer', 'fazer', 'poder',
  'sabe', 'soube', 'viu', 'vi', 'ter', 'tem', 'te',
  'assim', 'depois', 'antes', 'agora', 'sempre', 'so',
])

const FILLER_STARTS = [
  'qte pedir', 'qte', 'te pedir', 'te perguntar', 'uma coisa',
  'quero ver', 'deixa eu ver', 'deixa eu pensar', 'vou te falar',
  'tipo assim', 'como é que é', 'como é', 'vou te perguntar',
  'vou te contar', 'sabe o que', 'entendeu', 'cê entendeu', 'entende',
  'é o seguinte', 'olha só', 'então', 'ahn', 'hmm', 'hum',
]

/** Produto extraído com quantidade opcional */
interface ProdutoComQtd {
  nome: string
  qtd: number | null
  evidencia: string
}

function isFiller(text: string): boolean {
  const t = text.trim().toLowerCase()
  if (t.length <= 2) return true
  if (FILLER_WORDS.has(t)) return true
  for (const start of FILLER_STARTS) {
    if (t.startsWith(start)) return true
  }
  return false
}

/** Mapa de números por extenso para dígitos. */
const NUM_EXTENSO: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4,
  cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12,
  treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16,
  dezessete: 17, dezoito: 18, dezenove: 19, vinte: 20, trinta: 30,
  quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80,
  noventa: 90, cem: 100, duzentos: 200, trezentos: 300, quatrocentos: 400,
  quinhentos: 500, seiscentos: 600, setecentos: 700, oitocentos: 800,
  novecentos: 900, mil: 1000,
}

/** Tenta extrair quantidade do início do texto. Suporta dígitos ("10 de abobra") e extenso ("dois de abobora"). */
function tryExtrairQtdTexto(texto: string): { qtd: number | null; resto: string } {
  const t = texto.trim().toLowerCase()
  // Tenta dígito primeiro: "10 de abobra" → qtd=10, resto="abobra"
  const digito = t.match(/^(\d+)\s*(?:de\s+)?(.+)$/)
  if (digito) return { qtd: parseInt(digito[1], 10), resto: digito[2].trim() }
  // Tenta número por extenso: "dois de abobora" → qtd=2, resto="abobora"
  const partes = t.split(/\s+/)
  if (partes.length > 0) {
    const prim = partes[0].replace(/,$/, '')
    const num = NUM_EXTENSO[prim]
    if (num !== undefined) {
      let resto = partes.slice(1).join(' ')
      resto = resto.replace(/^de\s+/i, '')
      return { qtd: num, resto }
    }
  }
  return { qtd: null, resto: texto }
}

/** Detecta se o texto contém padrão "N% X" onde X é um produto com porcentaje (ex: "100% integral") */
function containsPctProduto(text: string): boolean {
  return /\d+%\s+\w+/i.test(text)
}

/** Extrai o produto "N% X" do texto, retornando {nome, qtd}. Ex: "5 pães 100% integral" → {nome: "100% integral", qtd: 5} */
function extractPctProduto(text: string): { nome: string; qtd: number } | null {
  // Primeiro tenta encontrar "N produto N% X" onde há quantity antes do producto com %
  // Ex: "5 pães 100% integral" → qtd=5, produto="100% integral"
  const withQtyBefore = text.match(/(\d+)\s+[\w]+\s+(\d+%)\s+(\w+(?:\s+\w+)*)/i)
  if (withQtyBefore) {
    return { nome: `${withQtyBefore[2]} ${withQtyBefore[3]}`.trim(), qtd: parseInt(withQtyBefore[1], 10) }
  }

  // Depois tenta "N% X" direto no início (sem quantity antes)
  // Ex: "100% integral" → qtd=1, produto="100% integral"
  const direct = text.match(/^(\d+%)\s+(\w+(?:\s+\w+)*)/i)
  if (direct) {
    return { nome: `${direct[1]} ${direct[2]}`.trim(), qtd: 1 }
  }

  // Tenta encontrar qualquer "N% X" no texto
  const anyMatch = text.match(/(\d+%)\s+(\w+(?:\s+\w+)*)/i)
  if (anyMatch) {
    return { nome: `${anyMatch[1]} ${anyMatch[2]}`.trim(), qtd: 1 }
  }

  return null
}

/** Corrige produtos que contêm "%" no nome extraindo o padrão correto "N% X" */
function corrigirProdutoComPercent(r: ProdutoComQtd, text: string): ProdutoComQtd | null {
  if (!/%\w/i.test(r.nome)) return null // não é percentage

  // O produto atual pode ser algo como "% integral" (qtd=100) ou "pães 100% integral" (qtd=5)
  // Precisamos extrair "N% X" da evidência (que pode ter texto antes ou depois)
  // Usar regex global para encontrar qualquer "N% X" na evidência
  const match = r.evidencia.match(/(\d+%)\s+(\w+(?:\s+\w+)*)/i)
  if (!match) return null

  const nomeCorrigido = `${match[1]} ${match[2]}`.trim() // "100% integral"

  // Se o nome começa com "%" (ex: "% integral"), significa que a qtd era o próprio número do percentage
  // Ex: "% integral" com qtd=100 → qtd deve ser 1, produto="100% integral"
  // Se o nome contém "%" mas não começa (ex: "pães 100% integral"), manter a qtd original
  const pctNum = parseInt(match[1], 10)
  const qtdFinal = r.nome.startsWith('%') ? 1 : r.qtd

  return { nome: nomeCorrigido, qtd: qtdFinal, evidencia: nomeCorrigido }
}

/** Verifica se um número capturado está dentro de um padrão "N% X" no texto.
 * Isso evita que "10" de "Quero um 10% integral" seja tratado como quantity.
 * Retorna true se o número está logo antes de um "%". */
function isNumberInsidePctPattern(text: string, numberStr: string, matchStart: number): boolean {
  // Verifica se há "%" logo após o número (compossível espaço)
  const afterNumber = text.slice(matchStart + numberStr.length).replace(/^\s*/, '')
  return afterNumber.startsWith('%')
}

/** Extrai padrões "N de produto" ou "N produto" em toda a string (global). */
function extractProdutosComQuantidade(text: string): ProdutoComQtd[] {
  const results: ProdutoComQtd[] = []
  // Números em dígitos: "10 de abobra", "5 multigraos"
  // Negative lookahead (?!%) evita capturar "N% X" como quantity (ex: "100% integral" → qtd=100, produto="% integral")
  // Também usamos \b para garantir que o número não esteja colado em "%"
  const re = /\b(\d+)(?!%)\b\s*(?:de\s+)?([\w%ºª]+(?:\s+[\w%ºª]+){0,4}?)(?=\s*[,;.!?¿¡]|\s+e\s+|\s+para\s+|\s+pra\s+|$)/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const qtdOriginal = parseInt(m[1], 10)
    const nome = limparProduto(m[2].trim())

    // Verificar se o número capturado está dentro de um padrão "N% X"
    // Se sim, não adicionar este resultado - o fallback cuidará
    if (isNumberInsidePctPattern(text, m[1], m.index)) {
      continue // pula este match, deixa o fallback tratar
    }

    // Verificar se o nome contém "%" seguido de palavra (ex: "% integral" ou "pães 100% integral")
    const hasPercent = /%\w/i.test(nome)

    if (nome.length > 2 && !isFiller(nome) && !/^\d+$/.test(nome)) {
      if (hasPercent) {
        // Produto contém "%" - tentar corrigir extraindo "N% X" do texto original
        // Primeiro tenta no match original, depois no texto completo
        let match = m[0].match(/(\d+%)\s+(\w+(?:\s+\w+)*)/i)
        if (!match) {
          // Tenta no texto completo (texto original pode ter acentos)
          match = text.match(/(\d+%)\s+(\w+(?:\s+\w+)*)/i)
        }
        if (match) {
          const nomeCorrigido = `${match[1]} ${match[2]}`.trim() // "100% integral"
          // Se nome começa com "%", a qtd era o próprio número do percentage → usar qty=1
          // Se nome contém "%" no meio (ex: "pães 100% integral"), manter a qtd original
          const qtdFinal = nome.startsWith('%') ? 1 : qtdOriginal
          const already = results.some(r => r.nome === nomeCorrigido && r.qtd === qtdFinal)
          if (!already) results.push({ nome: nomeCorrigido, qtd: qtdFinal, evidencia: nomeCorrigido })
        }
      } else {
        // Produto normal (sem "%")
        const already = results.some(r => r.nome === nome && r.qtd === qtdOriginal)
        if (!already) results.push({ nome, qtd: qtdOriginal, evidencia: m[0].trim() })
      }
    }
  }

  // Fallback: se nenhum resultado, tentar capturar apenas "N% X" como produto
  // Ex: "Quero 100% integral" → produto="100% integral", qty=1
  // Também: se resultados contêm "%" (possível mal-captura) E há "N% X" melhor, substituir
  // Também: se há "N produto N% X" no texto (ex: "5 pães 100% integral") → usar o "N% X" como produto
  const hasPctInResults = results.some(r => /%\w/i.test(r.nome))
  const hasQtyBeforePct = /\d+\s+\w+\s+\d+%/i.test(text) // detecta "N produto N% X"
  // Detecta "intent prefix + N% X" - ex: "Quero um 100% integral", "gostaria de 100% integral"
  const hasIntentBeforePct = /(?:gostaria de|quero|vou querer|vou pedir|pedir|quisesse|gostaria|preciso|precisaria)\s+\d+%\s+\w+/i.test(text)
  const needsFallback = (results.length === 0 && containsPctProduto(text)) ||
                        (hasPctInResults && containsPctProduto(text)) ||
                        (hasQtyBeforePct && containsPctProduto(text)) ||
                        (hasIntentBeforePct && containsPctProduto(text))
  
  if (needsFallback) {
    const pctExtracted = extractPctProduto(text)
    if (pctExtracted) {
      // Se havia resultados com "%" OU há "N produto N% X" OU tem intent prefix + N% X, substituir/adicionar o produto correto
      if (hasPctInResults || hasQtyBeforePct || (hasIntentBeforePct && results.length > 0)) {
        // Substituir o resultado que contém "%" OU o primeiro resultado (produto capturado pela regex)
        if (hasPctInResults) {
          const pctResult = results.find(r => /%\w/i.test(r.nome))
          if (pctResult) {
            pctResult.nome = pctExtracted.nome
            pctResult.qtd = pctExtracted.qtd
            pctResult.evidencia = pctExtracted.nome
          }
        } else if ((hasQtyBeforePct || hasIntentBeforePct) && results.length > 0) {
          // Para "5 pães 100% integral" ou "Quero um 100% integral", substituir/adicionar corretamente
          results[0].nome = pctExtracted.nome
          results[0].qtd = pctExtracted.qtd
          results[0].evidencia = pctExtracted.nome
        }
      } else {
        // Sem resultados, adicionar normalmente
        results.push({ nome: pctExtracted.nome, qtd: pctExtracted.qtd, evidencia: pctExtracted.nome })
      }
    }
  }

  return results
}

/** Extrai produtos usando padrões de intenção de compra, coletando TODOS os matches. */
function extractProdutosPorIntencao(text: string): ProdutoComQtd[] {
  const results: ProdutoComQtd[] = []
  const patterns = [
    /(?:gosto de|gostaria de|quero|vou querer|vou pedir|pedir|quisesse)\s+(.+?)(?:\.|,|;|$| para| pra| por favor|\?)/gi,
    /(?:queria)\s+(.+?)(?:\.|,|;|$| para| pra| por favor|\?)/gi,
    /(?:você tem|vocês tem|tu tem|vende|tem como)\s+(.+?)(?:\.|,|;|\?|$)/gi,
    /(?:quanto é|qual o preço|qual é o preço|qual o valor|qual é o valor|preço do|preço da|valor do|valor da)\s+(.+?)(?:\.|,|;|\?|$)/gi,
    /(.+?)(?:está disponível|tá disponível|tem disponível|tem em estoque)\s*(?:\?|\.|$)/gi,
  ]
  for (const p of patterns) {
    let match: RegExpExecArray | null
    while ((match = p.exec(text)) !== null) {
      const raw = match[1].trim()
      if (isFiller(raw)) continue
      const partes = raw.split(/\s+e\s+/).map(s => limparProduto(s)).filter(s => s.length > 2 && !isFiller(s))
      for (const parte of partes) {
        // Tenta extrair quantidade por extenso (ex: "dois de abobora" → "abobora" qtd=2)
        const { qtd, resto } = tryExtrairQtdTexto(parte)
        const nomeFinal = qtd !== null ? `${resto} (${qtd}x)` : parte
        const already = results.some(r => r.nome === nomeFinal)
        if (!already) results.push({ nome: nomeFinal, qtd, evidencia: match[0].trim() })
      }
    }
  }
  return results
}

function normalizarChaveProduto(nome: string): string {
  // Remove "(Nx)" se tiver
  const limpo = nome.replace(/\s*\(\d+x\)\s*/i, '')
  return limpo
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim()
}

function extractPreferenciasProduto(text: string): CampoExtraido | null {
  const comQtd = extractProdutosComQuantidade(text)
  const porIntencao = extractProdutosPorIntencao(text)

  // Mescla deduplicando por nome normalizado; prefere entradas com quantidade
  const mapa = new Map<string, ProdutoComQtd>()
  for (const item of comQtd) {
    mapa.set(normalizarChaveProduto(item.nome), item)
  }
  for (const item of porIntencao) {
    const key = normalizarChaveProduto(item.nome)
    const existente = mapa.get(key)
    if (!existente) {
      mapa.set(key, item)
    } else if (item.qtd !== null && existente.qtd === null) {
      mapa.set(key, item) // preferir quem tem qtd
    }
  }

  if (mapa.size === 0) {
    // Fallback: extrator genérico (texto curto sem gatilho, ex: "1 100% integral e 5 Multigrãos")
    const genérico = text.match(/^(.{4,60}?)\s*(?:\?|\.|,|!|$)/)
    if (genérico && genérico[1]) {
      const candidato = limparProduto(genérico[1].trim())
      if (candidato.length > 3 && !isFiller(candidato)) {
        return {
          campo: 'preferenciasProduto',
          valor: [candidato],
          confianca: 'baixa',
          fonte: 'regex:mencao_generica',
          evidencias: [genérico[0].trim()],
        }
      }
    }
    return null
  }

  const produtos = Array.from(mapa.values())
  const temQtd = produtos.some(p => p.qtd !== null)
  return {
    campo: 'preferenciasProduto',
    valor: produtos.map(p => {
      if (p.qtd === null) return p.nome
      if (/\(\d+x\)$/i.test(p.nome.trim())) return p.nome
      return `${p.nome} (${p.qtd}x)`
    }),
    confianca: temQtd ? 'media' : 'baixa',
    fonte: temQtd ? 'regex:produtos_com_qtd' : 'regex:produtos_intencao',
    evidencias: produtos.map(p => p.evidencia).filter(Boolean),
  }
}

function extractAversoesProduto(text: string): CampoExtraido | null {
  const patterns = [
    /(?:não gosto|não quero|odeio|dispenso|detesto|não curto)\s+(?:de\s+)?(.+?)(?:\.|,|;|$|\?)/i,
    /sem\s+(.+?)(?:\.|,|;|$|\?)/i,
    /(?:pode\s+)?(?:tirar|remover|retirar|sem)\s+(.+?)(?:\.|,|;|$|\?|por favor)/i,
  ]
  const aversoes: string[] = []
  const evidencias: string[] = []
  for (const p of patterns) {
    const m = text.match(p)
    if (m && m[1]) {
      aversoes.push(m[1].trim())
      evidencias.push(m[0].trim())
    }
  }
  if (aversoes.length > 0) {
    return {
      campo: 'aversoesProduto',
      valor: aversoes,
      confianca: classificarConfianca(0.3, 0.7, aversoes.length > 1 ? 0.8 : 0.4),
      fonte: 'regex:aversoes',
      evidencias,
    }
  }
  return null
}

const regexExtractors: Array<(text: string) => CampoExtraido | null> = [
  extractTelefone,
  extractCep,
  extractPix,
  extractFormaPagamento,
  extractUrgencia,
  extractEndereco,
  extractLogistica,
  extractNome,
  extractPreferenciasProduto,
  extractAversoesProduto,
]

const TODOS_CAMPOS = [
  'nome',
  'preferenciasProduto',
  'aversoesProduto',
  'enderecoEntrega',
  'formaPagamentoPreferida',
  'urgenciaEntrega',
  'observacoesLogisticas',
  'telefone',
]

async function callLlm(
  mensagem: string,
  bridge: MettriBridgeClient,
  apiKey: string,
): Promise<Record<string, unknown> | null> {
  const systemPrompt =
    'Você é um extrator de dados de perfil de cliente a partir de mensagens do WhatsApp. ' +
    'Extraia os campos solicitados e retorne APENAS um JSON válido, sem marcação, sem explicações. ' +
    'Não invente informações que não estejam na mensagem.'

  const userPrompt =
    `Mensagem do cliente:\n"${mensagem}"\n\n` +
    'Extraia os seguintes campos opcionais deste JSON:\n' +
    '{\n' +
    '  "nome": "string | null",\n' +
    '  "preferenciasProduto": "string[]",\n' +
    '  "aversoesProduto": "string[]",\n' +
    '  "enderecoEntrega": "string | null",\n' +
    '  "formaPagamentoPreferida": "string[]",\n' +
    '  "urgenciaEntrega": "string | null",\n' +
    '  "observacoesLogisticas": "string[]",\n' +
    '  "confianca": "baixa" | "media" | "alta"\n' +
    '}\n\n' +
    'Regras:\n' +
    '- "confianca" geral da extração: alta se informação clara e completa, media se parcial, baixa se incerta.\n' +
    '- Não preencher campos não mencionados (deixar null ou []).\n' +
    '- "preferenciasProduto" inclui produtos mencionados com intenção de compra.\n' +
    '- "observacoesLogisticas" inclui instruções de entrega, horários, portaria, etc.'

  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0,
    max_tokens: 300,
  }

  try {
    const result = await bridge.netFetch({
      url: OPENAI_URL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!result.ok) {
      console.warn(`[extrator] OpenAI ${result.status}: ${result.text}`)
      return null
    }

    const data = JSON.parse(result.text) as {
      choices?: { message?: { content?: string } }[]
    }
    const content = data.choices?.[0]?.message?.content?.trim()
    if (!content) {
      console.warn('[extrator] OpenAI respondeu sem conteúdo')
      return null
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.warn('[extrator] Resposta não contém JSON:', content.substring(0, 100))
      return null
    }

    return JSON.parse(jsonMatch[0]) as Record<string, unknown>
  } catch (error) {
    console.warn('[extrator] Erro na chamada LLM:', error)
    return null
  }
}

function penalizarConfianca(original: CampoConfianca): CampoConfianca {
  const ordem: CampoConfianca[] = ['alta', 'media', 'baixa', 'desconhecido']
  const idx = ordem.indexOf(original)
  if (idx >= 0 && idx < ordem.length - 1) return ordem[idx + 1]
  return 'desconhecido'
}

async function extractWithLlm(
  mensagem: string,
  chatId: string,
  regexCampos: CampoExtraido[],
): Promise<{ camposExtraidos: CampoExtraido[]; llmUsado: boolean }> {
  const camposCapturados = new Set(regexCampos.map(c => c.campo))
  const camposRestantes = TODOS_CAMPOS.filter(c => !camposCapturados.has(c))

  if (camposRestantes.length === 0) {
    return { camposExtraidos: regexCampos, llmUsado: false }
  }

  if (mensagem.length < MIN_MESSAGE_LENGTH_FOR_LLM) {
    return { camposExtraidos: regexCampos, llmUsado: false }
  }

  if (!checkBudget(chatId)) {
    console.log(`[extrator] Teto diário atingido para ${chatId}, pulando LLM`)
    return { camposExtraidos: regexCampos, llmUsado: false }
  }

  const bridge = new MettriBridgeClient(30_000)

  let apiKey = ''
  try {
    const obj = await bridge.storageGet([STORAGE_KEY_API])
    apiKey = typeof obj[STORAGE_KEY_API] === 'string' ? (obj[STORAGE_KEY_API] as string) : ''
  } catch {
    return { camposExtraidos: regexCampos, llmUsado: false }
  }

  if (!apiKey) {
    console.log('[extrator] API key não configurada')
    return { camposExtraidos: regexCampos, llmUsado: false }
  }

  incrementBudget(chatId)

  const llmResult = await callLlm(mensagem, bridge, apiKey)
  if (!llmResult) {
    return { camposExtraidos: regexCampos, llmUsado: false }
  }

  const llmConfianca = (llmResult.confianca as string) || 'baixa'
  const llmCampos: CampoExtraido[] = []

  for (const campo of TODOS_CAMPOS) {
    if (camposCapturados.has(campo)) continue
    const valor = llmResult[campo]
    if (valor === null || valor === undefined) continue
    if (Array.isArray(valor) && valor.length === 0) continue
    if (typeof valor === 'string' && !valor.trim()) continue

    const confPena = penalizarConfianca(llmConfianca as CampoConfianca)
    llmCampos.push({
      campo,
      valor: Array.isArray(valor) ? (valor as string[]) : String(valor),
      confianca: confPena,
      fonte: 'llm',
      evidencias: ['extraído via LLM'],
    })
  }

  const camposExtraidos = [...regexCampos, ...llmCampos]
  return { camposExtraidos, llmUsado: true }
}

export async function extrator(input: ExtratorInput): Promise<ExtratorOutput> {
  const normalized = normalizeMessage(input.mensagem)

  const regexCampos: CampoExtraido[] = []
  for (const extractor of regexExtractors) {
    const result = extractor(normalized)
    if (result) {
      const existing = regexCampos.find(c => c.campo === result.campo)
      if (existing) {
        if (result.confianca === 'alta' || existing.confianca === 'desconhecido') {
          Object.assign(existing, result)
        }
      } else {
        regexCampos.push(result)
      }
    }
  }

  let urgencia: 'alta' | 'media' | 'baixa' = 'baixa'
  const urgField = regexCampos.find(c => c.campo === 'urgenciaEntrega')
  if (urgField) {
    if (urgField.valor === 'alta') urgencia = 'alta'
    else if (urgField.valor === 'media') urgencia = 'media'
  }

  const { camposExtraidos, llmUsado } = await extractWithLlm(
    normalized,
    input.chatId,
    regexCampos,
  )

  const camposCapturados = new Set(camposExtraidos.map(c => c.campo))
  const camposRestantes = TODOS_CAMPOS.filter(c => !camposCapturados.has(c))

  return {
    campos: camposExtraidos,
    urgencia,
    usaLLM: llmUsado,
    camposRestantes,
  }
}

export function resetBudget(): void {
  budgetMap.clear()
}
