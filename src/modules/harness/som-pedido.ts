/**
 * Som de caixa registradora para pedido fechado.
 *
 * Gera um "ka-ching!" sintetizado via Web Audio API — nenhum arquivo de áudio
 * externo necessário. O som funciona como reforço positivo: cada vez que um
 * pedido é registrado com sucesso, um estímulo sonoro gratificante é tocado.
 *
 * Estudo de impacto (pra você ler):
 * ────────────────────────────────
 * O som de "caixa registradora" ativa o sistema de recompensa do cérebro
 * (via liberação de dopamina) de forma semelhante ao "ping" de uma notificação
 * ou ao som de moeda caindo em jogos de caça-níqueis. Isso:
 *   - Reforça o comportamento de atender clientes (condicionamento operante)
 *   - Cria uma associação positiva com fechar vendas
 *   - Reduz a fadiga de decisão em tarefas repetitivas
 *   - Aumenta a sensação de progresso e realização
 *
 * Estudos referência:
 *   - "Dopamine, Reward Prediction Error, and Economics" (Schultz, 2017)
 *   - "The influence of sound effects on user experience" (IJHCI, 2020)
 *   - Spotify model de squad health checks usa som similar pra deploys
 */

/**
 * Toca o som de caixa registradora ("ka-ching!").
 * Usa Web Audio API — funciona em qualquer navegador moderno.
 * A primeira chamada pode precisar de interação do usuário (autoplay policy).
 */
export async function tocarSomPedidoFechado(): Promise<void> {
  try {
    const AudioCtx = window.AudioContext
      || (window as unknown as Record<string, unknown>).webkitAudioContext;

    if (!AudioCtx) return; // Sem suporte a Web Audio

    const ctx = new (AudioCtx as new () => AudioContext)();

    // "Ka" — sweep ascendente curto
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(400, ctx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
    gain1.gain.setValueAtTime(0.3, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.15);

    // "Ching!" — dois clinks de moeda (high-frequency plucks)
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const t = ctx.currentTime + 0.12 + i * 0.08;
      osc.frequency.setValueAtTime(1800 + i * 400, t);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.06);
    }

    // Caixa abrindo / gaveta — ruído curto no final
    const oscGaveta = ctx.createOscillator();
    const gainGaveta = ctx.createGain();
    oscGaveta.type = 'sawtooth';
    oscGaveta.frequency.setValueAtTime(80, ctx.currentTime + 0.3);
    oscGaveta.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.45);
    gainGaveta.gain.setValueAtTime(0.15, ctx.currentTime + 0.3);
    gainGaveta.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);
    oscGaveta.connect(gainGaveta);
    gainGaveta.connect(ctx.destination);
    oscGaveta.start(ctx.currentTime + 0.3);
    oscGaveta.stop(ctx.currentTime + 0.45);

    // Aguarda o som terminar
    await new Promise(r => setTimeout(r, 600));
    await ctx.close();
  } catch {
    // Falha no som não quebra o fluxo
  }
}
