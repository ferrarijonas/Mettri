/**
 * Monta o prompt de retomada a partir da skill canônica (`skills/retomar/SKILL.md`).
 *
 * A skill contém o procedimento de retomada (estilo Claude Code) e a seção
 * "Dados do Contato" com placeholders `{firstName}`, `{cycleIndex}`, etc.
 * `buildAgenteRetomarMessages()` substitui os placeholders e retorna
 * o prompt completo como system message.
 */

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

// ---------------------------------------------------------------------------
// Prompt fill
// ---------------------------------------------------------------------------

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
}

function substitute(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.split(`{${key}}`).join(value);
  }
  return out;
}

/**
 * Monta o prompt final para a API chat/completions.
 *
 * O system é o corpo da skill com os placeholders de dados substituídos.
 * O user é uma instrução mínima de ativação.
 */
export function buildAgenteRetomarMessages(
  skillBody: string,
  fill: AgenteRetomarPromptFill,
  fraseBase?: string,
): {
  system: string;
  user: string;
} {
  const relationLabel: Record<string, string> = {
    frequente: 'Frequente (quinzenal ou mensal)',
    pontual: 'Pontual (mensal ou bimestral)',
    sazonal: 'Sazonal (trimestral)',
    personalizado: 'Personalizado',
  };

  let system = substitute(skillBody, {
    firstName: fill.firstName.trim() || '(não informado)',
    cycleIndex: String(Math.min(4, Math.max(1, Math.floor(fill.cycleIndex)))),
    relationType: fill.relationType
      ? (relationLabel[fill.relationType] ?? fill.relationType)
      : '(não informado)',
    daysInactive: fill.daysInactive != null ? String(fill.daysInactive) : '(não informado)',
    lastRetomarSentText: fill.lastRetomarSentText.trim() || '(nenhuma ainda)',
    conversationThread: fill.conversationThread.trim() || '(sem histórico)',
    catalogo: fill.catalogo?.trim() || '(catálogo não disponível)',
  });

  if (fraseBase?.trim()) {
    system += `\n\nO usuário sugeriu este tom/base: ${fraseBase.trim()}. Use-a como inspiração, mas personalize com os dados do contato.`;
  }

  return { system, user: 'Gere a mensagem.' };
}

/** Rótulo para o cabeçalho Respostas Agênticas (usa o campo `name` do frontmatter da skill). */
export function formatSkillLabel(skillMeta: SkillMetadata): string {
  return `skill: ${skillMeta.name} · ${skillMeta.description.slice(0, 60)}`;
}

/** Rótulo estático para uso onde a skill ainda não foi carregada. */
export function formatRetomarSkillLabelStatic(): string {
  return 'skill: retomar-clientes';
}
