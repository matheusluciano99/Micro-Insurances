import { formatEther } from "viem";
import { Policy, PolicyStatus, RainfallDay } from "@/app/types/apolice";
import { REGIONS } from "@/lib/utils";

// PolicyView do contrato (na ordem do struct em CropInsurance.sol).
// wagmi retorna structs como objetos com os nomes dos campos.
export type ContractPolicyView = {
  id: bigint;
  holder: `0x${string}`;
  regionId: bigint;
  startDay: bigint;
  endDay: bigint;
  drySpellDays: bigint;
  rainThresholdMm100: bigint;
  insuredAmount: bigint;
  premium: bigint;
  paid: boolean;
  reserveReleased: boolean;
  status: number; // 0 Active | 1 Claimable | 2 Paid | 3 Expired
  claimable: boolean;
  triggerDay: bigint;
  maxStreak: bigint;
  daysElapsed: bigint;
  daysRemaining: bigint;
};

const STATUS_LABELS: PolicyStatus[] = ["Ativa", "Acionável", "Paga", "Expirada"];

export function mapStatus(s: number): PolicyStatus {
  return STATUS_LABELS[s] ?? "Ativa";
}

export function regionName(regionId: bigint): string {
  return (
    REGIONS.find((r) => r.id === String(regionId))?.name ??
    `Região ${regionId.toString()}`
  );
}

// Dia absoluto (epoch/86400) → "YYYY-MM-DD"
export function dayToISO(day: bigint): string {
  return new Date(Number(day) * 86400 * 1000).toISOString().split("T")[0];
}

export function mapPolicyView(v: ContractPolicyView): Policy {
  return {
    id: Number(v.id),
    region: regionName(v.regionId),
    startDate: dayToISO(v.startDay),
    endDate: dayToISO(v.endDay),
    insuredAmount: formatEther(v.insuredAmount),
    premium: formatEther(v.premium),
    status: mapStatus(v.status),
    maxStreak: Number(v.maxStreak),
    drySpellDays: Number(v.drySpellDays),
    thresholdMm: Number(v.rainThresholdMm100) / 100,
    daysElapsed: Number(v.daysElapsed),
    daysRemaining: Number(v.daysRemaining),
    claimable: v.claimable,
    triggerDay: v.triggerDay > 0n ? Number(v.triggerDay) : undefined,
  };
}

// getRainfallWindow retorna 3 arrays paralelos; combina em RainfallDay[]
export function mapRainfallWindow(
  days: readonly bigint[],
  rainMm100: readonly bigint[],
  reported: readonly boolean[],
): RainfallDay[] {
  return days.map((d, i) => ({
    day: Number(d),
    mm: Number(rainMm100[i] ?? 0n) / 100,
    reported: !!reported[i],
  }));
}

// Dia absoluto de hoje (== CropInsurance.currentDay())
export function todayAbsoluteDay(): bigint {
  return BigInt(Math.floor(Date.now() / 1000 / 86400));
}

// Converte data "YYYY-MM-DD" para dia absoluto (UTC)
export function dateToAbsoluteDay(yyyyMmDd: string): bigint {
  return BigInt(Math.floor(Date.parse(yyyyMmDd) / 1000 / 86400));
}

// Extrai mensagem amigável de erro vindo de revert do contrato/viem.
export function parseContractError(
  err: unknown,
  messages: Record<string, string>,
): string {
  const msg = String(
    err && typeof err === "object" && "shortMessage" in err
      ? (err as { shortMessage?: string }).shortMessage
      : err,
  );
  // viem expõe a mensagem do revert no shortMessage / details / cause
  const full =
    msg +
    " " +
    String((err as { details?: string } | undefined)?.details ?? "") +
    " " +
    String((err as { cause?: unknown } | undefined)?.cause ?? "");
  for (const [key, label] of Object.entries(messages)) {
    if (full.includes(key)) return label;
  }
  return "Algo deu errado. Tente novamente.";
}
