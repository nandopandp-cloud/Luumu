"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

interface DemoSurvey {
  id: string;
  name: string;
  type: string;
  format: string;
}

declare global {
  interface Window {
    Luumu?: { init: (o: unknown) => void; show: (id: string) => void };
  }
}

/**
 * Produto SaaS FAKE que carrega o sdk.js REAL da Luumu.
 * Prova o job-to-be-done: o script exibe a pesquisa dentro do "produto do cliente".
 */
export function DemoApp({ surveys, sdkKey }: { surveys: DemoSurvey[]; sdkKey: string }) {
  const [ready, setReady] = useState(false);

  // limpa o "já visto" para a demo poder reexibir sempre
  useEffect(() => {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("luumu_seen_"))
        .forEach((k) => localStorage.removeItem(k));
    } catch {}
  }, []);

  function show(id: string) {
    window.Luumu?.show(id);
  }

  return (
    <div className="min-h-screen bg-[#0b1220] text-white">
      {/* SDK real da Luumu — data-luumu fornece a key; auto=false p/ disparar via clique */}
      <Script src="/sdk.js" data-luumu={sdkKey} data-luumu-auto="false" strategy="afterInteractive" onLoad={() => setReady(true)} />

      {/* App fake ("Acme SaaS") */}
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="grid size-8 place-items-center rounded-lg bg-white/10 font-bold">A</div>
          <span className="font-semibold">Acme Analytics</span>
          <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/60">demo</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-white/60">
          <span>Dashboard</span><span>Relatórios</span><span>Config</span>
          <div className="size-8 rounded-full bg-gradient-to-br from-indigo-400 to-fuchsia-500" />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs">
          <span className={`size-2 rounded-full ${ready ? "bg-green-400" : "bg-yellow-400"}`} />
          {ready ? "sdk.js carregado" : "carregando sdk.js…"}
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">Bem-vindo à Acme 👋</h1>
        <p className="mt-1 max-w-xl text-white/60">
          Esta é uma aplicação de exemplo. Ela carrega o <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm">sdk.js</code> real
          da Luumu. Clique numa pesquisa abaixo para vê-la aparecer <strong>dentro deste produto</strong>.
        </p>

        {/* métricas fake */}
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            ["Receita", "R$ 128k"],
            ["Usuários", "8.640"],
            ["Churn", "2.1%"],
            ["NPS", "58"],
          ].map(([l, v]) => (
            <div key={l} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-xs uppercase tracking-wide text-white/50">{l}</div>
              <div className="mt-1 text-2xl font-bold">{v}</div>
            </div>
          ))}
        </div>

        {/* gatilhos de pesquisa */}
        <div className="mt-10">
          <h2 className="mb-3 text-lg font-bold">Disparar uma pesquisa</h2>
          <p className="mb-4 text-sm text-white/60">
            Cada botão chama <code className="rounded bg-white/10 px-1.5 py-0.5">Luumu.show(id)</code> — o mesmo que
            aconteceria automaticamente por evento/trigger no produto real.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {surveys.length === 0 && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
                Nenhuma pesquisa ativa. Publique uma na Luumu e volte aqui.
              </div>
            )}
            {surveys.map((s) => (
              <button
                key={s.id}
                onClick={() => show(s.id)}
                disabled={!ready}
                className="group flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-white/30 hover:bg-white/10 disabled:opacity-50"
              >
                <div>
                  <div className="font-semibold">{s.name}</div>
                  <div className="mt-0.5 text-xs text-white/50">
                    {s.type} · formato {s.format}
                  </div>
                </div>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold group-hover:bg-white/20">
                  Exibir →
                </span>
              </button>
            ))}
          </div>
        </div>

        <p className="mt-10 text-center text-xs text-white/40">
          Produto fictício para demonstração do SDK da Luumu.
        </p>
      </main>
    </div>
  );
}
