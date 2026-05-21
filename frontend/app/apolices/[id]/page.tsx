"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ShieldCheck,
  CheckCircle,
  Loader2,
  AlertCircle,
  Calendar,
} from "lucide-react";
import {
  useReadContract,
  useWriteContract,
  usePublicClient,
} from "wagmi";

import { TxState } from "../../types/apolice";
import { RainfallChart } from "@/components/rainfall-chart";
import { StatusBadge } from "@/components/status-badge";
import { formatBRL } from "@/lib/utils";
import { CONTRACTS } from "@/lib/contracts";
import { cropInsuranceAbi } from "@/lib/abi/cropInsurance";
import {
  ContractPolicyView,
  mapPolicyView,
  mapRainfallWindow,
  parseContractError,
} from "@/lib/policy";

const CLAIM_ERRORS: Record<string, string> = {
  "Crop: sem seca elegivel":
    "Ainda não há seca que dispare a indenização nesta apólice",
  "Crop: ja pago": "Esta apólice já foi indenizada",
  "Crop: policy inexistente": "Apólice não existe",
};

export default function ApoliceDetalhePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const policyIdNum = Number(params.id);
  const policyIdValid = Number.isFinite(policyIdNum) && policyIdNum >= 0;
  const policyIdBig = policyIdValid ? BigInt(policyIdNum) : undefined;

  const [txState, setTxState] = useState<TxState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const {
    data: rawPolicy,
    isLoading: loadingPolicy,
    isError: errorPolicy,
    refetch: refetchPolicy,
  } = useReadContract({
    address: CONTRACTS.cropInsurance,
    abi: cropInsuranceAbi,
    functionName: "getPolicy",
    args: policyIdBig !== undefined ? [policyIdBig] : undefined,
    query: { enabled: policyIdBig !== undefined },
  });

  const { data: rainfallData } = useReadContract({
    address: CONTRACTS.cropInsurance,
    abi: cropInsuranceAbi,
    functionName: "getRainfallWindow",
    args: policyIdBig !== undefined ? [policyIdBig] : undefined,
    query: { enabled: policyIdBig !== undefined && !errorPolicy },
  });

  const policy = rawPolicy
    ? mapPolicyView(rawPolicy as ContractPolicyView)
    : undefined;

  const rainfall = rainfallData
    ? mapRainfallWindow(
        (rainfallData as [readonly bigint[], readonly bigint[], readonly boolean[]])[0],
        (rainfallData as [readonly bigint[], readonly bigint[], readonly boolean[]])[1],
        (rainfallData as [readonly bigint[], readonly bigint[], readonly boolean[]])[2],
      )
    : [];

  async function handleClaim() {
    if (!publicClient || policyIdBig === undefined) return;
    setErrorMsg("");
    try {
      setTxState("processando");
      const hash = await writeContractAsync({
        address: CONTRACTS.cropInsurance,
        abi: cropInsuranceAbi,
        functionName: "claim",
        args: [policyIdBig],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await refetchPolicy();
      setTxState("sucesso");
    } catch (err) {
      setErrorMsg(parseContractError(err, CLAIM_ERRORS));
      setTxState("erro");
    }
  }

  if (loadingPolicy) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="text-gray-400 animate-spin mx-auto mb-3" size={28} />
          <p className="text-sm text-gray-500">Lendo apólice...</p>
        </div>
      </main>
    );
  }

  if (errorPolicy || !policy) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Apólice não encontrada.</p>
          <Link
            href="/apolices"
            className="text-blue-600 hover:underline text-sm"
          >
            Voltar para minhas apólices
          </Link>
        </div>
      </main>
    );
  }

  const streakPct = Math.min(
    Math.round((policy.maxStreak / policy.drySpellDays) * 100),
    100,
  );
  const streakBarColor =
    streakPct >= 100
      ? "bg-red-400"
      : streakPct >= 70
        ? "bg-amber-400"
        : "bg-blue-400";

  if (txState === "sucesso") {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-10 max-w-md w-full text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-green-100 rounded-full p-4">
              <CheckCircle className="text-green-600" size={40} />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Indenização enviada!
          </h1>
          <p className="text-gray-500 mb-2">
            {formatBRL(policy.insuredAmount)} foram enviados para sua carteira.
          </p>
          <p className="text-xs text-gray-400 mb-8">
            A transferência foi registrada na blockchain e não pode ser revertida.
          </p>
          <button
            onClick={() => router.push("/apolices")}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-colors"
          >
            Voltar para minhas apólices
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/apolices"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
        >
          <ArrowLeft size={14} />
          Minhas apólices
        </Link>

        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-4">
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="text-xs text-gray-400 mb-1">Apólice #{policy.id}</p>
              <h1 className="text-2xl font-bold text-gray-900">{policy.region}</h1>
            </div>
            <StatusBadge status={policy.status} />
          </div>
          <div className="flex items-center gap-1.5 text-sm text-gray-400">
            <Calendar size={13} />
            <span>
              {policy.startDate} → {policy.endDate}
            </span>
          </div>
        </div>

        {policy.status === "Acionável" && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 flex gap-3">
            <AlertCircle
              className="text-amber-500 flex-shrink-0 mt-0.5"
              size={20}
            />
            <div>
              <p className="text-sm font-semibold text-amber-800">Seca detectada</p>
              <p className="text-sm text-amber-700 mt-0.5">
                {policy.maxStreak} dias consecutivos sem chuva acima do limiar. Você
                pode acionar a indenização agora.
              </p>
            </div>
          </div>
        )}

        {policy.status === "Paga" && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-4 flex gap-3">
            <ShieldCheck className="text-green-500 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-sm font-semibold text-green-800">
                Indenização recebida
              </p>
              <p className="text-sm text-green-700 mt-0.5">
                {formatBRL(policy.insuredAmount)} foram transferidos para sua
                carteira.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[
            { label: "Valor segurado", value: formatBRL(policy.insuredAmount) },
            { label: "Prêmio pago", value: formatBRL(policy.premium) },
            { label: "Dias decorridos", value: `${policy.daysElapsed} dias` },
            {
              label: policy.status === "Ativa" ? "Dias restantes" : "Duração total",
              value:
                policy.status === "Ativa"
                  ? `${policy.daysRemaining} dias`
                  : `${policy.daysElapsed} dias`,
            },
          ].map((item) => (
            <div
              key={item.label}
              className="bg-white border border-gray-200 rounded-xl p-4"
            >
              <p className="text-xs text-gray-400 mb-1">{item.label}</p>
              <p className="text-sm font-semibold text-gray-900">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
            Progresso de seca
          </p>
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm text-gray-600">
              {policy.maxStreak} de {policy.drySpellDays} dias atingidos
            </p>
            <p
              className={`text-sm font-semibold ${
                streakPct >= 100
                  ? "text-red-600"
                  : streakPct >= 70
                    ? "text-amber-600"
                    : "text-gray-600"
              }`}
            >
              {streakPct}%
            </p>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all ${streakBarColor}`}
              style={{ width: `${streakPct}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Limiar: {policy.thresholdMm} mm/dia — dias com menos chuva contam para a
            sequência de seca
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
            Histórico de chuva
          </p>
          <p className="text-xs text-gray-400 mb-4">
            Janela completa da apólice; dias ainda não reportados aparecem como 0
          </p>
          {rainfall.length > 0 ? (
            <>
              <RainfallChart data={rainfall} thresholdMm={policy.thresholdMm} />
              <div className="flex gap-4 mt-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-blue-400" />
                  <span className="text-xs text-gray-400">Acima do limiar</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-red-300" />
                  <span className="text-xs text-gray-400">Abaixo do limiar</span>
                </div>
              </div>
            </>
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-400 text-sm">
              Aguardando dados do oráculo...
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
            Parâmetros da apólice
          </p>
          <div className="flex flex-col gap-2">
            {[
              { label: "Região", value: policy.region },
              {
                label: "Dias de seca para acionar",
                value: `${policy.drySpellDays} dias consecutivos`,
              },
              { label: "Limiar de chuva", value: `${policy.thresholdMm} mm/dia` },
              { label: "Valor segurado", value: formatBRL(policy.insuredAmount) },
              {
                label: "Prêmio",
                value: `${formatBRL(policy.premium)} (5% do valor segurado)`,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="flex justify-between text-sm py-1.5 border-b border-gray-50 last:border-0"
              >
                <span className="text-gray-400">{item.label}</span>
                <span className="text-gray-800 font-medium">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {txState === "erro" && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-3 flex gap-3">
            <AlertCircle className="text-red-400 flex-shrink-0" size={18} />
            <p className="text-sm text-red-700">{errorMsg}</p>
          </div>
        )}
        {txState === "processando" && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-3 flex items-center gap-3">
            <Loader2 className="text-amber-500 animate-spin flex-shrink-0" size={18} />
            <div>
              <p className="text-sm font-medium text-amber-800">
                Acionando indenização...
              </p>
              <p className="text-xs text-amber-600">
                Confirme a transação na sua carteira
              </p>
            </div>
          </div>
        )}

        {policy.status === "Acionável" && (
          <button
            onClick={handleClaim}
            disabled={txState === "processando"}
            className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-amber-200 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-2xl transition-colors text-base"
          >
            {txState === "processando" ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="animate-spin" size={18} />
                Processando...
              </span>
            ) : (
              `Acionar indenização — ${formatBRL(policy.insuredAmount)}`
            )}
          </button>
        )}

        {policy.status === "Ativa" && (
          <div>
            <button
              disabled
              className="w-full bg-gray-100 text-gray-400 cursor-not-allowed font-medium py-4 rounded-2xl text-base"
            >
              Acionar indenização
            </button>
            <p className="text-xs text-gray-400 text-center mt-2">
              Disponível quando houver {policy.drySpellDays} dias consecutivos sem
              chuva suficiente. Faltam{" "}
              {Math.max(policy.drySpellDays - policy.maxStreak, 0)} dias.
            </p>
          </div>
        )}

        {policy.status === "Paga" && (
          <div className="bg-green-50 border border-green-200 rounded-2xl py-4 text-center">
            <p className="text-sm font-medium text-green-700">
              Indenização de {formatBRL(policy.insuredAmount)} já foi enviada
            </p>
          </div>
        )}

        {policy.status === "Expirada" && (
          <div className="bg-gray-50 border border-gray-200 rounded-2xl py-4 text-center">
            <p className="text-sm text-gray-500">
              Esta apólice encerrou sem acionar indenização.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
