import Link from "next/link"
import { Policy } from "@/app/types/apolice"
import { STATUS_CONFIG, formatBRL } from "@/lib/utils"
import { StatusBadge } from "@/components/status-badge"

type Props = { policy: Policy }

export function PolicyCard({ policy }: Props) {
  const config = STATUS_CONFIG[policy.status]

  const streakPct = Math.min(
    Math.round((policy.maxStreak / policy.drySpellDays) * 100),
    100
  )

  const barColor =
    streakPct >= 100 ? "bg-red-500"
    : streakPct >= 70 ? "bg-amber-400"
    : config.bar

  return (
    <Link href={`/apolices/${policy.id}`}>
      <div className="bg-white border border-gray-200 rounded-2xl p-5 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer">

        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Apólice #{policy.id}</p>
            <p className="font-semibold text-gray-900">{policy.region}</p>
          </div>
          <StatusBadge status={policy.status} />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-400 mb-0.5">Valor segurado</p>
            <p className="text-sm font-semibold text-gray-800">
              {formatBRL(policy.insuredAmount)}
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-400 mb-0.5">
              {policy.status === "Expirada" || policy.status === "Paga"
                ? "Encerrada em"
                : "Dias restantes"}
            </p>
            <p className="text-sm font-semibold text-gray-800">
              {policy.status === "Expirada" || policy.status === "Paga"
                ? policy.endDate
                : `${policy.daysRemaining} dias`}
            </p>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <p className="text-xs text-gray-400">
              Progresso de seca ({policy.maxStreak}/{policy.drySpellDays} dias)
            </p>
            <p className="text-xs font-medium text-gray-500">{streakPct}%</p>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${barColor}`}
              style={{ width: `${streakPct}%` }}
            />
          </div>
        </div>

        {policy.status === "Acionável" && (
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            <p className="text-xs text-amber-700 font-medium">
              ⚠ Seca detectada — você pode acionar a indenização
            </p>
          </div>
        )}

      </div>
    </Link>
  )
}
