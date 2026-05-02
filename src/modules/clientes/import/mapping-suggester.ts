import type { ImportMapping, ParsedTable } from './import-engine';
import { inferMappingFromHeaders } from './import-engine';
import { MettriBridgeClient } from '../../../content/bridge-client';

export interface MappingSuggestion {
  mapping: ImportMapping;
  confidence: number; // 0..1
  reason: string;
}

export interface MappingSuggester {
  suggest(table: ParsedTable): Promise<MappingSuggestion | null>;
}

/**
 * Sugestor local (sem rede).
 * Metáfora: “palpite rápido” baseado no cabeçalho.
 */
export class LocalHeuristicsSuggester implements MappingSuggester {
  async suggest(table: ParsedTable): Promise<MappingSuggestion | null> {
    if (!table.headers || table.headers.length === 0) return null;
    const { suggested } = inferMappingFromHeaders(table.headers);
    const hasIdentity =
      typeof suggested.phone === 'number' ||
      typeof suggested.phoneAlt === 'number' ||
      typeof suggested.email === 'number';
    return {
      mapping: suggested,
      confidence: hasIdentity ? 0.7 : 0.3,
      reason: 'local-heuristics',
    };
  }
}

/**
 * Stub para MCP (futuro).
 * Metáfora: “consultar um tradutor externo”.
 *
 * Nesta base, não há um MCP de LLM configurado; então devolve null.
 */
export class McpSuggester implements MappingSuggester {
  constructor(
    private options: {
      enabled: boolean;
      // no futuro: serverName, toolName, etc.
    } = { enabled: false }
  ) {}

  async suggest(table: ParsedTable): Promise<MappingSuggestion | null> {
    if (!this.options.enabled) return null;
    if (!table.headers || table.headers.length === 0) return null;

    const bridge = new MettriBridgeClient(8000);
    const cfg = await bridge.storageGet(['mettri_import_mcp_url', 'mettri_import_mcp_secret']);
    const baseUrl = typeof cfg.mettri_import_mcp_url === 'string' ? cfg.mettri_import_mcp_url : '';
    const secret = typeof cfg.mettri_import_mcp_secret === 'string' ? cfg.mettri_import_mcp_secret : '';
    if (!baseUrl || !secret) return null;

    const sampleRows = (table.rows || []).slice(0, 20);
    const payload = {
      secret,
      headers: table.headers,
      sampleRows,
    };

    const res = await bridge.netFetch({
      url: `${baseUrl.replace(/\/+$/, '')}/api/import/suggest-mapping`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) return null;

    let json: any;
    try {
      json = JSON.parse(res.text);
    } catch {
      return null;
    }

    const mapping = (json?.mapping ?? json?.result?.mapping ?? json?.suggestion?.mapping) as unknown;
    if (!mapping || typeof mapping !== 'object') return null;

    // Normalizar para ImportMapping (apenas números)
    const normalized: ImportMapping = {};
    for (const [k, v] of Object.entries(mapping as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v)) {
        (normalized as any)[k] = v;
      }
    }

    const hasAny = Object.keys(normalized).length > 0;
    return hasAny
      ? {
          mapping: normalized,
          confidence: typeof json?.confidence === 'number' ? json.confidence : 0.8,
          reason: 'mcp-worker',
        }
      : null;
  }
}

