"use client";

import { createContext, useContext, ReactNode } from "react";
import { useAccount, useReadContract } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";

import { CONTRACTS } from "./contracts";
import { cropInsuranceAbi } from "./abi/cropInsurance";

type AuthContextType = {
  isAdmin: boolean;
  isConnected: boolean;
  address: string;
  connect: () => void;
};

const AuthContext = createContext<AuthContextType>({
  isAdmin: false,
  isConnected: false,
  address: "",
  connect: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();

  // owner do CropInsurance == admin do app.
  const { data: owner } = useReadContract({
    address: CONTRACTS.cropInsurance,
    abi: cropInsuranceAbi,
    functionName: "owner",
  });

  const isAdmin =
    !!address &&
    !!owner &&
    address.toLowerCase() === (owner as string).toLowerCase();

  return (
    <AuthContext.Provider
      value={{
        isAdmin,
        isConnected,
        address: address ?? "",
        connect: () => openConnectModal?.(),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
