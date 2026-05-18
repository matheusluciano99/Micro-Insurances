"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ShieldCheck, CheckCircle, Loader2, AlertCircle, Wallet } from "lucide-react"
import { REGIONS, formatBRL } from "@/lib/utils"
import { useAuth } from "@/lib/auth-context"
import { ContratarTxState, FormData } from "../types/apolice"

// TODO: integração — substituir por: await readContract({ functionName: 'premiumOf', args: [insuredAmount] })
function calcularPremio(insuredAmount: string): string {
  const valor = parseFloat(insuredAmount)
  if (isNaN(valor) || valor <= 0) return "0.00"
  return (valor * 0.05).toFixed(2)
}

// TODO: integração — quando os contratos estiverem plugados, esses erros vão aparecer de verdade
const ERROR_MESSAGES: Record<string, string> = {
  "Crop: nao segura o passado":  "Data de início precisa ser hoje ou futura",
  "Crop: duracao excede maximo": "Duração máxima: 366 dias",
  "Crop: drySpell invalido":     "Dias de seca deve ser entre 1 e a duração",
  "Crop: pool insolvente":       "Capital do pool insuficiente no momento",
}

function parseContractError(err: unknown): string {
  const msg = String(err)
  for (const [key, label] of Object.entries(ERROR_MESSAGES)) {
    if (msg.includes(key)) return label
  }
  return "Algo deu errado. Tente novamente."
}

export default function ContratarPage() {
  const router = useRouter()
  const { isConnected, connect } = useAuth()

  const [form, setForm] = useState<FormData>({
    regionId: "", startDate: "", durationDays: "",
    drySpellDays: "", thresholdMm: "", insuredAmount: "",
  })
  const [txState, setTxState] = useState<ContratarTxState>("idle")
  const [errorMessage, setErrorMessage] = useState("")
  const [policyId, setPolicyId] = useState<number | null>(null)
  const [formErrors, setFormErrors] = useState<Partial<FormData>>({})

  function handleChange(field: keyof FormData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
    setFormErrors(prev => ({ ...prev, [field]: "" }))
  }

  function validar(): boolean {
    const errors: Partial<FormData> = {}
    const hoje = new Date().toISOString().split("T")[0]

    if (!form.regionId) errors.regionId = "Selecione uma região"
    if (!form.startDate) errors.startDate = "Informe a data de início"
    else if (form.startDate < hoje) errors.startDate = "A data deve ser hoje ou futura"

    const duracao = parseInt(form.durationDays)
    if (!form.durationDays || isNaN(duracao) || duracao < 1) errors.durationDays = "Informe a duração"
    else if (duracao > 366) errors.durationDays = "Duração máxima: 366 dias"

    const seca = parseInt(form.drySpellDays)
    if (!form.drySpellDays || isNaN(seca) || seca < 1) errors.drySpellDays = "Informe os dias de seca"
    else if (seca > duracao) errors.drySpellDays = "Deve ser menor ou igual à duração"

    if (!form.thresholdMm || parseFloat(form.thresholdMm) <= 0) errors.thresholdMm = "Informe o limiar de chuva"

    const valor = parseFloat(form.insuredAmount)
    if (!form.insuredAmount || isNaN(valor) || valor <= 0) errors.insuredAmount = "Informe o valor segurado"

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleContratar() {
    if (!validar()) return
    try {
      // PASSO 1: Aprovar o gasto do token
      // TODO: integração — substituir por:
      // await writeContractAsync({ address: TOKEN, abi: tokenAbi, functionName: 'approve', args: [CROP, premium] })
      setTxState("aprovando")
      await new Promise(r => setTimeout(r, 2000))

      // PASSO 2: Criar a apólice
      // TODO: integração — substituir por:
      // const hash = await writeContractAsync({ address: CROP, abi: cropAbi, functionName: 'createPolicy', args: [...] })
      // const receipt = await waitForTransactionReceipt({ hash })
      // const policyId = receipt.logs[0].args.policyId  ← pega do evento PolicyCreated
      setTxState("criando")
      await new Promise(r => setTimeout(r, 2000))

      // TODO: integração — substituir por ID real vindo do evento de criação da apólice
      setPolicyId(42)
      setTxState("sucesso")
    } catch (err) {
      setErrorMessage(parseContractError(err))
      setTxState("erro")
    }
  }

  // ── Guard: carteira não conectada ──────────────────────────────────────────
  if (!isConnected) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-10 max-w-sm w-full text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-100 rounded-full p-4">
              <Wallet className="text-blue-500" size={32} />
            </div>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Conecte sua carteira
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            Para contratar uma apólice você precisa conectar sua carteira primeiro.
          </p>
          <button
            onClick={connect}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Wallet size={18} />
            Conectar carteira
          </button>
        </div>
      </main>
    )
  }

  // ── Tela de sucesso ────────────────────────────────────────────────────────
  if (txState === "sucesso" && policyId !== null) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-10 max-w-md w-full text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-green-100 rounded-full p-4">
              <CheckCircle className="text-green-600" size={40} />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Apólice criada!</h1>
          <p className="text-gray-500 mb-6">
            Sua apólice #{policyId} foi registrada na blockchain com sucesso.
          </p>
          <button
            onClick={() => router.push(`/apolices/${policyId}`)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-colors"
          >
            Ver minha apólice
          </button>
        </div>
      </main>
    )
  }

  const premio = calcularPremio(form.insuredAmount)
  const formularioPreenchido = form.insuredAmount && parseFloat(form.insuredAmount) > 0

  // ── Formulário principal ───────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Contratar apólice</h1>
          <p className="text-gray-500 mt-1">Preencha os dados da sua safra para gerar a cotação.</p>
        </div>

        <div className="flex flex-col gap-6">

          <div className="bg-white rounded-2xl border border-gray-200 p-6">

            {/* Região */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-1">Região</label>
              <select
                value={form.regionId}
                onChange={e => handleChange("regionId", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione uma região...</option>
                {REGIONS.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              {formErrors.regionId && <p className="text-red-500 text-xs mt-1">{formErrors.regionId}</p>}
            </div>

            {/* Data início + Duração */}
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data de início</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={e => handleChange("startDate", e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {formErrors.startDate && <p className="text-red-500 text-xs mt-1">{formErrors.startDate}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duração (dias)</label>
                <input
                  type="number" value={form.durationDays}
                  onChange={e => handleChange("durationDays", e.target.value)}
                  placeholder="ex: 90" min={1} max={366}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {formErrors.durationDays && <p className="text-red-500 text-xs mt-1">{formErrors.durationDays}</p>}
              </div>
            </div>

            {/* Dias de seca + Limiar */}
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dias de seca para acionar</label>
                <input
                  type="number" value={form.drySpellDays}
                  onChange={e => handleChange("drySpellDays", e.target.value)}
                  placeholder="ex: 10" min={1}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {formErrors.drySpellDays && <p className="text-red-500 text-xs mt-1">{formErrors.drySpellDays}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Limiar de chuva (mm)</label>
                <input
                  type="number" value={form.thresholdMm}
                  onChange={e => handleChange("thresholdMm", e.target.value)}
                  placeholder="ex: 1.00" min={0.01} step={0.01}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {formErrors.thresholdMm && <p className="text-red-500 text-xs mt-1">{formErrors.thresholdMm}</p>}
              </div>
            </div>

            {/* Valor segurado */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valor segurado (R$)</label>
              <input
                type="number" value={form.insuredAmount}
                onChange={e => handleChange("insuredAmount", e.target.value)}
                placeholder="ex: 1000.00" min={1} step={0.01}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {formErrors.insuredAmount && <p className="text-red-500 text-xs mt-1">{formErrors.insuredAmount}</p>}
            </div>
          </div>

          {/* Card de cotação */}
          {formularioPreenchido && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-blue-600 font-medium mb-1">Prêmio estimado</p>
                  <p className="text-3xl font-bold text-blue-900">{formatBRL(premio)}</p>
                  <p className="text-sm text-blue-600 mt-1">para {formatBRL(form.insuredAmount)} segurados</p>
                </div>
                <ShieldCheck className="text-blue-400" size={36} />
              </div>
              <div className="mt-4 pt-4 border-t border-blue-200 grid grid-cols-2 gap-2 text-sm">
                {form.regionId && (
                  <div>
                    <span className="text-blue-500">Região: </span>
                    <span className="text-blue-900 font-medium">{REGIONS.find(r => r.id === form.regionId)?.name}</span>
                  </div>
                )}
                {form.durationDays && (
                  <div>
                    <span className="text-blue-500">Duração: </span>
                    <span className="text-blue-900 font-medium">{form.durationDays} dias</span>
                  </div>
                )}
                {form.drySpellDays && (
                  <div>
                    <span className="text-blue-500">Aciona em: </span>
                    <span className="text-blue-900 font-medium">{form.drySpellDays} dias secos</span>
                  </div>
                )}
                {form.thresholdMm && (
                  <div>
                    <span className="text-blue-500">Limiar: </span>
                    <span className="text-blue-900 font-medium">{form.thresholdMm} mm/dia</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Stepper de progresso */}
          {(txState === "aprovando" || txState === "criando") && (
            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <p className="text-sm font-medium text-gray-700 mb-4">Processando contratação...</p>
              <div className="flex items-center gap-3 mb-3">
                {txState === "aprovando"
                  ? <Loader2 className="text-blue-500 animate-spin" size={20} />
                  : <CheckCircle className="text-green-500" size={20} />
                }
                <div>
                  <p className="text-sm font-medium text-gray-800">Passo 1 — Aprovando gasto</p>
                  <p className="text-xs text-gray-400">
                    {txState === "aprovando" ? "Aguardando assinatura na carteira..." : "Concluído"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {txState === "criando"
                  ? <Loader2 className="text-blue-500 animate-spin" size={20} />
                  : <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                }
                <div>
                  <p className={`text-sm font-medium ${txState === "criando" ? "text-gray-800" : "text-gray-400"}`}>
                    Passo 2 — Criando apólice
                  </p>
                  <p className="text-xs text-gray-400">
                    {txState === "criando" ? "Aguardando confirmação na rede..." : "Aguardando passo 1..."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Erro */}
          {txState === "erro" && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="text-sm font-medium text-red-800">Erro na contratação</p>
                <p className="text-sm text-red-600 mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          <button
            onClick={handleContratar}
            disabled={txState === "aprovando" || txState === "criando"}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white font-medium py-3.5 rounded-xl transition-colors text-base"
          >
            {txState === "aprovando" && "Aprovando gasto..."}
            {txState === "criando"   && "Criando apólice..."}
            {txState === "erro"      && "Tentar novamente"}
            {(txState === "idle" || txState === "sucesso") && "Contratar apólice"}
          </button>

        </div>
      </div>
    </main>
  )
}
