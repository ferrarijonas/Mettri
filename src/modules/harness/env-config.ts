/**
 * env-config.ts — Parâmetros de ambiente do Mettri.
 *
 * @TODO: ler de chrome.storage.local (settings UI) quando existir.
 * @TODO: injetar via esbuild define (process.env.METTRI_*) quando houver build config.
 */

export interface AmbienteNegocio {
  /** Nome do negócio (ex: "Empresa Exemplo") */
  businessName: string
  /** Cidade do negócio (ex: "São Paulo") */
  city: string
  /** Fuso horário (ex: "America/Sao_Paulo") */
  timezone: string
  /** Data formatada no fuso do negócio */
  today: string
  /** Horário de funcionamento (ex: "Seg-Sex 7h-19h, Sáb 7h-13h") */
  horarioFuncionamento: string
}

export interface AmbienteRuntime {
  /** Diretório de trabalho */
  directory: string
  /** Nome do modelo (ex: "DeepSeek Chat") */
  modelName: string
  /** Versão do Mettri */
  version: string
  /** Plataforma: win32, darwin, linux */
  platform: string
}

export interface EnvInfo {
  negocio: AmbienteNegocio
  runtime: AmbienteRuntime
}

const DEFAULTS: EnvInfo = {
  negocio: {
    businessName: 'Empresa Exemplo',
    city: 'Uberlândia',
    timezone: 'America/Sao_Paulo',
    today: '',
    horarioFuncionamento: 'Seg-Sex 7h-19h, Sáb 7h-13h',
  },
  runtime: {
    directory: '',
    modelName: 'DeepSeek Chat',
    version: '2.0.1',
    platform: '',
  },
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
  const today = getToday(DEFAULTS.negocio.timezone)
  return {
    negocio: {
      ...DEFAULTS.negocio,
      today,
    },
    runtime: {
      ...DEFAULTS.runtime,
      directory: process.cwd(),
      platform: process.platform,
    },
  }
}
