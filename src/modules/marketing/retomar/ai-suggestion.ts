/**
 * Módulo de sugestão IA para o Retomar.
 *
 * Dado um Texto A (e contexto opcional de campanha/tipo de relação),
 * gera uma variação (Texto B) via OpenAI.
 *
 * Usa o MettriBridgeClient (storageGet + netFetch) para contornar o CSP
 * do WhatsApp Web e acessar chrome.storage.local do service worker.
 */

import { MettriBridgeClient } from '../../../content/bridge-client';
import {
  buildAgenteRetomarMessages,
  type AgenteRetomarPromptFill,
} from './agente-retomar-prompt';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';
const STORAGE_KEY_API = 'mettri:openai:apiKey';

async function getApiKey(bridge: MettriBridgeClient): Promise<string> {
  try {
    const obj = await bridge.storageGet([STORAGE_KEY_API]);
    return typeof obj[STORAGE_KEY_API] === 'string' ? (obj[STORAGE_KEY_API] as string) : '';
  } catch {
    return '';
  }
}

export async function suggestText(
  bridge: MettriBridgeClient,
  params: {
    text: string;
    campaign?: string;
    relationType?: string;
  },
): Promise<string> {
  const base = (params.text || '').trim();
  if (!base) return '';

  const apiKey = await getApiKey(bridge);
  if (!apiKey) {
    throw new Error('Chave API OpenAI não configurada. Acesse Cadastro > Mapear compras para salvar sua chave.');
  }

  const systemParts = [
    'Você é um copywriter especialista em mensagens de WhatsApp para reativação de clientes inativos.',
    'Receba um texto de mensagem (Texto A) e crie uma variação (Texto B) com tom, abordagem ou gatilho diferentes,',
    'mantendo o mesmo objetivo e tamanho similar.',
    'Responda APENAS com o texto da variação, sem explicações.',
  ];

  const userParts = [`Texto A:\n${base}`];
  if (params.campaign) {
    userParts.push(`\nContexto da campanha: ${params.campaign}`);
  }
  if (params.relationType) {
    userParts.push(`\nTipo de relação com o cliente: ${params.relationType}`);
  }
  userParts.push('\nGere o Texto B:');

  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: systemParts.join(' ') },
      { role: 'user', content: userParts.join('') },
    ],
    temperature: 1.1,
    top_p: 0.95,
    max_tokens: 300,
  };

  const result = await bridge.netFetch({
    url: OPENAI_URL,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!result.ok) {
    throw new Error(`OpenAI ${result.status}: ${result.text}`);
  }

  const data = JSON.parse(result.text) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('OpenAI respondeu sem conteúdo');

  return content;
}

/** Parâmetros do prompt em `prompts/agente_retomar.md`. */
export type { AgenteRetomarPromptFill };

/**
 * Gera texto de retomada com o prompt baseline (`prompts/agente_retomar.md`).
 */
export async function suggestRedacaoRetomar(
  bridge: MettriBridgeClient,
  params: AgenteRetomarPromptFill,
): Promise<string> {
  const incoming = (params.lastIncomingFromClient || '').trim();
  if (!incoming) return '';

  const apiKey = await getApiKey(bridge);
  if (!apiKey) {
    throw new Error('Chave API OpenAI não configurada. Acesse Cadastro > Mapear compras para salvar sua chave.');
  }

  const { system, user } = buildAgenteRetomarMessages(params);

  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 1.1,
    top_p: 0.95,
    max_tokens: 120,
  };

  const result = await bridge.netFetch({
    url: OPENAI_URL,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!result.ok) {
    throw new Error(`OpenAI ${result.status}: ${result.text}`);
  }

  const data = JSON.parse(result.text) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('OpenAI respondeu sem conteúdo');

  return content;
}
