"use client"

import Link from "next/link"
import { Leaf, Wallet, ShieldCheck } from "lucide-react"
import { useAuth } from "@/lib/auth-context"

export function Navbar() {
  const { isConnected, isAdmin, address, connect } = useAuth()

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex justify-between items-center max-w-4xl mx-auto">

        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <Leaf className="text-green-600" size={22} />
            <span className="font-semibold text-gray-800 text-lg">AgroSeguro</span>
          </Link>

          {isConnected && (
            <div className="flex items-center gap-6">
              <Link href="/contratar" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                Contratar
              </Link>
              <Link href="/apolices" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                Minhas apólices
              </Link>
              {isAdmin && (
                <Link href="/admin" className="flex items-center gap-1.5 text-sm text-purple-700 hover:text-purple-900 font-medium transition-colors">
                  <ShieldCheck size={14} />
                  Admin
                </Link>
              )}
            </div>
          )}
        </div>

        {isConnected ? (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-full px-4 py-1.5">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-sm text-green-800 font-medium font-mono">
              {address.slice(0, 6)}...{address.slice(-4)}
            </span>
          </div>
        ) : (
          <button
            onClick={connect}
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Wallet size={16} />
            Conectar carteira
          </button>
        )}

      </div>
    </nav>
  )
}
