
"use client" 
import Link from "next/link"
 import {ShieldCheck, CloudRain, Wallet } from "lucide-react"
 
export default function HomePage() {
 
 
  return (
    
    <main className="min-h-screen bg-gray-50 flex flex-col">
 
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20">
         <div className="bg-green-100 rounded-full p-4 mb-6">
          <ShieldCheck className="text-green-600" size={40} />
        </div>
 
        <h1 className="text-4xl font-bold text-gray-900 mb-4 max-w-xl">
          Seguro agrícola descentralizado
        </h1>
 
        <p className="text-gray-500 text-lg max-w-md mb-10">
          Proteção contra seca com pagamento automático, sem burocracia e
          sem intermediários.
        </p>
 
        <div className="flex flex-col sm:flex-row gap-3">
           <Link
            href="/contratar"
            className="bg-blue-500 hover:bg-blue-600 !text-white font-medium px-6 py-3 rounded-lg transition-colors"
          >
            Contratar apólice
          </Link>
 
          <Link
            href="/apolices"
            className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 font-medium px-6 py-3 rounded-lg transition-colors"
          >
            Ver minhas apólices
          </Link>
 
        </div>
      </section>
       <section className="bg-white border-t border-gray-100 px-6 py-16">
        <div className="max-w-4xl mx-auto">
 
          <h2 className="text-2xl font-semibold text-gray-900 text-center mb-10">
            Como funciona
          </h2>
 
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 
            {[
              {
                icon: <Wallet size={28} className="text-blue-500" />,
                step: "1",
                title: "Contrate",
                desc: "Conecte sua carteira, escolha região, duração e valor segurado.",
              },
              {
                icon: <CloudRain size={28} className="text-sky-500" />,
                step: "2",
                title: "Acompanhe",
                desc: "Veja o índice de chuva da sua região atualizado diariamente.",
              },
              {
                icon: <ShieldCheck size={28} className="text-green-500" />,
                step: "3",
                title: "Receba",
                desc: "Se a seca for detectada, a indenização cai na sua carteira automaticamente.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="bg-gray-50 rounded-xl p-6 flex flex-col items-center text-center gap-3"
              >
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  Passo {item.step}
                </div>
 
                <div className="bg-white rounded-full p-3 shadow-sm">
                  {item.icon}
                </div>
 
                <h3 className="font-semibold text-gray-800">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
 
          </div>
        </div>
      </section>
 

 
    </main>
  )
}