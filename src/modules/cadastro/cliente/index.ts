export { persistirClienteOficial } from './persistir-cliente-oficial';
export { atualizarPerfilOperacionalCliente } from './atualizar-perfil-operacional-cliente';
export { fornecerFichaClienteParaAtendimento } from './fornecer-ficha-cliente-para-atendimento';
export { criarClienteContextoVitrine } from './cliente-contexto-vitrine-adapter';

export type {
  CadastroClienteResult,
  CadastroClienteErrorCode,
  CustomerOperationalSignals,
  PurchaseSummary,
  FichaClienteAtendimento,
  CampoConfianca,
  CamposConfianca,
  OuvinteCampos,
} from './types';

export type { PersistirClienteOficialInput, PersistirClienteOficialDeps } from './persistir-cliente-oficial';
export type {
  AtualizarPerfilOperacionalClienteInput,
  AtualizarPerfilOperacionalClienteDeps,
} from './atualizar-perfil-operacional-cliente';
export type { FornecerFichaClienteParaAtendimentoDeps } from './fornecer-ficha-cliente-para-atendimento';
export type { ClienteContextoVitrine } from './cliente-contexto-vitrine-adapter';
