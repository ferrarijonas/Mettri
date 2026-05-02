import type { MettriBridgeClient } from '../../content/bridge-client';
import {
  EMBEDDING_DIMENSION,
  EMBEDDING_MODEL,
} from './embedding-config';
import { validateEmbeddingDimensions } from './embed_index';

const OPENAI_EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings';
const STORAGE_KEY_API = 'mettri:openai:apiKey';

async function getApiKey(bridge: MettriBridgeClient): Promise<string> {
  try {
    const obj = await bridge.storageGet([STORAGE_KEY_API]);
    return typeof obj[STORAGE_KEY_API] === 'string' ? (obj[STORAGE_KEY_API] as string) : '';
  } catch {
    return '';
  }
}

export async function embed_consulta(
  conversationText: string,
  bridge: MettriBridgeClient,
): Promise<number[]> {
  const input = conversationText.trim();

  if (!input) {
    throw new Error('conversationText vazio para embed_consulta.');
  }

  const apiKey = await getApiKey(bridge);
  if (!apiKey) {
    throw new Error('Chave API OpenAI não configurada para RAG.');
  }

  const body = {
    model: EMBEDDING_MODEL,
    input: [input],
  };

  const result = await bridge.netFetch({
    url: OPENAI_EMBEDDINGS_URL,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!result.ok) {
    throw new Error(`OpenAI embeddings ${result.status}: ${result.text}`);
  }

  const data = JSON.parse(result.text) as {
    data?: { embedding: number[]; index: number }[];
  };

  const embeddings = (data.data ?? []).map((item) => item.embedding);

  if (!embeddings.length) {
    throw new Error('Resposta de embeddings vazia da OpenAI para embed_consulta.');
  }

  validateEmbeddingDimensions(embeddings, EMBEDDING_DIMENSION);

  const [queryVector] = embeddings;

  return queryVector;
}

