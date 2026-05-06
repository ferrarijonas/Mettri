---
name: mettri-design-system
description: Design tokens visuais do Mettri — cores, tipografia, componentes, layout
---

# Mettri Design System — Tokens Visuais

Skill que carrega os tokens de design do projeto Mettri. Use junto com o DESIGN.md na raiz do projeto.

## Princípio Central

Verde é acento, não tema. A interface é uma camada de produtividade sobre o WhatsApp Web — não compete com ele. Zero decoração. Precisão funcional.

## 1. Paleta de Cores

### Acento (Verde — usar com moderação)

| Token | Valor | Onde usar |
|-------|-------|-----------|
| `--mettri-green` | `oklch(0.72 0.17 155)` | Badges, indicadores, hover de links |
| `--mettri-green-hover` | `oklch(0.65 0.15 155)` | Hover de elementos verdes |
| `--mettri-green-subtle` | `oklch(0.72 0.17 155 / 0.12)` | Background de destaque sutil |

REGRAS DO VERDE:
- **Nunca** usar verde como cor de fundo de cards
- **Nunca** usar verde em texto de corpo
- **Nunca** mais de um elemento verde por seção
- O verde aparece apenas em: status badges, hover states, indicadores de seleção, progress bars

### Superfícies (Modo Claro)

| Função | Token | Valor |
|--------|-------|-------|
| Fundo do painel | `--background` | `oklch(0.98 0.005 155)` |
| Card | `--card` | `oklch(1 0 0 / 0.7)` |
| Popover/Modal | `--popover` | `oklch(1 0 0 / 0.85)` |
| Superfície secundária | `--secondary` | `oklch(0.96 0.01 155)` |
| Superfície muted | `--muted` | `oklch(0.94 0.01 155)` |
| Sidebar | `--sidebar` | `oklch(1 0 0 / 0.6)` |

### Superfícies (Modo Escuro)

| Função | Valor |
|--------|-------|
| Fundo | `oklch(0.14 0.015 155)` |
| Card | `oklch(0.18 0.015 155 / 0.7)` |
| Popover | `oklch(0.2 0.015 155 / 0.9)` |
| Secondary | `oklch(0.22 0.015 155)` |
| Muted | `oklch(0.25 0.015 155)` |

### Texto

| Função | Token | Valor |
|--------|-------|-------|
| Primário | `--foreground` | `oklch(0.15 0.01 155)` |
| Secundário | `--muted-foreground` | `oklch(0.45 0.02 155)` |
| Sobre primary | `--primary-foreground` | `oklch(1 0 0)` |
| Destaque (verde) | `--accent-foreground` | `oklch(0.55 0.12 155)` |

### Borders

| Função | Valor | Opacidade |
|--------|-------|-----------|
| Border padrão | `oklch(0.88 0.02 155 / 0.5)` | 50% |
| Border sutil | `oklch(0.88 0.02 155 / 0.25)` | 25% |
| Border forte | `oklch(0.88 0.02 155 / 0.7)` | 70% |

### Vidro Fosco (Glass)

```css
.glass {
  background: oklch(1 0 0 / 0.65);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid oklch(1 0 0 / 0.3);
  box-shadow: 0 4px 30px oklch(0 0 0 / 0.08);
}
```

## 2. Tipografia

### Fontes

- Interface: `Inter`, `system-ui`, `-apple-system`, `sans-serif`
- Mono (código/dados): `"SF Mono"`, `"Geist Mono"`, `monospace`
- Números: Inter com `font-variant-numeric: tabular-nums`

### Escala Tipográfica

| Papel | Size | Peso | Leading | Tracking |
|-------|------|------|---------|----------|
| Título painel | 20px | 600 | 1.3 | -0.02em |
| Título card | 16px | 600 | 1.4 | -0.01em |
| Subtítulo | 14px | 500 | 1.4 | normal |
| Corpo | 13px | 400 | 1.5 | normal |
| Corpo denso | 12px | 400 | 1.4 | normal |
| Label | 11px | 500 | 1.3 | 0.03em |
| Micro | 10px | 500 | 1.2 | 0.04em |
| Valor numérico | 14px | 600 | 1.3 | -0.02em |
| Número tabela | 12px | 500 | 1.3 | -0.01em |
| Botão primário | 13px | 600 | 1 | 0.01em |
| Botão secundário | 12px | 500 | 1 | normal |
| Código/ID | 11px | 400 | 1.4 | normal |

### Regras Tipográficas

- Números tabulares (`tabular-nums`) em toda coluna numérica — SEMPRE
- Labels em maiúsculo com tracking (0.03em)
- Tracking negativo em títulos (-0.02em em 20px, -0.01em em 16px)
- Hierarquia por peso E tracking, não só tamanho
- Leading de 1.5 para corpo, 1.4 para denso

## 3. Componentes

### Botão Primário
- Padding: 8px 16px, Radius: 10px, Font: 13px 600
- Max 1 por tela. Só para ação crítica positiva.

### Botão Secundário
- Padding: 8px 16px, Radius: 10px, Font: 12px 500

### Botão Ghost
- Padding: 6px 12px, Radius: 10px, Hover: accent bg

### Botão Pill (Tag/Filtro)
- Padding: 4px 10px, Radius: 9999px, Font: 11px 500
- Versão ativa: accent bg + text

### Card
- Glass bg, radius 10px, padding 16px, glass border, glass shadow

### Input
- Padding: 8px 12px, Radius: 6px, border padrão
- Focus: ring `var(--ring)`

### Badge
- Pill style, 11px 500 uppercase, tracking 0.03em
- Dot indicator: 6px círculo

### Tabela
- Padding célula: 8px 12px, altura linha: 36-44px
- Header: 11px 600 uppercase, muted
- Números alinhados à direita, tabular-nums

## 4. Espaçamento

Base de 4px. Escala: 2, 4, 6, 8, 12, 16, 20, 24, 32, 48px.

Relações fixas:
- Label → input: 4px
- Input → próximo campo: 16px
- Card → próximo card: 12px
- Seção → próxima seção: 24px
- Título → conteúdo: 8px
- Botão → borda do card: 16px
- Ícone → texto: 6px

## 5. Regras de Ouro

1. Verde é acento, não tema — no máximo UM elemento verde por seção
2. Números tabulares em toda coluna numérica — sem exceção
3. Cards com vidro fosco por padrão
4. Zero gradientes, zero glow exagerado, zero emoji como ícone
5. Usar a escala de 4px — nunca valores arbitrários
6. Tipografia é o principal elemento visual
7. Checklist de hierarquia P/S/T antes de implementar
