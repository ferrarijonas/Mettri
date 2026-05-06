# ENGINEERING CONTRACT

Assuma que este sistema está em produção, com integrações frágeis.
Over-engineering é considerado um bug.

Qualquer proposta deve respeitar as regras abaixo.


## Regra 1 — Proporcionalidade
A solução não pode ser estruturalmente maior
ou mais complexa
que o problema que ela resolve.

## Regra 2 — Consciência de Impacto
Antes de qualquer mudança estrutural,
explique claramente:
- o que deixa de funcionar
- o que fica mais difícil
- o que não existia antes

Se isso não for explicado, a mudança não deve ser aplicada.

## Regra 3 — Design Tokens (UI sem hardcode)
O visual do Mettri deve ser controlado por **tokens/variáveis de tema**.

- Proibido hardcode de cores (ex.: `#1DAA61`) e outros valores visuais no CSS/HTML do painel.
- `panel.css` deve usar **CSS variables** `--mettri-*` (tema) com fallbacks.
- Componentes devem usar os **tokens/classes** já adotados (ex.: `bg-primary`, `bg-background`, `glass`, etc.).

Se a mudança exigir hardcode visual, deve justificar explicitamente (impacto + reversibilidade).

## Regra 4 — Reversibilidade
Se a mudança não puder ser desfeita facilmente,
ela exige justificativa explícita.

## Regra 5 — Build e dist
A extensão executa apenas o que está em `dist/` (content.js, panel.css, dist/modules/*.js).
Alterações em src (UI, painéis, módulos, tailwind-input.css) só têm efeito após:
- `npm run build` (content + panel.css);
- `npm run build:modules` (módulos em dist/modules/);
- recarregar a extensão no Chrome.
Quem altera código que afeta a UI deve rodar o build completo antes de dar por concluído.