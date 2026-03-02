import { describe, it, expect } from 'vitest';
import type { ConversationChunk } from '../../../src/modules/rag';
import {
  sliceIntoBatches,
  validateEmbeddingDimensions,
  zipChunksWithVectors,
} from '../../../src/modules/rag';

function createChunk(id: string, content: string): ConversationChunk {
  return {
    id,
    schemaVersion: '1.0',
    content,
    chatId: 'chat-1',
    timestamp: new Date('2026-01-01T10:00:00Z').toISOString(),
    messageIds: [id],
    turnSize: {
      client: 1,
      agent: 1,
    },
  };
}

describe('embed_index helpers (RAG)', () => {
  describe('sliceIntoBatches', () => {
    it('array vazio retorna []', () => {
      const result = sliceIntoBatches([], 10);
      expect(result).toEqual([]);
    });

    it('retorna único batch quando tamanho é menor que o limite', () => {
      const input = [1, 2, 3];
      const result = sliceIntoBatches(input, 10);
      expect(result).toEqual([[1, 2, 3]]);
    });

    it('fatia em vários batches respeitando EMBEDDING_MAX_BATCH', () => {
      const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const result = sliceIntoBatches(input, 4);
      expect(result).toEqual([
        [1, 2, 3, 4],
        [5, 6, 7, 8],
        [9, 10],
      ]);
    });
  });

  describe('validateEmbeddingDimensions', () => {
    it('não lança erro quando todas as dimensões estão corretas', () => {
      const embeddings = [
        [1, 2, 3],
        [4, 5, 6],
      ];

      expect(() => validateEmbeddingDimensions(embeddings, 3)).not.toThrow();
    });

    it('lança erro quando alguma dimensão está incorreta', () => {
      const embeddings = [
        [1, 2, 3],
        [4, 5],
      ];

      expect(() => validateEmbeddingDimensions(embeddings, 3)).toThrowError(
        /dimensão esperada 3, recebido 2/,
      );
    });
  });

  describe('zipChunksWithVectors', () => {
    it('faz o zip preservando a ordem dos chunks', () => {
      const chunks: ConversationChunk[] = [
        createChunk('c1', 'texto 1'),
        createChunk('c2', 'texto 2'),
      ];
      const vectors = [
        [0.1, 0.2],
        [0.3, 0.4],
      ];

      const result = zipChunksWithVectors(chunks, vectors);

      expect(result).toHaveLength(2);
      expect(result[0].chunk).toBe(chunks[0]);
      expect(result[0].vector).toEqual([0.1, 0.2]);
      expect(result[1].chunk).toBe(chunks[1]);
      expect(result[1].vector).toEqual([0.3, 0.4]);
    });

    it('lança erro quando o número de chunks e vetores é diferente', () => {
      const chunks: ConversationChunk[] = [createChunk('c1', 'texto 1')];
      const vectors = [
        [0.1, 0.2],
        [0.3, 0.4],
      ];

      expect(() => zipChunksWithVectors(chunks, vectors)).toThrowError(
        /Quantidade de chunks \(1\) diferente da quantidade de vetores \(2\)/,
      );
    });
  });
});

