"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldCheck, Plus, FileX, Loader2, Wallet } from "lucide-react";
import { useReadContract } from "wagmi";

import { Policy, PolicyStatus } from "../types/apolice";
import { PolicyCard } from "@/components/policy-card";
import { CONTRACTS } from "@/lib/contracts";
import { cropInsuranceAbi } from "@/lib/abi/cropInsurance";
import {
  ContractPolicyView,
  mapPolicyView,
} from "@/lib/policy";
import { useAuth } from "@/lib/auth-context";

const FILTROS = ["Todos", "Ativa", "Acionável", "Paga", "Expirada"] as const;
type Filtro = (typeof FILTROS)[number];

export default function ApolicesPage() {
  const { isConnected, address, connect } = useAuth();
  const [filtroAtivo, setFiltroAtivo] = useState<Filtro>("Todos");

  const { data, isLoading, isError } = useReadContract({
    address: CONTRACTS.cropInsurance,
    abi: cropInsuranceAbi,
    functionName: "getPoliciesByHolder",
    args: address ? [address as `0x${string}`] : undefined,
    query: { enabled: !!address },
  });

  const apolices: Policy[] = (
    (data as ContractPolicyView[] | undefined) ?? []
  ).map(mapPolicyView);

  const apolicesFiltradas = apolices.filter((p) =>
    filtroAtivo === "Todos" ? true : p.status === filtroAtivo,
  );

  const contagem = apolices.reduce(
    (acc, p) => ({ ...acc, [p.status]: (acc[p.status] ?? 0) + 1 }),
    {} as Record<PolicyStatus, number>,
  );

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
            Para ver suas apólices, conecte a carteira.
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
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Minhas apólices</h1>
            <p className="text-gray-500 mt-1">
              {isLoading
                ? "Carregando..."
                : `${apolices.length} apólice${apolices.length !== 1 ? "s" : ""} no total`}
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
          {FILTROS.map((filtro) => {
            const isAtivo = filtroAtivo === filtro;
            const count =
              filtro === "Todos"
                ? apolices.length
                : (contagem[filtro as PolicyStatus] ?? 0);
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
                  <span
                    className={`ml-1.5 text-xs ${isAtivo ? "text-blue-200" : "text-gray-400"}`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {isLoading ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
            <Loader2 className="text-gray-400 animate-spin mx-auto mb-3" size={28} />
            <p className="text-sm text-gray-500">Lendo suas apólices on-chain...</p>
          </div>
        ) : isError ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
            <p className="text-sm text-red-700">
              Não foi possível ler as apólices. Verifique a rede (Sepolia) e tente
              novamente.
            </p>
          </div>
        ) : apolicesFiltradas.length > 0 ? (
          <div className="flex flex-col gap-4">
            {apolicesFiltradas.map((policy) => (
              <PolicyCard key={policy.id} policy={policy} />
            ))}
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-gray-100 rounded-full p-4">
                {filtroAtivo === "Todos" ? (
                  <ShieldCheck className="text-gray-400" size={36} />
                ) : (
                  <FileX className="text-gray-400" size={36} />
                )}
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
  );
}
