/**
 * DivulgarPanel (mock)
 *
 * Tela placeholder para o fluxo "Divulgar".
 */

export class DivulgarPanel {
  private container: HTMLElement | null = null;
  constructor() {}

  public async render(): Promise<HTMLElement> {
    const root = document.createElement('div');
    root.className = 'flex flex-col gap-3';
    this.container = root;

    root.innerHTML = `
      <div class="glass-subtle rounded-xl p-3">
        <div class="text-sm font-semibold text-foreground">Divulgar</div>
        <div class="text-xs text-muted-foreground mt-1">
          Mock: aqui ficará o fluxo de divulgar (campanha/aviso) com aprovação humana.
        </div>
      </div>

      <button
        type="button"
        class="w-full h-11 rounded-xl bg-primary text-primary-foreground font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        disabled
      >
        Enviar (mock)
      </button>
    `;

    return root;
  }

  public destroy(): void {
    if (this.container) this.container.innerHTML = '';
    this.container = null;
  }
}

