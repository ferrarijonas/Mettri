export function cosineSimilarity(a: number[], b: number[]): number {
  if (!Array.isArray(a) || !Array.isArray(b)) {
    throw new Error('cosineSimilarity requer dois arrays numéricos.');
  }

  if (a.length !== b.length) {
    throw new Error(
      `Vetores com dimensões diferentes: a.length=${a.length}, b.length=${b.length}`,
    );
  }

  if (a.length === 0) {
    throw new Error('cosineSimilarity requer vetores com pelo menos uma dimensão.');
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    const va = a[i] ?? 0;
    const vb = b[i] ?? 0;

    dot += va * vb;
    normA += va * va;
    normB += vb * vb;
  }

  if (normA === 0 || normB === 0) {
    // Vetor sem norma tem direção indefinida; aqui consideramos similaridade 0.
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

