export {};

declare global {
  interface Window {
    /** Ponte para o ShadowRoot do Mettri (quando UI está isolada). */
    __mettriShadowRoot?: ShadowRoot;
    /** Exposto apenas para debug no console. */
    ThemeLoader?: unknown;
  }
}

