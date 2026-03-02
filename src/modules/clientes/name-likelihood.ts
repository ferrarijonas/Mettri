export type NameHeuristicFlags = {
  hasLink: boolean;
  hasAt: boolean;
  endsWithDigit: boolean;
  tooShort: boolean;
  tooLong: boolean;
  tooFewLetters: boolean;
  tooManyDigits: boolean;
  tooManySymbols: boolean;
};

export type NameLikelihood = {
  cleaned: string;
  score: number; // 0..100
  flags: NameHeuristicFlags;
};

export type NameCandidateKind = 'person' | 'business' | 'noise';

export type ClassifiedNameCandidate =
  | { kind: 'noise'; cleaned: string; reason: string; personScore: number }
  | { kind: 'business'; cleaned: string; nickname: string; reason: string; personScore: number }
  | { kind: 'person'; cleaned: string; firstName: string; lastName?: string; personScore: number };

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function countMatches(str: string, re: RegExp): number {
  const m = str.match(re);
  return m ? m.length : 0;
}

/**
 * Limpa um nome candidato vindo do WhatsApp.
 * Metáfora: “passar um pano” antes de avaliar.
 */
export function cleanCandidateName(raw: string): string {
  return String(raw || '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasDigitInsideWord(cleaned: string): boolean {
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  return tokens.some(t => /\d/.test(t));
}

function looksLikeBusiness(cleaned: string, hints?: { isBusiness?: boolean; verifiedName?: string | null }): boolean {
  if (hints?.isBusiness === true) return true;
  if (hints?.verifiedName && String(hints.verifiedName).trim().length > 0) return true;

  const s = cleaned.toLowerCase();

  // Sinais fortes de empresa/negócio (PT-BR comum)
  if (/\b(ltda|mei|epp|me)\b/.test(s)) return true;
  if (/\b(consultoria|contabilidade|advocacia|imobili(a|á)ria|cl(i|í)nica|studio|est(ú|u)dio)\b/.test(s)) return true;
  if (/\b(casa\s+de|loja|delivery|restaurante|pizzaria|hamburgueria|farm(a|á)cia|padaria|a(ç|c)ougue|mercado|oficina|barbearia|sal(a|ã)o)\b/.test(s)) return true;

  // Padrões: underscores e “nome composto de marca”
  if (/[&/|]/.test(cleaned)) return true;

  return false;
}

function formatPersonToken(token: string): string {
  const t = token.trim();
  if (!t) return '';

  // Preservar siglas curtas (BC, MEI etc.) se vierem
  const isAllCaps = t.toUpperCase() === t && t.toLowerCase() !== t;
  if (isAllCaps && t.length <= 4) return t;

  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

function splitPersonNameConservative(cleaned: string): { firstName: string; lastName?: string } | null {
  // Token “pessoa”: só letras (unicode) com hífen/apóstrofo opcionais
  const personTokenRe = /^[\p{L}]+(?:[’'\-][\p{L}]+)*$/u;
  const connectors = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);

  const rawTokens = cleaned.split(/\s+/).map(t => t.trim()).filter(Boolean);
  const tokens = rawTokens.filter(t => personTokenRe.test(t) || connectors.has(t.toLowerCase()));

  // Primeiro token não pode ser conector
  const firstIdx = tokens.findIndex(t => !connectors.has(t.toLowerCase()));
  if (firstIdx < 0) return null;

  const firstName = formatPersonToken(tokens[firstIdx]);
  if (!firstName) return null;

  const rest = tokens.slice(firstIdx + 1);
  const lastParts: string[] = [];
  for (const t of rest) {
    const low = t.toLowerCase();
    if (connectors.has(low)) {
      // Só manter conector se já temos alguma coisa no sobrenome (evita começar com “de”)
      if (lastParts.length > 0) lastParts.push(low);
      continue;
    }
    lastParts.push(formatPersonToken(t));
  }

  const lastName = lastParts.join(' ').trim();
  return lastName ? { firstName, lastName } : { firstName };
}

/**
 * Heurística leve para “isso parece nome de pessoa?”
 *
 * Metáfora: uma peneira (não é cartório/IA).
 */
export function scoreLikelyPersonName(raw: string): NameLikelihood {
  const cleaned = cleanCandidateName(raw);

  const flags: NameHeuristicFlags = {
    hasLink: /https?:\/\/|www\.|\.com\b|\.net\b|\.br\b/i.test(cleaned),
    hasAt: /@/.test(cleaned),
    endsWithDigit: /\d$/.test(cleaned),
    tooShort: cleaned.length > 0 && cleaned.length < 2,
    tooLong: cleaned.length > 40,
    tooFewLetters: false,
    tooManyDigits: false,
    tooManySymbols: false,
  };

  // Contagens unicode-friendly
  const letters = countMatches(cleaned, /\p{L}/gu);
  const digits = countMatches(cleaned, /\d/g);
  const spaces = countMatches(cleaned, /\s/g);
  const total = cleaned.length;
  const symbols = total - letters - digits - spaces;

  flags.tooFewLetters = letters > 0 ? letters < 2 : true;
  flags.tooManyDigits = total > 0 ? digits / total >= 0.4 : false;
  flags.tooManySymbols = total > 0 ? symbols / total >= 0.35 : false;

  if (!cleaned) {
    return { cleaned: '', score: 0, flags };
  }

  // Base
  let score = 55;

  // Hard rejects
  if (flags.hasLink) score -= 60;
  if (flags.hasAt) score -= 45;
  if (flags.tooShort) score -= 40;
  if (flags.tooLong) score -= 20;
  if (flags.tooFewLetters) score -= 50;

  // Penalidades
  if (flags.endsWithDigit) score -= 35; // pega Ane2
  // Qualquer dígito dentro de palavra é um sinal forte de não-pessoa (ex.: PAO20SET)
  if (hasDigitInsideWord(cleaned)) score -= 35;
  if (flags.tooManyDigits) score -= 25;
  if (flags.tooManySymbols) score -= 25;

  // Palavras (muitas palavras tende a ser “assinatura”, não nome)
  const words = cleaned.split(' ').filter(Boolean);
  if (words.length >= 1 && words.length <= 4) score += 10;
  if (words.length > 5) score -= 20;

  // “Nome com letras” ganha um pouco
  if (letters >= 4) score += 10;

  score = clamp(score, 0, 100);
  return { cleaned, score, flags };
}

export function isLikelyPersonName(raw: string, minScore: number = 60): boolean {
  return scoreLikelyPersonName(raw).score >= minScore;
}

/**
 * Classifica um nome candidato em: pessoa, empresa ou ruído.
 * Metáfora: “três caixas” (Pessoa / Empresa / Rabisco).
 */
export function classifyNameCandidate(
  raw: string,
  hints?: { isBusiness?: boolean; verifiedName?: string | null }
): ClassifiedNameCandidate {
  const cleaned = cleanCandidateName(raw);
  if (!cleaned) return { kind: 'noise', cleaned: '', reason: 'empty', personScore: 0 };

  const scored = scoreLikelyPersonName(cleaned);
  const personScore = scored.score;

  // Ruído forte
  if (scored.flags.hasLink) return { kind: 'noise', cleaned, reason: 'hasLink', personScore };
  if (scored.flags.hasAt) return { kind: 'noise', cleaned, reason: 'hasAt', personScore };
  if (scored.flags.tooFewLetters) return { kind: 'noise', cleaned, reason: 'tooFewLetters', personScore };
  if (scored.flags.tooManySymbols) return { kind: 'noise', cleaned, reason: 'tooManySymbols', personScore };
  // Números dentro do “nome” quase sempre é ruído para pessoa.
  // Só tolerar se o WhatsApp disser que é business/verificado (aí vira Apelido).
  if (hasDigitInsideWord(cleaned) && !looksLikeBusiness(cleaned, hints)) {
    return { kind: 'noise', cleaned, reason: 'digitInsideWord', personScore };
  }

  // Empresa tem prioridade (quando há sinais), e você preferiu salvar como Apelido.
  if (looksLikeBusiness(cleaned, hints)) {
    return { kind: 'business', cleaned, nickname: cleaned, reason: 'business', personScore };
  }

  // Pessoa: bem conservador
  const person = splitPersonNameConservative(cleaned);
  if (person && personScore >= 55) {
    return { kind: 'person', cleaned, firstName: person.firstName, lastName: person.lastName, personScore };
  }

  // No nosso caso: na dúvida, não inventar (fica em branco).
  if (personScore < 55) {
    return { kind: 'noise', cleaned, reason: 'lowConfidence', personScore };
  }

  return { kind: 'noise', cleaned, reason: 'fallbackNoise', personScore };
}

