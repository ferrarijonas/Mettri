---
name: mettri-ux-hierarchy
description: Hierarquia visual derivada do conteúdo — P/S/T visual baseado na classificação de conteúdo do mettri-content-ux
---

# Mettri UX Hierarchy — Hierarquia Visual

Esta skill transforma a **hierarquia de conteúdo** (definida pelo `mettri-content-ux`) em **hierarquia visual**. O P/S/T aqui é DERIVADO do conteúdo, não independente.

**⚠️ PRIMEIRO execute `mettri-content-ux` — só depois aplique esta skill.**

## Pipeline Correto

```
1. mettri-content-ux → hierarquia de CONTEÚDO (P/S/T de propósito)
2. mettri-ux-hierarchy → hierarquia VISUAL (P/S/T de apresentação)
3. mettri-design-system → tokens visuais
```

## Princípio Central

O que é P no conteúdo vira P no visual. O que é T no conteúdo vira T no visual. A hierarquia visual **reflete** a hierarquia de conteúdo — nunca a inventa.

## 1. Framework P/S/T Visual

### Primário (P)
Conteúdo classificado como P no content-ux. Recebe o MAIOR peso visual.

- Fonte maior ou mais pesada: 14-16px, weight 600
- Cor `--foreground` (sem opacidade reduzida)
- Posição de destaque no layout
- Espaço ao redor pra respirar
- Máximo de 2 elementos P por seção

### Secundário (S)
Conteúdo classificado como S no content-ux. Suporte visual.

- Fonte média: 11-13px, weight 400-500
- Cor `--muted-foreground` ou foreground a 70%
- Posição abaixo ou ao lado do P
- Pode ter múltiplos itens com peso controlado

### Terciário (T)
Conteúdo classificado como T no content-ux. Mínimo impacto visual.

- Fonte pequena: 10-11px, weight 400
- Cor `--muted-foreground` a 60%
- Colapsado por padrão (accordion, tooltip, "ver mais")
- Quando visível, à direita ou no final da linha

## 2. Checklist para Features

Depois da classificação de conteúdo (content-ux):

```
□ A classificação P/S/T de conteúdo está definida?
□ Cada P no conteúdo é P no visual? (sem rebaixar)
□ Cada T no visual é colapsável?
□ Tem P demais? (max 2 por seção → rever classificação de conteúdo)
□ O layout guia o olhar do P → S → T?
□ A densidade visual reflete a densidade de conteúdo?
```

## 3. Regras de Densidade Visual

- Conteúdo P tem espaço ao redor (padding 12-16px)
- Conteúdo S tem padding reduzido (8-12px)
- Conteúdo T é compacto (4-8px) ou colapsado
- Scroll vertical é esperado — não comprimir P pra caber na tela
- Tooltip para overflow de T

### Sinais de que a hierarquia visual falhou

- Um T visual compete com P → erro grave
- Dois P na mesma linha → um deles não é realmente P
- Texto abaixo de 10px → conteúdo mal classificado (T deveria estar colapsado)
- Elemento P com baixo contraste → precisa de foreground sólido

## 4. Fluxo de Decisão

```
1. Executar mettri-content-ux (job analysis, labels, grouping, noise, flow)
       ↓
2. Obter hierarquia de conteúdo P/S/T
       ↓
3. Aplicar hierarquia VISUAL derivada
       ↓
4. Gerar mock HTML
       ↓
5. Apresentar
       ↓
6. Aprovado? → Implementar com mettri-design-system
       ↓
7. Rejeitado? → Voltar ao passo 1 (pode ser problema de conteúdo, não visual)
```

## 5. Regras de Ouro

1. P/S/T visual é DERIVADO do P/S/T de conteúdo — nunca independente
2. Se não rodou o content-ux primeiro, não aplique esta skill
3. Um T visual que parece P é o erro mais comum — e o mais grave
4. Layout guia o olhar: P → S → T (nunca T → P)
5. Dado financeiro é P por padrão no conteúdo → P no visual (tabular-nums)
6. Botão de ação só é verde se for P no conteúdo e ação crítica positiva
