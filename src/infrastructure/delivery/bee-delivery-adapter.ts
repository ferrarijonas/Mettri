/**
 * Bee Delivery Adapter — Implementação real via API interna
 *
 * Usa as rotas Laravel do site www.beedelivery.com.br/central/
 * Requer sessão ativa no navegador (cookies bee_session + XSRF-TOKEN)
 *
 * Endpoints mapeados:
 *   POST /central/entregas/coleta/calcular  → cotação
 *   POST /central/entregas                   → criar entrega
 *   POST /central/entregas/cancelar          → cancelar
 *   GET  /central/entregas/entregasjson      → listar
 *   GET  /central/home                       → CSRF token
 *   GET  /central/google                     → geocode (place_id → lat/lng)
 *   GET  /central/googleAutoComplete         → autocomplete endereço
 *   GET  secservices/v1/company/balance/{id} → saldo
 */
import type { DeliveryAdapter } from './delivery-adapter';
import type {
  CotacaoParams,
  ResultadoCotacao,
  EntregaParams,
  ResultadoEntrega,
  StatusEntrega,
  EventoEntrega,
  DeliveryStatus,
} from '../../types/delivery';

const BEE_BASE = 'https://www.beedelivery.com.br/central';
const BEE_SALDO = 'https://secservices.beedelivery.com.br/api/v1/company/balance';

interface CotacaoResponse {
  total_empresa_taxa: string;
  saldoSuficiente: boolean;
  distancia: string;
  valor: string;
  vl_dinamica: string;
  total: string;
  valor_empresa: string;
  total_empresa: string;
}

interface CriarEntregaResponse {
  nextRequestToken: string;
  podeChamar: boolean;
}

interface EntregaJSON {
  id: string;
  uuid: string;
  status: string;
  valor: string;
  distancia: string;
  created_at: string;
  destino_descricao: string;
  // ... outros campos
}

export class BeeDeliveryAdapter implements DeliveryAdapter {
  id = 'bee-delivery' as const;
  nome = 'Bee Delivery';
  habilitado = false;

  // Configuração do usuário
  private originLatitude = '';
  private originLongitude = '';
  private empresaId = '';
  private franquiaId = '';
  private csrfToken: string | null = null;
  private csrfFetchedAt = 0;

  /**
   * Configura o adapter com os dados da empresa do usuário.
   */
  configurar(config: {
    originLatitude: string;
    originLongitude: string;
    empresaId?: string;
    franquiaId?: string;
  }): void {
    this.originLatitude = config.originLatitude;
    this.originLongitude = config.originLongitude;
    this.empresaId = config.empresaId || 'XXXXXX';
    this.franquiaId = config.franquiaId || '19';
    this.habilitado = true;
  }

  // ─── CSRF Token Management ───

  /**
   * Obtém o CSRF token da página home da Bee Delivery.
   * O token é extraído da meta tag <meta name="csrf-token">.
   * Requer que o usuário tenha sessão ativa no navegador.
   */
  private async obterCsrfToken(): Promise<string> {
    // Se já buscou há menos de 10 min, reusa
    if (this.csrfToken && Date.now() - this.csrfFetchedAt < 600000) {
      return this.csrfToken;
    }

    const resp = await fetch(`${BEE_BASE}/home`, {
      credentials: 'include',
      headers: { 'Accept': 'text/html' },
    });

    if (!resp.ok) {
      throw new Error(
        'Bee Delivery: não foi possível conectar. ' +
        'Certifique-se de que está logado em www.beedelivery.com.br no navegador.'
      );
    }

    const html = await resp.text();

    // Extrair CSRF token da meta tag
    const metaMatch = html.match(/<meta\s+name=["']csrf-token["']\s+content=["']([^"']+)["']/i);
    const token = metaMatch?.[1] || null;

    // Fallback: input hidden
    const inputMatch = html.match(/<input\s+type=["']hidden["']\s+name=["']_token["']\s+value=["']([^"']+)["']/i);
    const finalToken = token || inputMatch?.[1] || null;

    if (!finalToken) {
      throw new Error(
        'Bee Delivery: não foi possível obter o token CSRF. ' +
        'A sessão pode ter expirado. Faça login novamente em www.beedelivery.com.br.'
      );
    }

    this.csrfToken = finalToken;
    this.csrfFetchedAt = Date.now();
    return finalToken;
  }

  /**
   * Faz uma requisição autenticada para a API da Bee Delivery.
   */
  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const token = await this.obterCsrfToken();
    const url = path.startsWith('http') ? path : `${BEE_BASE}${path}`;

    const options: RequestInit = {
      method,
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'X-CSRF-TOKEN': token,
        'X-Requested-With': 'XMLHttpRequest',
      },
    };

    if (body) {
      options.headers = { ...options.headers, 'Content-Type': 'application/json' };
      options.body = JSON.stringify(body);
    }

    const resp = await fetch(url, options);

    // Se 419 (CSRF expirado), limpa token e tenta novamente uma vez
    if (resp.status === 419) {
      this.csrfToken = null;
      const newToken = await this.obterCsrfToken();
      options.headers = { ...options.headers as Record<string, string>, 'X-CSRF-TOKEN': newToken };
      const retryResp = await fetch(url, options);
      if (!retryResp.ok) {
        const text = await retryResp.text();
        throw new Error(`Bee Delivery: HTTP ${retryResp.status} — ${text.substring(0, 200)}`);
      }
      return retryResp.json();
    }

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Bee Delivery: HTTP ${resp.status} — ${text.substring(0, 300)}`);
    }

    return resp.json();
  }

  // ─── Geocoding (address → coordinates) ───

  /**
   * Busca coordenadas de um endereço usando o autocomplete da Bee Delivery.
   *
   * Primeiro tenta o autocomplete para obter place_id,
   * depois faz geocode para obter lat/lng.
   */
  async geocodificarEndereco(endereco: string): Promise<{ lat: string; lng: string; enderecoCompleto: string }> {
    // Passo 1: autocomplete
    const token = await this.obterCsrfToken();
    const autoUrl = `${BEE_BASE}/googleAutoComplete?input=${encodeURIComponent(endereco)}`;

    const autoResp = await fetch(autoUrl, {
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'X-CSRF-TOKEN': token,
        'X-Requested-With': 'XMLHttpRequest',
      },
    });

    if (!autoResp.ok) {
      throw new Error(`Bee Delivery: autocomplete falhou (HTTP ${autoResp.status})`);
    }

    const autoData = await autoResp.json() as { predictions?: Array<{ place_id: string; description: string }> };
    const predictions = autoData.predictions || [];

    if (predictions.length === 0) {
      throw new Error(`Bee Delivery: endereço não encontrado: "${endereco}"`);
    }

    // Usar o primeiro resultado
    const placeId = predictions[0].place_id;
    const enderecoCompleto = predictions[0].description;

    // Passo 2: geocode
    const geoUrl = `${BEE_BASE}/google?place_id=${placeId}`;
    const geoResp = await fetch(geoUrl, {
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'X-CSRF-TOKEN': token,
        'X-Requested-With': 'XMLHttpRequest',
      },
    });

    if (!geoResp.ok) {
      throw new Error(`Bee Delivery: geocode falhou (HTTP ${geoResp.status})`);
    }

    const geoData = await geoResp.json() as { data?: { lat: string | number; lng: string | number } };
    if (!geoData.data) {
      throw new Error('Bee Delivery: geocode não retornou dados');
    }

    return {
      lat: String(geoData.data.lat),
      lng: String(geoData.data.lng),
      enderecoCompleto,
    };
  }

  // ─── Saldo ───

  /**
   * Consulta o saldo atual da empresa.
   */
  async consultarSaldo(): Promise<number> {
    const url = `${BEE_SALDO}/${this.empresaId}/${this.franquiaId}`;
    const resp = await fetch(url, { credentials: 'include' });
    if (!resp.ok) throw new Error(`Bee Delivery: saldo HTTP ${resp.status}`);
    const data = await resp.json() as { saldo?: string | number };
    return Number(data.saldo || 0);
  }

  // ─── Taxa Dinâmica ───

  /**
   * Consulta a taxa dinâmica atual da Bee Delivery.
   *
   * A taxa dinâmica é um adicional variável baseado na demanda de entregadores
   * na região no momento (surge pricing).
   *
   * Endpoint: GET /central/entregas/dinamica/verificar
   * Resposta: { vl_dinamica: string, vl_dinamica_empresa: string }
   */
  async consultarTaxaDinamica(): Promise<{
    valorEmpresa: number;
    valorMotoboy: number;
    timestamp: string;
  }> {
    const token = await this.obterCsrfToken();
    const url = `${BEE_BASE}/entregas/dinamica/verificar`;

    const resp = await fetch(url, {
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'X-CSRF-TOKEN': token,
        'X-Requested-With': 'XMLHttpRequest',
      },
    });

    if (!resp.ok) {
      throw new Error(`Bee Delivery: taxa dinâmica HTTP ${resp.status}`);
    }

    const data = await resp.json() as {
      vl_dinamica?: string;
      vl_dinamica_empresa?: string;
    };

    return {
      valorEmpresa: Number(data.vl_dinamica_empresa) || 0,
      valorMotoboy: Number(data.vl_dinamica) || 0,
      timestamp: new Date().toISOString(),
    };
  }

  // ─── Implementação DeliveryAdapter ───

  /**
   * Cota frete com a Bee Delivery.
   *
   * Fluxo:
   * 1. Geocode do endereço de destino (se não tiver coordenadas)
   * 2. POST /central/entregas/coleta/calcular com coordenadas
   * 3. Retorna o valor calculado
   */
  async cotarFrete(params: CotacaoParams): Promise<ResultadoCotacao> {
    if (!this.habilitado) {
      throw new Error('Bee Delivery: configure o adapter antes de usar.');
    }

    // Obter coordenadas do destino
    let destLat: string;
    let destLng: string;

    if (params.destino.latitude && params.destino.longitude) {
      destLat = String(params.destino.latitude);
      destLng = String(params.destino.longitude);
    } else {
      // Montar endereço completo para geocode
      const enderecoStr = [
        params.destino.logradouro,
        params.destino.numero,
        params.destino.bairro,
        params.destino.cidade,
        params.destino.estado,
      ]
        .filter(Boolean)
        .join(', ');

      const geo = await this.geocodificarEndereco(enderecoStr);
      destLat = geo.lat;
      destLng = geo.lng;
    }

    // Chamar endpoint de cotação
    const result = await this.request<CotacaoResponse>('POST', '/entregas/coleta/calcular', {
      origem_latitude: this.originLatitude,
      origem_longitude: this.originLongitude,
      destino_latitude: destLat,
      destino_longitude: destLng,
      volta: 'N',
      sn_coleta: 'N',
      tipoTransporte: 'MB',
    });

    return {
      carrierId: 'bee-delivery',
      valorFrete: Number(result.total_empresa_taxa) || 0,
      prazoEstimadoMin: 20,
      prazoEstimadoMax: 60,
      moeda: 'BRL',
      validaAte: new Date(Date.now() + 300000).toISOString(),
    };
  }

  /**
   * Solicita uma entrega.
   *
   * Fluxo:
   * 1. Cota o frete primeiro (se não tiver valor)
   * 2. Gera request_token UUID
   * 3. POST /central/entregas com dados completos
   */
  async solicitarEntrega(params: EntregaParams): Promise<ResultadoEntrega> {
    if (!this.habilitado) {
      throw new Error('Bee Delivery: configure o adapter antes de usar.');
    }

    // Cotar frete para obter valor e distância
    const cotacaoParams: CotacaoParams = {
      origem: params.origem,
      destino: params.destino,
      items: params.items,
    };

    // Obter coordenadas do destino
    let destLat: string;
    let destLng: string;

    if (params.destino.latitude && params.destino.longitude) {
      destLat = String(params.destino.latitude);
      destLng = String(params.destino.longitude);
    } else {
      const enderecoStr = [
        params.destino.logradouro,
        params.destino.numero,
        params.destino.bairro,
        params.destino.cidade,
        params.destino.estado,
      ]
        .filter(Boolean)
        .join(', ');

      const geo = await this.geocodificarEndereco(enderecoStr);
      destLat = geo.lat;
      destLng = geo.lng;
    }

    const cotacao = await this.request<CotacaoResponse>('POST', '/entregas/coleta/calcular', {
      origem_latitude: this.originLatitude,
      origem_longitude: this.originLongitude,
      destino_latitude: destLat,
      destino_longitude: destLng,
      volta: 'N',
      sn_coleta: 'N',
      tipoTransporte: 'MB',
    });

    if (!cotacao.saldoSuficiente) {
      const saldo = await this.consultarSaldo();
      throw new Error(
        `Bee Delivery: saldo insuficiente (R$ ${saldo.toFixed(2)}). ` +
        `Frete: R$ ${cotacao.total_empresa_taxa}. Faça uma recarga.`
      );
    }

    // Montar endereço completo do destino
    const destinoDescricao = [
      params.destino.logradouro,
      params.destino.numero,
      params.destino.bairro,
      params.destino.cidade,
      params.destino.estado,
      params.destino.cep,
    ]
      .filter(Boolean)
      .join(', ');

    // Gerar request_token (UUID)
    const requestToken = crypto.randomUUID();

    // Criar entrega
    const createResult = await this.request<CriarEntregaResponse>('POST', '/entregas', {
      valor: cotacao.total_empresa_taxa,
      request_token: requestToken,
      colmeia_id: '',
      origem_latitude: this.originLatitude,
      origem_longitude: this.originLongitude,
      destino_latitude: destLat,
      destino_longitude: destLng,
      distancia: cotacao.distancia,
      qtd_enderecos: 1,
      sn_coleta: 'N',
      dataAgendamento: null,
      horaAgendamento: null,
      origem_descricao: '',
      destino_descricao: destinoDescricao,
      sn_agendada: 'N',
      entregador_id: null,
      origem_coleta: 'empresa',
      numero_origem: null,
      origem_complemento: '',
      destino_complemento: params.destino.complemento || '',
      volta: 'N',
      tipo_transporte_input: 'MB',
      tipo_compartimento_input: 'BAG',
      necessita_colmeia_input: 'SIM',
      sn_entregador_finalizar_coleta: 'S',
      cpf_entregador: null,
      entregador_alocado_por_cpf: null,
      obs: params.observacao || '',
      nome: params.contatoDestinatario?.nome || '',
      destino_telefones: params.contatoDestinatario?.telefone || '',
    });

    return {
      carrierId: 'bee-delivery',
      entregaId: createResult.nextRequestToken || requestToken,
      status: 'confirmed',
      valorFrete: Number(cotacao.total_empresa_taxa) || 0,
      prazoEstimado: 40,
      criadoEm: new Date().toISOString(),
    };
  }

  /**
   * Rastreia uma entrega.
   *
   * Lista as entregas via /central/entregas/entregasjson
   * e filtra pelo ID.
   */
  async rastrear(entregaId: string): Promise<StatusEntrega> {
    if (!this.habilitado) {
      throw new Error('Bee Delivery: configure o adapter antes de usar.');
    }

    const entregas = await this.request<EntregaJSON[]>('GET', '/entregas/entregasjson');

    const entrega = entregas.find(
      (e) => e.uuid === entregaId || e.id === entregaId
    );

    if (!entrega) {
      throw new Error(`Bee Delivery: entrega ${entregaId} não encontrada.`);
    }

    // Mapear status
    const statusMap: Record<string, DeliveryStatus> = {
      pendente: 'pending',
      aguardando: 'pending',
      aceita: 'pickup_route',
      coleta: 'picked_up',
      entregando: 'delivery_route',
      entregue: 'delivered',
      cancelada: 'canceled',
      devolvida: 'returned',
    };

    const eventos: EventoEntrega[] = [
      {
        timestamp: entrega.created_at,
        status: statusMap[entrega.status] || 'pending',
        descricao: `Entrega ${entrega.status}`,
      },
    ];

    return {
      carrierId: 'bee-delivery',
      entregaId: entrega.uuid || entrega.id,
      status: statusMap[entrega.status] || 'pending',
      historico: eventos,
    };
  }

  /**
   * Cancela uma entrega.
   *
   * POST /central/entregas/cancelar
   */
  async cancelar(entregaId: string, motivo: string): Promise<boolean> {
    if (!this.habilitado) {
      throw new Error('Bee Delivery: configure o adapter antes de usar.');
    }

    await this.request('POST', '/entregas/cancelar', {
      uuid: entregaId,
      motivo_cancelamento: motivo,
    });

    return true;
  }
}
