/**
 * env-config.ts — Parâmetros de ambiente do Mettri.
 *
 * @TODO: ler de chrome.storage.local (settings UI) quando existir.
 * @TODO: injetar via esbuild define (process.env.METTRI_*) quando houver build config.
 */
export interface EnvInfo {
  /** Nome do negócio (ex: "Pão de Verdade") */
  businessName: string
  /** Cidade do negócio (ex: "São Paulo") */
  city: string
  /** Fuso horário (ex: "America/Sao_Paulo") */
  timezone: string
  /** Versão do Mettri */
  version: string
  /** Nome do modelo (ex: "DeepSeek Chat") */
  modelName: string
  /** Ambiente: produção ou desenvolvimento */
  environment: 'production' | 'development'
}

const DEFAULTS: EnvInfo = {
  businessName: 'Pão de Verdade',
  city: 'Uberlândia',
  timezone: 'America/Sao_Paulo',
  version: '2.0.1',
  modelName: 'DeepSeek Chat',
  environment: 'development',
}

/** Retorna data/hora formatada no fuso do negócio */
export function getToday(timezone: string): string {
  try {
    const now = new Date()
    const diaSemana = now.toLocaleDateString('pt-BR', { timeZone: timezone, weekday: 'long' })
    const data = now.toLocaleDateString('pt-BR', { timeZone: timezone })
    return `${data} (${diaSemana})`
  } catch {
    return new Date().toLocaleDateString('pt-BR')
  }
}

export async function getEnvInfo(): Promise<EnvInfo> {
  const env = process.env.NODE_ENV === 'production' ? 'production' : 'development'
  return { ...DEFAULTS, environment: env }
}
