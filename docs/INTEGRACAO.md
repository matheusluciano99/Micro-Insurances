# Integração — História de usuário (Frontend ↔ Contratos)

Documento de alinhamento. **Sem backend**: a arquitetura é só
**Frontend (wagmi/viem + RainbowKit) + Contratos**. Tudo aqui está amarrado na
ABI **real** dos contratos em `src/` (não inventar função que não existe).

## Por que sem backend

- Listas/consultas: a UI lê **direto da chain** (o contrato é UI-first:
  `getPoliciesByHolder`, `getPolicies`, `poolStats`, `getRainfallWindow`...).
- Updates ao vivo: `watchContractEvent` (wagmi) — sem indexer.
- Sinistro: `claim` é permissionless; o usuário clica o botão (ninguém aprova).
- A única ação "de fora" — reportar a chuva no oráculo — vira uma **aba Admin**
  no próprio frontend (a carteira do time tem a role de `reporter`).

## Personas

- **Dona Marta** — pequena produtora. Conecta carteira, contrata, acompanha e
  recebe a indenização.
- **Cooperativa/Seguradora (admin)** — `owner` do `CropInsurance` e do
  `WeatherOracle` e `reporter` do oráculo. Aporta capital e reporta a chuva.
  Tudo isso por uma **aba Admin** no mesmo frontend.

## Divisão de responsabilidades

| Camada | Faz | **NÃO** faz |
|---|---|---|
| Contratos | custódia do pool, regra de seca, pagamento automático, fonte da verdade | — |
| Frontend | conectar carteira, ler views, montar txs, renderizar status/progresso/gráfico, **aba Admin** (capital + reportar chuva) | guardar dinheiro, decidir sinistro |

> **Liquidação é trustless**: não há função de aprovar/negar sinistro; `claim` é
> permissionless e paga sempre `policy.holder`; o admin não dreni o capital
> reservado (`withdrawCapital` ≤ `freeCapital`).
> **Limitação honesta (oracle trust)**: o admin é `reporter` do `WeatherOracle`,
> então *pode* negar um sinistro legítimo indiretamente — deixando de reportar a
> seca ou reportando chuva falsa. No MVP isso é assumido e documentado; mitigação
> de produção = fonte pública/oráculo independente e/ou mediana multi-fonte.

## Convenções compartilhadas (toda a UI usa igual)

- **Dia absoluto**: `day = floor(timestamp / 86400)`. `startDay`/`endDay` são
  dias absolutos. **Use `currentDay()` do contrato** como referência, não o
  relógio do navegador.
  - Data → dia: `Math.floor(Date.parse(d)/1000/86400)`.
- **Chuva**: `rainThresholdMm100` e o oráculo usam **mm × 100** (1,50 mm = `150`).
- **Prêmio**: ler via `premiumOf(insuredAmount)` (= `insured * premiumBps / 1e4`).
- **Token**: `MockStablecoin` tem 18 casas. Use `parseEther`.

---

## A jornada (passo a passo: UI ↔ contrato)

### 0. Bootstrap (aba Admin, uma vez)
- Admin conecta carteira (a do deploy = `owner`).
- `MockStablecoin.mint(admin, x)` → `approve(insurance, x)` →
  `CropInsurance.fundPool(x)`.
- (Já é `reporter` por ter feito o deploy do oráculo; se precisar de outra
  carteira: `WeatherOracle.setReporter(addr, true)`.)

### 1. Conectar carteira
- **UI**: botão RainbowKit `Conectar Carteira`; depois avatar + endereço.

### 2. Ver saldo e cotar a apólice
- **UI lê**: `MockStablecoin.balanceOf(user)`, `insurance.currentDay()`,
  `insurance.premiumBps()`, `insurance.MAX_DURATION_DAYS()`.
- **UI**: formulário (região, data início → `startDay >= currentDay()`,
  duração ≤ `MAX_DURATION_DAYS`, `drySpellDays` N, limiar mm, soma segurada).
  Mostra o prêmio com `insurance.premiumOf(insuredAmount)` (read).

### 3. Contratar (2 transações)
- **UI envia**:
  1. `MockStablecoin.approve(insurance, premium)`
  2. `insurance.createPolicy(regionId, startDay, durationDays, drySpellDays, rainThresholdMm100, insuredAmount)`
- **Contrato emite**: `PolicyCreated(policyId, holder, …, premium)`.
- **UI**: pega `policyId` do recibo/evento e navega para a apólice.

### 4. Acompanhar a safra
- **UI lê** (refresh + `watchContractEvent`):
  - `insurance.getPolicy(id)` → `PolicyView` (status, `maxStreak`,
    `daysElapsed/Remaining`, `claimable`, `triggerDay`).
  - `insurance.getRainfallWindow(id)` → `(dayList, rainMm100, reported)` →
    **gráfico de chuva**.
  - Barra de progresso de seca = `maxStreak / drySpellDays`.
- **Aba Admin (time)**: a cada "dia" da demo, para a região ativa, chama
  `WeatherOracle.reportRainfall(regionId, day, mm100)`. Emite `RainfallReported`
  → a UI da Dona Marta reflete via watch/refresh.

### 5. Seca detectada → acionar sinistro
- **UI lê**: `insurance.previewClaim(id)` → `(claimable, triggerDay)` e
  `getPolicyStatus(id) == Claimable` → habilita botão **"Acionar indenização"**.
- **UI envia**: `insurance.claim(id)` (qualquer carteira; o `holder` recebe).
- **Contrato emite**: `ClaimPaid(policyId, holder, amount, triggerDay)` e
  transfere a stablecoin pra Dona Marta.
- **UI**: `watchContractEvent('ClaimPaid')` → toast "Indenização paga ✓",
  status vira `Paid`, mostra valor e link do tx.

### 6. Safra sem seca (expiração)
- `currentDay() > endDay` sem seca → status `Expired`.
- **Aba Admin** (ou qualquer um): `insurance.expirePolicy(id)` libera a reserva
  (emite `PolicyExpired`). Não paga ninguém; só housekeeping do pool.

### 7. Painel do admin
- **UI lê**: `insurance.poolStats()` → `(balance, reserved, free)`;
  `insurance.getPolicies(offset, limit)` → lista paginada de `PolicyView`.
- **UI envia (somente owner)**: `fundPool`, `withdrawCapital` (≤ `free`),
  `WeatherOracle.reportRainfall`, `expirePolicy`.

---

## Cheat-sheet da ABI

### CropInsurance — escrita
- `createPolicy(regionId, startDay, durationDays, drySpellDays, rainThresholdMm100, insuredAmount) → policyId`
- `claim(policyId) → triggerDay` (permissionless)
- `expirePolicy(policyId)`
- `fundPool(amount)` · `withdrawCapital(amount)` (onlyOwner)

### CropInsurance — leitura (sem gas, ideal p/ UI)
- `getPolicy(id) → PolicyView`
- `getPolicyStatus(id) → PolicyStatus` (`0 Active,1 Claimable,2 Paid,3 Expired`)
- `previewClaim(id) → (bool claimable, uint256 triggerDay)`
- `getPoliciesByHolder(addr) → PolicyView[]` · `getPolicyIdsByHolder(addr)` · `holderPolicyCount(addr)`
- `getPolicies(offset, limit) → PolicyView[]`
- `poolStats() → (balance, reserved, free)` · `poolBalance()` · `freeCapital()`
- `getRainfallWindow(id) → (dayList[], rainMm100[], reported[])`
- `currentDay()` · `premiumOf(insured)` · `premiumBps()` · `MAX_DURATION_DAYS()`
- `policies(id)` · `policiesCount()` · `owner()` · `token()` · `oracle()`

### PolicyView (campos)
`id, holder, regionId, startDay, endDay, drySpellDays, rainThresholdMm100,
insuredAmount, premium, paid, reserveReleased, status, claimable, triggerDay,
maxStreak, daysElapsed, daysRemaining`

### WeatherOracle
- `reportRainfall(regionId, day, rainfallMm100)` (onlyReporter)
- `getRainfall(regionId, day)` (reverte se não reportado) · `isReported(regionId, day)`
- `setReporter(addr, bool)` (onlyOwner) · `isReporter(addr)` · `owner()`

### NasaRainfallConsumer (Chainlink Functions — só Sepolia)
- `requestRainfall(regionId, day, lat, lon, dateYYYYMMDD)` (onlyOwner) — a DON
  busca a **API oficial NASA POWER** e, no callback, grava via
  `WeatherOracle.reportRainfall`. O consumer é o `reporter` (não um humano).
- `setConfig(donId, subscriptionId, callbackGasLimit)` · `setSource(js)` (onlyOwner)
- Eventos: `RainfallRequested`, `RainfallFulfilled`, `RainfallRequestFailed`

> **Dois modos de oráculo:**
> - **Sepolia (produção/best practice):** `NasaRainfallConsumer` + DON. Confiança
>   minimizada — qualquer um audita o JS e a NASA. Precisa subscription + LINK.
> - **Anvil (demo local):** não há DON; usa-se o `WeatherOracle` mock com
>   `reportRainfall` manual (aba Admin / script de demo).
> O `WeatherOracle` e o `CropInsurance` são **idênticos** nos dois modos — só
> muda quem é o `reporter`.

### Eventos para `watchContractEvent`
- `CropInsurance`: `PolicyCreated`, `CapitalFunded`, `ClaimPaid`,
  `PolicyExpired`, `CapitalWithdrawn`
- `WeatherOracle`: `RainfallReported`, `ReporterSet`
- `MockStablecoin`: `Transfer`, `Approval`

## Mapa de erros (require → mensagem de UI)

| Revert | Mostrar na UI |
|---|---|
| `Crop: nao segura o passado` | "Data de início precisa ser hoje ou futura" |
| `Crop: duracao excede maximo` | "Duração máxima: 366 dias" |
| `Crop: drySpell invalido` | "Dias secos deve ser entre 1 e a duração" |
| `Crop: pool insolvente` | "Capital do pool insuficiente no momento" |
| `Crop: sem seca elegivel` | "Ainda não há seca que dispare a indenização" |
| `Crop: ja pago` | "Esta apólice já foi indenizada" |
| `Crop: tem seca, use claim` | "Há seca acionável — use Acionar, não expirar" |
| `Crop: excede capital livre` | "Valor acima do capital livre do pool" |
| `Oracle: somente reporter` | "Carteira sem permissão para reportar chuva" |

## Setup local

```bash
anvil                                  # chain local
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 \
  --private-key <chave_anvil_0> --broadcast
# anote os endereços logados (MockStablecoin/WeatherOracle/CropInsurance)
```

- **Frontend**: wagmi apontando para `http://localhost:8545`, chainId do Anvil,
  endereços do deploy. ABIs em `out/<Contrato>.sol/<Contrato>.json`.
- **Carteiras da demo**: `chave_anvil_0` = admin/owner (aba Admin);
  outra conta do Anvil = Dona Marta (importar no MetaMask).
- **Tempo na demo**: `currentDay()` usa o relógio da chain — use
  `evm_increaseTime` + `evm_mine` (RPC do Anvil) para "passar os dias" sem
  esperar, reportando a chuva de cada dia pela aba Admin.

## Exemplo viem (copiar e adaptar)

ABIs ficam em `out/<Contrato>.sol/<Contrato>.json` (campo `.abi`). Anvil =
chain `foundry` (chainId 31337) do `viem/chains`.

```ts
import { createPublicClient, createWalletClient, http, parseEther } from "viem";
import { foundry } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

import CropArtifact from "../../out/CropInsurance.sol/CropInsurance.json";
import TokenArtifact from "../../out/MockStablecoin.sol/MockStablecoin.json";

const cropAbi = CropArtifact.abi;
const tokenAbi = TokenArtifact.abi;

// endereços vêm do log do Deploy.s.sol
const CROP = "0x...";
const TOKEN = "0x...";

const publicClient = createPublicClient({ chain: foundry, transport: http() });

// no app real use a carteira do RainbowKit/wagmi; aqui chave do Anvil p/ exemplo
const account = privateKeyToAccount("0xac0974bec...");
const wallet = createWalletClient({ account, chain: foundry, transport: http() });

// --- LEITURA: status de uma apólice ---------------------------------------
const view = await publicClient.readContract({
  address: CROP, abi: cropAbi, functionName: "getPolicy", args: [0n],
});
// view.status: 0 Active | 1 Claimable | 2 Paid | 3 Expired
// view.maxStreak / view.drySpellDays -> barra de progresso

const [claimable, triggerDay] = await publicClient.readContract({
  address: CROP, abi: cropAbi, functionName: "previewClaim", args: [0n],
}) as [boolean, bigint];

// --- ESCRITA: contratar (approve -> createPolicy) -------------------------
const insured = parseEther("1000");

const premium = await publicClient.readContract({
  address: CROP, abi: cropAbi, functionName: "premiumOf", args: [insured],
}) as bigint;

await wallet.writeContract({
  address: TOKEN, abi: tokenAbi, functionName: "approve", args: [CROP, premium],
});

// dia absoluto: use currentDay() do contrato como base (NUNCA Date do browser)
const today = await publicClient.readContract({
  address: CROP, abi: cropAbi, functionName: "currentDay",
}) as bigint;
const startDay = today;            // começa hoje
const durationDays = 90n;
const drySpellDays = 10n;
const rainThresholdMm100 = 100n;   // 1,00 mm

const hash = await wallet.writeContract({
  address: CROP, abi: cropAbi, functionName: "createPolicy",
  args: [1n, startDay, durationDays, drySpellDays, rainThresholdMm100, insured],
});
await publicClient.waitForTransactionReceipt({ hash });

// --- EVENTOS: reagir ao pagamento -----------------------------------------
const unwatch = publicClient.watchContractEvent({
  address: CROP, abi: cropAbi, eventName: "ClaimPaid",
  onLogs: (logs) => {
    for (const l of logs) {
      // l.args: { policyId, holder, amount, triggerDay }
      console.log("Indenização paga:", l.args);
    }
  },
});
```

> `claim(policyId)` é igual ao `createPolicy` (write); qualquer carteira pode
> chamar — o pagamento vai sempre para `policy.holder`.

## Sugestão de telas (frontend)

1. **Conectar / Home** — RainbowKit + resumo.
2. **Contratar** — formulário + cotação (`premiumOf`) + 2 txs.
3. **Minha apólice** — `PolicyView`: status, barra `maxStreak/drySpellDays`,
   gráfico (`getRainfallWindow`), botão "Acionar" (gate por `previewClaim`).
4. **Minhas apólices** — lista via `getPoliciesByHolder`.
5. **Admin** (só `owner`/`reporter`) — `poolStats`, `fundPool`,
   `withdrawCapital`, **Reportar chuva** (`reportRainfall`), `expirePolicy`,
   listagem `getPolicies`.
