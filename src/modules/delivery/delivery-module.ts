/**
 * Módulo Delivery — Container de entregas
 *
 * Agrupa os submódulos relacionados a delivery:
 * - Dashboard com visão geral e cotação rápida
 * - Configuração de carriers (iFood, Bee Delivery, etc.)
 */
import type { ModuleDefinition } from '../../ui/core/module-registry';

export const DeliveryModule: ModuleDefinition = {
  id: 'delivery',
  name: 'Delivery',
  icon: '🚚',
  dependencies: [],
  defaultSubModuleId: 'delivery.dashboard',
  panelFactory: () => {
    throw new Error('DeliveryModule é apenas container, não tem UI própria.');
  },
  lazy: false,
};
