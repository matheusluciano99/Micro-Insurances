import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { PolicyStatus } from "@/app/types/apolice"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const REGIONS = [
  { id: "1", name: "Nordeste" },
  { id: "2", name: "Sudeste" },
  { id: "3", name: "Centro-Oeste" },
  { id: "4", name: "Sul" },
  { id: "5", name: "Norte" },
]

// Formata número como moeda brasileira — usado em várias páginas
export function formatBRL(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value
  if (isNaN(num)) return "R$ 0,00"
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

// Configuração visual de status — usada em lista e detalhe de apólice
export const STATUS_CONFIG: Record<PolicyStatus, { label: string; badge: string; bar: string }> = {
  Ativa:     { label: "Ativa",     badge: "bg-blue-100 text-blue-800",   bar: "bg-blue-400"  },
  Acionável: { label: "Acionável", badge: "bg-amber-100 text-amber-800", bar: "bg-amber-400" },
  Paga:      { label: "Paga",      badge: "bg-green-100 text-green-800", bar: "bg-green-400" },
  Expirada:  { label: "Expirada",  badge: "bg-gray-100 text-gray-500",   bar: "bg-gray-300"  },
}
