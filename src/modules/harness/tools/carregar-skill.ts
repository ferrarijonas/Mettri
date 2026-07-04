import { z } from 'zod';
import type { Tool } from '../types';
import { carregarSkill, formatarListaSkills } from '../skills/skill-registry';

/**
 * SkillTool — equivalente 1:1 ao `SkillTool` do Claude Code.
 *
 * Carrega uma skill registrada pelo nome e retorna seu corpo (procedimento).
 * O agente absorve o conhecimento da skill na conversa e o aplica usando
 * suas ferramentas normais (consultar_catalogo, enviar_mensagem, etc.).
 *
 * Ao contrário de outras tools, a SkillTool NÃO executa uma ação —
 * ela provê conhecimento procedural que o modelo usa nos turnos seguintes.
 */
export const carregarSkillTool: Tool = {
  nome: 'carregar_skill',
  descricao: `Carrega uma skill (procedimento especializado) que o agente deve seguir nos próximos turnos.

Skills disponíveis:
${formatarListaSkills()}

QUANDO USAR:
- Quando o agente detectar que a tarefa requer um procedimento específico (ex: retomar cliente inativo, campanha de marketing, suporte técnico)
- Quando o usuário pedir explicitamente para executar uma skill
- Quando o contexto da conversa indicar que um workflow especializado é necessário

QUANDO NÃO USAR:
- Para tarefas triviais que o agente já sabe fazer (saudar, responder pergunta simples, consultar catálogo)
- Se a skill já foi carregada neste turno

IMPORTANTE: Após carregar a skill, continue o loop normalmente. A skill contém instruções sobre COMO agir — use suas ferramentas (consultar_catalogo, enviar_mensagem, etc.) para executar as ações.`,
  categoria: 'leitura',
  tipo: 'delegacao',
  inputSchema: z.object({
    nome: z.string().describe('Nome da skill a carregar (ex: "retomar-clientes")'),
  }),
  soLeitura: true,
  precisaConfirmacao: false,

  executar: async (input) => {
    const { nome } = input as { nome: string };
    const skill = carregarSkill(nome);
    if (!skill) {
      const disponiveis = formatarListaSkills();
      return {
        sucesso: false,
        erro: `Skill "${nome}" não encontrada.\n\nDisponíveis:\n${disponiveis}`,
      };
    }

    return {
      sucesso: true,
      dados: {
        skill: {
          nome: skill.name,
          descricao: skill.description,
          corpo: skill.body,
        },
      },
    };
  },
};
