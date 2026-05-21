"use client";

import { useState } from "react";
import {
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  CloudRain,
  Loader2,
  CheckCircle,
  AlertCircle,
  Lock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { formatEther, parseEther } from "viem";
import {
  useReadContract,
  useWriteContract,
  usePublicClient,
} from "wagmi";

import { useAuth } from "@/lib/auth-context";
import { REGIONS } from "@/lib/utils";
import { PoolStats, PolicyRow, PolicyStatus, TxState } from "../types/apolice";
import { CONTRACTS } from "@/lib/contracts";
import { cropInsuranceAbi } from "@/lib/abi/cropInsurance";
import { mockStablecoinAbi } from "@/lib/abi/mockStablecoin";
import { weatherOracleAbi } from "@/lib/abi/weatherOracle";
import {
  ContractPolicyView,
  mapStatus,
  parseContractError,
  regionName,
} from "@/lib/policy";

const POOL_ERRORS: Record<string, string> = {
  "Crop: excede capital livre": "Valor acima do capital livre do pool",
  "Crop: somente owner": "Apenas o owner pode fazer essa operação",
  "ERC20: saldo insuficiente": "Saldo de mBRL insuficiente",
};
const ORACLE_ERRORS: Record<string, string> = {
  "Oracle: somente reporter":
    "Sua carteira não tem permissão de reporter no oráculo",
};
const EXPIRE_ERRORS: Record<string, string> = {
  "Crop: tem seca, use claim":
    "Esta apólice tem seca acionável — use claim, não expire",
  "Crop: janela aberta": "A janela da apólice ainda não fechou",
  "Crop: foi pago": "Esta apólice já foi paga",
  "Crop: ja liberado": "A reserva desta apólice já foi liberada",
};

function formatBRL(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "R$ 0,00";
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const STATUS_BADGE: Record<PolicyStatus, string> = {
  Ativa: "bg-blue-100 text-blue-800",
  Acionável: "bg-amber-100 text-amber-800",
  Paga: "bg-green-100 text-green-800",
  Expirada: "bg-gray-100 text-gray-500",
};

function TxFeedback({
  state,
  errorMsg,
  successMsg,
  loadingMsg,
}: {
  state: TxState;
  errorMsg: string;
  successMsg: string;
  loadingMsg: string;
}) {
  if (state === "idle") return null;
  return (
    <div
      className={`rounded-xl p-3 flex items-center gap-3 mt-3 ${
        state === "processando"
          ? "bg-blue-50 border border-blue-200"
          : state === "sucesso"
            ? "bg-green-50 border border-green-200"
            : "bg-red-50 border border-red-200"
      }`}
    >
      {state === "processando" && (
        <Loader2 className="text-blue-500 animate-spin flex-shrink-0" size={16} />
      )}
      {state === "sucesso" && (
        <CheckCircle className="text-green-500 flex-shrink-0" size={16} />
      )}
      {state === "erro" && (
        <AlertCircle className="text-red-400 flex-shrink-0" size={16} />
      )}
      <p
        className={`text-sm ${
          state === "processando"
            ? "text-blue-700"
            : state === "sucesso"
              ? "text-green-700"
              : "text-red-700"
        }`}
      >
        {state === "processando"
          ? loadingMsg
          : state === "sucesso"
            ? successMsg
            : errorMsg}
      </p>
    </div>
  );
}

function Section({
  title,
  subtitle,
  icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden mb-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="text-gray-400">{icon}</div>
          <div className="text-left">
            <p className="font-semibold text-gray-900 text-sm">{title}</p>
            <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
          </div>
        </div>
        {open ? (
          <ChevronUp size={16} className="text-gray-400" />
        ) : (
          <ChevronDown size={16} className="text-gray-400" />
        )}
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-gray-100 pt-4">{children}</div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const { isAdmin } = useAuth();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  // Pool stats (balance, reserved, free) — lido on-chain.
  const { data: poolRaw, refetch: refetchPool } = useReadContract({
    address: CONTRACTS.cropInsurance,
    abi: cropInsuranceAbi,
    functionName: "poolStats",
    query: { enabled: isAdmin },
  });

  const pool: PoolStats = poolRaw
    ? (() => {
        const [balance, reserved, free] = poolRaw as [bigint, bigint, bigint];
        return {
          balance: formatEther(balance),
          reserved: formatEther(reserved),
          free: formatEther(free),
        };
      })()
    : { balance: "0", reserved: "0", free: "0" };

  // Listagem de todas as apólices (paginação simples: 0..50).
  const { data: allPoliciesRaw, refetch: refetchPolicies } = useReadContract({
    address: CONTRACTS.cropInsurance,
    abi: cropInsuranceAbi,
    functionName: "getPolicies",
    args: [0n, 50n],
    query: { enabled: isAdmin },
  });

  const policies: PolicyRow[] = (
    (allPoliciesRaw as ContractPolicyView[] | undefined) ?? []
  ).map((v) => ({
    id: Number(v.id),
    region: regionName(v.regionId),
    holder: `${v.holder.slice(0, 6)}...${v.holder.slice(-4)}`,
    insuredAmount: formatEther(v.insuredAmount),
    status: mapStatus(v.status),
    daysRemaining: Number(v.daysRemaining),
    claimable: v.claimable,
  }));

  // ---- estado dos formulários ----
  const [fundAmount, setFundAmount] = useState("");
  const [fundState, setFundState] = useState<TxState>("idle");
  const [fundError, setFundError] = useState("");

  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawState, setWithdrawState] = useState<TxState>("idle");
  const [withdrawError, setWithdrawError] = useState("");

  const [rainRegion, setRainRegion] = useState("");
  const [rainDay, setRainDay] = useState("");
  const [rainMm, setRainMm] = useState("");
  const [rainState, setRainState] = useState<TxState>("idle");
  const [rainError, setRainError] = useState("");

  const [expiringId, setExpiringId] = useState<number | null>(null);

  async function handleFund() {
    if (!publicClient || !fundAmount || parseFloat(fundAmount) <= 0) return;
    setFundError("");
    try {
      setFundState("processando");
      const amount = parseEther(fundAmount);
      // 1) approve
      const approveHash = await writeContractAsync({
        address: CONTRACTS.mockStablecoin,
        abi: mockStablecoinAbi,
        functionName: "approve",
        args: [CONTRACTS.cropInsurance, amount],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });
      // 2) fundPool
      const fundHash = await writeContractAsync({
        address: CONTRACTS.cropInsurance,
        abi: cropInsuranceAbi,
        functionName: "fundPool",
        args: [amount],
      });
      await publicClient.waitForTransactionReceipt({ hash: fundHash });
      await refetchPool();
      setFundAmount("");
      setFundState("sucesso");
      setTimeout(() => setFundState("idle"), 3000);
    } catch (err) {
      setFundError(parseContractError(err, POOL_ERRORS));
      setFundState("erro");
    }
  }

  async function handleWithdraw() {
    if (!publicClient) return;
    const valor = parseFloat(withdrawAmount);
    if (!withdrawAmount || valor <= 0) return;
    if (valor > parseFloat(pool.free)) {
      setWithdrawError(`Valor excede o capital livre (${formatBRL(pool.free)})`);
      setWithdrawState("erro");
      return;
    }
    setWithdrawError("");
    try {
      setWithdrawState("processando");
      const hash = await writeContractAsync({
        address: CONTRACTS.cropInsurance,
        abi: cropInsuranceAbi,
        functionName: "withdrawCapital",
        args: [parseEther(withdrawAmount)],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await refetchPool();
      setWithdrawAmount("");
      setWithdrawState("sucesso");
      setTimeout(() => setWithdrawState("idle"), 3000);
    } catch (err) {
      setWithdrawError(parseContractError(err, POOL_ERRORS));
      setWithdrawState("erro");
    }
  }

  async function handleReportRain() {
    if (!publicClient || !rainRegion || !rainDay || !rainMm) return;
    setRainError("");
    try {
      setRainState("processando");
      const mm100 = Math.round(parseFloat(rainMm) * 100);
      const hash = await writeContractAsync({
        address: CONTRACTS.weatherOracle,
        abi: weatherOracleAbi,
        functionName: "reportRainfall",
        args: [BigInt(rainRegion), BigInt(rainDay), BigInt(mm100)],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setRainRegion("");
      setRainDay("");
      setRainMm("");
      setRainState("sucesso");
      setTimeout(() => setRainState("idle"), 3000);
    } catch (err) {
      setRainError(parseContractError(err, ORACLE_ERRORS));
      setRainState("erro");
    }
  }

  async function handleExpire(policyId: number) {
    if (!publicClient) return;
    try {
      setExpiringId(policyId);
      const hash = await writeContractAsync({
        address: CONTRACTS.cropInsurance,
        abi: cropInsuranceAbi,
        functionName: "expirePolicy",
        args: [BigInt(policyId)],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await refetchPolicies();
      await refetchPool();
    } catch (err) {
      // mostra no console; podemos evoluir pra um toast por linha
      console.error("expirePolicy:", parseContractError(err, EXPIRE_ERRORS));
    } finally {
      setExpiringId(null);
    }
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-10 max-w-sm w-full text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-red-100 rounded-full p-4">
              <Lock className="text-red-500" size={32} />
            </div>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Acesso restrito</h1>
          <p className="text-sm text-gray-500">
            Esta página é exclusiva para o administrador do contrato. Conecte a
            carteira correta para acessar.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={20} className="text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Painel admin</h1>
          </div>
          <p className="text-gray-500 text-sm">
            Gerencie o pool, reporte chuva e acompanhe todas as apólices.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            {
              label: "Saldo total",
              value: formatBRL(pool.balance),
              color: "text-gray-900",
              bg: "bg-white",
              border: undefined as string | undefined,
            },
            {
              label: "Capital reservado",
              value: formatBRL(pool.reserved),
              color: "text-amber-700",
              bg: "bg-amber-50",
              border: "border-amber-200",
            },
            {
              label: "Capital livre",
              value: formatBRL(pool.free),
              color: "text-green-700",
              bg: "bg-green-50",
              border: "border-green-200",
            },
          ].map((card) => (
            <div
              key={card.label}
              className={`${card.bg} border ${card.border ?? "border-gray-200"} rounded-2xl p-4`}
            >
              <p className="text-xs text-gray-400 mb-1">{card.label}</p>
              <p className={`text-base font-bold ${card.color}`}>{card.value}</p>
            </div>
          ))}
        </div>

        <Section
          title="Aportar capital"
          subtitle="Depositar stablecoin no pool de seguros"
          icon={<TrendingUp size={20} />}
        >
          <p className="text-xs text-gray-400 mb-3">
            Requer 2 transações: aprovar o gasto do token e depois depositar no pool.
          </p>
          <div className="flex gap-2">
            <input
              type="number"
              value={fundAmount}
              onChange={(e) => setFundAmount(e.target.value)}
              placeholder="Valor em mBRL"
              min={1}
              className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleFund}
              disabled={fundState === "processando" || !fundAmount}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-200 text-white text-sm font-medium px-5 py-2 rounded-xl transition-colors"
            >
              {fundState === "processando" ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                "Depositar"
              )}
            </button>
          </div>
          <TxFeedback
            state={fundState}
            loadingMsg="Processando depósito (approve + fundPool)..."
            successMsg="Capital aportado com sucesso!"
            errorMsg={fundError || "Não foi possível aportar."}
          />
        </Section>

        <Section
          title="Retirar capital"
          subtitle="Sacar somente o capital livre (não reservado)"
          icon={<TrendingDown size={20} />}
          defaultOpen={false}
        >
          <p className="text-xs text-gray-400 mb-3">
            Capital livre disponível:{" "}
            <span className="font-medium text-gray-600">{formatBRL(pool.free)}</span>.
            Você não pode retirar capital reservado para apólices ativas.
          </p>
          <div className="flex gap-2">
            <input
              type="number"
              value={withdrawAmount}
              onChange={(e) => {
                setWithdrawAmount(e.target.value);
                setWithdrawState("idle");
              }}
              placeholder="Valor em mBRL"
              min={1}
              max={parseFloat(pool.free)}
              className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleWithdraw}
              disabled={withdrawState === "processando" || !withdrawAmount}
              className="bg-gray-700 hover:bg-gray-800 disabled:bg-gray-200 text-white text-sm font-medium px-5 py-2 rounded-xl transition-colors"
            >
              {withdrawState === "processando" ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                "Retirar"
              )}
            </button>
          </div>
          <TxFeedback
            state={withdrawState}
            loadingMsg="Processando retirada..."
            successMsg="Capital retirado com sucesso!"
            errorMsg={withdrawError || "Não foi possível retirar."}
          />
        </Section>

        <Section
          title="Reportar chuva"
          subtitle="Enviar dados de precipitação para o oráculo"
          icon={<CloudRain size={20} />}
        >
          <p className="text-xs text-gray-400 mb-3">
            Reporta direto no WeatherOracle (sua carteira é reporter). Em produção
            isso é feito automaticamente pelo Chainlink Functions consumindo a NASA
            POWER.
          </p>
          <div className="grid grid-cols-3 gap-2 mb-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Região</label>
              <select
                value={rainRegion}
                onChange={(e) => setRainRegion(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione...</option>
                {REGIONS.map((r: { id: string; name: string }) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Dia absoluto
                <span className="text-gray-400 ml-1">(timestamp ÷ 86400)</span>
              </label>
              <input
                type="number"
                value={rainDay}
                onChange={(e) => setRainDay(e.target.value)}
                placeholder="ex: 20592"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Chuva (mm)</label>
              <input
                type="number"
                value={rainMm}
                onChange={(e) => setRainMm(e.target.value)}
                placeholder="ex: 1.50"
                step={0.01}
                min={0}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {rainMm && (
            <p className="text-xs text-gray-400 mb-3">
              Será enviado ao contrato como{" "}
              <span className="font-mono text-gray-600">
                {Math.round(parseFloat(rainMm) * 100)}
              </span>{" "}
              (mm × 100, conforme convenção do oráculo)
            </p>
          )}

          <button
            onClick={handleReportRain}
            disabled={
              rainState === "processando" || !rainRegion || !rainDay || !rainMm
            }
            className="w-full bg-sky-600 hover:bg-sky-700 disabled:bg-sky-200 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
          >
            {rainState === "processando" ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="animate-spin" size={15} />
                Reportando...
              </span>
            ) : (
              "Reportar chuva"
            )}
          </button>

          <TxFeedback
            state={rainState}
            loadingMsg="Enviando dados ao oráculo..."
            successMsg="Chuva reportada com sucesso!"
            errorMsg={rainError || "Não foi possível reportar."}
          />
        </Section>

        <Section
          title="Todas as apólices"
          subtitle="Listagem completa e gerenciamento"
          icon={<ShieldCheck size={20} />}
          defaultOpen={false}
        >
          {policies.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              Nenhuma apólice criada ainda.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {policies.map((policy) => (
                <div
                  key={policy.id}
                  className="border border-gray-100 rounded-xl p-4 flex items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        #{policy.id} — {policy.region}
                      </p>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_BADGE[policy.status]}`}
                      >
                        {policy.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 font-mono truncate">
                      {policy.holder}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatBRL(policy.insuredAmount)} segurados
                      {policy.status === "Ativa" &&
                        ` · ${policy.daysRemaining} dias restantes`}
                    </p>
                  </div>

                  {policy.status === "Ativa" && !policy.claimable && (
                    <button
                      onClick={() => handleExpire(policy.id)}
                      disabled={expiringId === policy.id}
                      className="text-xs text-gray-500 border border-gray-200 hover:border-gray-300 hover:text-gray-700 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0 flex items-center gap-1.5"
                    >
                      {expiringId === policy.id ? (
                        <Loader2 className="animate-spin" size={12} />
                      ) : null}
                      Expirar
                    </button>
                  )}

                  {policy.status === "Acionável" && (
                    <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-lg flex-shrink-0">
                      Use claim
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-gray-400 text-center mt-4">
            Mostrando {policies.length} apólice{policies.length !== 1 ? "s" : ""}.
          </p>
        </Section>
      </div>
    </main>
  );
}
