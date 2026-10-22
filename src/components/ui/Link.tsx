"use client";

import NextLink from "next/link";
import { useState, type ComponentProps } from "react";

/*
  <Link> do painel com prefetch POR INTENÇÃO (mouse em cima, foco pelo teclado, toque).

  O padrão do Next é prefetch de todo link que entra na tela. Nas rotas do painel (dinâmicas,
  com loading.tsx) isso dispara ~2 requisições por link a cada carregamento de página —
  sidebar, abas, linhas de tabela —, todas sem cache (`no-store`): cada uma é uma Edge Request
  + uma invocação de função na Vercel, mesmo que a pessoa nunca clique. Medido localmente:
  23 prefetches para abrir uma página com 12 links.

  Aqui o prefetch só acontece quando há intenção. O clique continua rápido: o hover vem
  ~100–300 ms antes dele, tempo de sobra para o prefetch, e o loading.tsx cobre o resto.
  `prefetch={false}` explícito continua desligando de vez; `prefetch={true}` mantém o
  prefetch completo, mas também só depois da intenção.
*/
export default function Link({ prefetch, onMouseEnter, onFocus, onTouchStart, ...props }: ComponentProps<typeof NextLink>) {
  const [intent, setIntent] = useState(false);
  if (prefetch === false) return <NextLink {...props} prefetch={false} onMouseEnter={onMouseEnter} onFocus={onFocus} onTouchStart={onTouchStart} />;
  return (
    <NextLink
      {...props}
      prefetch={intent ? (prefetch ?? null) : false}
      onMouseEnter={(e) => {
        setIntent(true);
        onMouseEnter?.(e);
      }}
      onFocus={(e) => {
        setIntent(true);
        onFocus?.(e);
      }}
      onTouchStart={(e) => {
        setIntent(true);
        onTouchStart?.(e);
      }}
    />
  );
}
