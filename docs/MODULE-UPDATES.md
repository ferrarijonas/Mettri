# Sistema de AtualizaÃ§Ã£o AutomÃ¡tica de MÃ³dulos

Sistema que permite atualizar mÃ³dulos da extensÃ£o sem reinstalar, usando GitHub Pages como servidor de distribuiÃ§Ã£o.

## Como Funciona

### Para Desenvolvedor

1. Fazer mudanÃ§as em mÃ³dulos em src/modules/
2. Compilar mÃ³dulos: npm run build:modules
3. Publicar atualizaÃ§Ãµes: npm run publish-modules
4. Fazer upload da pasta modules-updates/ para GitHub Pages (branch gh-pages)

### Para Testers

1. Instalar extensÃ£o uma vez (normal)
2. Pronto! ExtensÃ£o verifica atualizaÃ§Ãµes automaticamente:
   - Ao iniciar WhatsApp Web
   - 1x por dia (alarm automÃ¡tico)
3. MÃ³dulos sÃ£o atualizados automaticamente quando disponÃ­veis

## ConfiguraÃ§Ã£o

### Configurar URL do Servidor

Edite src/infrastructure/module-updater.ts e altere a URL padrÃ£o.

### Desabilitar AtualizaÃ§Ãµes AutomÃ¡ticas

1. Abrir WhatsApp Web
2. Clicar no botÃ£o âš™ï¸ na navbar do Mettri
3. Desabilitar toggle "AtualizaÃ§Ãµes AutomÃ¡ticas"

## Estrutura de Arquivos

modules-updates/
â”œâ”€â”€ manifest.json
â””â”€â”€ v2.0.2/
    â”œâ”€â”€ marketing.reactivation.js
    â””â”€â”€ ...

## Troubleshooting

Ver console do Chrome para logs detalhados.
