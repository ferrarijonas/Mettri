import type { CatalogoDashboardViewModel } from './view-model';

type ActionHandler = (actionId: string, payload?: unknown) => void;

export class CatalogoPanel {
  private container: HTMLElement | null = null;
  private vm: CatalogoDashboardViewModel | null = null;
  private onAction: ActionHandler | null = null;
  private searchQuery = '';
  private categoryFilter = 'Todos';

  constructor(params: { onAction?: ActionHandler } = {}) {
    this.onAction = params.onAction ?? null;
  }

  public async render(vm: CatalogoDashboardViewModel): Promise<HTMLElement> {
    this.vm = vm;
    const root = document.createElement('div');
    root.className = 'flex flex-col gap-2 text-[11px] leading-tight';
    this.container = root;
    this.renderContent();
    this.bindListeners();
    return root;
  }

  public destroy(): void {
    if (this.container) this.container.innerHTML = '';
    this.container = null;
    this.vm = null;
  }

  private renderContent(): void {
    if (!this.container || !this.vm) return;
    const produtosFiltrados = this.getFilteredProducts();
    const categorias = this.getCategoryChips();

    this.container.innerHTML = `
      <div class="flex items-center justify-between gap-2">
        <div class="text-xs font-semibold text-foreground">${this.escapeHtml(this.vm.title)}</div>
        <button
          type="button"
          class="h-8 px-3 rounded-xl bg-primary text-primary-foreground text-[11px] font-medium"
          data-action="produto:new"
        >
          Novo produto
        </button>
      </div>

      <div class="rounded-xl border border-border/30 bg-background px-2 py-2">
        <input
          type="search"
          value="${this.escapeAttr(this.searchQuery)}"
          placeholder="Buscar..."
          class="w-full h-8 rounded-xl border border-border/30 bg-secondary/10 px-2.5 text-[11px] text-foreground placeholder:text-muted-foreground"
          data-field="catalog-search"
        />
        <div class="mt-2 flex items-center gap-1 overflow-x-auto pb-1">
          ${categorias
            .map((categoria) => {
              const active = categoria === this.categoryFilter;
              const cls = active
                ? 'bg-primary text-primary-foreground border-primary/50'
                : 'bg-secondary/20 text-foreground border-border/30';
              return `
                <button
                  type="button"
                  class="h-7 px-2.5 rounded-full border text-[11px] whitespace-nowrap ${cls}"
                  data-action="catalog:filter-category"
                  data-category="${this.escapeAttr(categoria)}"
                >
                  ${this.escapeHtml(categoria)}
                </button>
              `;
            })
            .join('')}
        </div>
      </div>

      <div class="rounded-xl border border-border/30 bg-secondary/10 p-1.5">
        ${
          produtosFiltrados.length === 0
            ? `<div class="p-3 text-xs text-muted-foreground">Sem produtos ainda.</div>`
            : `
              ${produtosFiltrados
                .map(
                  (item) => `
                    <div class="rounded-xl border border-border/20 bg-background/60 px-2 py-1.5 mb-1.5">
                      <div class="grid grid-cols-[16px_1fr_auto] gap-1.5 items-center">
                        <input
                          type="checkbox"
                          class="h-3.5 w-3.5 rounded border-border/40"
                          data-action="produto:toggle"
                          data-produto-id="${this.escapeAttr(item.id)}"
                          ${item.ativo ? 'checked' : ''}
                          title="${item.ativo ? 'Produto ativo' : 'Produto inativo'}"
                        />
                        <input
                          type="text"
                          class="w-full min-w-0 h-7 rounded-lg border border-transparent bg-transparent px-1 text-[12px] leading-tight font-semibold text-foreground focus:border-border/30 focus:bg-background"
                          value="${this.escapeAttr(item.nome)}"
                          data-inline-field="nome"
                          data-produto-id="${this.escapeAttr(item.id)}"
                          title="Nome do produto"
                        />
                        <div class="flex items-center gap-1">
                          <span class="text-[9px] px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                            item.ativo ? 'bg-emerald-500/15 text-emerald-600' : 'bg-zinc-500/15 text-zinc-500'
                          }">
                            ${item.ativo ? 'Ativo' : 'Inativo'}
                          </span>
                          <button
                            type="button"
                            class="text-muted-foreground text-xs h-5 w-5 rounded-md hover:bg-secondary/40"
                            data-action="produto:menu"
                            data-produto-id="${this.escapeAttr(item.id)}"
                            title="Ações do produto"
                          >
                            ⋯
                          </button>
                        </div>
                      </div>

                      <div class="mt-1 grid grid-cols-3 gap-1.5 items-start">
                        <div class="min-w-0">
                          <div class="text-[9px] text-muted-foreground leading-none mb-0.5">Preco</div>
                          <div class="flex items-center gap-1 rounded-md border border-transparent px-1 focus-within:border-border/30 focus-within:bg-background">
                            <span class="text-[10px] font-semibold text-foreground">R$</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              class="w-full min-w-0 h-6 bg-transparent text-[12px] leading-none font-semibold text-foreground outline-none"
                              value="${this.escapeAttr((item.precoCentavos / 100).toFixed(2))}"
                              data-inline-field="precoCentavos"
                              data-produto-id="${this.escapeAttr(item.id)}"
                              title="Preço em reais"
                            />
                          </div>
                        </div>
                        <div class="min-w-0">
                          <div class="text-[9px] text-muted-foreground leading-none mb-0.5">Estoque</div>
                          <input
                            type="text"
                            class="w-full min-w-0 h-6 rounded-md border border-transparent bg-transparent px-1 text-[11px] text-foreground focus:border-border/30 focus:bg-background"
                            value="${item.estoqueDisponivel == null ? '' : this.escapeAttr(String(item.estoqueDisponivel))}"
                            data-inline-field="estoqueDisponivel"
                            data-produto-id="${this.escapeAttr(item.id)}"
                            placeholder="Sem controle"
                            title="Estoque (vazio/null = sem controle)"
                          />
                        </div>
                        <div class="min-w-0">
                          <div class="text-[9px] text-muted-foreground leading-none mb-0.5">Categoria</div>
                          <input
                            type="text"
                            class="w-full min-w-0 h-6 rounded-md border border-border/30 bg-secondary/15 px-1.5 text-[10px] text-foreground"
                            value="${this.escapeAttr(item.categoria)}"
                            data-inline-field="categoria"
                            data-produto-id="${this.escapeAttr(item.id)}"
                            placeholder="Categoria"
                            title="Categoria"
                          />
                        </div>
                      </div>
                    </div>
                  `,
                )
                .join('')}
            `
        }
      </div>
      <div class="text-[9px] text-muted-foreground">
        Dica rápida: clique no texto para editar. Enter ou sair do campo salva na hora.
      </div>
    `;
  }

  private bindListeners(): void {
    if (!this.container) return;

    const newBtn = this.container.querySelector('[data-action="produto:new"]') as HTMLButtonElement | null;
    newBtn?.addEventListener('click', () => this.onAction?.('produto:new'));

    const searchInput = this.container.querySelector('[data-field="catalog-search"]') as HTMLInputElement | null;
    searchInput?.addEventListener('input', () => {
      this.searchQuery = String(searchInput.value || '');
      this.renderContent();
      this.bindListeners();
    });

    const categoryButtons = Array.from(
      this.container.querySelectorAll('[data-action="catalog:filter-category"]'),
    ) as HTMLButtonElement[];
    categoryButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const category = btn.getAttribute('data-category');
        if (!category) return;
        this.categoryFilter = category;
        this.renderContent();
        this.bindListeners();
      });
    });

    const toggleButtons = Array.from(this.container.querySelectorAll('[data-action="produto:toggle"]')) as HTMLInputElement[];
    toggleButtons.forEach((btn) => {
      btn.addEventListener('change', () => {
        const produtoId = btn.getAttribute('data-produto-id');
        if (!produtoId) return;
        this.onAction?.('produto:toggle', { produtoId, ativo: btn.checked });
      });
    });

    const menuButtons = Array.from(this.container.querySelectorAll('[data-action="produto:menu"]')) as HTMLButtonElement[];
    menuButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const produtoId = btn.getAttribute('data-produto-id');
        if (!produtoId) return;
        const choice = window.prompt('Ações:\n1 - Duplicar\n2 - Excluir\n\nDigite 1 ou 2:');
        if (!choice) return;
        const normalized = choice.trim();
        if (normalized === '1') {
          this.onAction?.('produto:duplicate', { produtoId });
        } else if (normalized === '2') {
          this.onAction?.('produto:delete', { produtoId });
        }
      });
    });

    const inlineInputs = Array.from(this.container.querySelectorAll('[data-inline-field]')) as HTMLInputElement[];
    inlineInputs.forEach((input) => {
      const saveInline = (): void => {
        const produtoId = input.getAttribute('data-produto-id');
        const field = input.getAttribute('data-inline-field');
        if (!produtoId || !field) return;
        this.onAction?.('produto:update-inline', {
          produtoId,
          field,
          value: input.value,
        });
      };

      input.addEventListener('blur', saveInline);
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          saveInline();
        }
      });
    });
  }

  private escapeHtml(value: string): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private escapeAttr(value: string): string {
    return this.escapeHtml(value).replace(/"/g, '&quot;');
  }

  private getCategoryChips(): string[] {
    if (!this.vm) return ['Todos'];
    const fromProducts = this.vm.produtos
      .map((item) => item.categoria.trim())
      .filter(Boolean);
    const unique = Array.from(new Set(fromProducts)).sort((a, b) => a.localeCompare(b));
    return ['Todos', ...unique];
  }

  private getFilteredProducts(): CatalogoDashboardViewModel['produtos'] {
    if (!this.vm) return [];
    const query = this.searchQuery.trim().toLowerCase();
    return this.vm.produtos.filter((item) => {
      if (this.categoryFilter !== 'Todos' && item.categoria !== this.categoryFilter) return false;
      if (!query) return true;
      const haystack = `${item.nome} ${item.sku} ${item.categoria}`.toLowerCase();
      return haystack.includes(query);
    });
  }
}
