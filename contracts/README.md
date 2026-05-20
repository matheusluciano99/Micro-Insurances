# Contratos — Microsseguro de Seca

Apólice paramétrica de seca para pequenos produtores. O sinistro é
**paramétrico**: se houver **N dias secos consecutivos** (chuva diária abaixo
de um limiar) dentro da janela da apólice, a indenização é paga
**automaticamente** — `claim` é permissionless e o pagamento vai sempre para o
segurado (impede calote silencioso).

## Contratos (`src/`)

- **`MockStablecoin.sol`** — ERC-20 mintável usado como stablecoin na demo.
- **`WeatherOracle.sol`** — feed climático; registra chuva diária por região,
  com controle de acesso (`onlyReporter`).
- **`CropInsurance.sol`** — núcleo: apólice, prêmio, pool com reserva por
  solvência, gatilho de dias secos consecutivos, pagamento automático e
  expiração de apólice. Expõe views ricas (`PolicyView`) para a UI.
- **`NasaRainfallConsumer.sol`** — oráculo de chuva via **Chainlink Functions**:
  a DON consulta a API oficial **NASA POWER** e grava no `WeatherOracle`. É o
  `reporter` on-chain (minimiza confiança no dado). Só Sepolia (não há DON em
  Anvil); testes usam `MockFunctionsRouter`.

## Limitações honestas

Não é o *oracle problem* (evento subjetivo), e sim *oracle quality*:

- **Risco de base:** a chuva medida na grade pode diferir da chuva real na
  fazenda específica.
- **Confiança na fonte de dados:** **mitigada na Sepolia** via Chainlink
  Functions + NASA POWER (DON descentralizada, JS auditável). Como não há
  evento subjetivo, a fraude é ≈ zero.

## API de leitura (frontend)

`getPolicy/getPolicyStatus/previewClaim/getPoliciesByHolder/getPolicies/
poolStats/getRainfallWindow/currentDay/premiumOf` — ver `../docs/INTEGRACAO.md`
para a tabela completa e exemplos.

## Comandos (rodar dentro de `contracts/`)

```bash
cp .env.example .env       # ajuste SEPOLIA_RPC_URL, SUBSCRIPTION_ID, ETHERSCAN_API_KEY
forge build
forge test                 # 33 testes (27 CropInsurance + 6 Functions)

# Deploy na Sepolia (via just)
just deploy         # WeatherOracle + NasaRainfallConsumer (Chainlink Functions)
just deploy-core    # MockStablecoin + CropInsurance (reusa o WeatherOracle)
```

## Endereços deployados (Sepolia, chainId 11155111)

Todos verificados no Etherscan:

| Contrato | Endereço |
|---|---|
| `CropInsurance` | `0xd786BAD5D896938E384d6C110f5d6bc44BF9a7ed` |
| `MockStablecoin` | `0x629B047D6d637Ae058d9B6D24308f8116FdB5Ff6` |
| `WeatherOracle` | `0x9b3ccC0007e6a2A6AeEbc2bf84df1A01b2723c05` |
| `NasaRainfallConsumer` | `0xcd36E43CEB04986358A5bbC6883492061AD6a9bF` |
