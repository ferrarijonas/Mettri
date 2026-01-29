/**
 * Core UI - Exportações principais do sistema de módulos
 */

export { EventBus, type EventHandler } from './event-bus';
export { ModuleRegistry, type ModuleDefinition, type PanelInstance, type PanelFactory } from './module-registry';
export { PanelShell, type PanelShellConfig } from './panel-shell';
