---
name: design
description: Frontend design direction — clarity under pressure, refined aesthetics, functional minimalism
---

# Frontend Design Skill — Clareza Sob Pressão

Antes de escrever qualquer código, define uma direção estética clara e executa com precisão total.

## Princípio central

Funcionalidade como estética.
A beleza emerge da precisão funcional — cada elemento existe porque resolve algo.
O design funciona quando há muita coisa na tela. Não entra em colapso. Não grita. Organiza.

## Direção estética

Escolhe uma das três — ou combina com intenção:

- **Minimalismo refinado** — espaço negativo generoso, poucos elementos, cada detalhe deliberado
- **System UI** — densidade alta, tipografia pequena e precisa, hierarquia por opacidade e peso
- **Pro App** — ferramenta séria, camadas de profundidade, estados expressivos, zero decoração

O que as três têm em comum é mais importante do que o que as separa.

## Tipografia

- Fontes com caráter próprio. Nada de Inter, Roboto, Arial, Space Grotesk.
- Tamanhos pequenos e precisos — 11px, 12px, 13px não são limitações, são linguagem.
- Hierarquia construída com peso e opacidade, não com tamanho.
- Uma display com personalidade + uma corpo discreta e legível.

## Cor

- Paleta enxuta: 1–2 cores dominantes + 1 acento funcional.
- Backgrounds em camadas — sidebar, painel, card, tooltip em níveis distintos.
- Off-white, cinza quente, papel — não necessariamente branco puro nem preto absoluto.
- Gradiente só quando sutil e proposital. Nunca decorativo.

## Espaço e layout

- Espaço negativo com propósito — generoso no minimalismo, controlado no system UI.
- Grid disciplinado. Quebrado só com razão.
- Densidade de informação alta sem colapso visual.

## Profundidade

- Bordas finas como separadores.
- Sombras quase imperceptíveis para criar dimensão sem drama.
- Camadas de background que comunicam hierarquia espacial.

## Estado como linguagem

- Hover, active, focus, disabled são partes do design, não afterthoughts.
- A interface responde com precisão. Cada estado é visível e distinto.
- Transições suaves que orientam, não distraem.

## Movimento

- Mínimo e proposital. Uma entrada bem coreografada vale mais que dez micro-interações.
- CSS-only quando possível. Motion library no React quando necessário.

## O que nunca fazer

- Gradiente roxo em fundo branco
- Card com sombra pesada e borda arredondada genérica
- Ícone emoji como decoração
- Qualquer coisa que pareça template de SaaS de 2021
- Espaçamento inconsistente
- Hierarquia construída só com tamanho de fonte

## Regra final

Executa a visão com precisão.
Elegância vem de fazer bem o que foi escolhido — não de acumular recursos.
O refinamento está nos detalhes que quase não se veem.
