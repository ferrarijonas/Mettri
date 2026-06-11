/**
 * Extrator de Memórias via LLM
 *
 * No final de cada turno do AgentLoop, chama o DeepSeek para analisar
 * a interação e extrair memórias nas 4 taxonomias (cliente, licao,
 * negocio, referencia), decidindo escopo (cliente vs global).
 *
 * Se o LLM falhar (sem API key, timeout), retorna vazio — degradação
 * graciosa. O caller decide o fallback.
 *
 * Inspirado no padrão de forked agent do Claude Code.
 */
import { MettriBridgeClient } from '../../content/bridge-client';
import type { AgentTurno } from './types';

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';
const MODEL = 'deepseek-chat';
const STORAGE_KEY_API = 'ds_api_key';

// ── Schema de saída ──

export interface MemoriaExtraida {
  tipo: 'cliente' | 'licao' | 'negocio' | 'referencia';
  descricao: string;
  escopo: 'cliente' | 'global';
  dados?: Record<string, unknown>;
}

// ── Helpers compartilhados ──

/** Pega API key do DeepSeek via bridge (timeout rápido para fallback) */
async function getApiKey(): Promise<string> {
  try {
    const bridge = new MettriBridgeClient(300);
    const storage = await bridge.storageGet([STORAGE_KEY_API]);
    return typeof storage[STORAGE_KEY_API] === 'string'
      ? (storage[STORAGE_KEY_API] as string)
      : '';
  } catch { return ''; }
}

/** Chama DeepSeek com mensagens e retorna texto da resposta, ou null */
async function callDeepSeek(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  timeoutMs = 30_000,
): Promise<string | null> {
  try {
    const llm = new MettriBridgeClient(timeoutMs);
    const response = await llm.netFetch({
      url: DEEPSEEK_URL,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0,
        max_tokens: 1000,
      }),
    });
    if (!response.ok) return null;
    const data = JSON.parse(response.text) as { choices?: { message?: { content?: string | null } }[] };
    return data.choices?.[0]?.message?.content ?? null;
  } catch { return null; }
}

// ── Prompt de Extração (nível Claude Code 1:1) ──

const EXTRACTION_SYSTEM_PROMPT = `Você é um extrator de memórias para um assistente de vendas no WhatsApp. Sua função é analisar cada interação entre o assistente (IA) e o cliente e extrair informações duráveis que melhorem interações futuras.

<tipos_de_memoria>
<type>
  <name>cliente</name>
  <scope>sempre cliente-específico (usa chatId)</scope>
  <description>Informações sobre o cliente: nome, preferências, restrições, endereço, forma de pagamento. Qualquer detalhe que personalize o atendimento.</description>
  <when_to_save>Ao descobrir qualquer informação nova sobre o cliente: nome que ele se identificou, endereço que mencionou, forma de pagamento que prefere, reclamação específica, restrição alimentar, horário preferido.</when_to_save>
  <how_to_use>Use para o assistente lembrar quem é o cliente sem precisar perguntar de novo. Ex: se o cliente disse "meu nome é João" e o próximo turno começa sabendo disso.</how_to_use>
  <examples>
    <good>cliente prefere pagamento no pix (útil: não pergunta de novo)</good>
    <good>cliente reclamou da demora na entrega da última vez (útil: menciona no próximo pedido)</good>
    <good>cliente tem restrição a glúten (útil: sugere produtos sem glúten)</good>
    <bad>cliente comprou pão (não é info do cliente, é do pedido)</bad>
    <bad>cliente falou "obrigado" (óbvio, sem valor futuro)</bad>
  </examples>
</type>
<type>
  <name>licao</name>
  <scope>cliente-específico OU global</scope>
  <description>Lições aprendidas: o que funcionou, o que não funcionou, padrões de comportamento. Pode ser específico de um cliente ou aplicável a todos.</description>
  <when_to_save>Quando uma abordagem funcionou bem ("cliente gostou do desconto"), quando uma ferramenta falhou ("consultarPedido retornou timeout"), quando um padrão se repetiu ("clientes desta região pedem mais pão integral"). Escolha o escopo adequado.</when_to_save>
  <how_to_use>Lições cliente-específicas personalizam o atendimento daquele cliente. Lições globais melhoram o sistema para todos. Erros de ferramenta são SEMPRE globais.</how_to_use>
  <examples>
    <good scope="global">ferramenta consultar_pedido está retornando timeout (útil: sabermos que está instável)</good>
    <good scope="cliente">cliente ficou satisfeito com desconto de 10% no pedido anterior (útil: oferecer de novo)</good>
    <good scope="global">clientes reagem melhor quando o assistente pergunta o endereço antes do pagamento (útil: ordem do fluxo)</good>
    <bad scope="global">assistente usou consultar_catalogo (óbvio, é o esperado)</bad>
    <bad scope="cliente">cliente mandou "ok" (sem aprendizado útil)</bad>
  </examples>
</type>
<type>
  <name>negocio</name>
  <scope>sempre global</scope>
  <description>Regras do negócio, políticas, metas, informações operacionais. Tudo que um novo atendente precisaria saber sobre como o negócio funciona.</description>
  <when_to_save>Ao descobrir: política de troca, prazo de entrega, formas de pagamento aceitas, horário de funcionamento, região de entrega, metas do mês, campanhas ativas.</when_to_save>
  <how_to_use>Estas memórias têm precedência sobre qualquer outra — são regras do negócio. O assistente deve segui-las estritamente.</how_to_use>
  <examples>
    <good>entregas somente na região central da cidade (útil: saber onde entrega)</good>
    <good>taxa de entrega grátis acima de R$30 (útil: informar o cliente)</good>
    <good>política de troca: 24h com nota fiscal (útil: resolver reclamações)</good>
    <bad>padaria vende pão (óbvio, é o negócio)</bad>
    <bad>cliente X pediu entrega (é sobre o cliente, não sobre o negócio)</bad>
  </examples>
</type>
<type>
  <name>referencia</name>
  <scope>sempre global</scope>
  <description>Links, códigos, contatos externos, IDs de sistemas. Informações de referência que o assistente pode consultar.</description>
  <when_to_save>Ao descobrir: código de fornecedor, link do sistema de gestão, contato do suporte técnico, ID de integração com PDV/ERP.</when_to_save>
  <how_to_use>Use como ponto de partida para encontrar informações em sistemas externos. O conteúdo exato pode mudar — a referência diz ONDE olhar.</how_to_use>
  <examples>
    <good>código do fornecedor FORN-123 para pão integral (útil: reabastecimento)</good>
    <good>bug tracker dos pedidos: linear.app/mettri/pedidos (útil: reportar bugs)</good>
    <bad>número de telefone do cliente (isso é perfil, não referência)</bad>
  </examples>
</type>
</tipos_de_memoria>

<regras_de_escopo>
- "cliente": escopo SEMPRE "cliente"
- "licao": "cliente" se sobre preferências/comportamento do cliente; "global" se sobre ferramentas/sistema
- "negocio": escopo SEMPRE "global"
- "referencia": escopo SEMPRE "global"
</regras_de_escopo>

<instrucoes_importantes>
- Só extraia memória se for REALMENTE útil para interações futuras. O teste é: "se eu perder esta informação, o próximo atendimento vai ser pior?"
- Seja conservador: extrair memória inútil polui o contexto pior do que não extrair.
- NÃO extraia: saudações ("bom dia", "obrigado"), confirmações óbvias ("ok", "sim"), informações já óbvias do contexto.
- Uma memória boa tem: (1) informação específica, (2) ação útil futura, (3) contexto suficiente.
- NÃO invente informações. Se não tiver certeza, não extraia.
- Use o chatId fornecido apenas para determinar escopo "cliente" — não inclua o chatId na descrição.
- A descrição deve ser auto-contida: alguém lendo ela meses depois deve entender o contexto.
</instrucoes_importantes>

<formato_de_saida>
Retorne APENAS um JSON array de objetos. Nenhum texto adicional, nenhuma formatação markdown:
[{ "tipo": "cliente", "descricao": "...", "escopo": "cliente" }]
Se nenhuma memória for relevante, retorne [].
</formato_de_saida>`;

// ── Função principal ──

export interface SalvarTurnoContexto {
  profile?: unknown;
  historicoContexto?: { papel: string; texto: string }[];
  envInfo?: { businessName: string };
  today?: string;
}

export type ExtrairMemoriasParams = { turno: AgentTurno } & SalvarTurnoContexto

/**
 * Chama DeepSeek para extrair memórias estruturadas do turno.
 * @returns array de memórias extraídas, ou [] se falhar
 */
export async function extrairMemoriasLLM(
  params: ExtrairMemoriasParams,
): Promise<MemoriaExtraida[]> {
  const { turno } = params;

  const apiKey = await getApiKey();
  if (!apiKey) return [];

  const toolsBlock = turno.ferramentasChamadas.length > 0
    ? turno.ferramentasChamadas.map(t =>
        `- ${t.nome}: ${t.erro ? `ERRO: ${t.erro}` : `sucesso: ${JSON.stringify(t.resultado)}`}`
      ).join('\n')
    : '(nenhuma ferramenta usada)';

  const userPrompt = [
    `## Turno`,
    `Cliente: ${turno.chatId}`,
    `Mensagem: "${turno.mensagemAtual}"`,
    `Status: ${turno.status}`,
    `Ferramentas chamadas:\n${toolsBlock}`,
    params.profile ? `\n## Perfil do cliente\n${JSON.stringify(params.profile)}` : '',
    params.historicoContexto && params.historicoContexto.length > 0
      ? `\n## Histórico recente\n${params.historicoContexto.slice(-5).map(h => `[${h.papel}] ${h.texto}`).join('\n')}`
      : '',
    params.envInfo ? `\n## Ambiente\nNegócio: ${params.envInfo.businessName}` : '',
    params.today ? `Data: ${params.today}` : '',
    '\nExtraia memórias relevantes como JSON array:',
  ].filter(Boolean).join('\n');

  const content = await callDeepSeek(apiKey, EXTRACTION_SYSTEM_PROMPT, userPrompt);
  if (!content) return [];

  const parsed = parseLLMOutput(content);
  return Array.isArray(parsed) ? parsed : [];
}

// ── Seleção de memórias (retrieval via LLM) ──

const SELECTION_SYSTEM_PROMPT = `Você é um selecionador de memórias para um assistente de vendas no WhatsApp. Dada a mensagem atual do cliente e uma lista de memórias disponíveis, você deve escolher APENAS as memórias que ajudarão o assistente a dar uma resposta melhor.

<instrucoes>
- Seja CONSERVADOR: só inclua memórias cuja relevância é clara e direta para a mensagem atual do cliente.
- Se uma memória tem relevância duvidosa, EXCLUA. É melhor o assistente não ter uma memória moderadamente útil do que ter 10 memórias e se distrair.
- Máximo de 5 memórias selecionadas.
- Se nenhuma memória for claramente relevante, retorne array vazio [].
- Considere o contexto: uma memória sobre "prefere pagamento no pix" é relevante se o cliente está comprando, mas não se ele está reclamando de um atraso.
- Memórias do tipo "negocio" (regras do negócio) têm precedência — sempre inclua se relevantes.
- NÃO inclua memórias que o assistente já está vendo no contexto atual (ex: o perfil do cliente já carregado). O objetivo é trazer informações ADICIONAIS.
</instrucoes>

<exemplos>
  Query: "quero 2 pães integrais"
  Memórias:
  [0] cliente: prefere pagamento no pix
  [1] licao: cliente ficou satisfeito com pão integral na última compra
  [2] negocio: entregas somente região central
  [3] referencia: código fornecedor FORN-123
  → Selecionar: [0, 1, 2]
    (0: forma de pagamento relevante pra venda, 1: confirma preferência por integral, 2: precisa saber se entrega, 3: irrelevante pro cliente)

  Query: "meu pedido atrasou"
  Memórias:
  [0] cliente: prefere pagamento no pix
  [1] licao global: ferramenta consultar_pedido está com timeout
  [2] negocio: política de troca 24h
  → Selecionar: [1, 2]
    (1: explica o atraso, 2: útil se quiser trocar. 0: irrelevante para reclamação)

  Query: "bom dia"
  Memórias: [0] cliente: prefere pão integral
  → Selecionar: []
    (Saudação não requer nenhuma memória específica)
</exemplos>

<formato>
Retorne APENAS um JSON array de números com os índices selecionados:
[0, 3, 5]
</formato>`;

/** Item de memória candidata para seleção */
export interface MemoriaCandidata {
  id?: number;
  descricao: string;
  tipo: string;
}

/**
 * Chama DeepSeek para selecionar memórias relevantes para a mensagem do cliente.
 * @returns índices das memórias selecionadas, ou null se falhar
 */
export async function selecionarMemoriasLLM(
  mensagem: string,
  candidatas: MemoriaCandidata[],
): Promise<number[] | null> {
  if (candidatas.length === 0) return [];

  const apiKey = await getApiKey();
  if (!apiKey) return null;

  const lista = candidatas.map((m, i) =>
    `[${i}] ${m.tipo}: ${m.descricao}`
  ).join('\n');

  const userPrompt = `Mensagem do cliente: "${mensagem}"\n\nMemórias disponíveis:\n${lista}\n\nSelecione os índices relevantes:`;

  const content = await callDeepSeek(apiKey, SELECTION_SYSTEM_PROMPT, userPrompt, 15_000);
  if (!content) return null;

  return parseSelectionOutput(content);
}

/**
 * Parseia output do LLM para array de índices.
 * Aceita: [0, 3, 5] ou ```json [0, 3, 5] ``` ou "0, 3, 5"
 */
function parseSelectionOutput(content: string): number[] | null {
  // Tenta bloco ```json```
  const jsonBlock = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = jsonBlock ? jsonBlock[1].trim() : content.trim();

  try {
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed) && parsed.every((n: unknown) => typeof n === 'number')) {
      return parsed;
    }
  } catch { /* fallback abaixo */ }

  // Fallback: "0, 3, 5" ou "0 3 5"
  const nums = content.match(/\d+/g);
  if (nums) return nums.map(Number);
  return null;
}

/**
 * Tenta extrair JSON do output do LLM, lidando com markdown ```json ```.
 */
function parseLLMOutput(content: string): MemoriaExtraida[] | null {
  // Tenta extrair bloco ```json ... ```
  const jsonBlock = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = jsonBlock ? jsonBlock[1].trim() : content.trim();

  try {
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (m: unknown) =>
          m &&
          typeof m === 'object' &&
          ['cliente', 'licao', 'negocio', 'referencia'].includes((m as Record<string, unknown>).tipo as string) &&
          typeof (m as Record<string, unknown>).descricao === 'string' &&
          ['cliente', 'global'].includes((m as Record<string, unknown>).escopo as string),
      );
    }
    return null;
  } catch {
    return null;
  }
}

// ── Self-review (planejado — não integrado ainda) ──

const SELF_REVIEW_SYSTEM_PROMPT = `Você é um revisor de respostas para um assistente de vendas no WhatsApp. Sua função é detectar erros ANTES que a resposta seja enviada ao cliente.

<o_que_verificar>
1. <tool_correctness>A ferramenta escolhida é a mais adequada para a situação? Ou deveria ser outra?</tool_correctness>
2. <argument_correctness>Os argumentos passados para a ferramenta estão completos e corretos?</argument_correctness>
3. <response_quality>A resposta textual é apropriada para o cliente? Tom, conteúdo, completude?</tool_response_quality>
4. <business_rules>A resposta segue as regras do negócio? (políticas, preços, prazos)</tool_business_rules>
5. <safety>A resposta pode causar dano? (prometer algo que não pode cumprir, informação errada)</tool_safety>
</o_que_verificar>

<formato_de_saida>
Se TUDO estiver correto, retorne APENAS: {"status": "OK", "confianca": 0.9}

Se houver ALGUM problema, retorne: {"status": "CORRIGIR", "problemas": ["...", "..."], "sugestao": "..."}

- "confianca" deve ser um número entre 0 e 1. 0.0 = nenhuma confiança, 1.0 = certeza absoluta.
- "problemas" é um array de strings descrevendo cada problema encontrado.
- "sugestao" é a correção proposta — o que o assistente deveria fazer em vez disso.
- NÃO retorne markdown. APENAS o JSON.
</formato_de_saida>

<exemplos>
  Input: Cliente disse "quero 2 pães", assistente chamou consultar_catalogo({busca: "pão"})
  → OK (tool correta, args corretos)

  Input: Cliente disse "quero 2 pães", assistente chamou registrar_pedido({itens: [{nome: "pão", quantidade: 2}]})
  → CORRIGIR — deveria consultar o catálogo primeiro para saber preço e disponibilidade antes de registrar

  Input: Cliente disse "meu pedido atrasou", assistente respondeu "vou verificar" sem chamar ferramenta
  → CORRIGIR — deveria consultar o histórico do cliente antes de responder

  Input: Cliente disse "quanto custa o pão?", assistente respondeu "R$ 8,50" sem consultar catálogo
  → CORRIGIR — deveria consultar o catálogo para ter certeza do preço, não inventar
</exemplos>

<instrucoes>
- Seja RÁPIDO: esta revisão acontece em tempo real. Priorize erros graves (ferramenta errada, informação falsa) sobre erros estéticos.
- Ignore pequenas diferenças de estilo. Foque em erros que impactam o cliente.
- Se estiver em dúvida, dê o benefício da dúvida e retorne OK.
- NUNCA invente regras que não existem. Use apenas as regras do negócio fornecidas.
</instrucoes>`;

/**
 * SUB-AGENTE #3: Revisa a resposta antes de enviar.
 *
 * Planejado — prompt definido mas não integrado ao agent-loop.ts ainda.
 * Integração futura: chamar antes de emitir RESPOSTA_PRONTA e, se
 * retornar CORRIGIR, ajustar tool call ou resposta antes de enviar.
 *
 * @returns { status: 'OK' } | { status: 'CORRIGIR', problemas: string[], sugestao: string }
 */
export type SelfReviewOutput =
  | { status: 'OK'; confianca: number }
  | { status: 'CORRIGIR'; problemas: string[]; sugestao: string };

export async function revisarResposta(
  mensagemCliente: string,
  acaoAgente: string,
  contexto?: { ferramentasUsadas?: string[]; regrasNegocio?: string[] },
): Promise<SelfReviewOutput | null> {
  const apiKey = await getApiKey();
  if (!apiKey) return null;

  const userPrompt = [
    `Cliente disse: "${mensagemCliente}"`,
    `Assistente fez: ${acaoAgente}`,
    contexto?.ferramentasUsadas?.length
      ? `Ferramentas já usadas neste turno: ${contexto.ferramentasUsadas.join(', ')}`
      : '',
    contexto?.regrasNegocio?.length
      ? `Regras do negócio: ${contexto.regrasNegocio.join('; ')}`
      : '',
    '\nRevise a resposta do assistente:',
  ].filter(Boolean).join('\n');

  const content = await callDeepSeek(apiKey, SELF_REVIEW_SYSTEM_PROMPT, userPrompt, 15_000);
  if (!content) return null;

  try {
    const jsonBlock = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonBlock ? jsonBlock[1].trim() : content.trim();
    const parsed = JSON.parse(jsonStr);

    if (parsed.status === 'OK' && typeof parsed.confianca === 'number') {
      return parsed as SelfReviewOutput;
    }
    if (parsed.status === 'CORRIGIR' && Array.isArray(parsed.problemas)) {
      return parsed as SelfReviewOutput;
    }
    return null;
  } catch {
    return null;
  }
}
