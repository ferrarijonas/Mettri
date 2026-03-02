import type { EventBus } from './event-bus';

export const PANEL_NAVIGATE_EVENT = 'panel:navigate' as const;

export type PanelNavigatePayload = {
  moduleId: string;
};

function normalizeModuleId(moduleId: string): string {
  return moduleId.trim();
}

export function emitPanelNavigate(eventBus: EventBus, moduleId: string): void {
  const normalized = normalizeModuleId(moduleId);
  if (!normalized) return;
  eventBus.emit<PanelNavigatePayload>(PANEL_NAVIGATE_EVENT, { moduleId: normalized });
}

export function onPanelNavigate(
  eventBus: EventBus,
  handler: (data: PanelNavigatePayload) => void
): () => void {
  const wrapped = (data?: PanelNavigatePayload) => {
    if (!data || typeof data.moduleId !== 'string') return;
    const normalized = normalizeModuleId(data.moduleId);
    if (!normalized) return;
    handler({ moduleId: normalized });
  };

  eventBus.on<PanelNavigatePayload>(PANEL_NAVIGATE_EVENT, wrapped);
  return () => eventBus.off<PanelNavigatePayload>(PANEL_NAVIGATE_EVENT, wrapped);
}

