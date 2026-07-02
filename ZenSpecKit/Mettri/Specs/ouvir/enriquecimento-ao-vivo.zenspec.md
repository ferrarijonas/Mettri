---
status: obsoleto
---

# Mostrar enriquecimento ao vivo no painel de atendimento

>Programa que reage ao evento `ouvir:profile-updated` e atualiza a UI do painel de atendimento em tempo real.

## 1. Propósito

Esta feature existe para que o atendente veja, em tempo real durante o atendimento, os campos do perfil do cliente sendo preenchidos pelo Ouvinte — sem precisar trocar de tela — com feedback visual que mostra o que mudou e quando.

---

## 2. Conceito

O Ouvinte processa mensagens do cliente e persiste no `CustomerProfileDB`. O painel `AtendimentoPanel` (dashboard do módulo atendimento) exibe esses dados na seção "Perfil Ouvinte" dentro do cartão do cliente, mas só atualiza quando o chat muda.

O enriquecimento ao vivo conecta esses dois mundos: quando o Ouvinte termina de processar uma mensagem, emite um evento no EventBus. O módulo do Atendimento escuta, recarrega o perfil e aplica animação nos campos que mudaram — tudo dentro do painel onde o atendente já está trabalhando.

---

## 3. Pipeline & fluxos

```
ouvinte (persistiu)  →  eventBus.emit('ouvir:profile-updated')  →  DashboardModule  →  rerender()  →  AtendimentoPanel  →  UI atualizada
```

| Programa | Recebe | Faz | Manda para |
| -------- | ------ | --- | ---------- |
| `DashboardModule` | evento `ouvir:profile-updated` | Aciona `rerender()` com campos atualizados | `AtendimentoPanel.render(vm)` |
| `AtendimentoPanel` | ViewModel com `updatedFields` | Renderiza campos com animação e badges | — (UI local) |

---

## 4. Lógica

### 4.1 Evento: `ouvir:profile-updated`

**Emitido por:** `ouvinte.ts` após chamar `atualizarPerfilOperacionalCliente` com sucesso.

```typescript
interface OuvirProfileUpdatedEvent {
  chatId: string
  camposAtualizados: string[]   // ["preferenciasProduto", "enderecoEntrega"]
  confiancaPerfil: number       // 0.0 - 1.0
}
```

**Condições de emissão:**
- **Se** `atualizarPerfilOperacionalCliente` retornou `ok: true` **então** emitir evento com sucesso.
- **Se** a chamada falhou (throttle, cursor, erro) **então** não emitir evento.

### 4.2 Recepção no DashboardModule

**Quando o módulo recebe o evento:**
1. **Se** `data.chatId !== this.currentChatId` **então** ignorar (outro chat).
2. Armazenar `this.updatedFields = data.camposAtualizados` e `this.confiancaPerfil = data.confiancaPerfil`.
3. Chamar `this.rerender()` que reconstrói o ViewModel e recria o painel.
4. Após 4 segundos, limpar `this.updatedFields` (animação expirou).

### 4.3 ViewModel

O ViewModel `AtendimentoViewModel` (kind: `ready`) ganha dois campos opcionais em `customer`:

```typescript
updatedFields?: string[]
confiancaPerfil?: number
```

Além de `preferenciasProduto` que faltava na seção Ouvinte.

### 4.4 Seção "Perfil Ouvinte" no AtendimentoPanel

Renderizada dentro do cartão do cliente com 6 campos:

| Campo | Origem | Exemplo |
|-------|--------|---------|
| `preferenciasProduto` | `perfilOperacional.preferenciasProduto` | "pão de abóbora" |
| `aversoesProduto` | `perfilOperacional.aversoesProduto` | "sem azeitona" |
| `enderecoEntrega` | `perfilOperacional.enderecoEntrega` | "Rua Gloria, 100" |
| `formaPagamentoPreferida` | `perfilOperacional.formaPagamentoPreferida` | "PIX" |
| `urgenciaEntrega` | `perfilOperacional.urgenciaEntrega` | "quinta-feira" |
| `observacoesLogisticas` | `perfilOperacional.observacoesLogisticas` | "portaria 24hs" |

Cada campo mostra:
- Label + valor
- Badge de confiança (alta/verde, média/amarelo, baixa/vermelho, desconhecido/cinza)
- **Se** o campo está em `updatedFields`: classe `campo-atualizado` + badge `✨novo`

### 4.5 Indicador "Ouvinte ativo" e barra de confiança

No cabeçalho da seção "Perfil Ouvinte":

```
� Ouvinte ativo    [████████░░] 72%
```

- Indicador "Ouvinte ativo" aparece após primeira atualização no chat atual.
- Barra de confiança: largura animada, cor conforme nível (verde >= 0.6, amarelo >= 0.3, vermelho < 0.3).

### 4.6 Animação de campo atualizado

```css
@keyframes flash-update {
  0%   { background: rgba(34, 197, 94, 0.25); transform: scale(1.02); }
  50%  { background: rgba(34, 197, 94, 0.12); }
  100% { background: transparent; transform: scale(1); }
}
.campo-atualizado {
  animation: flash-update 1.5s ease-out;
}
```

- O campo pisca em verde suave por 1.5s.
- Badge `✨novo` aparece ao lado do valor, fade-out em 4s.
- Badge `⚠ pendente` permanente se confianca do campo for `baixa`.

---

## 5. Interface

```
┌─ Cliente: Roberta ──────────────────────────┐
│ [Cadastro] [Notas]              [Ver +]     │
│                                              │
│ ── Perfil Ouvinte ──                         │
│ ● Ouvinte ativo    [████████░░] 72%          │
│                                              │
│ Preferências: pão de abóbora  ✨novo  🟢     │ ← pisca verde
│ Aversões:       —                        ⚫  │
│ Endereço:       Rua Gloria, 100...  ✨novo  │
│ Forma pgto:     PIX                    🟡    │
│ Urgência:       quinta-feira           🟡    │
│ Observações:    portaria 24hs          🟢    │
└──────────────────────────────────────────────┘
```

### 5.1 Estados

| Estado | Quando | Conteúdo |
|--------|--------|----------|
| `sem_dados` | Nenhum campo extraído ainda | Seção oculta (mostrar só "Ver +" para expandir) |
| `parcial` | Alguns campos preenchidos | Campos com valor + badges de confiança |
| `atualizando` | Evento `ouvir:profile-updated` recebido | Campos atualizados piscam + badge `✨novo` |

---

## 6. Casos de borda

| Cenário | Comportamento |
|---------|---------------|
| Evento chega para chatId diferente do atual | Ignorar silenciosamente |
| Múltiplos eventos em sequência rápida | Cada evento limpa o timer anterior e inicia novo ciclo de 4s |
| Campo foi editado manualmente e depois atualizado pelo Ouvinte | Animação normal (dados do perfil operacional são independentes) |
| Perfil não existe (primeira vez) | Seção aparece com campos vazios, animação marca os primeiros preenchidos |
| Falha ao recarregar perfil | Manter estado anterior, sem animação falsa |

---

## 7. Critérios de aceitação

- Ao enviar mensagem de cliente, campos aparecem no perfil em < 3s.
- Animação de flash verde dura 1.5s.
- Badge `✨novo` desaparece após 4s.
- Indicador "Ouvinte ativo" aparece após primeira atualização e permanece.
- Mudar de chat não dispara atualização falsa no chat anterior.
- Tudo visível no AtendimentoPanel, sem precisar navegar para outro painel.

---

## 8. Dependências

- EventBus (evento `ouvir:profile-updated`)
- DashboardModule (atendimento/dashboard/dashboard-module.ts)
- AtendimentoPanel (atendimento/dashboard/atendimento-panel.ts)
- Provider (atendimento/dashboard/provider.ts)
- CSS animações inline (sem biblioteca externa)

---

## 9. Escopo fora

- Histórico de alterações (timeline de quando cada campo foi atualizado).
- Notificação sonora ao receber enriquecimento.
- Efeitos de partícula ou animações complexas (só flash e badge).
- Edição inline dos campos do Ouvinte (só exibição).

---

## 10. Referências

- ouvinte.zenspec.md: emissão do evento após persistência
- extrator.zenspec.md: origem dos dados
- spec.md (ouvir): arquitetura geral do Ouvinte
- atendimento-panel.ts: código do painel de atendimento
- dashboard-module.ts: módulo que orquestra o painel
