import type { FichaClienteAtendimento } from './types';

export interface ClienteContextoVitrine {
  clienteId: string | null;
  nome: string | null;
  telefone: string | null;
  tags: string[];
  ultimaCompra: {
    data: string | null;
    valor: number | null;
    itens: string[] | null;
    origem: 'MANUAL' | 'AI_DETECTED' | null;
  };
  perfil: {
    segmento: string | null;
    confiancaPerfil: number | null;
    rfm: {
      recenciaDias: number | null;
      frequencia30d: number | null;
      monetario30d: number | null;
      bandaRecencia: string | null;
      bandaFrequencia: string | null;
      bandaMonetario: string | null;
      score: number | null;
    } | null;
  };
}

export function criarClienteContextoVitrine(ficha: FichaClienteAtendimento): ClienteContextoVitrine {
  const perfil = ficha.perfilOperacional;
  const rfm = perfil?.rfm;

  return {
    clienteId: ficha.cadastro?.clientKey || ficha.cadastro?.phoneDigits || null,
    nome: ficha.cadastro?.fullName || ficha.cadastro?.firstName || ficha.cadastro?.nickname || null,
    telefone: ficha.cadastro?.phoneDigits || null,
    tags: Array.isArray(perfil?.segmentos) ? perfil.segmentos : [],
    ultimaCompra: {
      data: ficha.ultimaCompra?.purchaseDateIso || null,
      valor: typeof ficha.ultimaCompra?.value === 'number' ? ficha.ultimaCompra.value : null,
      itens: ficha.ultimaCompra?.items || null,
      origem: ficha.ultimaCompra?.source || null,
    },
    perfil: {
      segmento: Array.isArray(perfil?.segmentos) && perfil.segmentos.length > 0 ? perfil.segmentos[0] : null,
      confiancaPerfil: typeof perfil?.confiancaPerfil === 'number' ? perfil.confiancaPerfil : null,
      // Vitrine consome RFM pronto; não recalcula aqui.
      rfm: rfm && typeof rfm === 'object'
        ? {
            recenciaDias: typeof (rfm as Record<string, unknown>).recenciaDias === 'number' ? ((rfm as Record<string, unknown>).recenciaDias as number) : null,
            frequencia30d: typeof (rfm as Record<string, unknown>).frequencia30d === 'number' ? ((rfm as Record<string, unknown>).frequencia30d as number) : null,
            monetario30d: typeof (rfm as Record<string, unknown>).monetario30d === 'number' ? ((rfm as Record<string, unknown>).monetario30d as number) : null,
            bandaRecencia: typeof (rfm as Record<string, unknown>).bandaRecencia === 'string' ? ((rfm as Record<string, unknown>).bandaRecencia as string) : null,
            bandaFrequencia: typeof (rfm as Record<string, unknown>).bandaFrequencia === 'string' ? ((rfm as Record<string, unknown>).bandaFrequencia as string) : null,
            bandaMonetario: typeof (rfm as Record<string, unknown>).bandaMonetario === 'string' ? ((rfm as Record<string, unknown>).bandaMonetario as string) : null,
            score: typeof (rfm as Record<string, unknown>).score === 'number' ? ((rfm as Record<string, unknown>).score as number) : null,
          }
        : null,
    },
  };
}
