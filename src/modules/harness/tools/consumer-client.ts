/**
 * consumer-client — cliente das tools para o gateway local do Consumer.
 *
 * A extensão não fala com o Firebird direto: chama o serviço local
 * (scripts/consumer-bridge) via bridge.netFetch. O gateway é somente-leitura,
 * fica em 127.0.0.1 e bloqueia origem de página web (só extensão/processo local).
 */
import { MettriBridgeClient } from '../../../content/bridge-client';

const bridge = new MettriBridgeClient(30000);

const URL_PADRAO = 'http://127.0.0.1:8765';

export async function consultarConsumer<T = unknown>(
  consulta: string,
  params: Record<string, string | number | undefined> = {},
): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }
  const full = `${URL_PADRAO}/q/${consulta}${qs.toString() ? `?${qs.toString()}` : ''}`;

  let res: { ok: boolean; status: number; text: string; location?: string };
  try {
    // Gateway local responde em ~1s; 8s de folga. Se o SW pendurar (loopback travado),
    // o bridge cai no fetch direto em vez de segurar o painel por 30s.
    res = await bridge.netFetch({ url: full, method: 'GET', swTimeoutMs: 8000 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'erro desconhecido';
    throw new Error(`consumer-bridge inacessível (${full}): ${msg}`);
  }

  if (!res.ok) {
    throw new Error(`consumer-bridge HTTP ${res.status}: ${res.text.slice(0, 200)}`);
  }

  const json = JSON.parse(res.text) as { ok: boolean; dados?: T; erro?: string };
  if (!json.ok) throw new Error(json.erro || 'erro no consumer-bridge');
  return json.dados as T;
}
