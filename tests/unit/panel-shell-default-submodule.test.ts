import { describe, it, expect } from 'vitest';
import { PanelShell } from '../../src/ui/core/panel-shell';
import { ModuleRegistry } from '../../src/ui/core/module-registry';
import { EventBus } from '../../src/ui/core/event-bus';

function createNoopPanelFactory() {
  return () => ({
    render() {
      // no-op
    },
  });
}

describe('PanelShell - defaultSubModuleId', () => {
  it('deve abrir o defaultSubModuleId quando o módulo é container', async () => {
    const registry = new ModuleRegistry();
    const eventBus = new EventBus();
    const container = document.createElement('div');

    registry.register({
      id: 'marketing.enviar',
      name: 'Enviar',
      parent: 'marketing',
      defaultSubModuleId: 'marketing.enviar.retomar',
      panelFactory: () => {
        throw new Error('container não deve renderizar');
      },
    });

    registry.register({
      id: 'marketing.enviar.divulgar',
      name: 'Divulgar',
      parent: 'marketing.enviar',
      panelFactory: createNoopPanelFactory(),
    });
    registry.register({
      id: 'marketing.enviar.retomar',
      name: 'Retomar',
      parent: 'marketing.enviar',
      panelFactory: createNoopPanelFactory(),
    });
    registry.register({
      id: 'marketing.enviar.responder',
      name: 'Responder',
      parent: 'marketing.enviar',
      panelFactory: createNoopPanelFactory(),
    });

    const shell = new PanelShell({ container, registry, eventBus });
    await shell.switchToModule('marketing.enviar');
    expect(shell.getCurrentModuleId()).toBe('marketing.enviar.retomar');
  });

  it('deve cair no primeiro filho quando não existe defaultSubModuleId', async () => {
    const registry = new ModuleRegistry();
    const eventBus = new EventBus();
    const container = document.createElement('div');

    registry.register({
      id: 'marketing.enviar',
      name: 'Enviar',
      parent: 'marketing',
      panelFactory: () => {
        throw new Error('container não deve renderizar');
      },
    });

    // Ordem alfabética por id: divulgar < retomar < responder
    registry.register({
      id: 'marketing.enviar.divulgar',
      name: 'Divulgar',
      parent: 'marketing.enviar',
      panelFactory: createNoopPanelFactory(),
    });
    registry.register({
      id: 'marketing.enviar.retomar',
      name: 'Retomar',
      parent: 'marketing.enviar',
      panelFactory: createNoopPanelFactory(),
    });

    const shell = new PanelShell({ container, registry, eventBus });
    await shell.switchToModule('marketing.enviar');
    expect(shell.getCurrentModuleId()).toBe('marketing.enviar.divulgar');
  });

  it('deve ignorar defaultSubModuleId inválido e cair no primeiro filho', async () => {
    const registry = new ModuleRegistry();
    const eventBus = new EventBus();
    const container = document.createElement('div');

    registry.register({
      id: 'marketing.enviar',
      name: 'Enviar',
      parent: 'marketing',
      defaultSubModuleId: 'marketing.enviar.inexistente',
      panelFactory: () => {
        throw new Error('container não deve renderizar');
      },
    });

    registry.register({
      id: 'marketing.enviar.divulgar',
      name: 'Divulgar',
      parent: 'marketing.enviar',
      panelFactory: createNoopPanelFactory(),
    });

    const shell = new PanelShell({ container, registry, eventBus });
    await shell.switchToModule('marketing.enviar');
    expect(shell.getCurrentModuleId()).toBe('marketing.enviar.divulgar');
  });
});

