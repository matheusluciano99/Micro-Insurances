type Addr = `0x${string}`;

const orDefault = (v: string | undefined, fallback: string): Addr =>
  ((v ?? fallback) as Addr);

// Endereços já deployados e verificados na Sepolia.
// Sobrescreva via .env.local (NEXT_PUBLIC_*) se precisar.
export const CONTRACTS = {
  cropInsurance: orDefault(
    process.env.NEXT_PUBLIC_CROP_INSURANCE_ADDRESS,
    "0xd786BAD5D896938E384d6C110f5d6bc44BF9a7ed",
  ),
  mockStablecoin: orDefault(
    process.env.NEXT_PUBLIC_MOCK_STABLECOIN_ADDRESS,
    "0x629B047D6d637Ae058d9B6D24308f8116FdB5Ff6",
  ),
  weatherOracle: orDefault(
    process.env.NEXT_PUBLIC_WEATHER_ORACLE_ADDRESS,
    "0x9b3ccC0007e6a2A6AeEbc2bf84df1A01b2723c05",
  ),
  nasaConsumer: orDefault(
    process.env.NEXT_PUBLIC_NASA_CONSUMER_ADDRESS,
    "0xcd36E43CEB04986358A5bbC6883492061AD6a9bF",
  ),
} as const;
