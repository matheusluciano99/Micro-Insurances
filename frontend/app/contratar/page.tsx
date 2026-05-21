"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  CheckCircle,
  Loader2,
  AlertCircle,
  Wallet,
} from "lucide-react";
import { decodeEventLog, formatEther, parseEther } from "viem";
import { useReadContract, useWriteContract, usePublicClient } from "wagmi";

import { REGIONS, formatBRL } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { ContratarTxState, FormData } from "../types/apolice";
import { CONTRACTS } from "@/lib/contracts";
import { cropInsuranceAbi } from "@/lib/abi/cropInsurance";
import { mockStablecoinAbi } from "@/lib/abi/mockStablecoin";
import { dateToAbsoluteDay, parseContractError } from "@/lib/policy";

const ERROR_MESSAGES: Record<string, string> = {
  "Crop: nao segura o passado": "Data de início precisa ser hoje ou futura",
  "Crop: duracao excede maximo": "Duração máxima: 366 dias",
  "Crop: drySpell invalido": "Dias de seca deve ser entre 1 e a duração",
  "Crop: pool insolvente": "Capital do pool insuficiente no momento",
  "Crop: insured zero": "Informe um valor segurado maior que zero",
  "Crop: duracao zero": "Informe uma duração maior que zero",
  "ERC20: saldo insuficiente": "Saldo de mBRL insuficiente para o prêmio",
};

export default function ContratarPage() {
  const router = useRouter();
  const { isConnected, address, connect } = useAuth();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [form, setForm] = useState<FormData>({
    regionId: "",
    startDate: "",
    durationDays: "",
    drySpellDays: "",
    thresholdMm: "",
    insuredAmount: "",
  });
  const [txState, setTxState] = useState<ContratarTxState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [policyId, setPolicyId] = useState<number | null>(null);
  const [formErrors, setFormErrors] = useState<Partial<FormData>>({});
  const [minting, setMinting] = useState(false);

  // Prêmio ao vivo do contrato (5% de insuredAmount via premiumOf).
  const insuredWei =
    form.insuredAmount && parseFloat(form.insuredAmount) > 0
      ? parseEther(form.insuredAmount)
      : 0n;

  const { data: premiumWei } = useReadContract({
    address: CONTRACTS.cropInsurance,
    abi: cropInsuranceAbi,
    functionName: "premiumOf",
    args: [insuredWei],
    query: { enabled: insuredWei > 0n },
  });

  const premio =
    premiumWei !== undefined ? formatEther(premiumWei as bigint) : "0.00";

  // Saldo de mBRL do usuário (avisa antes da tx reverter por falta de saldo).
  const { data: balanceWei, refetch: refetchBalance } = useReadContract({
    address: CONTRACTS.mockStablecoin,
    abi: mockStablecoinAbi,
    functionName: "balanceOf",
    args: address ? [address as `0x${string}`] : undefined,
    query: { enabled: !!address },
  });

  const saldo = formatEther((balanceWei as bigint | undefined) ?? 0n);
  const premiumWeiBig = (premiumWei as bigint | undefined) ?? 0n;
  const saldoInsuficiente =
    insuredWei > 0n &&
    premiumWeiBig > 0n &&
    ((balanceWei as bigint | undefined) ?? 0n) < premiumWeiBig;

  async function handleMint() {
    if (!address || !publicClient) return;
    try {
      setMinting(true);
      const hash = await writeContractAsync({
        address: CONTRACTS.mockStablecoin,
        abi: mockStablecoinAbi,
        functionName: "mint",
        args: [address as `0x${string}`, parseEther("1000")],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await refetchBalance();
    } finally {
      setMinting(false);
    }
  }

  function handleChange(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFormErrors((prev) => ({ ...prev, [field]: "" }));
  }

  function validar(): boolean {
    const errors: Partial<FormData> = {};
    const hoje = new Date().toISOString().split("T")[0];

    if (!form.regionId) errors.regionId = "Selecione uma região";
    if (!form.startDate) errors.startDate = "Informe a data de início";
    else if (form.startDate < hoje)
      errors.startDate = "A data deve ser hoje ou futura";

    const duracao = parseInt(form.durationDays);
    if (!form.durationDays || isNaN(duracao) || duracao < 1)
      errors.durationDays = "Informe a duração";
    else if (duracao > 366) errors.durationDays = "Duração máxima: 366 dias";

    const seca = parseInt(form.drySpellDays);
    if (!form.drySpellDays || isNaN(seca) || seca < 1)
      errors.drySpellDays = "Informe os dias de seca";
    else if (seca > duracao)
      errors.drySpellDays = "Deve ser menor ou igual à duração";

    if (!form.thresholdMm || parseFloat(form.thresholdMm) <= 0)
      errors.thresholdMm = "Informe o limiar de chuva";

    const valor = parseFloat(form.insuredAmount);
    if (!form.insuredAmount || isNaN(valor) || valor <= 0)
      errors.insuredAmount = "Informe o valor segurado";

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleContratar() {
    if (!validar() || !publicClient) return;
    setErrorMessage("");
    try {
      const insured = parseEther(form.insuredAmount);
      const premium = (await publicClient.readContract({
        address: CONTRACTS.cropInsurance,
        abi: cropInsuranceAbi,
        functionName: "premiumOf",
        args: [insured],
      })) as bigint;

      // PASSO 1: approve do prêmio para o CropInsurance gastar o mBRL.
      setTxState("aprovando");
      const approveHash = await writeContractAsync({
        address: CONTRACTS.mockStablecoin,
        abi: mockStablecoinAbi,
        functionName: "approve",
        args: [CONTRACTS.cropInsurance, premium],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      // PASSO 2: createPolicy. Coleta o policyId do evento PolicyCreated.
      setTxState("criando");
      const args = [
        BigInt(form.regionId),
        dateToAbsoluteDay(form.startDate),
        BigInt(form.durationDays),
        BigInt(form.drySpellDays),
        BigInt(Math.round(parseFloat(form.thresholdMm) * 100)),
        insured,
      ] as const;

      const createHash = await writeContractAsync({
        address: CONTRACTS.cropInsurance,
        abi: cropInsuranceAbi,
        functionName: "createPolicy",
        args,
      });
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: createHash,
      });

      // Decodifica o evento PolicyCreated pra pegar o policyId.
      let newId: number | null = null;
      for (const log of receipt.logs) {
        if (
          log.address.toLowerCase() !== CONTRACTS.cropInsurance.toLowerCase()
        )
          continue;
        try {
          const decoded = decodeEventLog({
            abi: cropInsuranceAbi,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === "PolicyCreated") {
            newId = Number((decoded.args as { policyId: bigint }).policyId);
            break;
          }
        } catch {
          // log que não bate com o ABI — ignora
        }
      }

      setPolicyId(newId);
      setTxState("sucesso");
    } catch (err) {
      setErrorMessage(parseContractError(err, ERROR_MESSAGES));
      setTxState("erro");
    }
  }

  // Guard: carteira não conectada
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
    );
  }

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
            Apólice criada!
          </h1>
          <p className="text-gray-500 mb-6">
            {policyId !== null
              ? `Sua apólice #${policyId} foi registrada na blockchain com sucesso.`
              : `Sua apólice foi registrada na blockchain com sucesso.`}
          </p>
          <button
            onClick={() =>
              router.push(policyId !== null ? `/apolices/${policyId}` : "/apolices")
            }
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-colors"
          >
            {policyId !== null ? "Ver minha apólice" : "Ver minhas apólices"}
          </button>
        </div>
      </main>
    );
  }

  const formularioPreenchido =
    !!form.insuredAmount && parseFloat(form.insuredAmount) > 0;

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Contratar apólice</h1>
          <p className="text-gray-500 mt-1">
            Preencha os dados da sua safra para gerar a cotação.
          </p>
        </div>

        <div className="flex flex-col gap-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Região
              </label>
              <select
                value={form.regionId}
                onChange={(e) => handleChange("regionId", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione uma região...</option>
                {REGIONS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              {formErrors.regionId && (
                <p className="text-red-500 text-xs mt-1">{formErrors.regionId}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data de início
                </label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => handleChange("startDate", e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {formErrors.startDate && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.startDate}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duração (dias)
                </label>
                <input
                  type="number"
                  value={form.durationDays}
                  onChange={(e) => handleChange("durationDays", e.target.value)}
                  placeholder="ex: 90"
                  min={1}
                  max={366}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {formErrors.durationDays && (
                  <p className="text-red-500 text-xs mt-1">
                    {formErrors.durationDays}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dias de seca para acionar
                </label>
                <input
                  type="number"
                  value={form.drySpellDays}
                  onChange={(e) => handleChange("drySpellDays", e.target.value)}
                  placeholder="ex: 10"
                  min={1}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {formErrors.drySpellDays && (
                  <p className="text-red-500 text-xs mt-1">
                    {formErrors.drySpellDays}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Limiar de chuva (mm)
                </label>
                <input
                  type="number"
                  value={form.thresholdMm}
                  onChange={(e) => handleChange("thresholdMm", e.target.value)}
                  placeholder="ex: 1.00"
                  min={0.01}
                  step={0.01}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {formErrors.thresholdMm && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.thresholdMm}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Valor segurado (mBRL)
              </label>
              <input
                type="number"
                value={form.insuredAmount}
                onChange={(e) => handleChange("insuredAmount", e.target.value)}
                placeholder="ex: 1000"
                min={1}
                step={0.01}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {formErrors.insuredAmount && (
                <p className="text-red-500 text-xs mt-1">
                  {formErrors.insuredAmount}
                </p>
              )}
            </div>
          </div>

          {formularioPreenchido && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-blue-600 font-medium mb-1">
                    Prêmio (lido do contrato)
                  </p>
                  <p className="text-3xl font-bold text-blue-900">
                    {formatBRL(premio)}
                  </p>
                  <p className="text-sm text-blue-600 mt-1">
                    para {formatBRL(form.insuredAmount)} segurados
                  </p>
                </div>
                <ShieldCheck className="text-blue-400" size={36} />
              </div>
              <div className="mt-4 pt-4 border-t border-blue-200 grid grid-cols-2 gap-2 text-sm">
                {form.regionId && (
                  <div>
                    <span className="text-blue-500">Região: </span>
                    <span className="text-blue-900 font-medium">
                      {REGIONS.find((r) => r.id === form.regionId)?.name}
                    </span>
                  </div>
                )}
                {form.durationDays && (
                  <div>
                    <span className="text-blue-500">Duração: </span>
                    <span className="text-blue-900 font-medium">
                      {form.durationDays} dias
                    </span>
                  </div>
                )}
                {form.drySpellDays && (
                  <div>
                    <span className="text-blue-500">Aciona em: </span>
                    <span className="text-blue-900 font-medium">
                      {form.drySpellDays} dias secos
                    </span>
                  </div>
                )}
                {form.thresholdMm && (
                  <div>
                    <span className="text-blue-500">Limiar: </span>
                    <span className="text-blue-900 font-medium">
                      {form.thresholdMm} mm/dia
                    </span>
                  </div>
                )}
              </div>

              {/* Saldo + mint pra desbloquear quando não há mBRL suficiente */}
              <div className="mt-4 pt-4 border-t border-blue-200 flex items-center justify-between gap-3">
                <div className="text-sm">
                  <span className="text-blue-500">Seu saldo: </span>
                  <span
                    className={
                      saldoInsuficiente
                        ? "text-red-600 font-semibold"
                        : "text-blue-900 font-medium"
                    }
                  >
                    {formatBRL(saldo)} mBRL
                  </span>
                  {saldoInsuficiente && (
                    <span className="text-red-600 text-xs block">
                      Insuficiente para o prêmio. Minte mBRL de teste:
                    </span>
                  )}
                </div>
                {saldoInsuficiente && (
                  <button
                    onClick={handleMint}
                    disabled={minting}
                    className="text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    {minting ? (
                      <Loader2 className="animate-spin" size={14} />
                    ) : null}
                    Mintar 1.000 mBRL
                  </button>
                )}
              </div>
            </div>
          )}

          {(txState === "aprovando" || txState === "criando") && (
            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <p className="text-sm font-medium text-gray-700 mb-4">
                Processando contratação...
              </p>
              <div className="flex items-center gap-3 mb-3">
                {txState === "aprovando" ? (
                  <Loader2 className="text-blue-500 animate-spin" size={20} />
                ) : (
                  <CheckCircle className="text-green-500" size={20} />
                )}
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    Passo 1 — Aprovando gasto
                  </p>
                  <p className="text-xs text-gray-400">
                    {txState === "aprovando"
                      ? "Aguardando assinatura na carteira..."
                      : "Concluído"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {txState === "criando" ? (
                  <Loader2 className="text-blue-500 animate-spin" size={20} />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                )}
                <div>
                  <p
                    className={`text-sm font-medium ${
                      txState === "criando" ? "text-gray-800" : "text-gray-400"
                    }`}
                  >
                    Passo 2 — Criando apólice
                  </p>
                  <p className="text-xs text-gray-400">
                    {txState === "criando"
                      ? "Aguardando confirmação na rede..."
                      : "Aguardando passo 1..."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {txState === "erro" && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="text-sm font-medium text-red-800">
                  Erro na contratação
                </p>
                <p className="text-sm text-red-600 mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          <button
            onClick={handleContratar}
            disabled={
              txState === "aprovando" ||
              txState === "criando" ||
              saldoInsuficiente ||
              minting
            }
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white font-medium py-3.5 rounded-xl transition-colors text-base"
          >
            {txState === "aprovando" && "Aprovando gasto..."}
            {txState === "criando" && "Criando apólice..."}
            {txState === "erro" && "Tentar novamente"}
            {txState === "idle" &&
              (saldoInsuficiente
                ? "Saldo de mBRL insuficiente"
                : "Contratar apólice")}
          </button>
        </div>
      </div>
    </main>
  );
}
