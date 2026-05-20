import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { sepolia } from "wagmi/chains";
import { http } from "viem";

export const wagmiConfig = getDefaultConfig({
  appName: "AgroSeguro",
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || "DEMO_PROJECT_ID",
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
  },
  ssr: true,
});
