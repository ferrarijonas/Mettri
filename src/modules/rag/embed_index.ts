import { MettriBridgeClient } from '../../content/bridge-client';
import {
  EMBEDDING_DIMENSION,
  EMBEDDING_MAX_BATCH,
  EMBEDDING_MODEL,
} from './embedding-config';
import type { ConversationChunk } from './agrupar_por_turno';

const OPENAI_EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings';
const STORAGE_KEY_API = 'mettri:openai:apiKey';

// Limite de segurança para o tamanho do texto enviado em cada embedding.
// Metáfora: enviamos só o "resumo gordo" do turno, não o romance inteiro.
const EMBEDDING_MAX_CONTENT_CHARS = 8000;

export interface EmbedIndexItem {
  chunk: ConversationChunk;
  vector: number[];
}

export function sliceIntoBatches<T>(items: T[], maxBatchSize: number): T[][] {
  if (maxBatchSize <= 0) {
    throw new Error('maxBatchSize deve ser maior que 0');
  }

  const batches: T[][] = [];

  for (let i = 0; i < items.length; i += maxBatchSize) {
    batches.push(items.slice(i, i + maxBatchSize));
  }

  return batches;
}

export function validateEmbeddingDimensions(
  embeddings: number[][],
  expectedDimension: number,
): void {
  embeddings.forEach((embedding, index) => {
    if (!Array.isArray(embedding)) {
      throw new Error(`Embedding inválido no índice ${index}: não é um array`);
    }

    if (embedding.length !== expectedDimension) {
      throw new Error(
        `Embedding inválido no índice ${index}: dimensão esperada ${expectedDimension}, recebido ${embedding.length}`,
      );
    }
  });
}

export function zipChunksWithVectors(
  chunks: ConversationChunk[],
  vectors: number[][],
): EmbedIndexItem[] {
  if (chunks.length !== vectors.length) {
    throw new Error(
      `Quantidade de chunks (${chunks.length}) diferente da quantidade de vetores (${vectors.length})`,
    );
  }

  return chunks.map((chunk, index) => ({
    chunk,
    vector: vectors[index],
  }));
}

async function getApiKey(bridge: MettriBridgeClient): Promise<string> {
  try {
    const obj = await bridge.storageGet([STORAGE_KEY_API]);
    return typeof obj[STORAGE_KEY_API] === 'string' ? (obj[STORAGE_KEY_API] as string) : '';
  } catch {
    return '';
  }
}

export async function embed_index(
  chunks: ConversationChunk[],
  bridge: MettriBridgeClient,
): Promise<EmbedIndexItem[]> {
  if (!chunks.length) {
    return [];
  }

  const inputs = chunks.map((chunk) => {
    const raw = (chunk as any)?.content;
    const text =
      typeof raw === 'string'
        ? raw.trim()
        : String(raw ?? '').trim();
    if (text.length <= EMBEDDING_MAX_CONTENT_CHARS) {
      return text;
    }
    return text.slice(0, EMBEDDING_MAX_CONTENT_CHARS);
  });

  const apiKey = await getApiKey(bridge);
  if (!apiKey) {
    throw new Error('Chave API OpenAI não configurada para RAG.');
  }

  const batches = sliceIntoBatches(inputs, EMBEDDING_MAX_BATCH);
  const allEmbeddings: number[][] = [];

  for (const batchInputs of batches) {
    const body = {
      model: EMBEDDING_MODEL,
      input: batchInputs,
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
      data?: Array<{ embedding: number[]; index: number }>;
    };

    const embeddings = (data.data ?? []).map((item) => item.embedding);
    validateEmbeddingDimensions(embeddings, EMBEDDING_DIMENSION);

    allEmbeddings.push(...embeddings);
  }

  if (allEmbeddings.length !== chunks.length) {
    throw new Error(
      `Quantidade de vetores (${allEmbeddings.length}) diferente da quantidade de chunks (${chunks.length})`,
    );
  }

  return zipChunksWithVectors(chunks, allEmbeddings);
}

