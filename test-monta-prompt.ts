/**
 * Verification script for montarPrompt
 * 
 * Run: npx tsx test-monta-prompt.ts
 * 
 * Tests:
 *   1. decisao:true with envInfo → full output verification
 *   2. decisao:false
 *   3. identidade:false
 */

import { montarPrompt } from './src/modules/ouvir/monta-prompt.js'
import type { EnvInfo } from './src/modules/harness/env-config.js'
import type { ContextoMemorias } from './src/modules/harness/memory-store.js'

// ── Test fixtures ──

const envInfo: EnvInfo = {
  businessName: 'Padaria Teste',
  city: 'São Paulo',
  timezone: 'America/Sao_Paulo',
  version: '2.0.1',
  modelName: 'DeepSeek Chat',
  environment: 'development',
}

const memorias: ContextoMemorias = {
  cliente: ['Prefere pão francês', 'Alérgico a glúten — cuidado'],
  licoes: ['Última entrega atrasou 2h'],
  negocio: ['Entregamos apenas no bairro Centro', 'Pedido mínimo R$ 20'],
  referencias: ['Concorrente X vende pão mais barato'],
  freshnessWarnings: [],
}

const catalogoCandidatos = ['Pão Francês', 'Pão Multigrãos', 'Brigadeiro', 'Coca-Cola']

// ── Helpers ──

function assert(cond: boolean, label: string): 'PASS' | 'FAIL' {
  if (cond) {
    console.log(`  ✅ ${label}`)
    return 'PASS'
  } else {
    console.log(`  ❌ ${label}`)
    return 'FAIL'
  }
}

function getSectionBetween(output: string, startMarker: string, endMarker?: string): string {
  const startIdx = output.indexOf(startMarker)
  if (startIdx === -1) return ''
  let endIdx: number
  if (endMarker) {
    endIdx = output.indexOf(endMarker, startIdx + startMarker.length)
    if (endIdx === -1) endIdx = output.length
  } else {
    endIdx = output.length
  }
  return output.substring(startIdx, endIdx)
}

function extractSectionName(text: string): string {
  // Extract the header line from a section (first non-empty line)
  const lines = text.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed) return trimmed
  }
  return ''
}

// ── Tests ──

let totalPass = 0
let totalFail = 0
const results: string[] = []

function runTest(name: string, fn: () => void) {
  console.log(`\n${'='.repeat(70)}`)
  console.log(`TEST: ${name}`)
  console.log(`${'='.repeat(70)}`)
  const passBefore = totalPass
  const failBefore = totalFail
  fn()
  const testPass = totalPass - passBefore
  const testFail = totalFail - failBefore
  results.push(`${name}: ${testPass}P/${testFail}F`)
}

// ────────────────────────────────────────────────
// TEST 1: decisao:true with envInfo (standard)
// ────────────────────────────────────────────────
runTest('1. Standard – decisao:true, identidade:true, envInfo provided', () => {
  const output = montarPrompt({
    identidade: true,
    decisao: true,
    mensagem: 'Quero 2 pães franceses',
    catalogoCandidatos,
    envInfo,
    today: '12/06/2026 (sexta-feira)',
    chatId: '5511999999999@c.us',
    memorias,
  })

  const sp = output.systemPrompt

  console.log('\n── SYSTEM PROMPT ──')
  console.log(sp)
  console.log('── END SYSTEM PROMPT ──\n')

  console.log('\n── USER PROMPT ──')
  console.log(output.userPrompt)
  console.log('── END USER PROMPT ──\n')

  // Assertion 1: Starts with identity line
  const startsWithIdentity = sp.startsWith('Você é a Mettri, atendente de IA para WhatsApp.')
  if (assert(startsWithWithIdentity, 'Starts with "Você é a Mettri, atendente de IA para WhatsApp."')) { totalPass++ } else { totalFail++ }

  // Assertion 2: Contains '# Sistema'
  const hasSistema = sp.includes('# Sistema')
  if (assert(hasSistema, 'Contains "# Sistema"')) { totalPass++ } else { totalFail++ }

  // Assertion 3: Contains '# Modo Atendente'
  const hasModoAtendente = sp.includes('# Modo Atendente')
  if (assert(hasModoAtendente, 'Contains "# Modo Atendente"')) { totalPass++ } else { totalFail++ }

  // Assertion 4: Contains '<ambiente>'
  const hasAmbiente = sp.includes('<ambiente>')
  if (assert(hasAmbiente, 'Contains "<ambiente>"')) { totalPass++ } else { totalFail++ }

  // Assertion 5: Order verification
  // Expected order: "Você é a Mettri..." > "# Sistema" > "# Modo Atendente" > "<ambiente>" > persona
  const idxIdentityPrefix = sp.indexOf('Você é a Mettri')
  const idxSistema = sp.indexOf('# Sistema')
  const idxModoAtendente = sp.indexOf('# Modo Atendente')
  const idxAmbiente = sp.indexOf('<ambiente>')
  const idxJonas = sp.indexOf('Você é Jonas') // persona mark

  const orderCorrect =
    idxIdentityPrefix < idxSistema &&
    idxSistema < idxModoAtendente &&
    idxModoAtendente < idxAmbiente &&
    idxAmbiente < idxJonas

  if (assert(orderCorrect, `Order: identity(${idxIdentityPrefix}) > #Sistema(${idxSistema}) > #ModoAtendente(${idxModoAtendente}) > <ambiente>(${idxAmbiente}) > persona(${idxJonas})`)) { totalPass++ } else { totalFail++ }

  // Assertion 6: sistema section does NOT contain 'Jonas', 'padaria', 'Pão de Verdade'
  const sistemaSection = getSectionBetween(sp, '# Sistema', '# Modo Atendente')
  const sistemaClean =
    !sistemaSection.toLowerCase().includes('jonas') &&
    !sistemaSection.toLowerCase().includes('padaria') &&
    !sistemaSection.toLowerCase().includes('pão de verdade')
  if (assert(sistemaClean, 'Sistema section does NOT contain Jonas/padaria/Pão de Verdade')) { totalPass++ } else { totalFail++ }

  // Assertion 7: modoAtendente section does NOT contain 'Jonas', 'padaria', 'Pão de Verdade'
  const modoSection = getSectionBetween(sp, '# Modo Atendente', '<ambiente>')
  const modoClean =
    !modoSection.toLowerCase().includes('jonas') &&
    !modoSection.toLowerCase().includes('padaria') &&
    !modoSection.toLowerCase().includes('pão de verdade')
  if (assert(modoClean, 'Modo Atendente section does NOT contain Jonas/padaria/Pão de Verdade')) { totalPass++ } else { totalFail++ }

  // Assertion 8: userPrompt contains expected data
  const userOk =
    output.userPrompt.includes('Quero 2 pães franceses') &&
    output.userPrompt.includes('CONVERSA ATUAL') &&
    output.userPrompt.includes('Pão Francês')
  if (assert(userOk, 'userPrompt contains message text, CONVERSA ATUAL, and catalog items')) { totalPass++ } else { totalFail++ }
})

// ────────────────────────────────────────────────
// TEST 2: decisao:false
// ────────────────────────────────────────────────
runTest('2. decisao:false – no decision section', () => {
  const output = montarPrompt({
    identidade: true,
    decisao: false,
    mensagem: 'Oi, tudo bem?',
    catalogoCandidatos: [],
    envInfo,
    today: '12/06/2026 (sexta-feira)',
    chatId: '5511999999999@c.us',
  })

  const sp = output.systemPrompt

  console.log('\n── SYSTEM PROMPT (decisao:false) ──')
  console.log(sp)
  console.log('── END ──\n')

  // Should still have the core sections
  if (assert(sp.startsWith('Você é a Mettri, atendente de IA para WhatsApp.'), 'Starts with identity prefix')) { totalPass++ } else { totalFail++ }
  if (assert(sp.includes('# Sistema'), 'Contains # Sistema')) { totalPass++ } else { totalFail++ }
  if (assert(sp.includes('# Modo Atendente'), 'Contains # Modo Atendente')) { totalPass++ } else { totalFail++ }
  if (assert(sp.includes('<ambiente>'), 'Contains <ambiente>')) { totalPass++ } else { totalFail++ }

  // Should NOT contain decision-specific content
  const hasDecisaoPhrase = sp.includes('Com base na mensagem do cliente, decida qual ferramenta chamar') ||
    sp.includes('ESCOLHA DE RESPOSTA') ||
    sp.includes('FERRAMENTAS DISPONÍVEIS')
  if (assert(!hasDecisaoPhrase, 'Does NOT contain decision-section content')) { totalPass++ } else { totalFail++ }

  // Must contain identidade (Jonas)
  if (assert(sp.includes('Você é Jonas'), 'Contains "Você é Jonas" (identidade)')) { totalPass++ } else { totalFail++ }
})

// ────────────────────────────────────────────────
// TEST 3: identidade:false
// ────────────────────────────────────────────────
runTest('3. identidade:false – no persona section', () => {
  const output = montarPrompt({
    identidade: false,
    decisao: true,
    mensagem: 'Quanto custa o pão?',
    catalogoCandidatos: ['Pão Francês'],
    envInfo,
    today: '12/06/2026 (sexta-feira)',
    chatId: '5511999999999@c.us',
  })

  const sp = output.systemPrompt

  console.log('\n── SYSTEM PROMPT (identidade:false) ──')
  console.log(sp)
  console.log('── END ──\n')

  // Core sections must still exist
  if (assert(sp.startsWith('Você é a Mettri, atendente de IA para WhatsApp.'), 'Starts with identity prefix')) { totalPass++ } else { totalFail++ }
  if (assert(sp.includes('# Sistema'), 'Contains # Sistema')) { totalPass++ } else { totalFail++ }
  if (assert(sp.includes('# Modo Atendente'), 'Contains # Modo Atendente')) { totalPass++ } else { totalFail++ }
  if (assert(sp.includes('<ambiente>'), 'Contains <ambiente>')) { totalPass++ } else { totalFail++ }

  // Should NOT contain "Você é Jonas" (persona identity)
  if (assert(!sp.includes('Você é Jonas'), 'Does NOT contain "Você é Jonas" (identidade disabled)')) { totalPass++ } else { totalFail++ }

  // Should NOT contain tom-de-voz persona content
  if (assert(!sp.includes('Não soar robótico'), 'Does NOT contain persona voice instructions')) { totalPass++ } else { totalFail++ }

  // BUT decision section may still contain "Jonas" reference (from decisao-sistema.md)
  const hasJonasInDecisao = sp.includes('Jonas')
  console.log(`  ℹ️  NOTE: decisao section may contain "Jonas" reference: ${hasJonasInDecisao}`)

  // sistema and modoAtendente still clean
  const sistemaSection = getSectionBetween(sp, '# Sistema', '# Modo Atendente')
  const sistemaClean =
    !sistemaSection.toLowerCase().includes('jonas') &&
    !sistemaSection.toLowerCase().includes('padaria') &&
    !sistemaSection.toLowerCase().includes('pão de verdade')
  if (assert(sistemaClean, 'Sistema section still clean')) { totalPass++ } else { totalFail++ }

  const modoSection = getSectionBetween(sp, '# Modo Atendente', '<ambiente>')
  const modoClean =
    !modoSection.toLowerCase().includes('jonas') &&
    !modoSection.toLowerCase().includes('padaria') &&
    !modoSection.toLowerCase().includes('pão de verdade')
  if (assert(modoClean, 'Modo Atendente section still clean')) { totalPass++ } else { totalFail++ }
})

// ────────────────────────────────────────────────
// SUMMARY
// ────────────────────────────────────────────────
console.log(`\n${'='.repeat(70)}`)
console.log('SUMMARY')
console.log(`${'='.repeat(70)}`)
for (const r of results) {
  console.log(`  ${r}`)
}
console.log(`\nTotal: ${totalPass} PASS, ${totalFail} FAIL`)
if (totalFail > 0) {
  console.log('\n❌ SOME TESTS FAILED')
  process.exit(1)
} else {
  console.log('\n✅ ALL TESTS PASSED')
}
