# Microsseguro paramétrico de seca

Microsseguro de seca para pequenos produtores rurais (projeto de blockchain).
Apólice **sazonal de prazo fixo**, prêmio pago na contratação. O sinistro é
**paramétrico**: se houver **N dias secos consecutivos** (chuva diária abaixo de
um limiar) dentro da janela da apólice, a indenização é paga **automaticamente**,
sem perito e sem aprovador — `claim` é permissionless e o pagamento vai sempre
para o segurado (impede calote silencioso).

## Contratos (`src/`)

- **`MockStablecoin.sol`** — ERC-20 mintável usado como stablecoin na demo.
- **`WeatherOracle.sol`** — mock do feed climático (papel de INMET/NASA POWER/
  Chainlink); registra chuva diária por região, com controle de acesso.
- **`CropInsurance.sol`** — núcleo: apólice, prêmio, pool com reserva por
  solvência, gatilho de dias secos consecutivos, pagamento automático e
  expiração de apólice.
- **`NasaRainfallConsumer.sol`** — oráculo de chuva via **Chainlink Functions**:
  a DON consulta a API oficial **NASA POWER** e grava no `WeatherOracle`. É o
  `reporter` on-chain (minimiza a confiança no dado). Só Sepolia (não há DON em
  Anvil); testes usam `MockFunctionsRouter`.

## Limitações honestas (declarar no relatório)

Não é o *oracle problem* (evento subjetivo), e sim *oracle quality*:

- **Risco de base:** a chuva medida na estação/grade pode diferir da chuva real
  na fazenda específica.
- **Confiança na fonte de dados:** **mitigada na Sepolia** via Chainlink
  Functions + NASA POWER (DON descentralizada, JS auditável). Como não há
  evento subjetivo, a fraude é ≈ zero.

## API de leitura (frontend)

O contrato é "UI-first": além de `createPolicy/claim/expirePolicy/fundPool/
withdrawCapital`, expõe leituras sem gas:

- `getPolicy(id)` → `PolicyView` (status, premium, `claimable`, `triggerDay`,
  `maxStreak`, `daysElapsed/Remaining`)
- `getPolicyStatus(id)` → enum `Active | Claimable | Paid | Expired`
- `previewClaim(id)` → habilita o botão "Acionar" sem transação
- `getPoliciesByHolder(addr)` / `getPolicyIdsByHolder` / `holderPolicyCount`
- `getPolicies(offset, limit)` → listagem paginada (painel)
- `poolStats()` → `(balance, reserved, free)`
- `getRainfallWindow(id)` → série diária `(dayList, rainMm100, reported)` p/ gráfico

## Comandos

```bash
forge build
forge test                            # 33 testes (27 CropInsurance + 6 Functions)
forge script script/Demo.s.sol -vv    # roteiro narrado da demo

# Deploy em Anvil local (oráculo mock)
anvil
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 \
  --private-key <chave_anvil_0> --broadcast

# Deploy do oráculo Chainlink Functions (Sepolia — precisa subscription+LINK)
export SUBSCRIPTION_ID=<id de functions.chain.link>
forge script script/DeployFunctions.s.sol --rpc-url $SEPOLIA_RPC \
  --private-key $PRIVATE_KEY --broadcast
```

## Demo

`script/Demo.s.sol`: produtor contrata a apólice → chuva normal (claim revertido)
→ 3 dias secos consecutivos → indenização paga automaticamente. Em Anvil ao vivo,
use `evm_increaseTime` para avançar os dias ou um limiar curto para rodar em
tempo real.
