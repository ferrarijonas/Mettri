# Mettri

> Plataforma de vendas conversacionais para WhatsApp Web

![CI](https://github.com/YOUR_USERNAME/mettri/actions/workflows/ci.yml/badge.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)
![Chrome Extension](https://img.shields.io/badge/Chrome-Manifest%20V3-green)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Sobre

Mettri transforma conversas em vendas. Uma extensao Chrome que se integra ao WhatsApp Web para:

- Capturar mensagens em tempo real
- Manter historico persistente
- Fornecer sugestoes de IA para respostas
- Organizar contatos e tags
- Reativar clientes inativos

---

## Screenshots

> Em breve

---

## Instalacao

### Pre-requisitos

- Node.js 20+
- npm 10+
- Google Chrome

### Setup

```bash
# Clone o repositorio
git clone https://github.com/YOUR_USERNAME/mettri.git
cd mettri

# Instale dependencias
npm install

# Build da extensao
npm run build
```

### Carregar no Chrome

1. Abra `chrome://extensions`
2. Ative "Modo do desenvolvedor"
3. Clique "Carregar sem compactacao"
4. Selecione a pasta `dist/`

---

## Desenvolvimento

### Scripts disponiveis

| Comando | Descricao |
|---------|-----------|
| `npm run dev` | Build com watch mode |
| `npm run build` | Build de producao |
| `npm run lint` | Verificar linting |
| `npm run lint:fix` | Corrigir linting |
| `npm run format` | Formatar codigo |
| `npm run type-check` | Verificar tipos |
| `npm run test:e2e` | Testes E2E |
| `npm run test:e2e:headed` | Testes E2E visiveis |

### Estrutura do Projeto

```
mettri/
├── src/
│   ├── types/          # Tipos TypeScript
│   ├── background/     # Service worker
│   ├── content/        # Content script
│   ├── core/           # Logica de captura
│   ├── storage/        # IndexedDB
│   └── ui/             # Interface
├── config/
│   └── selectors.json  # Seletores do WhatsApp
├── tests/
│   └── e2e/            # Testes Playwright
├── dist/               # Build
└── legacy/             # Codigo antigo (referencia)
```

---

## Documentacao

| Documento | Descricao |
|-----------|-----------|
| [project_concept.md](project_concept.md) | Visao conceitual |
| [project_context.md](project_context.md) | Especificacoes tecnicas |
| [tech_stack.md](tech_stack.md) | Stack tecnologica |
| [progress.md](progress.md) | Status do desenvolvimento |

---

## Roadmap

- [x] Setup TypeScript
- [x] UI no WhatsApp Web
- [x] Captura de mensagens
- [x] Persistencia IndexedDB
- [ ] Sugestoes de IA
- [ ] Gestao de contatos
- [ ] Reativacao de clientes

Veja [progress.md](progress.md) para detalhes.

---

## Contribuindo

1. Fork o repositorio
2. Crie sua branch (`git checkout -b feature/nova-feature`)
3. Commit suas mudancas (`git commit -m 'feat: adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

Veja [CONTRIBUTING.md](.github/PULL_REQUEST_TEMPLATE.md) para mais detalhes.

---

## Licenca

MIT - veja [LICENSE](LICENSE) para detalhes.

---

## Autor

Desenvolvido com TypeScript e muito cafe.
