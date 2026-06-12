# API Endpoints — Bee Delivery (Central)

## secservices.beedelivery.com.br (API Pública)

**Base:** `https://secservices.beedelivery.com.br/api/v1/`

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/v1/company/balance/{empresa_id}/{franquia_id}` | Saldo da empresa |
| GET | `/api/v1/deliverymen/location/last/{entregador_id}/{franquia_id}` | Última localização do entregador |

## www.beedelivery.com.br/central (API Interna — Laravel)

**Base:** `https://www.beedelivery.com.br/central/`

### Entregas

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/entregas/entregasjson` | Listar entregas (JSON) |
| POST | `/entregas` | Criar nova entrega |
| POST | `/entregas/coleta/calcular` | **Calcular valor do frete** |
| POST | `/entregas/atualizar` | Atualizar entrega (região, coleta) |
| POST | `/entregas/adicionar` | Adicionar entrega a entregador |
| POST | `/entregas/cancelar` | Cancelar entrega |
| POST | `/entregas/solicitarCancelamento` | Solicitar cancelamento |
| POST | `/entregas/liberarTodas` | Liberar todas as entregas |
| PATCH | `/entregas/atualizarTelefone` | Atualizar telefone |

### Colmeias

| GET | `/colmeias` | Listar colmeias |
| GET | `/colmeias/home` | Dashboard colmeias |

### Outros

| GET | `/perfil` | Perfil |
| GET | `/roteirizacao` | Roteirização |
| GET | `/qrCode` | QR Code |
| GET | `/financeiro` | Financeiro |
| GET | `/usuarios` | Usuários |
| GET | `/relatorios` | Relatórios |
| GET | `/linkManualEmpresa` | Link do manual |
| GET | `/chat-franquia/true` | Chat |

## chat.bee.com.br

| POST | `/api/authchat` | Autenticar |
| GET | `/api-publica/mensagens/{codigo}` | Mensagens |
| GET | `/api-publica/conversa/iniciada/{codigo}` | Conversa |
| GET | `/api-publica/departamentos/check-horario/{uuid}` | Check horário |

---

## Como o sistema calcula o valor do frete

O cálculo é feito via `POST /central/entregas/coleta/calcular` com payload:

```json
{
  "origem_latitude": -23.5505,
  "origem_longitude": -46.6333,
  "destino_latitude": -23.5610,
  "destino_longitude": -46.6560,
  "volta": "N",
  "sn_coleta": "N",
  "tipoTransporte": "moto"
}
```

**Fatores considerados:**
1. **Distância** entre origem e destino (calculada via coordenadas)
2. **Tipo de veículo** (`tipoTransporte`: moto, bike, carro, picape, van)
3. **Volta** (`volta`: 'S' se precisa retornar → dobra distância)
4. **Coleta** (`sn_coleta`: 'S' se tem coleta → 2 endereços)
5. **Região/Dinâmica** (`dinamicaId`, `regiao_id`) — preço dinâmico por região
6. **Seguro** (`sn_seguro`, `valor_produto`) — seguro opcional sobre valor da mercadoria

**Resposta:**
```json
{
  "total_empresa_taxa": 12.50,
  "saldoSuficiente": true,
  "distancia": 3.2
}
```

O `total_empresa_taxa` é o valor final do frete. Se `saldoSuficiente` for false, a entrega não pode ser criada — o usuário é redirecionado a fazer recarga. O saldo mínimo necessário é armazenado no frontend via localStorage.

---

## Rotas completas da API

```
# Públicas (secservices)
GET  https://secservices.beedelivery.com.br/api/v1/company/balance/{empresa_id}/{franquia_id}
GET  https://secservices.beedelivery.com.br/api/v1/deliverymen/location/last/{entregador_id}/{franquia_id}

# Privadas (www.beedelivery.com.br/central)
POST https://www.beedelivery.com.br/central/entregas/coleta/calcular
GET  https://www.beedelivery.com.br/central/entregas/entregasjson
POST https://www.beedelivery.com.br/central/entregas
POST https://www.beedelivery.com.br/central/entregas/atualizar
POST https://www.beedelivery.com.br/central/entregas/adicionar
POST https://www.beedelivery.com.br/central/entregas/cancelar
POST https://www.beedelivery.com.br/central/entregas/solicitarCancelamento
POST https://www.beedelivery.com.br/central/entregas/liberarTodas
PATCH https://www.beedelivery.com.br/central/entregas/atualizarTelefone
GET  https://www.beedelivery.com.br/central/colmeias
GET  https://www.beedelivery.com.br/central/linkManualEmpresa
GET  https://www.beedelivery.com.br/central/chat-franquia/true

# Chat
POST https://chat.bee.com.br/api/authchat
GET  https://chat.bee.com.br/api-publica/mensagens/{codigo}
GET  https://chat.bee.com.br/api-publica/conversa/iniciada/{codigo}
GET  https://chat.bee.com.br/api-publica/departamentos/check-horario/{uuid}
```
