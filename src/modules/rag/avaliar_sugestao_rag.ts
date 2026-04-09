import type { ConversationChunk } from './agrupar_por_turno';
import type { MettriBridgeClient } from '../../content/bridge-client';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';
const STORAGE_KEY_API = 'mettri:openai:apiKey';

export interface AvaliacaoResult {
  scoreRelevance: number;
  scoreFaithfulness: number;
  scoreStyle: number;
  mode: 'llm';
  notes?: string;
}

export type AvaliarSugestaoFn = (
  currentConversation: string,
  chunks: ConversationChunk[],
  suggestion: string,
  bridge: MettriBridgeClient,
) => Promise<AvaliacaoResult>;

const STYLE_RULES_SUMMARY = [
  'Mensagens curtas: 3-14 palavras, máximo 20.',
  'Uma ideia por mensagem.',
  'Padrão: confirmação curta + próxima ação.',
  'Tom informal e direto. Usar: pra, tô, tá, vc, né.',
  'Sem linguagem corporativa.',
  'Sem "Fico à disposição", "Qualquer dúvida estamos aqui", "Conforme solicitado", "Espero que esteja bem", "Tudo bem?".',
  'Sem saudações protocolares longas, adjetivos desnecessários ou explicações antes da informação principal.',
  'Sem emoji (raríssima exceção para produto específico).',
  'Exclamação com moderação, nunca !! como padrão.',
  'Só texto da mensagem, sem explicações, aspas ou prefixos.',
].join('\n');

function buildJudgePrompt(
  currentConversation: string,
  chunks: ConversationChunk[],
  suggestion: string,
): { system: string; user: string } {
  const system = [
    'Você é um avaliador de qualidade de respostas de atendimento via WhatsApp.',
    'Avalie a sugestão de resposta usando três critérios, cada um com score de 0 a 1:',
    '',
    '1. scoreRelevance: A resposta trata do que o cliente perguntou? (0 = totalmente fora do assunto, 1 = perfeita)',
    '2. scoreFaithfulness: As afirmações estão sustentadas na conversa e nos exemplos de histórico? Penalize alucinações. (0 = pura invenção, 1 = totalmente fiel)',
    '3. scoreStyle: A resposta segue o estilo Jonas (regras abaixo)? (0 = ignora todas as regras, 1 = segue perfeitamente)',
    '',
    '## Regras de estilo Jonas:',
    STYLE_RULES_SUMMARY,
    '',
    'Responda APENAS com JSON válido, sem markdown, sem explicações:',
    '{ "scoreRelevance": 0.0, "scoreFaithfulness": 0.0, "scoreStyle": 0.0, "notes": "opcional" }',
  ].join('\n');

  const userParts: string[] = [];

  userParts.push('## Conversa atual:');
  userParts.push(currentConversation || '(vazia)');
  userParts.push('');

  userParts.push('## Exemplos de histórico fornecidos ao modelo:');
  if (chunks.length > 0) {
    chunks.forEach((chunk, i) => {
      userParts.push(`[Exemplo ${i + 1}]`);
      userParts.push(chunk.content);
      userParts.push('');
    });
  } else {
    userParts.push('(nenhum exemplo fornecido)');
    userParts.push('');
  }

  userParts.push('## Sugestão de resposta a avaliar:');
  userParts.push(suggestion);

  return { system, user: userParts.join('\n') };
}

function parseAndValidate(text: string): AvaliacaoResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Resposta do juiz não é JSON válido: ${text.slice(0, 200)}`);
  }

  const obj = parsed as Record<string, unknown>;

  const scoreFields = ['scoreRelevance', 'scoreFaithfulness', 'scoreStyle'] as const;
  for (const field of scoreFields) {
    const val = obj[field];
    if (typeof val !== 'number' || val < 0 || val > 1) {
      throw new Error(
        `Campo ${field} inválido na resposta do juiz: esperado número entre 0 e 1, recebido ${JSON.stringify(val)}`,
      );
    }
  }

  return {
    scoreRelevance: obj.scoreRelevance as number,
    scoreFaithfulness: obj.scoreFaithfulness as number,
    scoreStyle: obj.scoreStyle as number,
    mode: 'llm',
    notes: typeof obj.notes === 'string' ? obj.notes : undefined,
  };
}

export async function avaliar_sugestao_rag(
  currentConversation: string,
  chunks: ConversationChunk[],
  suggestion: string,
  bridge: MettriBridgeClient,
): Promise<AvaliacaoResult> {
  if (!suggestion.trim()) {
    throw new Error('Sugestão vazia não pode ser avaliada.');
  }

  let apiKey = '';
  try {
    const obj = await bridge.storageGet([STORAGE_KEY_API]);
    apiKey = typeof obj[STORAGE_KEY_API] === 'string' ? (obj[STORAGE_KEY_API] as string) : '';
  } catch {
    apiKey = '';
  }

  if (!apiKey) {
    throw new Error('Chave API OpenAI não configurada para avaliação RAG.');
  }

  const { system, user } = buildJudgePrompt(currentConversation, chunks, suggestion);

  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.0,
    max_tokens: 300,
  };

  const result = await bridge.netFetch({
    url: OPENAI_URL,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!result.ok) {
    throw new Error(`OpenAI avaliação ${result.status}: ${result.text}`);
  }

  const data = JSON.parse(result.text) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('OpenAI respondeu sem conteúdo para a avaliação RAG.');
  }

  return parseAndValidate(content);
}
