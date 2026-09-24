import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  images: {
    // logos do workspace hospedadas no Vercel Blob
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
  async headers() {
    return [
      {
        /*
          O SDK é carregado pelo <script> em TODA página dos sites clientes — inclusive quando
          nenhuma pesquisa está no ar. Com o padrão de `public/` (max-age=0) o navegador
          revalidava o arquivo a cada página: uma Edge Request por pageview só para ouvir
          "não mudou".

          1h de cache no navegador corta isso para no máximo uma por hora por visitante. O
          custo é a propagação: uma versão nova do SDK leva até 1h para chegar a quem já tem o
          arquivo (a URL é fixa no site do cliente, não dá para versionar). O
          stale-while-revalidate deixa a troca acontecer em segundo plano depois disso.
        */
        source: "/sdk.js",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" }],
      },
    ];
  },
};

export default nextConfig;
