/**
 * Analisa o arquivo de clientes para entender estrutura e por que linhas são puladas.
 * Uso: node scripts/analyze-client-import.mjs "Lista-Clientes 30-01-26 2052.xlsx"
 */
import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const fileName = process.argv[2] || 'Lista-Clientes 30-01-26 2052.xlsx';
const filePath = join(projectRoot, fileName);

function digitsOnly(input) {
  return String(input ?? '').replace(/\D+/g, '');
}

function analyze() {
  const buf = readFileSync(filePath);
  const wb = XLSX.read(buf, { type: 'buffer' });
  const sheetName = wb.SheetNames?.[0];
  const ws = wb.Sheets[sheetName];
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const rawHeaders = (aoa[0] || []).map(h => String(h ?? '').trim());
  const headers = rawHeaders.map((h, i) => h || `col_${i + 1}`);
  const rows = aoa.slice(1).filter(Array.isArray);

  console.log('=== ESTRUTURA DO ARQUIVO ===');
  console.log('Headers:', headers);
  console.log('Total de linhas (dados):', rows.length);
  console.log('');

  // Encontrar colunas por nome (case-insensitive, normalizado)
  const findCol = (names) => {
    for (const n of names) {
      const idx = headers.findIndex(h =>
        h.toLowerCase().replace(/\s+/g, ' ').includes(n.toLowerCase())
      );
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const phoneCol = findCol(['celular', 'telefone', 'phone', 'whatsapp', 'tel']);
  const fonePrincipalCol = findCol(['fone principal', 'telefone principal', 'phone principal']);
  const nameCol = findCol(['nome', 'name', 'cliente']);
  const emailCol = findCol(['email', 'e-mail', 'mail']);

  console.log('=== COLUNAS IDENTIFICADAS ===');
  console.log('Celular:', phoneCol >= 0 ? `col ${phoneCol} ("${headers[phoneCol]}")` : 'NÃO ENCONTRADA');
  console.log('Fone Principal:', fonePrincipalCol >= 0 ? `col ${fonePrincipalCol} ("${headers[fonePrincipalCol]}")` : 'NÃO ENCONTRADA');
  console.log('Nome:', nameCol >= 0 ? `col ${nameCol} ("${headers[nameCol]}")` : 'NÃO ENCONTRADA');
  console.log('Email:', emailCol >= 0 ? `col ${emailCol} ("${headers[emailCol]}")` : 'NÃO ENCONTRADA');
  console.log('');

  if (phoneCol < 0 && fonePrincipalCol < 0) {
    console.log('ERRO: Nenhuma coluna de telefone encontrada. Colunas:', headers.join(', '));
    return;
  }

  // Analisar Celular E Fone Principal
  const celularValues = rows.map(r => String(r[phoneCol] ?? '').trim());
  const fonePrincipalValues = fonePrincipalCol >= 0 ? rows.map(r => String(r[fonePrincipalCol] ?? '').trim()) : [];

  // Telefone "efetivo" = Celular OU Fone Principal (qual tiver valor)
  const phoneValues = celularValues.map((c, i) => c || (fonePrincipalValues[i] || ''));
  const emptyPhone = phoneValues.filter(v => !v).length;
  const withPhone = phoneValues.filter(v => v).length;

  console.log('=== ANÁLISE TELEFONE ===');
  console.log('Celular preenchido:', celularValues.filter(Boolean).length);
  if (fonePrincipalCol >= 0) {
    console.log('Fone Principal preenchido:', fonePrincipalValues.filter(Boolean).length);
    const onlyFonePrincipal = rows.filter((_, i) => !celularValues[i] && fonePrincipalValues[i]).length;
    console.log('Só Fone Principal (Celular vazio):', onlyFonePrincipal);
  }
  console.log('Total com telefone (Celular OU Fone Principal):', withPhone);
  console.log('Linhas sem telefone:', emptyPhone);

  const digitCounts = new Map();
  const formats = new Map();
  const samples = { empty: 0, short: [], ok: [], weird: [] };

  for (let i = 0; i < phoneValues.length; i++) {
    const raw = phoneValues[i];
    if (!raw) {
      samples.empty++;
      continue;
    }
    const digits = digitsOnly(raw);
    const len = digits.length;

    digitCounts.set(len, (digitCounts.get(len) || 0) + 1);

    // Detectar formato
    let fmt = 'outro';
    if (/^\d{10,13}$/.test(digits)) fmt = 'só_dígitos';
    else if (/^\+?\d[\d\s\-\(\)\.]+$/.test(raw)) fmt = 'formatado';
    else if (/^[\d\s\-\.\(\)]+$/.test(raw)) fmt = 'com_pontuação';
    formats.set(fmt, (formats.get(fmt) || 0) + 1);

    if (len < 8) samples.short.push({ row: i + 2, raw: raw.slice(0, 40), digits });
    else if (len >= 10 && len <= 15) samples.ok.push({ row: i + 2, raw: raw.slice(0, 40), digits });
    else samples.weird.push({ row: i + 2, raw: raw.slice(0, 40), digits });
  }

  console.log('\nDistribuição por quantidade de dígitos:');
  [...digitCounts.entries()].sort((a, b) => a[0] - b[0]).forEach(([len, count]) => {
    console.log(`  ${len} dígitos: ${count} linhas`);
  });

  console.log('\nFormatos detectados:');
  [...formats.entries()].forEach(([fmt, count]) => console.log(`  ${fmt}: ${count}`));

  console.log('\nAmostras (primeiras 5 de cada):');
  console.log('  Curto (<8 dígitos):', samples.short.slice(0, 5));
  console.log('  OK (10-15 dígitos):', samples.ok.slice(0, 5));
  console.log('  Estranho:', samples.weird.slice(0, 5));

  // Por que são pulados?
  let skipReasons = { empty: 0, noDigits: 0, tooShort: 0, noEmail: 0, wouldImport: 0 };
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const phoneRaw = phoneValues[i];
    const emailRaw = emailCol >= 0 ? String(row[emailCol] ?? '').trim() : '';
    const digits = digitsOnly(phoneRaw);
    const hasEmail = emailRaw.includes('@');

    if (!phoneRaw && !hasEmail) {
      skipReasons.empty++;
    } else if (phoneRaw && !digits) {
      skipReasons.noDigits++;
    } else if (digits && digits.length < 8 && !hasEmail) {
      skipReasons.tooShort++;
    } else if (digits.length >= 10 || hasEmail) {
      skipReasons.wouldImport++;
    } else {
      skipReasons.noEmail++;
    }
  }

  console.log('\n=== POR QUE SÃO PULADOS ===');
  console.log('Célula vazia (telefone+email):', skipReasons.empty);
  console.log('Tem texto mas sem dígitos:', skipReasons.noDigits);
  console.log('Poucos dígitos (<8) e sem email:', skipReasons.tooShort);
  console.log('SERIAM IMPORTADOS:', skipReasons.wouldImport);
  console.log('Outros:', skipReasons.noEmail);
}

try {
  analyze();
} catch (e) {
  console.error(e);
  process.exit(1);
}
