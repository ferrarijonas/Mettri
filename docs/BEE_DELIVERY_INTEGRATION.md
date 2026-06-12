# Integração Bee Delivery

## Visão Geral

O Mettri se integra com a **Bee Delivery** (www.beedelivery.com.br) para oferecer **cotação de frete** e **solicitação de entregas** diretamente do WhatsApp.

**Modelo de negócio:** Pré-pago. A empresa recarrega créditos e cada entrega é descontada do saldo.

**Empresa cadastrada:** PÃO DE VERDADE (CNPJ: 50.330.598/0001-55)
- Endereço: Rua Mário Pinto Sobrinho, 156 — Santa Mônica, Uberlândia/MG
- Coordenadas: `-18.921178, -48.256128`
- Franquia: Uberlândia/MG (ID: 19)
- Ticket médio: R$ 15,91

---

## Como funciona

### Arquitetura

```
┌─────────────────────────────────────────────────────┐
│                   Mettri (Chrome Extension)           │
│  ┌────────────────────────────────────────────────┐  │
│  │  Pedidos Panel (web.whatsapp.com)              │  │
│  │  ↓ ação "cotar frete" / "chamar motoboy"      │  │
│  ├────────────────────────────────────────────────┤  │
│  │  DeliveryService (infrastructure/delivery/)    │  │
│  │  ↓ delega                                     │  │
│  ├────────────────────────────────────────────────┤  │
│  │  BeeDeliveryAdapter                            │  │
│  │  ↓ fetch com credentials: 'include'            │  │
│  └────────────────────────────────────────────────┘  │
│                       │                               │
└───────────────────────┼───────────────────────────────┘
                        │
              host_permissions + CSP
                        │
                        ▼
          www.beedelivery.com.br/central/
          (Laravel + Vue 2)
```

**Autenticação:** A integração reusa a sessão ativa do navegador. O usuário precisa estar logado na Bee Delivery em alguma aba do Chrome. O adapter:

1. Faz `GET /central/home` para obter o **CSRF token** (extraído da meta tag)
2. Inclui o cookie de sessão automaticamente via `credentials: 'include'`
3. Se o CSRF expirar (HTTP 419), renova automaticamente e retenta

---

## Endpoints da API

### www.beedelivery.com.br/central/

| Método | Endpoint | Uso | Autenticação |
|--------|----------|-----|-------------|
| GET | `/central/home` | Obter CSRF token (meta tag) | Cookie sessão |
| POST | `/central/entregas/coleta/calcular` | **Calcular frete** | CSRF + Cookie |
| POST | `/central/entregas` | **Criar entrega** | CSRF + Cookie |
| POST | `/central/entregas/cancelar` | Cancelar entrega | CSRF + Cookie |
| GET | `/central/entregas/entregasjson` | Listar entregas (tracking) | CSRF + Cookie |
| GET | `/central/googleAutoComplete?input=` | Autocomplete de endereço | CSRF + Cookie |
| GET | `/central/google?place_id=` | Geocode (place_id → lat/lng) | CSRF + Cookie |

### secservices.beedelivery.com.br

| Método | Endpoint | Uso |
|--------|----------|-----|
| GET | `/api/v1/company/balance/{empresaId}/{franquiaId}` | Consultar saldo (sem CSRF) |

---

## Fluxo de Cotação

```
1. Mettri tem endereço do cliente (do WhatsApp)
2. Usuário clica "Cotar frete Bee Delivery"
3. Adapter:
   a. Obtém CSRF token (GET /central/home)
   b. Geocode do endereço do cliente
      - GET /googleAutoComplete?input=Rua Exemplo, 123 — Bairro, Uberlândia
      - GET /google?place_id=... → { lat, lng }
   c. POST /entregas/coleta/calcular com coordenadas
      Body: {
        origem_latitude: "-18.921...",    // fixo (Pão de Verdade)
        origem_longitude: "-48.256...",
        destino_latitude: "-18.947...",   // do geocode
        destino_longitude: "-48.258...",
        volta: "N",
        sn_coleta: "N",
        tipoTransporte: "MB"              // Moto/Bike
      }
   d. Response: {
        total_empresa_taxa: "14.59",      // valor cobrado
        saldoSuficiente: true,
        distancia: "4.452",               // km
        valor: "8.90",                    // taxa motoboy
        vl_dinamica: "2.00",             // taxa dinâmica
        total_empresa: "14.30"
      }
4. Mettri exibe o valor: "Frete: R$ 14,59 (4,4 km)"
5. Se usuário confirmar → solicitar entrega
```

## Fluxo de Criação de Entrega

```
1. POST /entregas/coleta/calcular (mesmo payload — para confirmar valor)
2. Se saldoSuficiente = false → avisar "Saldo insuficiente"
3. POST /entregas com payload completo:
   Body: {
     valor: "14.59",                     // do cálculo
     request_token: "uuid-v4",           // UUID gerado no front
     distancia: "4.452",
     origem_latitude: "...",
     origem_longitude: "...",
     destino_latitude: "...",
     destino_longitude: "...",
     destino_descricao: "Rua Exemplo, 123 — Bairro, Uberlândia - MG",
     tipo_transporte_input: "MB",
     tipo_compartimento_input: "BAG",
     necessita_colmeia_input: "SIM",
     sn_entregador_finalizar_coleta: "S",
     sn_agendada: "N",
     volta: "N",
     sn_coleta: "N",
     nome: "Nome do Cliente",
     destino_telefones: "34999999999",
     obs: "",                            // observações
     origem_coleta: "empresa"
   }
   Response: { nextRequestToken: "uuid", podeChamar: true }
```

---

## Estrutura de Código

```
src/
├── types/delivery.ts                          ← Tipos compartilhados
├── infrastructure/delivery/
│   ├── delivery-adapter.ts                    ← Interface genérica
│   ├── bee-delivery-adapter.ts                ← Implementação Bee Delivery
│   └── delivery-service.ts                    ← Orquestrador singleton
└── modules/
    ├── delivery/delivery-module.ts            ← Container do módulo
    ├── delivery/dashboard/dashboard-module.ts ← Dashboard delivery
    └── pedidos/dashboard/
        ├── pedidos-panel.ts                   ← UI dos pedidos
        └── ...                                ← resto do módulo pedidos
```

### Configuração do Adapter

Feita em `delivery-service.ts`:

```typescript
const beeAdapter = new BeeDeliveryAdapter();
beeAdapter.configurar({
  originLatitude: '-18.92117849290788',     // Pão de Verdade
  originLongitude: '-48.25612809276656',
  empresaId: '168556',                       // ID na Bee Delivery
  franquiaId: '19',                          // Uberlândia/MG
});
```

### Uso básico

```typescript
import { deliveryService } from './infrastructure/delivery/delivery-service';

// 1. Cotar frete
const cotacao = await deliveryService.cotarFrete('bee-delivery', {
  origem: { ... },
  destino: {
    logradouro: 'Rua Exemplo',
    numero: '123',
    bairro: 'Centro',
    cidade: 'Uberlândia',
    estado: 'MG'
  },
  items: []
});
// → { valorFrete: 14.59, prazoEstimadoMin: 20, prazoEstimadoMax: 60 }

// 2. Solicitar entrega
const resultado = await deliveryService.solicitarEntrega('bee-delivery', {
  origem: { ... },
  destino: { ... },
  items: [],
  valorTotal: 1459,               // em centavos
  contatoDestinatario: {
    nome: 'Maria',
    telefone: '34999999999'
  }
});
// → { entregaId: 'uuid', status: 'confirmed', valorFrete: 14.59 }

// 3. Consultar saldo
const bee = deliveryService.getAdapter('bee-delivery') as BeeDeliveryAdapter;
const saldo = await bee.consultarSaldo();
// → 5.05 (R$ 5,05)

// 4. Rastrear
const status = await deliveryService.rastrear('bee-delivery', 'uuid-entrega');

// 5. Cancelar
await deliveryService.cancelar('bee-delivery', 'uuid-entrega', 'Cliente desistiu');
```

---

## Pré-requisitos

1. **Conta ativa** na Bee Delivery como empresa
2. **Saldo** suficiente (pré-pago)
3. **Sessão ativa** no navegador (www.beedelivery.com.br logado)
4. Extensão Mettri com permissões:
   ```json
   "host_permissions": [
     "https://www.beedelivery.com.br/*",
     "https://secservices.beedelivery.com.br/*"
   ]
   ```

---

## Dados da Empresa (Pão de Verdade)

| Dado | Valor |
|------|-------|
| CNPJ | 50.330.598/0001-55 |
| Endereço | Rua Mário Pinto Sobrinho, 156 |
| Bairro | Santa Mônica |
| Cidade | Uberlândia/MG |
| CEP | 38408-128 |
| Latitude | -18.92117849290788 |
| Longitude | -48.25612809276656 |
| Franquia ID | 19 |
| Empresa ID | 168556 |
| Avaliação | 4.78 ⭐ |
| Raio de entrega | 4 km |
| Tipo de veículo | Moto (MB) com Bag |
| Ticket médio | R$ 15,91 |
| Tempo médio | 40 min |

---

## Notas Técnicas

- **CSRF Token:** Expira periodicamente. O adapter renova automaticamente em HTTP 419.
- **CORS:** Funciona via `credentials: 'include'` (extensão Chrome). O header `X-Requested-With: XMLHttpRequest` é obrigatório.
- **Geocoding:** Usa a API interna da Bee Delivery (`/central/googleAutoComplete` + `/central/google`), que depende de chave Google Maps configurada na franquia.
- **Request Token:** UUID v4 gerado no frontend para idempotência.
- **Saldo:** Endpoint `secservices` não exige CSRF, apenas cookie de sessão.

---

## Limitações Conhecidas

1. **Depende de sessão ativa** — Usuário precisa estar logado na Bee Delivery no navegador
2. **Apenas Uberlândia/MG** — A franquia atual cobre apenas essa região
3. **Apenas moto/bike com bag** — Tipo de veículo configurado como "MB" (Moto/Bike)
4. **Raio de 4 km** — Distância máxima da origem
5. **Sem fallback** — Se a Bee Delivery estiver fora do ar, não há transportadora alternativa
6. **CSRF expira** — Sessões inativas por mais de ~1h podem exigir re-login
