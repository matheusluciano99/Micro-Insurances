import { PolicyStatus } from "@/app/types/apolice"
import { STATUS_CONFIG } from "@/lib/utils"

type Props = { status: PolicyStatus }

export function StatusBadge({ status }: Props) {
  const config = STATUS_CONFIG[status]
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${config.badge}`}>
      {config.label}
    </span>
  )
}
