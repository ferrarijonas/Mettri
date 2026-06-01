import { messageDB } from '../../storage/message-db'
import { catalogoDB } from '../../storage/catalogo-db'
import { MettriBridgeClient } from '../../content/bridge-client'

const STORAGE_KEY_API = 'mettri:openai:apiKey'
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = 'gpt-4o-mini'
const MAX_LLM_CALLS_PER_DAY = 100
const MIN_MESSAGE_LENGTH_FOR_LLM = 10

const budgetMap = new Map<string, { data: string; chamadasHoje: number }>()

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
    budgetMap.set(key, { data: hoje(), chamadasHoje: 1 })
  }
}

export interface ResolverOutput {
  resolvido: boolean
  nome?: string
  qtd: number
  nomeExtraido?: string
  confianca?: 'alta' | 'media' | 'baixa'
  metodo?: 'reply' | 'ultimo_produto' | 'llm'
  evidencia?: string
}

interface CatalogoItem {
  productId: string
  nome: string
  precoCentavos: number
}

function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/** Regex de sinais de ambiguidade — qtd sem produto, pronome, referência vaga. */
function temSinalAmbiguidade(text: string): boolean {
  const t = normalizeText(text)
  // Quantidade sem nome: "quero dois", "queria 5", "vou querer meia duzia"
  if (/^(quero|queria|vou querer|manda|pedi|pode ser)\s+(\d+|dois|duas|tres|quatro|cinco|meia|uma)\s*(desses?|disso|deles?|unidades?)?\s*$/.test(t)) return true
  // Pronome isolado: "esse", "essa", "isso", "aquele", "desse"
  if (/^(esse|essa|isso|aquele|aquela|desse|dessa|esse mesmo|esse aí|esse aqui)\s*(aí|mesmo)?$/.test(t)) return true
  // Referência vaga: "quero de novo", "quero igual", "quero o mesmo"
  if (/^(quero|queria|vou querer)\s+(de novo|também|igual|o mesmo|outro|mais um|mais uma)$/.test(t)) return true
  return false
}

function extrairQtdDoTexto(text: string): number {
  const original = text.trim()
  const t = normalizeText(text)

  // Se inicia com N% (porcentagem), não é quantidade
  if (/^\d+%/.test(original)) {
    return 1
  }

  // Se inicia com % ou R$, não tem quantity explícita (ex: "100% integral", "R$ 50,00")
  if (/^%/.test(original) || /^(R\$|R\s|Reais|Centavos)/i.test(original)) {
    return 1
  }

  // Primeiro tenta "N de produto" ou "N produto" (padrão claro de quantidade)
  const padraoQtd = t.match(/^(\d+)\s*(?:de\s+|p\s|p\.|pã|fati?s?)?\s*([a-zá-ú]+|$)/)
  if (padraoQtd) {
    const num = parseInt(padraoQtd[1], 10)
    if (num > 0 && num <= 100) return num
  }

  // Se começa com "%" no texto normalizado, ignora
  if (/^%/.test(t)) return 1

  // Regex que ignora números seguidos de unidades não-quantidade
  // "ano 2024" → ignora 2024
  const NaoQuantidade = /(\d+)(?!\s*(?:de\s|unidades?|p\.|p\s|pã|fati?s?|unidades?|pç|pcs|vez|x|kg|g|ml|l|metro|cm|mm|anos?|ano|CEP|CEP\.?|tel|fone|cel|whatsapp)|$|[a-zA-Z])/g

  const digMatch = t.match(NaoQuantidade)
  if (digMatch) {
    for (const match of digMatch) {
      const num = parseInt(match, 10)
      if (num > 0 && num <= 100) return num
    }
  }

  // Extenso (numerais)
  const numerais: Record<string, number> = {
    um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4,
    cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
    meia: 0.5, meio: 0.5, meia_duzia: 6, seis_unidades: 6,
  }
  for (const [palavra, num] of Object.entries(numerais)) {
    if (t.includes(palavra)) return num
  }

  return 1
}

function extrairProdutoSimples(texto: string): string | null {
  const t = normalizeText(texto)
  // Padrão "N de produto" ou "N produto"
  const m = t.match(/(\d+)\s*(?:de\s+)?([\wá-ú%]+(?:\s+[\wá-ú%]+){0,4})$/)
  if (m) {
    const nome = m[2].trim()
    if (nome.length > 2 && !/^\d+$/.test(nome)) return nome
  }
  // Padrão "quero X", "tem X", etc. (intenção de compra)
  const compraPatterns = [
    /(?:gosto de|gostaria de|quero|vou querer|vou pedir|pedir|quisesse|queria)\s+(.+?)(?:\.|,|;|$| para| pra| por favor|\?)/i,
    /(?:você tem|vocês tem|tu tem|vende|tem como)\s+(.+?)(?:\.|,|;|\?|$)/i,
  ]
  for (const p of compraPatterns) {
    const pm = t.match(p)
    if (pm && pm[1]) {
      const nome = pm[1].trim()
      if (nome.length > 2) return nome
    }
  }
  // Padrão de OFERTA do atendente: "hoje tem X", "temos X", etc.
  const ofertaPatterns = [
    /(?:hoje|temos|agora|nesse\s+momento|nessa\s+hora)\s+(?:tem|que|vai|dispõe|disponível)\s+(.+?)(?:\.|,|;|$| e | com |$)/i,
    /(?:tenho|tenha)\s+(?:disponível|à\s+venda)\s+(.+?)(?:\.|,|;|$| e )/i,
    /(?:no\s+cardápio|tem\s+no\s+cardápio)\s+(?:hoje|agora)?\s*(.+?)(?:\.|,|;|$| e )/i,
  ]
  for (const p of ofertaPatterns) {
    const pm = t.match(p)
    if (pm && pm[1]) {
      const raw = pm[1].trim()
      const partes = raw.split(/\s+e\s+/)
      if (partes.length > 0) {
        const primeiro = partes[0].trim()
        if (primeiro.length > 2) return primeiro
      }
    }
  }
  // Fallback: pega a palavra mais longa que parece produto
  const words = t.split(/\s+/).filter(w => w.length > 3)
  if (words.length > 0) return words[words.length - 1]
  return null
}

function buscarProdutoCatalogo(
  texto: string,
  produtos: CatalogoItem[],
): CatalogoItem | null {
  const norm = normalizeText(texto)
  if (!norm || produtos.length === 0) return null
  for (const p of produtos) {
    if (normalizeText(p.nome) === norm) return p
  }
  for (const p of produtos) {
    const pn = normalizeText(p.nome)
    if (pn.includes(norm) || norm.includes(pn)) return p
  }
  const palavras = norm.split(/\s+/).filter(w => w.length > 3)
  if (palavras.length > 0) {
    for (const p of produtos) {
      const pn = normalizeText(p.nome)
      const matchCount = palavras.filter(w => pn.includes(w)).length
      if (matchCount / palavras.length >= 0.5) return p
    }
  }
  return null
}

/** Estratégia 1: lookup por replyToId */
async function resolverPorReply(
  replyToId: string,
  chatId: string,
  catalogo: CatalogoItem[],
): Promise<ResolverOutput | null> {
  try {
    const msgs = await messageDB.getMessages(chatId, 50)
    const replied = msgs.find(m => m.id === replyToId)
    if (!replied || !replied.text || replied.text.length < 3) return null

    const produtoNome = extrairProdutoSimples(replied.text)
    if (!produtoNome) return null

    const match = buscarProdutoCatalogo(produtoNome, catalogo)
    return {
      resolvido: true,
      nome: match?.nome || produtoNome,
      qtd: 1,
      nomeExtraido: `${match?.nome || produtoNome} (1x)`,
      confianca: match ? 'alta' : 'media',
      metodo: 'reply',
      evidencia: replied.text,
    }
  } catch {
    return null
  }
}

/** Estratégia 2: último produto mencionado pelo atendente */
function resolverPorUltimoProduto(
  historico: Array<{ text: string; isOutgoing: boolean }>,
  catalogo: CatalogoItem[],
): ResolverOutput | null {
  for (let i = historico.length - 1; i >= 0; i--) {
    const msg = historico[i]
    if (!msg.isOutgoing) continue
    const produtoNome = extrairProdutoSimples(msg.text)
    if (!produtoNome) continue
    const match = buscarProdutoCatalogo(produtoNome, catalogo)
    return {
      resolvido: true,
      nome: match?.nome || produtoNome,
      qtd: 1,
      nomeExtraido: `${match?.nome || produtoNome} (1x)`,
      confianca: match ? 'alta' : 'baixa',
      metodo: 'ultimo_produto',
      evidencia: msg.text,
    }
  }
  return null
}

/** Estratégia 3: LLM com contexto */
async function resolverPorLlm(
  mensagem: string,
  historico: Array<{ text: string; isOutgoing: boolean }>,
  chatId: string,
  catalogo: CatalogoItem[],
): Promise<ResolverOutput | null> {
  if (!checkBudget(chatId)) return null
  if (mensagem.length < MIN_MESSAGE_LENGTH_FOR_LLM) return null

  const bridge = new MettriBridgeClient(30_000)
  let apiKey = ''
  try {
    const obj = await bridge.storageGet([STORAGE_KEY_API])
    apiKey = typeof obj[STORAGE_KEY_API] === 'string' ? (obj[STORAGE_KEY_API] as string) : ''
  } catch {
    return null
  }
  if (!apiKey) return null

  const contexto = historico
    .slice(-10)
    .map(m => `${m.isOutgoing ? 'Atendente' : 'Cliente'}: ${m.text}`)
    .join('\n')

  const systemPrompt =
    'Você é um assistente que ajuda a resolver referências ambíguas em conversas de WhatsApp. ' +
    'Dada uma conversa entre Atendente e Cliente, e a última mensagem do Cliente que contém ' +
    'uma referência ambígua (ex: "quero dois", "quero desse", "esse mesmo"), responda com ' +
    'o nome do produto mais provável que o cliente está pedindo. ' +
    'Responda APENAS com o nome do produto, ou "INDETERMINADO" se não for possível saber.'

  const userPrompt =
    `Conversa:\n${contexto}\n\nMensagem ambígua do cliente: "${mensagem}"\n\nQual produto o cliente quer? Responda apenas o nome do produto ou "INDETERMINADO".`

  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0,
    max_tokens: 50,
  }

  try {
    incrementBudget(chatId)
    const result = await bridge.netFetch({
      url: OPENAI_URL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!result.ok) return null

    const data = JSON.parse(result.text) as { choices?: { message?: { content?: string } }[] }
    const content = data.choices?.[0]?.message?.content?.trim()
    if (!content || content === 'INDETERMINADO') return null

    const nome = content.replace(/[^a-zA-ZÀ-ÿ0-9\s%]/g, '').trim()
    if (!nome || nome.length < 2) return null

    const match = buscarProdutoCatalogo(nome, catalogo)
    return {
      resolvido: true,
      nome: match?.nome || nome,
      qtd: 1,
      nomeExtraido: `${match?.nome || nome} (1x)`,
      confianca: match ? 'media' : 'baixa',
      metodo: 'llm',
      evidencia: mensagem,
    }
  } catch {
    return null
  }
}

export async function resolverAmbiguidade(params: {
  mensagem: string
  chatId: string
  msgId: string
  replyToId?: string
  quotedText?: string
  historico: Array<{ text: string; isOutgoing: boolean }>
}): Promise<ResolverOutput> {
  const mensagem = String(params.mensagem || '').trim()
  if (!mensagem || !temSinalAmbiguidade(mensagem)) {
    return { resolvido: false, qtd: 1 }
  }

  let catalogo: CatalogoItem[] = []
  try {
    const accountId = catalogoDB.getCurrentUserWid() || 'default'
    const todos = await catalogoDB.listByAccount(accountId)
    catalogo = todos.filter(p => p.ativo).map(p => ({
      productId: p.productId,
      nome: p.nome,
      precoCentavos: p.precoCentavos,
    }))
  } catch {
    // Catálogo indisponível
  }

  // Estratégia 1: reply lookup
  if (params.replyToId) {
    const result = await resolverPorReply(params.replyToId, params.chatId, catalogo)
    if (result) {
      result.qtd = extrairQtdDoTexto(mensagem)
      result.nomeExtraido = `${result.nome} (${result.qtd}x)`
      return result
    }
  }

  // Estratégia 2: último produto do atendente
  const ultimoProduto = resolverPorUltimoProduto(params.historico, catalogo)
  if (ultimoProduto) {
    ultimoProduto.qtd = extrairQtdDoTexto(mensagem)
    ultimoProduto.nomeExtraido = `${ultimoProduto.nome} (${ultimoProduto.qtd}x)`
    return ultimoProduto
  }

  // Estratégia 3: LLM
  const llmResult = await resolverPorLlm(mensagem, params.historico, params.chatId, catalogo)
  if (llmResult) {
    llmResult.qtd = extrairQtdDoTexto(mensagem)
    llmResult.nomeExtraido = `${llmResult.nome} (${llmResult.qtd}x)`
    return llmResult
  }

  return { resolvido: false, qtd: 1 }
}

export function resetBudget(): void {
  budgetMap.clear()
}
