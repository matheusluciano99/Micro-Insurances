export type PolicyStatus = "Ativa" | "Acionável" | "Paga" | "Expirada"

export type Policy = {
  id: number
  region: string
  startDate: string
  endDate: string
  insuredAmount: string
  premium: string
  status: PolicyStatus
  maxStreak: number
  drySpellDays: number
  thresholdMm: number
  daysElapsed?: number
  daysRemaining: number
  claimable?: boolean
  triggerDay?: number
}

export type RainfallDay = {
  day: number
  mm: number
  reported: boolean
}

export type PolicyRow = {
  id: number
  region: string
  holder: string
  insuredAmount: string
  status: PolicyStatus
  daysRemaining: number
  claimable: boolean
}

export type PoolStats = {
  balance: string
  reserved: string
  free: string
}

// TxState genérico — usado em admin e detalhe de apólice
export type TxState = "idle" | "processando" | "sucesso" | "erro"

// TxState específico do fluxo de contratação (tem 2 passos)
export type ContratarTxState = "idle" | "aprovando" | "criando" | "sucesso" | "erro"

// Dados do formulário de contratação
export type FormData = {
  regionId: string
  startDate: string
  durationDays: string
  drySpellDays: string
  thresholdMm: string
  insuredAmount: string
}
