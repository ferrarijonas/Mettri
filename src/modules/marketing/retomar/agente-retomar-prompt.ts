/**
 * Carrega e preenche o prompt baseline do agente Retomar (`prompts/agente_retomar.md`).
 *
 * Se `skillContent` for fornecido em `AgenteRetomarPromptFill`, a seção SYSTEM
 * do `agente_retomar.md` é substituída pelo conteúdo da skill (`skills/retomar/SKILL.md`).
 * O template USER (placeholders) sempre vem do `agente_retomar.md`.
 */

import agenteRetomarRaw, {
  AGENTE_RETOMAR_PROMPT_LAST_MODIFIED_ISO,
} from '../../../../prompts/agente_retomar.md';

export { AGENTE_RETOMAR_PROMPT_LAST_MODIFIED_ISO };

// ---------------------------------------------------------------------------
// Skill parsing (formato Claude Code: YAML frontmatter entre --- + corpo markdown)
// ---------------------------------------------------------------------------

const SKILL_FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*\n/;

export interface SkillMetadata {
  name: string;
  description: string;
  whenToUse: string;
}

/**
 * Extrai YAML frontmatter e corpo de um arquivo SKILL.md no formato Claude Code.
 * Frontmatter esperado: name, description, whenToUse (todos strings simples).
 */
export function parseSkillMarkdown(md: string): { meta: SkillMetadata; body: string } {
  const m = SKILL_FRONTMATTER_RE.exec(md);
  if (!m) {
    throw new Error('SKILL.md: frontmatter YAML entre --- não encontrado');
  }

  const yamlBlock = m[1];
  const body = md.slice(m[0].length).trim();

  const meta: SkillMetadata = { name: '', description: '', whenToUse: '' };
  for (const line of yamlBlock.split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    if (key === 'name') meta.name = value;
    else if (key === 'description') meta.description = value;
    else if (key === 'whenToUse') meta.whenToUse = value;
  }

  if (!meta.name) {
    throw new Error('SKILL.md: campo "name" obrigatório no frontmatter');
  }

  return { meta, body };
}

/** Rótulo curto para o cabeçalho Respostas Agênticas (data do ficheiro no build). */
export function formatAgenteRetomarPromptUpdatedLabel(): string {
  const d = new Date(AGENTE_RETOMAR_PROMPT_LAST_MODIFIED_ISO);
  if (Number.isNaN(d.getTime())) return '';
  const when = d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  return `agente_retomar.md · atualizado ${when}`;
}

/** Só cabeçalhos markdown em linha própria (evita confundir com `**## USER**` no texto introdutório). */
const SECTION_HEADERS = /^## (SYSTEM|USER|OUTPUT)\s*$/gm;

export interface AgenteRetomarPromptFill {
  firstName: string;
  /** 1–4 (igual ao contador Retomar / retomarMeta.cycleIndex). */
  cycleIndex: number;
  /** Tipo de relação: frequente, pontual, sazonal, personalizado. */
  relationType?: string;
  /** Dias desde a última atividade do cliente. */
  daysInactive?: number;
  /** Última mensagem do cliente; usada como guarda em `suggestRedacaoRetomar`. */
  lastIncomingFromClient: string;
  /** Texto da última retomar ou sentinela quando não houver. */
  lastRetomarSentText: string;
  /** Histórico recente intercalado para o modelo calibrar tom. */
  conversationThread: string;
  /** Catálogo de produtos ativos formatado para o prompt (ex: "Pão Francês, Bolo de Chocolate"). */
  catalogo?: string;
  /**
   * Corpo da skill de retomada (`skills/retomar/SKILL.md`).
   * Se fornecido, substitui a seção SYSTEM do `agente_retomar.md`.
   * O template USER (placeholders) sempre vem do `agente_retomar.md`.
   */
  skillContent?: string;
}

/**
 * Extrai corpo das secções SYSTEM e USER (cabeçalho = linha exatamente `## NOME`).
 */
export function parseAgenteRetomarMarkdown(md: string): { system: string; userTemplate: string } {
  const headers: { name: string; headerStart: number; bodyStart: number }[] = [];
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
 *
 * Se `fill.skillContent` for fornecido, ele é usado como system prompt
 * (substitui a seção SYSTEM do `agente_retomar.md`).
 * O template USER sempre vem do `agente_retomar.md`.
 */
export function buildAgenteRetomarMessages(fill: AgenteRetomarPromptFill): {
  system: string;
  user: string;
} {
  const { userTemplate } = getParsed();

  const system = fill.skillContent?.trim()
    ? fill.skillContent.trim()
    : getParsed().system;

  const relationLabel: Record<string, string> = {
    frequente: 'Frequente (quinzenal ou mensal)',
    pontual: 'Pontual (mensal ou bimestral)',
    sazonal: 'Sazonal (trimestral)',
    personalizado: 'Personalizado',
  };

  const user = substitute(userTemplate, {
    firstName: fill.firstName.trim() || '(não informado)',
    cycleIndex: String(Math.min(4, Math.max(1, Math.floor(fill.cycleIndex)))),
    relationType: fill.relationType ? (relationLabel[fill.relationType] ?? fill.relationType) : '(não informado)',
    daysInactive: fill.daysInactive != null ? String(fill.daysInactive) : '(não informado)',
    lastRetomarSentText: fill.lastRetomarSentText.trim() || '(nenhuma ainda)',
    conversationThread: fill.conversationThread.trim() || '(sem histórico)',
    catalogo: fill.catalogo?.trim() || '(catálogo não disponível)',
  });
  return { system, user };
}

/** Para testes: repor cache após alterar fixture. */
export function resetAgenteRetomarPromptCache(): void {
  cachedParsed = null;
}
