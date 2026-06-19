/**
 * Registro de skills — equivalente ao SkillTool do Claude Code.
 *
 * Skills são conhecimento procedural injetado sob demanda no agente.
 * Diferente de tools, skills não executam ações — elas provêm instruções
 * que o agente absorve e aplica usando suas ferramentas normais.
 *
 * 1:1 com o padrão Claude Code: {@link https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/skills}
 */

// ---------------------------------------------------------------------------
// Parser de YAML frontmatter (formato Claude Code)
// ---------------------------------------------------------------------------

const SKILL_FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*\n/;

export interface SkillMeta {
  name: string;
  description: string;
  whenToUse: string;
}

export interface RegisteredSkill {
  name: string;
  description: string;
  whenToUse: string;
  body: string;
}

/** Extrai YAML frontmatter e corpo de um arquivo SKILL.md. */
function parseSkillMarkdown(md: string): { meta: SkillMeta; body: string } {
  const m = SKILL_FRONTMATTER_RE.exec(md);
  if (!m) {
    throw new Error('SKILL.md: frontmatter YAML entre --- não encontrado');
  }
  const yamlBlock = m[1];
  const body = md.slice(m[0].length).trim();

  const meta: SkillMeta = { name: '', description: '', whenToUse: '' };
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
// Registry
// ---------------------------------------------------------------------------

const skills: Map<string, RegisteredSkill> = new Map();

/**
 * Registra uma skill a partir do conteúdo raw do SKILL.md.
 * Chamado durante a inicialização do módulo, antes do AgentLoop.
 */
export function registrarSkill(raw: string): RegisteredSkill {
  const { meta, body } = parseSkillMarkdown(raw);
  const skill: RegisteredSkill = {
    name: meta.name,
    description: meta.description,
    whenToUse: meta.whenToUse,
    body,
  };
  skills.set(meta.name, skill);
  return skill;
}

/** Lista todas as skills registradas. */
export function listarSkills(): RegisteredSkill[] {
  return Array.from(skills.values());
}

/** Carrega o corpo de uma skill pelo nome. */
export function carregarSkill(nome: string): RegisteredSkill | undefined {
  return skills.get(nome);
}

/**
 * Formata a lista de skills para o campo `descricao` da tool `carregar_skill`.
 * Segue o formato do Claude Code: `- nome: descrição - whenToUse`.
 */
export function formatarListaSkills(): string {
  if (skills.size === 0) return '(nenhuma skill disponível)';
  return Array.from(skills.values())
    .map(s => `- ${s.name}: ${s.description} — ${s.whenToUse}`)
    .join('\n');
}
