# Arquitetura — Microsseguro Paramétrico de Seca

## 1. Visão geral

```
        USUÁRIO (produtor)                          ADMIN / DEMO
              │                                          │
              ▼                                          ▼
   ┌────────────────────────┐                  ┌───────────────────┐
   │       FRONTEND         │                  │  reportRainfall    │
   │  Next.js + wagmi +     │                  │  (manual, teste)   │
   │  RainbowKit + viem     │                  └─────────┬─────────┘
   └───────────┬────────────┘                            │
               │ createPolicy / claim                    │
               │ getPolicy / previewClaim (leitura)      │
               ▼                                          │
   ┌────────────────────────┐      lê chuva    ┌──────────▼─────────┐
   │     CropInsurance      │ ───────────────► │   WeatherOracle    │
   │  • pool de capital     │                  │  (regionId, day)   │
   │  • apólices            │ ◄─────────────── │      → mm × 100    │
   │  • pagamento AUTOMÁTICO │                  └──────────▲─────────┘
   └────────────────────────┘                             │ reportRainfall
                                                           │ (onlyReporter)
                                              ┌────────────┴──────────┐
                                              │  NasaRainfallConsumer │
                                              │  (Chainlink Functions)│
                                              └────────────▲──────────┘
                                                           │ DON executa JS público
                                                           ▼
                                              ┌───────────────────────┐
                                              │   NASA POWER API       │
                                              │  (chuva diária real)   │
                                              └───────────────────────┘
```

## 2. Os contratos

| Contrato | Papel | Analogia |
|---|---|---|
| `CropInsurance` | Núcleo: pool, apólices, gatilho de seca, **pagamento automático** | A seguradora |
| `WeatherOracle` | Armazena chuva por `(região, dia)` | O banco de dados de clima |
| `NasaRainfallConsumer` | Busca chuva da NASA via Chainlink e grava no oráculo | O ETL / robô de ingestão |
| `MockStablecoin` | ERC-20 usado como moeda (prêmio e indenização) | O dinheiro (BRL tokenizado) |

## 3. Ciclo de vida de uma apólice

```
 CONTRATAR ──► ACOMPANHAR ──► [ teve N dias secos? ]
 approve +      (oráculo          │            │
 createPolicy    reporta          SIM          NÃO
 (paga prêmio)   chuva)           │            │
                                  ▼            ▼
                              ACIONÁVEL      EXPIRA
                              claim()      expirePolicy()
                              (paga         (libera reserva,
                              automático)    sem pagar)
```

- **Gatilho**: N dias consecutivos com chuva ≤ limiar dentro da janela.
- **`claim` é permissionless**: qualquer um aciona, paga sempre o segurado.
- **Sem aprovador**: ninguém pode censurar um sinistro legítimo na liquidação.

## 4. Os dois caminhos do dado de chuva

```
PRODUÇÃO (trustless)                     DEMO / DEV (controlado)
NASA → Chainlink DON → Consumer          Admin → cast/forge
        │ JS público auditável                  │ valores definidos
        ▼                                        ▼
        └──────────► WeatherOracle.reportRainfall ◄──────────┘
                              │
                              ▼
              CropInsurance lê — não importa quem escreveu
```

> O `WeatherOracle` é neutro: aceita qualquer `reporter`. Hoje os reporters são
> a **Chainlink** (robô) e o **admin** (humano, só pra teste).

## 5. Modelo de confiança

| Garantido por código (sem confiança) | Confiança residual (mínima e explícita) |
|---|---|
| Custódia do pool não-custodial | Qualidade do dado climático (basis risk) |
| Pagamento automático e permissionless | Fonte do dado → **mitigado**: Chainlink + NASA, JS público auditável |
| Regras do prêmio/sinistro imutáveis | — |
| Reserva por solvência (não dá pra sacar o reservado) | — |

## 6. Stack & deploy

- **Contratos**: Solidity 0.8.34 · Foundry · 33 testes · verificados no Etherscan
- **Oráculo externo**: Chainlink Functions (Sepolia) + NASA POWER API
- **Frontend**: Next.js 16 · wagmi v2 · viem · RainbowKit · shadcn/ui
- **Rede**: Sepolia (chainId 11155111)

| Contrato | Endereço (Sepolia) |
|---|---|
| CropInsurance | `0xd786BAD5D896938E384d6C110f5d6bc44BF9a7ed` |
| WeatherOracle | `0x9b3ccC0007e6a2A6AeEbc2bf84df1A01b2723c05` |
| NasaRainfallConsumer | `0xcd36E43CEB04986358A5bbC6883492061AD6a9bF` |
| MockStablecoin | `0x629B047D6d637Ae058d9B6D24308f8116FdB5Ff6` |
