import { EMBEDDING_DIMENSION } from './embedding-config';
import type { VectorIndex, VectorIndexQueryResult } from './vectorIndex';

export async function buscar(
  queryVector: number[],
  k: number,
  index: VectorIndex,
): Promise<VectorIndexQueryResult[]> {
  if (!Array.isArray(queryVector)) {
    throw new Error('queryVector deve ser um array numérico.');
  }

  if (queryVector.length !== EMBEDDING_DIMENSION) {
    throw new Error(
      `Dimensão inválida para queryVector: esperado ${EMBEDDING_DIMENSION}, recebido ${queryVector.length}.`,
    );
  }

  if (!Number.isInteger(k) || k <= 0) {
    throw new Error('k deve ser um inteiro maior ou igual a 1.');
  }

  return index.query(queryVector, k);
}

