$ErrorActionPreference = "Stop"

$owner = "ferrarijonas"
$repo  = "Mettri"
$base  = "https://api.github.com/repos/$owner/$repo"

if (-not $env:GITHUB_TOKEN) {
    Write-Host ""
    Write-Host "=== INSTRUCOES ===" -ForegroundColor Cyan
    Write-Host "1. Va em https://github.com/settings/tokens/new"
    Write-Host "2. De um nome (ex: mettri-script), marque repo e gere o token."
    Write-Host "3. Copie o token e rode novamente assim:"
    Write-Host ""
    Write-Host '   $env:GITHUB_TOKEN = "ghp_SEU_TOKEN_AQUI"' -ForegroundColor Yellow
    Write-Host '   .\scripts\create-milestones-issues.ps1' -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

$headers = @{
    Authorization = "Bearer $env:GITHUB_TOKEN"
    Accept        = "application/vnd.github+json"
}

function New-Milestone($title, $description) {
    $body = @{ title = $title; description = $description; state = "open" } | ConvertTo-Json -Compress
    $r = Invoke-RestMethod -Uri "$base/milestones" -Method Post -Headers $headers -Body $body -ContentType "application/json"
    Write-Host "  Milestone criada: $($r.title) (#$($r.number))" -ForegroundColor Green
    return $r.number
}

function New-Issue($title, $body, $milestoneNumber, $labels) {
    $payload = @{
        title     = $title
        body      = $body
        milestone = $milestoneNumber
        labels    = $labels
    } | ConvertTo-Json -Compress
    $r = Invoke-RestMethod -Uri "$base/issues" -Method Post -Headers $headers -Body $payload -ContentType "application/json"
    Write-Host "    Issue #$($r.number): $($r.title)" -ForegroundColor White
}

Write-Host ""
Write-Host "Criando milestones e issues em $owner/$repo..." -ForegroundColor Cyan
Write-Host ""

$m1 = New-Milestone "Avaliacao de Respostas RAG" "Implementar avaliador pos-sugestao RAG (LLM-as-judge ou heuristicas). Score no debug, primeiro experimento RAG ON vs OFF."

New-Issue "Definir metricas de avaliacao (relevancia, fidelidade, utilidade)" "Escolher 2-3 metricas objetivas para medir qualidade da resposta RAG. Relacionado a spec: specs/rag/spec.md" $m1 @("enhancement", "rag")

New-Issue "Implementar avaliador LLM-as-judge" "Criar modulo que envia resposta + contexto para um LLM e recebe score. Saida: score number, reason string" $m1 @("enhancement", "rag")

New-Issue "Exibir score de avaliacao no painel de debug" "Mostrar score da avaliacao no console ou num campo debug do painel." $m1 @("enhancement", "rag")

New-Issue "Primeiro experimento RAG ON vs OFF" "Comparar respostas com RAG ligado vs desligado em 10-20 conversas reais. Documentar resultados." $m1 @("enhancement", "rag")

$m2 = New-Milestone "Memoria de Sessao" "Short-term da conversa atual (ultimo pedido, preferencias, resumo) e injetar no contexto do prompt junto do RAG."

New-Issue "Definir estrutura de dados da memoria de sessao" "Tipos para: ultimo pedido, preferencias detectadas, resumo da conversa atual." $m2 @("enhancement")

New-Issue "Capturar e manter memoria de sessao durante conversa ativa" "Atualizar a memoria a cada mensagem recebida/enviada no chat ativo." $m2 @("enhancement")

New-Issue "Injetar memoria de sessao no prompt do RAG" "Concatenar dados de sessao no contexto enviado ao LLM junto com chunks RAG." $m2 @("enhancement", "rag")

$m3 = New-Milestone "Tool Use" "Fluxo chamando 1-2 ferramentas reais (ex.: API de cardapio/preco) e usando o retorno na resposta."

New-Issue "Definir interface generica de Tool (entrada, saida, descricao)" "Criar tipo ToolDefinition com name, description, parameters, execute()." $m3 @("enhancement")

New-Issue "Implementar primeira tool: consulta de cardapio/preco" "Tool concreta que retorna dados de produtos/precos para o LLM usar na resposta." $m3 @("enhancement")

New-Issue "Integrar tool use no fluxo de geracao de resposta" "O orquestrador detecta que precisa de uma tool, chama, e injeta o resultado no prompt final." $m3 @("enhancement", "rag")

$m4 = New-Milestone "Orquestracao" "Supervisor + intent + agentes especializados (vendas, suporte, etc.) quando RAG + avaliacao + tools estiverem estaveis."

New-Issue "Definir intents basicos (venda, suporte, informacao, saudacao)" "Lista fechada de intents iniciais com exemplos de frases para cada um." $m4 @("enhancement")

New-Issue "Implementar classificador de intent" "Modulo que recebe mensagem e retorna intent detectado." $m4 @("enhancement")

New-Issue "Criar agentes especializados por intent" "Pelo menos 2 agentes: vendas (usa tools + RAG) e suporte (usa RAG + docs)." $m4 @("enhancement")

New-Issue "Implementar supervisor/router que delega para o agente correto" "Supervisor recebe mensagem, classifica intent, despacha para agente especializado, retorna resposta." $m4 @("enhancement")

Write-Host ""
Write-Host "Pronto! 4 milestones + 14 issues criadas." -ForegroundColor Green
Write-Host "Veja em: https://github.com/$owner/$repo/milestones" -ForegroundColor Cyan
