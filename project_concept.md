# Project Concept - METTRI

--

# Arquitetura Conceitual

## atendimento
Central das conversas
Mostra mensagens em tempo real
Permite responder manualmente ou com sugestão
Transforma conversa em pedido
Registra tudo no histórico

### contexto
Informações do momento atual
Dia, horário, clima, eventos
Influenciam recomendações e mensagens
Nunca decidem sozinhas

## clientes
Mostra informações de cada cliente
Histórico completo de conversas e pedidos
Preferências explícitas e implícitas
Tags e observações
Geolocalização quando disponível
Dashboards gerais e individuais

### histórico
Memória completa do sistema
Armazena todas as mensagens (entrada e saída)
Nunca apaga dados
Base para estado, relatórios e reativação
Exportação em tempo real via webhook (padrão WA-Sync)
Raspagem histórica completa com loadEarlierMsgs()
Ordenação via getModelsArray() (1/1 com WhatsApp)
Batch processing para grandes volumes

### recomendação
Sugere próximos passos
Produtos
Mensagens
Ações
Baseado em histórico, cliente e contexto
Não executa sem permissão

## produtos
Cadastro e organização dos produtos
Preço, categoria, unidade
Disponibilidade real ou simbólica
Base para vitrine e recomendações

## vitrine
Arranja os produtos para exibição
Pode ser geral (site, WhatsApp) ou por cliente
Define ordem, destaque e texto curto
Serve para facilitar o que pode ser dito na conversa

## pedidos
Registra acordos feitos na conversa
Produtos, valores, status
Entrega ou retirada
Ligado ao histórico do cliente
Pode ser alterado ou cancelado mantendo rastro

## entrega
Define onde e como entregar
Zonas, áreas, valores
Cálculo automático ou manual
Integra com pedidos

## financeiro
Organização financeira
Entradas e saídas
Conecta com bancos e Pix
Conciliação automática quando possível
Relatórios e dashboards
Base para decisões, não para contabilidade pesada

## marketing
Organiza tudo que promove o produto
Mensagem, imagem, momento e público

### enviar
Módulo que trabalha com os contextos Reativar, Responder e Divulgar

#### reativar
Identifica clientes inativos
Escreve mensagens automáticas ou manuais
Puxa conversas de forma ativa
Sempre respeita histórico

#### responder
Usado para responder em massa, msgs não lidas por afastamento, férias.

#### divulgar
Usado para envio de mensagens em lote.

Enviar ▾
Reativar
Responder
Divulgar



### testes A/B
Centraliza tudo que pode ser testado
Mensagens de resposta
Mensagens de reativação
Descrição de produtos
Horários e abordagens

### imagens
Cria ou melhora imagens
Relaciona imagem com produto ou campanha
Usa ID para controle e reaproveitamento

### persona
Consolida identidade da marca
Tom de voz
Vocabulário
Pode raspar site, Instagram e WhatsApp
Serve para alinhar respostas e mensagens automáticas

## infraestrutura
Sistema invisível que mantém tudo funcionando
Garante que a extensão nunca pare de funcionar
Atualiza sem depender da Chrome Web Store
Monitora e corrige problemas automaticamente

### plugin-system
Sistema de módulos desacoplados e auto-descobríveis
Permite adicionar/remover módulos sem quebrar outros
Suporta hierarquia (módulos dentro de módulos)
Registry descobre módulos automaticamente
Lazy loading para performance
Isolamento total entre módulos

### seletores
Sistema de seletores auto-corrigíveis
Múltiplos seletores por elemento (fallback chain)
Servidor remoto com seletores sempre atualizados
Extensão busca seletores a cada X minutos
Se um falhar, tenta o próximo da lista
Correção em menos de 1 minuto
Monitoramento detecta quebra antes do usuário reclamar
Nunca depende de um único seletor

### auto-mapeamento
Sistema que reconstrói seletores em tempo real
Usuário pode ativar manualmente (Ctrl+Shift+M) ou automaticamente quando quebra
Identifica elementos focados via atalhos de teclado
Usa coordenadas de tela (Hit Test) para achar containers perdidos
Faz loop de tentativa e erro até validar 100% dos campos
Atualiza o config remoto automaticamente após sucesso
Correção distribuída para todos os usuários

### interceptação webpack
Sistema que acessa módulos internos do WhatsApp via webpack
Intercepta eventos diretamente da memória (não apenas DOM)
Mais rápido e confiável que manipulação de DOM
Funciona via window.webpackChunkwhatsapp_web_client
Extrai GroupMetadata, ChatCollection, Msg, User
Intercepta eventos: Msg.on("add"), Msg.on("change"), PresenceCollection
Fallback para DOM quando webpack não disponível

### config-remota
Configurações que atualizam sem passar pela Store
Seletores DOM atualizados
Regras de negócio
Feature flags (ligar/desligar funcionalidades)
Mensagens e textos da interface
Rollout gradual de novas features
Extensão busca config ao iniciar e periodicamente
Fallback para config local se servidor offline

## suporte
Suporte escalável por IA
Tudo que funciona é documentado automaticamente
Base de conhecimento sempre atualizada
Resolve 90% das dúvidas sem humano
Escala para 100k usuários sem equipe grande

### documentacao-viva
Documentação gerada automaticamente
Cada feature nova gera sua própria explicação
Cada erro conhecido gera sua própria solução
Changelog automático
Usuário sempre sabe o que mudou
Busca inteligente por problema

### bot-ia
Bot de suporte com IA
Acesso à base de conhecimento completa
Entende contexto do problema
Sugere soluções passo a passo
Coleta feedback para melhorar
Escala para humano quando necessário
Aprende com resoluções anteriores

## monetizacao
Sistema de cobrança e proteção
Permite cobrar de forma justa
Protege contra pirataria
Não depende de código client-side
Backend valida tudo

### licenciamento
Validação de licença no backend
Cada usuário tem token único
Token validado a cada ação crítica
Features premium só funcionam com token válido
Período de trial configurável
Diferentes planos (básico, pro, enterprise)

### seguranca
Proteção contra uso indevido
Rate limiting por conta
Detecção de uso anormal
Bloqueio automático de abuso
Logs de auditoria
Webhook para integrações (valor agregado)
Código crítico nunca exposto no client

## Autonomia

### estabilidade
Se o WhatsApp mudar o DOM, o foco único é atualizar selectors.json Não mexe em UI nem em lógica enquanto a captura estiver quebrada IA deve sugerir correção de seletor antes de qualquer outra alteração

### Definição de Pronto:
Código sem any, TypeScript Strict, Documentação atualizada com a nova função,  Commits no padrão, Lint sem warnings


#engenharia

## arquitetura-modular
Sistema de plugins para escalabilidade
Módulos independentes e auto-descobríveis
Hierarquia natural (módulos dentro de módulos)
Zero acoplamento entre módulos
Performance otimizada com lazy loading
Estrutura preparada para 100k módulos

## monitoramento
Estado centralizado e único (Truth Source)
Logs de execução para cada ação da IA
Sincronização entre banco local e interface
Detecta e limpa dados corrompidos automaticamente

## rastreabilidade
Identifica o caminho de cada dado
Mostra onde o processo parou se houver erro
Garante que a IA saiba o estado atual antes de agir
Histórico de execução técnico (Telemetria)

## integridade
Verifica se as funções são puras e seguras
Trava execuções duplicadas ou conflitantes
Validação rigorosa de entrada e saída (Zod)
Garante que o banco local é a fonte final da verdade

---

# Princípios Lean/TPS

## Jidoka - Autonomação
Se algo quebrar, parar imediatamente e corrigir.
Seletor quebrado = nenhuma feature nova até corrigir.
Problema detectado = parar a linha de produção.

## Just-in-Time
Só implementar o que for necessário agora.
Nada de "vai ser útil no futuro".
Código especulativo é desperdício.

## Kaizen - Melhoria Contínua
Cada commit deve deixar o código melhor.
Nunca pior, nunca igual.
Pequenas melhorias constantes > grandes refatorações.

## Genchi Genbutsu - Ir ao Gemba
Testar no ambiente real (WhatsApp Web).
Não confiar em mocks ou simulações.
Ver o problema com os próprios olhos.

## Muda - Eliminar Desperdício
Código comentado = deletar.
Feature não usada = não implementar.
Abstrações desnecessárias = simplificar.
Reuniões sem decisão = cancelar.

## Heijunka - Nivelamento
Tasks pequenas e constantes.
Nada de sprints gigantes.
Fluxo contínuo de valor.

## Poka-yoke - À Prova de Erros
TypeScript strict (sem any).
Validação Zod em toda entrada.
Fallback selectors (nunca depender de um só).
Testes E2E para fluxos críticos.

---

# Design Sistêmico

## Design Sistêmico Global
Design inspirado no WhatsApp web, com aparência de nativo do sistema, com mínimo atrito entre Chrome e WhatsApp web

## Design Sistêmico por Capacidade
Cada domínio tem seu próprio design quando necessário
Atendimento: central de conversas em tempo real
Clientes: perfil expandido com histórico
Produtos: catálogo visual
Pedidos: lista com status e ações
Infraestrutura: invisível, sem UI para usuário final
Suporte: chat integrado ou página externa
Monetização: tela de planos e pagamento