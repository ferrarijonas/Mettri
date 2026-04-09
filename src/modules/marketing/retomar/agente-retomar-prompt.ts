/**
 * Carrega e preenche o prompt baseline do agente Retomar (`prompts/agente_retomar.md`).
 */

import agenteRetomarRaw from '../../../../prompts/agente_retomar.md';

/** Só cabeçalhos markdown em linha própria (evita confundir com `**## USER**` no texto introdutório). */
const SECTION_HEADERS = /^## (SYSTEM|USER|OUTPUT)\s*$/gm;

export type AgenteRetomarPromptFill = {
  firstName: string;
  /** 1–4 (igual ao contador Retomar / retomarMeta.cycleIndex). */
  cycleIndex: number;
  /** Última mensagem do cliente; usada como guarda em `suggestRedacaoRetomar`. */
  lastIncomingFromClient: string;
  /** Texto da última retomar ou sentinela quando não houver. */
  lastRetomarSentText: string;
  /** Histórico recente intercalado para o modelo calibrar tom. */
  conversationThread: string;
};

/**
 * Extrai corpo das secções SYSTEM e USER (cabeçalho = linha exatamente `## NOME`).
 */
export function parseAgenteRetomarMarkdown(md: string): { system: string; userTemplate: string } {
  const headers: Array<{ name: string; headerStart: number; bodyStart: number }> = [];
  SECTION_HEADERS.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SECTION_HEADERS.exec(md)) !== null) {
    const name = m[1];
    let bodyStart = m.index + m[0].length;
    while (bodyStart < md.length && (md[bodyStart] === '\r' || md[bodyStart] === '\n')) {
      bodyStart++;
    }
    headers.push({ name, headerStart: m.index, bodyStart });
  }

  let system = '';
  let userTemplate = '';
  for (let i = 0; i < headers.length; i++) {
    const bodyStart = headers[i].bodyStart;
    const bodyEnd = i + 1 < headers.length ? headers[i + 1].headerStart : md.length;
    const body = md.slice(bodyStart, bodyEnd).trim();
    if (headers[i].name === 'SYSTEM') system = body;
    if (headers[i].name === 'USER') userTemplate = body;
  }

  if (!system || !userTemplate) {
    throw new Error(
      'agente_retomar.md: faltam secções ## SYSTEM ou ## USER em linha própria (ver topo do ficheiro)',
    );
  }

  return { system, userTemplate };
}

function substitute(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.split(`{${key}}`).join(value);
  }
  return out;
}

let cachedParsed: { system: string; userTemplate: string } | null = null;

function getParsed(): { system: string; userTemplate: string } {
  if (!cachedParsed) {
    cachedParsed = parseAgenteRetomarMarkdown(agenteRetomarRaw);
  }
  return cachedParsed;
}

/**
 * System + user já preenchidos para a API chat/completions.
 */
export function buildAgenteRetomarMessages(fill: AgenteRetomarPromptFill): {
  system: string;
  user: string;
} {
  const { system, userTemplate } = getParsed();
  const user = substitute(userTemplate, {
    firstName: fill.firstName.trim() || '(não informado)',
    cycleIndex: String(Math.min(4, Math.max(1, Math.floor(fill.cycleIndex)))),
    lastRetomarSentText: fill.lastRetomarSentText.trim() || '(nenhuma ainda)',
    conversationThread: fill.conversationThread.trim() || '(sem histórico)',
  });
  return { system, user };
}

/** Para testes: repor cache após alterar fixture. */
export function resetAgenteRetomarPromptCache(): void {
  cachedParsed = null;
}
