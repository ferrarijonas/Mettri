export interface CatalogoProdutoViewModel {
  id: string;
  sku: string;
  nome: string;
  categoria: string;
  precoCentavos: number;
  estoqueDisponivel: number | null;
  ativo: boolean;
}

export interface CatalogoDashboardViewModel {
  title: string;
  produtos: CatalogoProdutoViewModel[];
}
