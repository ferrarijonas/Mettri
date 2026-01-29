/**
 * Resolve URLs de recursos da extensão no "world: MAIN".
 *
 * Metáfora: é o "endereço do aquário" (chrome-extension://<id>),
 * para buscar tinta (CSS/temas) sem cair no endereço da rua (web.whatsapp.com).
 */
export function getExtensionOrigin(): string | null {
  // Caminho feliz: API da extensão disponível
  const runtimeGetUrl = (globalThis as unknown as {
    chrome?: { runtime?: { getURL?: (path: string) => string } };
  }).chrome?.runtime?.getURL;

  if (runtimeGetUrl) {
    try {
      return new URL(runtimeGetUrl('')).origin;
    } catch {
      // fallback abaixo
    }
  }

  // Fallback 1: stack trace contém a origem da extensão
  const stack = new Error().stack ?? '';
  const originMatch = stack.match(/chrome-extension:\/\/[a-p]{32}/i);
  if (originMatch) return originMatch[0];

  // Fallback 2: procurar algum <script src="chrome-extension://...">
  try {
    for (const s of Array.from(document.scripts)) {
      const src = s.src;
      if (src && src.startsWith('chrome-extension://')) {
        return new URL(src).origin;
      }
    }
  } catch {
    // ignore
  }

  return null;
}

export function getExtensionResourceUrl(relativePath: string): string | null {
  const origin = getExtensionOrigin();
  if (!origin) return null;
  const cleanPath = relativePath.replace(/^\/+/, '');
  return `${origin}/${cleanPath}`;
}

