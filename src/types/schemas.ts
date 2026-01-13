import { z } from 'zod';

/**
 * Schemas Zod para validação de dados em runtime.
 * Este arquivo é a única definição de tipos para mensagens e seletores.
 * 
 * @see project_context.md seção 3.13.3 - integridade.validation
 */

/**
 * Schema para validação de mensagens capturadas.
 * Representa uma mensagem extraída do DOM do WhatsApp.
 */
export const CapturedMessageSchema = z.object({
  id: z.string().min(1, 'ID da mensagem não pode ser vazio'),
  chatId: z.string().min(1, 'ID do chat não pode ser vazio'),
  chatName: z.string().min(1, 'Nome do chat não pode ser vazio'),
  sender: z.string().min(1, 'Remetente não pode ser vazio'),
  text: z.string(),
  timestamp: z.date(),
  isOutgoing: z.boolean(),
  type: z.enum(['text', 'image', 'audio', 'video', 'document', 'sticker'], {
    errorMap: () => ({ message: 'Tipo de mensagem inválido' }),
  }),
});

/**
 * Tipo TypeScript inferido do schema CapturedMessageSchema.
 */
export type CapturedMessage = z.infer<typeof CapturedMessageSchema>;

/**
 * Schema para definição de um seletor individual.
 * Cada seletor tem uma cadeia de fallbacks (múltiplos seletores CSS).
 */
export const SelectorDefinitionSchema = z.object({
  id: z.string().min(1, 'ID do seletor não pode ser vazio'),
  description: z.string().min(1, 'Descrição do seletor não pode ser vazia'),
  selectors: z
    .array(z.string().min(1, 'Seletor CSS não pode ser vazio'))
    .min(1, 'Deve haver pelo menos um seletor na cadeia de fallback'),
  lastVerified: z.date().optional(),
  status: z.enum(['working', 'broken', 'unknown'], {
    errorMap: () => ({ message: 'Status do seletor inválido' }),
  }),
});

/**
 * Tipo TypeScript inferido do schema SelectorDefinitionSchema.
 */
export type SelectorDefinition = z.infer<typeof SelectorDefinitionSchema>;

/**
 * Schema para configuração completa de seletores.
 * Valida o arquivo selectors.json importado.
 */
export const SelectorsConfigSchema = z.object({
  version: z.string().min(1, 'Versão não pode ser vazia'),
  updatedAt: z.string().datetime({ message: 'updatedAt deve ser uma data ISO 8601 válida' }),
  selectors: z.record(SelectorDefinitionSchema, {
    errorMap: () => ({ message: 'Seletores devem ser um objeto válido' }),
  }),
});

/**
 * Tipo TypeScript inferido do schema SelectorsConfigSchema.
 */
export type SelectorsConfig = z.infer<typeof SelectorsConfigSchema>;

/**
 * Schema para entrada no IndexedDB.
 * Timestamp é armazenado como string ISO (não Date) para compatibilidade com IndexedDB.
 */
export const MessageDBEntrySchema = z.object({
  id: z.string().min(1, 'ID da mensagem não pode ser vazio'),
  chatId: z.string().min(1, 'ID do chat não pode ser vazio'),
  chatName: z.string().min(1, 'Nome do chat não pode ser vazio'),
  sender: z.string().min(1, 'Remetente não pode ser vazio'),
  text: z.string(),
  timestamp: z.string().datetime({ message: 'Timestamp deve ser uma data ISO 8601 válida' }),
  isOutgoing: z.boolean(),
  type: z.enum(['text', 'image', 'audio', 'video', 'document', 'sticker'], {
    errorMap: () => ({ message: 'Tipo de mensagem inválido' }),
  }),
});

/**
 * Tipo TypeScript inferido do schema MessageDBEntrySchema.
 */
export type MessageDBEntry = z.infer<typeof MessageDBEntrySchema>;

/**
 * Função helper para converter CapturedMessage para MessageDBEntry.
 * Converte Date para string ISO para armazenamento no IndexedDB.
 */
export function messageToDBEntry(message: CapturedMessage): MessageDBEntry {
  return {
    ...message,
    timestamp: message.timestamp.toISOString(),
  };
}

/**
 * Função helper para converter MessageDBEntry para CapturedMessage.
 * Converte string ISO para Date após recuperar do IndexedDB.
 */
export function dbEntryToMessage(entry: MessageDBEntry): CapturedMessage {
  return {
    ...entry,
    timestamp: new Date(entry.timestamp),
  };
}

/**
 * Schema para sessão de auto-mapeamento.
 * Representa uma sessão ativa de mapeamento de seletores.
 */
export const AutoMappingSessionSchema = z.object({
  id: z.string().min(1, 'ID da sessão não pode ser vazio'),
  startedAt: z.string().datetime({ message: 'startedAt deve ser uma data ISO 8601 válida' }),
  trigger: z.enum(['manual', 'auto', 'scheduled'], {
    errorMap: () => ({ message: 'Trigger inválido' }),
  }),
  status: z.enum(['active', 'validating', 'completed', 'failed'], {
    errorMap: () => ({ message: 'Status da sessão inválido' }),
  }),
  progress: z.number().min(0).max(100, 'Progresso deve estar entre 0 e 100'),
  targets: z.array(
    z.object({
      selectorId: z.string().min(1, 'ID do seletor não pode ser vazio'),
      element: z.any().nullable(), // HTMLElement não é serializável, aceita any
      coordinates: z
        .object({
          x: z.number(),
          y: z.number(),
        })
        .optional(),
      attempts: z.number().int().min(0, 'Tentativas deve ser um número inteiro não negativo'),
      status: z.enum(['pending', 'validating', 'success', 'failed'], {
        errorMap: () => ({ message: 'Status do target inválido' }),
      }),
    })
  ),
  results: z.array(
    z.object({
      selectorId: z.string().min(1, 'ID do seletor não pode ser vazio'),
      newSelector: z.string().min(1, 'Novo seletor não pode ser vazio'),
      validated: z.boolean(),
      validatedAt: z
        .string()
        .datetime({ message: 'validatedAt deve ser uma data ISO 8601 válida' })
        .optional(),
    })
  ),
});

/**
 * Tipo TypeScript inferido do schema AutoMappingSessionSchema.
 */
export type AutoMappingSession = z.infer<typeof AutoMappingSessionSchema>;

/**
 * Schema para resultado de auto-mapeamento.
 * Representa o resultado de mapear um seletor específico.
 */
export const AutoMappingResultSchema = z.object({
  sessionId: z.string().min(1, 'ID da sessão não pode ser vazio'),
  selectorId: z.string().min(1, 'ID do seletor não pode ser vazio'),
  oldSelector: z.string().min(1, 'Seletor antigo não pode ser vazio'),
  newSelector: z.string().min(1, 'Novo seletor não pode ser vazio'),
  validated: z.boolean(),
  validatedAt: z.string().datetime({ message: 'validatedAt deve ser uma data ISO 8601 válida' }),
  updatedRemote: z.boolean(),
  updatedAt: z
    .string()
    .datetime({ message: 'updatedAt deve ser uma data ISO 8601 válida' })
    .optional(),
});

/**
 * Tipo TypeScript inferido do schema AutoMappingResultSchema.
 */
export type AutoMappingResult = z.infer<typeof AutoMappingResultSchema>;
