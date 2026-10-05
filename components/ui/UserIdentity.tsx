"use client";

import { useState } from "react";
import { Fingerprint, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

/*
  Padrão de exibição de um usuário do produto do cliente em todo o app (Analytics, Respostas,
  busca…): foto → iniciais coloridas → ícone de anônimo; nome → e-mail → ID → anônimo.
  Os dados vêm do Luumu.identify() / da captura de identidade (lib/db/people.ts).
*/
export interface PersonLike {
  name: string | null;
  email: string | null;
  avatar?: string | null;
  userId: string | null;
  /** ID anônimo do navegador (Analytics); ausente quando o usuário só existe nas respostas */
  anonId?: string | null;
}

const isIdentified = (u: PersonLike) => !!(u.userId || u.email || u.name);

/** Nome para exibir: nome → e-mail → ID do produto → visitante anônimo. */
export function displayName(u: PersonLike) {
  if (u.name) return u.name;
  if (u.email) return u.email;
  if (u.userId) return `Usuário ${u.userId}`;
  return u.anonId ? `Visitante ${u.anonId.slice(-6).toUpperCase()}` : "Anônimo";
}

/** Linha de apoio sob o nome: o e-mail quando o nome já apareceu, senão o ID. */
export function secondaryLine(u: PersonLike) {
  if (u.name && u.email) return u.email;
  if (u.userId && (u.name || u.email)) return `ID ${u.userId}`;
  if (u.anonId && !isIdentified(u)) return `ID anônimo ${u.anonId.slice(0, 10)}…`;
  return null;
}

/** Cor estável por usuário. */
function hue(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}

export function UserAvatar({ u, size = 36 }: { u: PersonLike; size?: number }) {
  // foto vinda da plataforma do cliente: carregada direto de lá, sem passar pela Luumu;
  // se não abrir (expirada, privada), voltam as iniciais
  const [broken, setBroken] = useState<string | null>(null);
  const identified = isIdentified(u);
  if (u.avatar && broken !== u.avatar)
    return (
      // eslint-disable-next-line @next/next/no-img-element -- imagem externa e pequena: o otimizador da Vercel só custaria
      <img
        src={u.avatar}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setBroken(u.avatar ?? null)}
        className="shrink-0 rounded-full bg-bg-sunken object-cover"
        style={{ width: size, height: size }}
      />
    );
  const text = (u.name || u.email || "").trim();
  const initials = text
    ? text
        .replace(/@.*/, "")
        .split(/[\s._-]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]!.toUpperCase())
        .join("")
    : "";
  const h = hue(u.anonId || u.userId || u.email || u.name || "");
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-display font-bold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: identified ? `linear-gradient(135deg, hsl(${h} 70% 55%), hsl(${(h + 40) % 360} 70% 45%))` : "var(--bg-sunken)",
        color: identified ? "#fff" : "var(--text-mut)",
      }}
      aria-hidden
    >
      {identified ? initials || <UserRound className="size-[45%]" /> : <Fingerprint className="size-[48%]" />}
    </span>
  );
}

/** Avatar + nome + linha de apoio (e-mail/ID). `extra`: conteúdo abaixo (plataforma, data…). */
export function UserIdentity({
  u,
  size = 40,
  extra,
  className,
  nameClassName,
}: {
  u: PersonLike;
  size?: number;
  extra?: React.ReactNode;
  className?: string;
  nameClassName?: string;
}) {
  const sub = secondaryLine(u);
  const name = displayName(u);
  return (
    <div className={cn("flex min-w-0 items-start gap-3", className)}>
      <UserAvatar u={u} size={size} />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={cn("truncate text-sm font-bold text-fg", nameClassName)} title={name}>
            {name}
          </span>
          {!isIdentified(u) && <span className="rounded-full bg-bg-sunken px-1.5 py-px text-[10px] font-semibold text-fg-mut">anônimo</span>}
        </div>
        {sub && (
          <div className="truncate text-xs text-fg-mut" title={sub}>
            {sub}
          </div>
        )}
        {extra}
      </div>
    </div>
  );
}
