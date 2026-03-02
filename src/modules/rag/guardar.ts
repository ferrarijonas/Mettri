import type { EmbedIndexItem } from './embed_index';
import type { VectorIndex } from './vectorIndex';

export async function guardar(items: EmbedIndexItem[], index: VectorIndex): Promise<void> {
  if (!Array.isArray(items) || items.length === 0) {
    return;
  }

  await index.upsertMany(items);
}

