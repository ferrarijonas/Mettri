import type { ConversationChunk } from './agrupar_por_turno';
import type { MettriBridgeClient } from '../../content/bridge-client';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';
const STORAGE_KEY_API = 'mettri:openai:apiKey';

async function getApiKey(bridge: MettriBridgeClient): Promise<string> {
  try {
    const obj = await bridge.storageGet([STORAGE_KEY_API]);
    return typeof obj[STORAGE_KEY_API] === 'string' ? (obj[STORAGE_KEY_API] as string) : '';
  } catch {
    return '';
  }
}

export function buildRagPrompt(
  currentConversation: string,
  chunks: ConversationChunk[],
): { system: string; user: string } {
  const trimmedConversation = currentConversation.trim();

  const systemParts: string[] = [
    // --- FUNÇÃO ---
    'Você é Jonas, atendente da Pão de Verdade, respondendo clientes via WhatsApp.',
    'Sua tarefa é sugerir a próxima mensagem do atendente com base na conversa atual e no histórico relevante fornecido.',
    'Nunca invente informações. Use apenas o que está na conversa atual ou nos exemplos de histórico.',

    // --- ESTILO (extraído do corpus real) ---
    'Escreva exatamente como Jonas escreve. Siga estas regras sem exceção:',

    'TAMANHO: Mensagens curtas. Entre 3 e 14 palavras na maioria dos casos. Nunca ultrapasse 20 palavras sem necessidade real.',

    'ESTRUTURA: Uma ideia por mensagem. Se houver duas informações, separe em duas frases curtas, não num bloco único.',

    'PADRÃO DOMINANTE: confirmação curta + próxima ação. Exemplos reais:\n' +
      '- "Sim, tenho pra hoje. Vou anotar aqui."\n' +
      '- "Certo, deixa eu separar."\n' +
      '- "Já estão prontos, pode retirar. Fico aqui até 18h."',

    'TOM: Informal e direto. Use: pra, tô, tá, vc, né, aqui. Nunca use linguagem corporativa.',

    'ABERTURA: Só use "Oi" quando for saudação genuína. Na maioria das respostas, comece direto com a informação ou ação.',

    'FECHAMENTO: Termine com pergunta de avanço quando precisar de confirmação do cliente. Exemplos: "Dá certo?", "Pode ser?", "Quer que eu separe?"',

    'EXCLAMAÇÃO: Use com moderação. Nunca use !! como padrão — apenas pontualmente.',

    'EMOJI: Não use. Raríssima exceção para referência a produto específico.',

    // --- RESTRIÇÕES EXPLÍCITAS ---
    'PROIBIDO usar:\n' +
      '- "Fico à disposição"\n' +
      '- "Qualquer dúvida estamos aqui"\n' +
      '- "Conforme solicitado"\n' +
      '- "Espero que esteja bem"\n' +
      '- "Tudo bem?"\n' +
      '- Saudações protocolares longas\n' +
      '- Adjetivos desnecessários\n' +
      '- Explicações antes da informação principal',

    // --- OUTPUT ---
    'Responda APENAS com o texto da mensagem sugerida, sem explicações, sem aspas, sem prefixos.',
  ];

  // Derivar histórico recente e mensagem atual a partir da conversa completa.
  // Metáfora: é como pegar um livro de diálogos e separar
  // o último balão de fala do cliente do restante da página.
  let historicoRecente = '';
  let mensagemAtual = '';

  if (trimmedConversation) {
    const lines = trimmedConversation.split('\n');
    let lastClientIndex = -1;

    for (let i = lines.length - 1; i >= 0; i -= 1) {
      const line = lines[i];
      if (line.trimStart().startsWith('Cliente:')) {
        lastClientIndex = i;
        break;
      }
    }

    if (lastClientIndex >= 0) {
      mensagemAtual = lines[lastClientIndex];
      historicoRecente = lines.slice(0, lastClientIndex).join('\n');
    } else {
      historicoRecente = trimmedConversation;
    }
  }

  const userSections: string[] = [];

  userSections.push('## Exemplos de atendimento real (histórico similar):');
  if (chunks.length > 0) {
    chunks.forEach((chunk, index) => {
      userSections.push('');
      userSections.push(`[Exemplo ${index + 1}]`);
      userSections.push(chunk.content);
    });
  } else {
    userSections.push('');
    userSections.push('(nenhum exemplo relevante encontrado)');
  }

  userSections.push('');
  userSections.push('## Conversa atual:');
  userSections.push(historicoRecente || '(sem histórico anterior)');

  userSections.push('');
  userSections.push('## Mensagem do cliente agora:');
  userSections.push(mensagemAtual || '(sem mensagem atual identificada)');

  return {
    system: systemParts.join('\n'),
    user: userSections.join('\n'),
  };
}

export async function generateRagSuggestion(
  currentConversation: string,
  chunks: ConversationChunk[],
  bridge: MettriBridgeClient,
): Promise<string> {
  const trimmedConversation = currentConversation.trim();

  if (!trimmedConversation && chunks.length === 0) {
    throw new Error(
      'Não há conversa atual nem chunks de histórico para gerar sugestão de resposta RAG.',
    );
  }

  const apiKey = await getApiKey(bridge);
  if (!apiKey) {
    throw new Error(
      'Chave API OpenAI não configurada para RAG. Acesse as configurações e salve sua chave.',
    );
  }

  const { system, user } = buildRagPrompt(trimmedConversation, chunks);

  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.6,
    max_tokens: 400,
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
    throw new Error(`OpenAI ${result.status}: ${result.text}`);
  }

  const data = JSON.parse(result.text) as {
    choices?: { message?: { content?: string } }[];
  };

  const content = data.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error('OpenAI respondeu sem conteúdo para a sugestão RAG.');
  }

  return content;
}

