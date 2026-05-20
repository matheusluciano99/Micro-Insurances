# Microsseguro paramétrico de seca — monorepo

Microsseguro de seca para pequenos produtores rurais. Pagamento **automático**
on-chain quando ocorrer N dias secos consecutivos na janela da apólice.
Sem perito, sem aprovador, sem custódia.

## Layout

```
.
├── contracts/   Foundry: contratos + testes + scripts de deploy
├── frontend/    Next.js 16 + wagmi + RainbowKit + shadcn/ui
└── docs/        INTEGRACAO.md (jornada UI ↔ contrato, ABI, exemplos viem)
```

- **[`contracts/`](./contracts/README.md)** — Solidity 0.8.34, 33 testes verdes,
  deploy verificado na Sepolia.
- **[`frontend/`](./frontend/README.md)** — Next.js app (rodar com `npm run dev`).
- **[`docs/INTEGRACAO.md`](./docs/INTEGRACAO.md)** — documento único de
  integração: endereços Sepolia, cheat-sheet da ABI, mapa de erros, telas.

## Comandos rápidos

```bash
# Contratos
cd contracts && forge test            # 33 passando
cd contracts && just deploy-core      # deploy do núcleo na Sepolia

# Frontend
cd frontend && cp .env.example .env.local && npm install && npm run dev
```

## Endereços Sepolia (chainId 11155111, verificados)

| Contrato | Endereço |
|---|---|
| `CropInsurance` | `0xd786BAD5D896938E384d6C110f5d6bc44BF9a7ed` |
| `MockStablecoin` | `0x629B047D6d637Ae058d9B6D24308f8116FdB5Ff6` |
| `WeatherOracle` | `0x9b3ccC0007e6a2A6AeEbc2bf84df1A01b2723c05` |
| `NasaRainfallConsumer` | `0xcd36E43CEB04986358A5bbC6883492061AD6a9bF` |
