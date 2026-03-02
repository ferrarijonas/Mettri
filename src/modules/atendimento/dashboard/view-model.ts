/**
 * ViewModel do Atendimento (UI-first).
 *
 * Metáfora: é a "lista de ingredientes" pronta para cozinhar.
 * A UI só lê isso; não sabe de WhatsApp, DB, ou regras de negócio.
 */

export type AtendimentoViewModel =
  | {
      kind: 'noChat';
      title: string;
      hint: string;
    }
  | {
      kind: 'ready';
      demoBadge?: string;
      customer: {
        displayName: string;
        phoneLabel: string;
        chatId: string;
        clientKey?: string;
        phoneDigits?: string;
        badges: string[];
        hasCadastro: boolean;
      };
      kpis: Array<{ label: string; value: string }>;
      actions: Array<{ id: string; label: string; disabled?: boolean }>;
      products: Array<{ id: string; name: string; priceLabel: string; stockLabel?: string; offerText: string }>;
      offers: Array<{ id: string; title: string; subtitle?: string; text: string }>;
      orders: Array<{ id: string; title: string; subtitle: string; status: string }>;
      phrases: Array<{ id: string; label: string; text: string }>;
      notes: {
        value: string;
        placeholder: string;
      };
      retomar: {
        contador: number;
        etiquetas: Array<{
          id: string;
          name: string;
          isMember: boolean;
          isDefault: boolean;
          color: string;
          memberCount: number;
        }>;
      };
      lastPurchase: {
        purchaseId: string;
        purchaseDate: string;
        value: number | null;
        items: string[] | null;
        notes: string | null;
        source: 'MANUAL' | 'AI_DETECTED';
      } | null;
    };

