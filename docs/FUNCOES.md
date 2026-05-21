# Funções principais (slide)

## CropInsurance — o núcleo

| Função | O que faz |
|---|---|
| `createPolicy(região, início, duração, diasSeca, limiar, valor)` | contrata a apólice e cobra o prêmio |
| `claim(policyId)` | aciona a indenização — **permissionless**, paga sempre o segurado, automático |
| `expirePolicy(policyId)` | encerra apólice sem seca e libera a reserva |
| `premiumOf(valor)` | cotação do prêmio (% do valor segurado) |
| `fundPool` / `withdrawCapital` | aporta / saca capital do pool (saque só o livre) |
| `getPolicy` / `previewClaim` / `poolStats` | leituras pra UI (sem gas) |

## WeatherOracle — o banco de chuva

| Função | O que faz |
|---|---|
| `reportRainfall(região, dia, mm)` | grava a chuva do dia (só reporter autorizado) |
| `getRainfall(região, dia)` | lê a chuva — reverte se o dia não foi reportado |
| `isReported(região, dia)` | diz se aquele dia já tem dado |
| `setReporter(addr, bool)` | autoriza quem pode gravar (admin + Chainlink) |

## NasaRainfallConsumer — a ponte Chainlink → NASA

| Função | O que faz |
|---|---|
| `requestRainfall(região, dia, lat, lon, data)` | pede o dado à DON da Chainlink |
| `fulfillRequest(reqId, resposta, erro)` | callback da DON: grava no oráculo (ou ignora se erro) |
| `setConfig` / `setSource` | configura DON, subscription e o JS executado |

## MockStablecoin — a moeda (ERC-20)

| Função | O que faz |
|---|---|
| `mint(to, valor)` | cunha tokens (aberto — só pra teste/demo) |
| `approve(spender, valor)` | autoriza o CropInsurance a debitar o prêmio |

---

### Ciclo completo em 4 funções

`createPolicy` → `requestRainfall`/`reportRainfall` (oráculo recebe a chuva) → `claim` (paga automático)

### Detalhe forte

No `fulfillRequest`, se a NASA não tem o dado (latência), vem erro e o consumer
**não grava nada** — não inventa um zero. E `getRainfall` **reverte** em dia não
reportado. O seguro nunca paga (nem nega) com base em dado ausente.
