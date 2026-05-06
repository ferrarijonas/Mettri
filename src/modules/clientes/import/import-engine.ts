import { CanonicalClientSchema, type CanonicalClient } from './canonical';

export type ImportFileType = 'csv' | 'tsv' | 'xlsx' | 'json' | 'vcf' | 'unknown';

export interface ParsedTable {
  headers: string[];
  rows: string[][];
  delimiter?: string; // para csv/tsv
}

export type ImportFieldId =
  | 'phone'
  | 'phoneAlt'
  | 'fullName'
  | 'firstName'
  | 'lastName'
  | 'nickname'
  | 'addressFreeform'
  | 'email';

export type ImportMapping = Partial<Record<ImportFieldId, number | number[]>>;

function stripBom(text: string): string {
  if (text.charCodeAt(0) === 0xfeff) return text.slice(1);
  return text;
}

function countChar(str: string, ch: string): number {
  let n = 0;
  for (let i = 0; i < str.length; i++) if (str[i] === ch) n++;
  return n;
}

function normalizeHeader(header: string): string {
  // Normalização internacional: remove acentos e símbolos, vira minúsculo.
  return header
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function detectDelimiter(headerLine: string): string {
  const commas = countChar(headerLine, ',');
  const semis = countChar(headerLine, ';');
  const tabs = countChar(headerLine, '\t');
  // TSV internacional é comum.
  if (tabs >= semis && tabs >= commas) return '\t';
  if (semis > commas) return ';';
  return ',';
}

/**
 * Parser CSV/TSV mínimo com suporte a aspas duplas.
 * Metáfora: “não se perde quando tem vírgula dentro de aspas”.
 */
export function parseDelimitedLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        cur += '"';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && ch === delimiter) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }

  out.push(cur);
  return out.map(s => s.trim());
}

function parseDelimitedText(text: string): ParsedTable {
  const raw = stripBom(String(text || '').trim());
  const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseDelimitedLine(lines[0], delimiter).map(h => h.trim());
  const rows: string[][] = [];

  for (let i = 1; i < lines.length; i++) {
    rows.push(parseDelimitedLine(lines[i], delimiter));
  }

  return { headers, rows, delimiter };
}

async function readFileTextSmart(file: File): Promise<string> {
  // Tentativa 1: file.text() (UTF-8)
  const t = await file.text();
  const text = stripBom(t);

  // Heurística: se tiver muito caractere de substituição, tentar windows-1252
  const replacementCount = (text.match(/\uFFFD/g) || []).length;
  if (replacementCount >= 5) {
    try {
      const buf = await file.arrayBuffer();
      const decoded = new TextDecoder('windows-1252').decode(buf);
      return stripBom(decoded);
    } catch {
      return text;
    }
  }

  return text;
}

export function detectFileType(file: File): ImportFileType {
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.tsv')) return 'tsv';
  if (name.endsWith('.csv')) return 'csv';
  if (name.endsWith('.xlsx')) return 'xlsx';
  if (name.endsWith('.json')) return 'json';
  if (name.endsWith('.vcf')) return 'vcf';
  return 'unknown';
}

export function inferMappingFromHeaders(headers: string[]): {
  suggested: ImportMapping;
  normalizedHeaders: string[];
} {
  const normalizedHeaders = headers.map(normalizeHeader);

  const synonyms: Record<ImportFieldId, string[]> = {
    phone: [
      'phone',
      'telefone',
      'celular',
      'mobile',
      'whatsapp',
      'telefono',
      'tel',
      'contact phone',
      'numero',
      'number',
      'fone',
      'fone principal',
      'telefone principal',
    ],
    phoneAlt: [
      'phone alt',
      'telefone 2',
      'telefone alternativo',
      'celular 2',
      'telefono 2',
      'tel 2',
      'fone 2',
      'telefone secundario',
    ],
    email: ['email', 'e mail', 'correo', 'correo electronico', 'mail'],
    fullName: ['full name', 'nome completo', 'nombre completo', 'nom complet', 'customer', 'cliente', 'name'],
    firstName: ['first name', 'firstname', 'nome', 'given name', 'prenom', 'nombre'],
    lastName: ['last name', 'lastname', 'sobrenome', 'surname', 'apellido', 'nom de famille'],
    nickname: ['nickname', 'apelido', 'display name', 'fantasia', 'nome fantasia'],
    addressFreeform: ['address', 'endereco', 'endereco completo', 'direccion', 'adresse', 'logradouro', 'street'],
  };

  const scoreHeader = (hNorm: string, syn: string): number => {
    const s = normalizeHeader(syn);
    if (hNorm === s) return 100;
    if (hNorm.startsWith(s)) return 85;
    if (hNorm.includes(s)) return 75;
    return 0;
  };

  const used = new Set<number>();
  const pickBest = (field: ImportFieldId): number | null => {
    let bestIdx: number | null = null;
    let bestScore = 0;

    for (let i = 0; i < normalizedHeaders.length; i++) {
      if (used.has(i)) continue;
      const h = normalizedHeaders[i];
      for (const syn of synonyms[field]) {
        const sc = scoreHeader(h, syn);
        if (sc > bestScore) {
          bestScore = sc;
          bestIdx = i;
        }
      }
    }

    if (bestIdx != null && bestScore >= 75) {
      used.add(bestIdx);
      return bestIdx;
    }
    return null;
  };

  const suggested: ImportMapping = {};
  const phoneIdx = pickBest('phone');
  if (phoneIdx != null) suggested.phone = phoneIdx;

  // Telefone alternativo: segunda coluna de phone (ex.: Fone Principal quando Celular vazio)
  const phoneAltIdx = pickBest('phone');
  if (phoneAltIdx != null && phoneAltIdx !== phoneIdx) suggested.phoneAlt = phoneAltIdx;

  const fullNameIdx = pickBest('fullName');
  if (fullNameIdx != null) suggested.fullName = fullNameIdx;

  const firstIdx = pickBest('firstName');
  if (firstIdx != null) suggested.firstName = firstIdx;

  const lastIdx = pickBest('lastName');
  if (lastIdx != null) suggested.lastName = lastIdx;

  const nickIdx = pickBest('nickname');
  if (nickIdx != null) suggested.nickname = nickIdx;

  const addrIdx = pickBest('addressFreeform');
  if (addrIdx != null) suggested.addressFreeform = addrIdx;

  const emailIdx = pickBest('email');
  if (emailIdx != null) suggested.email = emailIdx;

  return { suggested, normalizedHeaders };
}

function pickCell(row: string[], idx: number | undefined): string {
  if (typeof idx !== 'number') return '';
  return String(row[idx] ?? '').trim();
}

/** Pega primeira célula não vazia de uma lista de colunas (fallback em cadeia). */
function pickFirstNonEmpty(row: string[], indices: (number | undefined)[]): string {
  for (const idx of indices) {
    const v = pickCell(row, idx);
    if (v) return v;
  }
  return '';
}

/** Prévia por campo mapeado: valores das primeiras N linhas para cada campo. */
export function getPreviewByMapping(params: {
  table: ParsedTable;
  mapping: ImportMapping;
  maxRows?: number;
}): Record<string, string[]> {
  const { table, mapping, maxRows = 5 } = params;
  const phoneIndices = [mapping.phone, mapping.phoneAlt].filter(
    (x): x is number => typeof x === 'number'
  );

  const fields: { id: ImportFieldId; label: string }[] = [
    { id: 'phone', label: 'Telefone' },
    { id: 'phoneAlt', label: 'Telefone 2 (fallback)' },
    { id: 'fullName', label: 'Nome completo' },
    { id: 'firstName', label: 'Nome' },
    { id: 'lastName', label: 'Sobrenome' },
    { id: 'nickname', label: 'Apelido' },
    { id: 'addressFreeform', label: 'Endereço' },
    { id: 'email', label: 'Email' },
  ];
  const out: Record<string, string[]> = {};
  for (const { id, label } of fields) {
    if (id === 'phone' && phoneIndices.length > 0) {
      const vals = table.rows
        .slice(0, maxRows)
        .map(r => pickFirstNonEmpty(r, phoneIndices).slice(0, 50))
        .filter(Boolean);
      out['Telefone'] = vals;
      continue;
    }
    if (id === 'phoneAlt') continue; // já incluso em Telefone
    const idx = mapping[id] as number | undefined;
    if (typeof idx !== 'number') {
      out[label] = [];
      continue;
    }
    const vals = table.rows
      .slice(0, maxRows)
      .map(r => String(r[idx] ?? '').trim().slice(0, 50))
      .filter(Boolean);
    out[label] = vals;
  }
  return out;
}

function splitMulti(value: string): string[] {
  const v = String(value || '').trim();
  if (!v) return [];
  return v
    .split(/[;,|/]\s*|\s{2,}|\n+/g)
    .map(s => s.trim())
    .filter(Boolean);
}

function digitsOnly(input: string): string {
  return String(input || '').replace(/\D+/g, '');
}

export function mapTableToCanonicalClients(params: {
  table: ParsedTable;
  mapping: ImportMapping;
  filename: string;
  importedAtIso: string;
  profileId?: string;
  maxRows?: number;
}): CanonicalClient[] {
  const { table, mapping, filename, importedAtIso, profileId } = params;
  const maxRows = params.maxRows ?? 50_000;

  const out: CanonicalClient[] = [];

  const phoneIndices = [mapping.phone, mapping.phoneAlt].filter(
    (x): x is number => typeof x === 'number'
  );

  for (let i = 0; i < table.rows.length && out.length < maxRows; i++) {
    const row = table.rows[i];

    const phoneRaw = pickFirstNonEmpty(row, phoneIndices);
    const phones = splitMulti(phoneRaw).map(raw => ({
      raw,
      digits: digitsOnly(raw) || undefined,
    }));

    const emailRaw = pickCell(row, mapping.email as number | undefined);
    const emails = splitMulti(emailRaw)
      .map(e => e.trim())
      .filter(e => e.includes('@'));

    const fullName = pickCell(row, mapping.fullName as number | undefined) || undefined;
    const firstName = pickCell(row, mapping.firstName as number | undefined) || undefined;
    const lastName = pickCell(row, mapping.lastName as number | undefined) || undefined;
    const nickname = pickCell(row, mapping.nickname as number | undefined) || undefined;
    const addressFreeform = pickCell(row, mapping.addressFreeform as number | undefined) || undefined;

    const canonical: CanonicalClient = CanonicalClientSchema.parse({
      fullName,
      firstName,
      lastName,
      nickname,
      phones,
      emails,
      addressFreeform,
      source: { filename, importedAtIso, profileId },
      confidence: {
        phone: phones.length > 0 ? 1 : 0,
        fullName: fullName ? 0.8 : 0,
        addressFreeform: addressFreeform ? 0.7 : 0,
      },
      raw: Object.fromEntries(table.headers.map((h, idx) => [h, row[idx] ?? ''])),
    });

    // Regra mínima: ignorar linha sem telefone e sem email (sem identidade)
    if (canonical.phones.length === 0 && canonical.emails.length === 0) continue;

    out.push(canonical);
  }

  return out;
}

export async function parseFileToTable(file: File): Promise<{ type: ImportFileType; table: ParsedTable }> {
  const type = detectFileType(file);

  if (type === 'csv' || type === 'tsv' || type === 'unknown') {
    const text = await readFileTextSmart(file);
    return { type: type === 'tsv' ? 'tsv' : 'csv', table: parseDelimitedText(text) };
  }

  if (type === 'xlsx') {
    // Lazy import do parser (não pesa no bundle normal)
    const mod = await import('./parsers/xlsx');
    const table = await mod.parseXlsxToTable(file);
    return { type, table };
  }

  if (type === 'json') {
    const text = await readFileTextSmart(file);
    const value = JSON.parse(text) as unknown;
    // MVP: JSON só se for array de objetos
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && value[0] != null) {
      const headers = Array.from(
        new Set(
          value.flatMap(v => Object.keys((v as Record<string, unknown>) ?? {}))
        )
      );
      const rows = value.map(v => headers.map(h => String((v as any)?.[h] ?? '')));
      return { type, table: { headers, rows } };
    }
    return { type, table: { headers: [], rows: [] } };
  }

  if (type === 'vcf') {
    // MVP: não implementado ainda (fica para fase posterior)
    return { type, table: { headers: [], rows: [] } };
  }

  return { type: 'unknown', table: { headers: [], rows: [] } };
}

