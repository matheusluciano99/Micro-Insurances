"use client"

import { useState } from "react"
import Link from "next/link"
import { ShieldCheck, Plus, FileX } from "lucide-react"
import { Policy, PolicyStatus } from "../types/apolice"
import { PolicyCard } from "@/components/policy-card"

// TODO: integração — substituir por:
// const ids = await readContract({ functionName: 'getPoliciesByHolder', args: [address] })
// const policies = await Promise.all(ids.map(id => readContract({ functionName: 'getPolicy', args: [id] })))
const MOCK_POLICIES: Policy[] = [
  {
    id: 1,
    region: "Nordeste",
    startDate: "2025-06-01",
    endDate: "2025-08-30",
    insuredAmount: "1000.00",
    premium: "50.00",
    status: "Ativa",
    maxStreak: 7,
    drySpellDays: 10,
    thresholdMm: 1.5,
    daysElapsed: 30,
    daysRemaining: 45,
  },
  {
    id: 2,
    region: "Sudeste",
    startDate: "2025-04-01",
    endDate: "2025-06-30",
    insuredAmount: "2000.00",
    premium: "100.00",
    status: "Acionável",
    maxStreak: 14,
    drySpellDays: 14,
    thresholdMm: 1.5,
    daysRemaining: 0,
  },
  {
    id: 3,
    region: "Centro-Oeste",
    startDate: "2025-01-01",
    endDate: "2025-03-31",
    insuredAmount: "1500.00",
    premium: "75.00",
    status: "Paga",
    maxStreak: 20,
    drySpellDays: 15,
    thresholdMm: 1.5,
    daysRemaining: 0,
  },
  {
    id: 4,
    region: "Sul",
    startDate: "2024-10-01",
    endDate: "2024-12-31",
    insuredAmount: "800.00",
    premium: "40.00",
    status: "Expirada",
    maxStreak: 5,
    drySpellDays: 12,
    thresholdMm: 1.5,
    daysRemaining: 0,
  },
]

const FILTROS = ["Todos", "Ativa", "Acionável", "Paga", "Expirada"] as const
type Filtro = typeof FILTROS[number]

export default function ApolicesPage() {
  const [filtroAtivo, setFiltroAtivo] = useState<Filtro>("Todos")

  const apolicesFiltradas = MOCK_POLICIES.filter(p =>
    filtroAtivo === "Todos" ? true : p.status === filtroAtivo
  )

  const contagem = MOCK_POLICIES.reduce(
    (acc, p) => ({ ...acc, [p.status]: (acc[p.status] ?? 0) + 1 }),
    {} as Record<PolicyStatus, number>
  )

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">

        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Minhas apólices</h1>
            <p className="text-gray-500 mt-1">
              {MOCK_POLICIES.length} apólice{MOCK_POLICIES.length !== 1 ? "s" : ""} no total
            </p>
          </div>
          <Link
            href="/contratar"
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 !text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
          >
            <Plus size={16} />
            Nova apólice
          </Link>
        </div>

        <div className="flex gap-2 mb-6 flex-wrap">
          {FILTROS.map(filtro => {
            const isAtivo = filtroAtivo === filtro
            const count = filtro === "Todos"
              ? MOCK_POLICIES.length
              : (contagem[filtro as PolicyStatus] ?? 0)
            return (
              <button
                key={filtro}
                onClick={() => setFiltroAtivo(filtro)}
                className={`text-sm px-4 py-1.5 rounded-full border transition-colors ${
                  isAtivo
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                }`}
              >
                {filtro}
                {count > 0 && (
                  <span className={`ml-1.5 text-xs ${isAtivo ? "text-blue-200" : "text-gray-400"}`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {apolicesFiltradas.length > 0 ? (
          <div className="flex flex-col gap-4">
            {apolicesFiltradas.map(policy => (
              <PolicyCard key={policy.id} policy={policy} />
            ))}
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-gray-100 rounded-full p-4">
                {filtroAtivo === "Todos"
                  ? <ShieldCheck className="text-gray-400" size={36} />
                  : <FileX className="text-gray-400" size={36} />
                }
              </div>
            </div>
            <p className="font-medium text-gray-700 mb-1">
              {filtroAtivo === "Todos"
                ? "Você ainda não tem apólices"
                : `Nenhuma apólice com status "${filtroAtivo}"`}
            </p>
            <p className="text-sm text-gray-400 mb-6">
              {filtroAtivo === "Todos"
                ? "Contrate sua primeira apólice para proteger sua safra."
                : "Tente selecionar outro filtro."}
            </p>
            {filtroAtivo === "Todos" && (
              <Link
                href="/contratar"
                className="inline-flex items-center gap-2 bg-blue-500 hover:bg-blue-600 !text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
              >
                <Plus size={16} />
                Contratar apólice
              </Link>
            )}
          </div>
        )}

      </div>
    </main>
  )
}
