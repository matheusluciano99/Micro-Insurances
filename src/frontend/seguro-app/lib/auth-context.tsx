"use client"

import { createContext, useContext, useState, ReactNode } from "react"

// O formato do que o contexto vai fornecer
type AuthContextType = {
  isAdmin: boolean
  isConnected: boolean
  address: string
  connect: () => void
}

// Cria o contexto com valores padrão
const AuthContext = createContext<AuthContextType>({
  isAdmin: false,
  isConnected: false,
  address: "",
  connect: () => {},
})

// Endereços mock — TODO: integração — apagar e usar wagmi
const MOCK_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
const MOCK_OWNER   = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"

// Provider — envolve a aplicação e calcula isAdmin
export function AuthProvider({ children }: { children: ReactNode }) {
  // TODO: integração — substituir por:
  // const { address, isConnected } = useAccount()
  // const owner = useReadContract({ functionName: 'owner' })
  // const isAdmin = address?.toLowerCase() === owner?.toLowerCase()
  const [isConnected, setIsConnected] = useState(false)
  const address    = isConnected ? MOCK_ADDRESS : ""
  const isAdmin    = isConnected &&
    address.toLowerCase() === MOCK_OWNER.toLowerCase() //TODO: integração — substituir por comparação com owner real no contrato





  function connect() {
    setIsConnected(true)
  }

  return (
    <AuthContext.Provider value={{ isAdmin, isConnected, address, connect }}>
      {children}
    </AuthContext.Provider>
  )
}



// Hook — qualquer componente chama useAuth() para ler os valores
export function useAuth() {
  return useContext(AuthContext)
}