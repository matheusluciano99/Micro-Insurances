"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, ShieldCheck, CheckCircle, Loader2, AlertCircle, Calendar } from "lucide-react"
import { Policy, RainfallDay, TxState } from "../../types/apolice"
import { RainfallChart } from "@/components/rainfall-chart"
import { StatusBadge } from "@/components/status-badge"
import { formatBRL, STATUS_CONFIG } from "@/lib/utils"

// TODO: integração — substituir por:
// const policy = await readContract({ functionName: 'getPolicy', args: [policyId] })
// const [days, rain, reported] = await readContract({ functionName: 'getRainfallWindow', args: [policyId] })
const MOCK_POLICIES: Record<number, Policy> = {
  1: {
    id: 1, region: "Nordeste",
    startDate: "2025-06-01", endDate: "2025-08-30",
    insuredAmount: "1000.00", premium: "50.00",
    status: "Ativa", maxStreak: 7, drySpellDays: 10, thresholdMm: 1.0,
    daysElapsed: 45, daysRemaining: 45, claimable: false,
  },
  2: {
    id: 2, region: "Centro-Oeste",
    startDate: "2025-04-01", endDate: "2025-06-30",
    insuredAmount: "2000.00", premium: "100.00",
    status: "Acionável", maxStreak: 14, drySpellDays: 14, thresholdMm: 1.5,
    daysElapsed: 90, daysRemaining: 0, claimable: true, triggerDay: 76,
  },
  3: {
    id: 3, region: "Sudeste",
    startDate: "2025-01-01", endDate: "2025-03-31",
    insuredAmount: "1500.00", premium: "75.00",
    status: "Paga", maxStreak: 20, drySpellDays: 15, thresholdMm: 2.0,
    daysElapsed: 90, daysRemaining: 0, claimable: false,
  },
  4: {
    id: 4, region: "Sul",
    startDate: "2024-10-01", endDate: "2024-12-31",
    insuredAmount: "800.00", premium: "40.00",
    status: "Expirada", maxStreak: 5, drySpellDays: 12, thresholdMm: 1.0,
    daysElapsed: 92, daysRemaining: 0, claimable: false,
  },
}

// TODO: integração — substituir por getRainfallWindow(policyId)
const MOCK_RAINFALL: Record<number, RainfallDay[]> = {
  1: [
    { day: 1, mm: 3.2, reported: true }, { day: 2, mm: 0.0, reported: true },
    { day: 3, mm: 0.0, reported: true }, { day: 4, mm: 2.1, reported: true },
    { day: 5, mm: 0.0, reported: true }, { day: 6, mm: 0.0, reported: true },
    { day: 7, mm: 0.0, reported: true }, { day: 8, mm: 0.5, reported: true },
    { day: 9, mm: 0.0, reported: true }, { day: 10, mm: 0.0, reported: true },
  ],
  2: [
    { day: 1, mm: 5.0, reported: true }, { day: 2, mm: 1.2, reported: true },
    { day: 3, mm: 0.3, reported: true }, { day: 4, mm: 0.0, reported: true },
    { day: 5, mm: 0.0, reported: true }, { day: 6, mm: 4.5, reported: true },
    { day: 7, mm: 0.0, reported: true }, { day: 8, mm: 0.0, reported: true },
    { day: 9, mm: 0.0, reported: true }, { day: 10, mm: 0.0, reported: true },
    { day: 11, mm: 0.0, reported: true }, { day: 12, mm: 0.0, reported: true },
    { day: 13, mm: 0.0, reported: true }, { day: 14, mm: 0.0, reported: true },
  ],
  3: Array.from({ length: 15 }, (_, i) => ({ day: i + 1, mm: i < 5 ? 2.5 : 0, reported: true })),
  4: Array.from({ length: 10 }, (_, i) => ({ day: i + 1, mm: i % 3 === 0 ? 1.8 : 0, reported: true })),
}

export default function ApoliceDetalhePage() {
  const params = useParams()
  const router = useRouter()
  const policyId = Number(params.id)

  const [txState, setTxState] = useState<TxState>("idle")
  const [errorMsg, setErrorMsg] = useState("")

  // TODO: integração — substituir por hook useReadContract
  const policy = MOCK_POLICIES[policyId]
  const rainfall = MOCK_RAINFALL[policyId] ?? []

  if (!policy) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Apólice não encontrada.</p>
          <Link href="/apolices" className="text-blue-600 hover:underline text-sm">
            Voltar para minhas apólices
          </Link>
        </div>
      </main>
    )
  }

  async function handleClaim() {
    try {
      // TODO: integração — substituir por:
      // await writeContractAsync({ address: CROP, abi: cropAbi, functionName: 'claim', args: [policyId] })
      setTxState("processando")
      await new Promise(r => setTimeout(r, 2500))
      setTxState("sucesso")
    } catch {
      setErrorMsg("Não foi possível acionar a indenização. Tente novamente.")
      setTxState("erro")
    }
  }

  const streakPct = Math.min(Math.round((policy.maxStreak / policy.drySpellDays) * 100), 100)
  const streakBarColor =
    streakPct >= 100 ? "bg-red-400"
    : streakPct >= 70 ? "bg-amber-400"
    : "bg-blue-400"

  if (txState === "sucesso") {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-10 max-w-md w-full text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-green-100 rounded-full p-4">
              <CheckCircle className="text-green-600" size={40} />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Indenização enviada!</h1>
          <p className="text-gray-500 mb-2">{formatBRL(policy.insuredAmount)} foram enviados para sua carteira.</p>
          <p className="text-xs text-gray-400 mb-8">A transferência foi registrada na blockchain e não pode ser revertida.</p>
          <button
            onClick={() => router.push("/apolices")}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-colors"
          >
            Voltar para minhas apólices
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">

        <Link href="/apolices" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors">
          <ArrowLeft size={14} />
          Minhas apólices
        </Link>

        {/* Cabeçalho */}
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
            <span>{policy.startDate} → {policy.endDate}</span>
          </div>
        </div>

        {/* Alertas de status */}
        {policy.status === "Acionável" && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 flex gap-3">
            <AlertCircle className="text-amber-500 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-sm font-semibold text-amber-800">Seca detectada</p>
              <p className="text-sm text-amber-700 mt-0.5">
                {policy.maxStreak} dias consecutivos sem chuva acima do limiar. Você pode acionar a indenização agora.
              </p>
            </div>
          </div>
        )}

        {policy.status === "Paga" && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-4 flex gap-3">
            <ShieldCheck className="text-green-500 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-sm font-semibold text-green-800">Indenização recebida</p>
              <p className="text-sm text-green-700 mt-0.5">{formatBRL(policy.insuredAmount)} foram transferidos para sua carteira.</p>
            </div>
          </div>
        )}

        {/* Métricas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[
            { label: "Valor segurado",  value: formatBRL(policy.insuredAmount) },
            { label: "Prêmio pago",     value: formatBRL(policy.premium) },
            { label: "Dias decorridos", value: `${policy.daysElapsed} dias` },
            {
              label: policy.status === "Ativa" ? "Dias restantes" : "Duração total",
              value: policy.status === "Ativa" ? `${policy.daysRemaining} dias` : `${policy.daysElapsed} dias`,
            },
          ].map(item => (
            <div key={item.label} className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">{item.label}</p>
              <p className="text-sm font-semibold text-gray-900">{item.value}</p>
            </div>
          ))}
        </div>

        {/* Barra de seca */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Progresso de seca</p>
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm text-gray-600">{policy.maxStreak} de {policy.drySpellDays} dias atingidos</p>
            <p className={`text-sm font-semibold ${streakPct >= 100 ? "text-red-600" : streakPct >= 70 ? "text-amber-600" : "text-gray-600"}`}>
              {streakPct}%
            </p>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5">
            <div className={`h-2.5 rounded-full transition-all ${streakBarColor}`} style={{ width: `${streakPct}%` }} />
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Limiar: {policy.thresholdMm} mm/dia — dias com menos chuva contam para a sequência de seca
          </p>
        </div>

        {/* Gráfico de chuva */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Histórico de chuva</p>
          <p className="text-xs text-gray-400 mb-4">Mostrando os últimos {rainfall.length} dias reportados pelo oráculo</p>
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

        {/* Parâmetros */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Parâmetros da apólice</p>
          <div className="flex flex-col gap-2">
            {[
              { label: "Região",                    value: `ID ${policy.id} — ${policy.region}` },
              { label: "Dias de seca para acionar", value: `${policy.drySpellDays} dias consecutivos` },
              { label: "Limiar de chuva",           value: `${policy.thresholdMm} mm/dia` },
              { label: "Valor segurado",            value: formatBRL(policy.insuredAmount) },
              { label: "Prêmio",                    value: `${formatBRL(policy.premium)} (5% do valor segurado)` },
            ].map(item => (
              <div key={item.label} className="flex justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-gray-400">{item.label}</span>
                <span className="text-gray-800 font-medium">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Feedback de erro/loading */}
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
              <p className="text-sm font-medium text-amber-800">Acionando indenização...</p>
              <p className="text-xs text-amber-600">Confirme a transação na sua carteira</p>
            </div>
          </div>
        )}

        {/* Botão de ação — varia por status */}
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
            ) : `Acionar indenização — ${formatBRL(policy.insuredAmount)}`}
          </button>
        )}

        {policy.status === "Ativa" && (
          <div>
            <button disabled className="w-full bg-gray-100 text-gray-400 cursor-not-allowed font-medium py-4 rounded-2xl text-base">
              Acionar indenização
            </button>
            <p className="text-xs text-gray-400 text-center mt-2">
              Disponível quando houver {policy.drySpellDays} dias consecutivos sem chuva suficiente.
              Faltam {policy.drySpellDays - policy.maxStreak} dias.
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
            <p className="text-sm text-gray-500">Esta apólice encerrou sem acionar indenização.</p>
          </div>
        )}

      </div>
    </main>
  )
}
