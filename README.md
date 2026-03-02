# Mettri

> Plataforma de vendas conversacionais para WhatsApp Web

---

## 🎯 **Destaque: Veja a Evolução do Projeto**

📖 **[📜 Histórico Simples](HISTORICO_SIMPLES.md)** - Uma linha por coisa feita. Veja como o Mettri evoluiu desde o nascimento até hoje, com as conquistas mais recentes no topo!

---

⚠️ Este projeto segue regras obrigatórias definidas em `ENGINEERING_CONTRACT.md`.
Qualquer mudança estrutural deve respeitá-las.

CI
TypeScript
Chrome Extension
License

---

## Sobre

O Mettri é uma ferramenta de apoio à comunicação com clientes existentes.
Ele transforma o WhatsApp em um sistema de continuidade, contexto e vendas responsáveis, sem automação agressiva e sem mensagens frias.

Como extensão do Chrome integrada ao WhatsApp Web, o Mettri ajuda negócios a decidir melhor quando, com quem e por que falar, mantendo ritmo humano e intenção real.


O Mettri organiza conversas, estrutura ciclos de continuidade, sugere ações com IA e protege o usuário de excessos — para vender mais falando menos e melhor.

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
git clone https://github.com/ferrarijonas/Mettri.git
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

### Testar no WhatsApp Web

**IMPORTANTE:** O WhatsApp Web detecta quando o Chrome está sendo controlado por software de automação (MCP/Playwright) e bloqueia o carregamento completo.

**Para testar a extensão:**

- ✅ Use Chrome normal (aberto manualmente)
- ❌ NÃO use MCP browser extension ou Playwright para testar WhatsApp
- ❌ NÃO use Chrome em modo dev se for testar WhatsApp

**Playwright/MCP:**

- Podem ser usados para validar estrutura básica (manifest, arquivos)
- NÃO funcionam para testar WhatsApp (detecção de automação)

Veja [TESTE-RAPIDO.md](TESTE-RAPIDO.md) para mais detalhes.

---

## Desenvolvimento

### Scripts disponiveis


| Comando                   | Descricao            |
| ------------------------- | -------------------- |
| `npm run dev`             | Build com watch mode |
| `npm run build`           | Build de producao    |
| `npm run lint`            | Verificar linting    |
| `npm run lint:fix`        | Corrigir linting     |
| `npm run format`          | Formatar codigo      |
| `npm run type-check`      | Verificar tipos      |
| `npm run test:e2e`        | Testes E2E           |
| `npm run test:e2e:headed` | Testes E2E visiveis  |


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


| Documento                                | Descricao                 |
| ---------------------------------------- | ------------------------- |
| [project_concept.md](project_concept.md) | Visao conceitual          |
| [project_context.md](project_context.md) | Especificacoes tecnicas   |
| [tech_stack.md](tech_stack.md)           | Stack tecnologica         |
| [progress.md](progress.md)               | Status do desenvolvimento |


---

## Roadmap

- Setup TypeScript
- UI no WhatsApp Web
- Captura de mensagens
- Persistencia IndexedDB
- Sugestoes de IA
- Gestao de contatos
- Reativacao de clientes

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

Desenvolvido com TypeScript, Agentes de IA e muita paciência.