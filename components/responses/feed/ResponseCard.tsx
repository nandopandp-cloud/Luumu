"use client";

import { useState } from "react";
import { Copy, Frown, Loader2, Meh, Monitor, MoreHorizontal, Smartphone, Smile, Star, Tablet } from "lucide-react";
import { DEVICE_LABEL, isDeviceKind, type DeviceKind } from "@/lib/device";
import { Dialog } from "@/components/ui/Dialog";
import { HostBadge } from "@/components/ui/HostBadge";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { UserIdentity, type PersonLike } from "@/components/ui/UserIdentity";
import { getResponseDetailAction } from "@/app/(app)/responses/actions";

export interface ResponseCardData {
  id: string;
  who: string; // e-mail, id ou "Anônimo" (o que se copia)
  person: PersonLike; // nome, e-mail e foto, como em Analytics › Usuários
  surveyName: string;
  showSurvey: boolean;
  host: string | null;
  device: DeviceKind | null; // null = resposta anterior ao registro de dispositivo
  when: string; // "há 14 min"
  date: string; // "23 nov 2026"
  sentiment: "positivo" | "neutro" | "negativo" | null;
  score: number | null;
  comment: string;
  tags: string[];
}

const DEVICE_ICON: Record<DeviceKind, React.ReactNode> = {
  mobile: <Smartphone className="size-4" />,
  tablet: <Tablet className="size-4" />,
  desktop: <Monitor className="size-4" />,
};

/** Ícone + rótulo do dispositivo em que a pesquisa foi vista e respondida. */
function DeviceTag({ device }: { device: DeviceKind }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2 py-1 text-xs font-semibold text-fg-soft"
      title={`Respondida pelo ${DEVICE_LABEL[device].toLowerCase()}`}
    >
      <span className="text-fg-mut">{DEVICE_ICON[device]}</span>
      {DEVICE_LABEL[device]}
    </span>
  );
}

const SENTIMENT = {
  positivo: { label: "Positivo", icon: <Smile className="size-3.5" />, cls: "bg-sucesso/10 text-sucesso" },
  neutro: { label: "Neutro", icon: <Meh className="size-3.5" />, cls: "bg-fg/10 text-fg-soft" },
  negativo: { label: "Negativo", icon: <Frown className="size-3.5" />, cls: "bg-erro/10 text-erro" },
} as const;

type Detail = NonNullable<Awaited<ReturnType<typeof getResponseDetailAction>>>;

export function ResponseCard({ r, hosts }: { r: ResponseCardData; hosts: string[] }) {
  const [menu, setMenu] = useState(false);
  const [detail, setDetail] = useState<Detail | null | "loading">(null);
  const toast = useToast();
  const s = r.sentiment ? SENTIMENT[r.sentiment] : null;

  async function openDetail() {
    setDetail("loading");
    const d = await getResponseDetailAction(r.id);
    if (!d) {
      setDetail(null);
      toast("error", "Não foi possível abrir esta resposta.");
      return;
    }
    setDetail(d);
  }

  function copy(text: string, what: string) {
    setMenu(false);
    navigator.clipboard?.writeText(text).then(
      () => toast("success", `${what} copiado.`),
      () => toast("error", "Não foi possível copiar.")
    );
  }

  return (
    <article className="group rounded-2xl border border-line bg-bg-elev p-4 shadow-[var(--shadow-sm)] transition hover:border-line-strong sm:p-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,240px)_minmax(0,1fr)_auto]">
        {/* quem */}
        <UserIdentity
          u={r.person}
          extra={
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-fg-mut">
              {r.host ? <HostBadge host={r.host} all={hosts} /> : null}
              {r.showSurvey && <span className="max-w-[180px] truncate" title={r.surveyName}>{r.surveyName}</span>}
              <span>· {r.when}</span>
            </div>
          }
        />

        {/* o que disse */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {s && (
              <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", s.cls)}>
                {s.icon}
                {s.label}
              </span>
            )}
            {r.score != null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-brand px-2.5 py-0.5 text-xs font-bold text-accent">
                {r.score}
                <Star className="size-3" />
              </span>
            )}
          </div>
          {r.comment ? (
            <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-fg-soft">“{r.comment}”</p>
          ) : (
            <p className="mt-2 text-sm italic text-fg-mut">Sem comentário</p>
          )}
          {r.tags.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {r.tags.map((t) => (
                <span key={t} className="rounded-md bg-bg-sunken px-2 py-0.5 text-[11.5px] font-medium capitalize text-fg-soft">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ações */}
        <div className="flex items-center gap-2 md:flex-col md:items-end md:justify-between">
          <span className="flex items-center gap-2 md:order-first">
            <span className="text-xs text-fg-mut">{r.date}</span>
            {r.device && <DeviceTag device={r.device} />}
          </span>
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <button
              type="button"
              onClick={openDetail}
              className="inline-flex items-center gap-1.5 rounded-xl bg-surface-brand px-3.5 py-2 text-xs font-bold text-accent transition hover:brightness-95"
            >
              {detail === "loading" && <Loader2 className="size-3.5 animate-spin" />}
              Ver detalhes
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenu((v) => !v)}
                aria-label="Mais ações"
                aria-expanded={menu}
                className="grid size-8 place-items-center rounded-xl border border-line text-fg-mut hover:border-line-strong hover:text-fg"
              >
                <MoreHorizontal className="size-4" />
              </button>
              {menu && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setMenu(false)} />
                  <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-52 overflow-hidden rounded-xl border border-line bg-bg-elev py-1 text-sm shadow-[var(--shadow-lg)]">
                    <button type="button" role="menuitem" onClick={() => copy(r.who, "Identificação")} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-fg-soft hover:bg-bg-sunken">
                      <Copy className="size-4" /> Copiar e-mail / ID
                    </button>
                    {r.comment && (
                      <button type="button" role="menuitem" onClick={() => copy(r.comment, "Comentário")} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-fg-soft hover:bg-bg-sunken">
                        <Copy className="size-4" /> Copiar comentário
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {detail && detail !== "loading" && (
        <Dialog title="Detalhes da resposta" description={`${detail.surveyName} · ${new Date(detail.createdAt).toLocaleString("pt-BR")}`} onClose={() => setDetail(null)} size="lg">
          <dl className="mb-5 grid grid-cols-2 gap-3 rounded-xl bg-bg-sunken p-4 text-sm sm:grid-cols-4">
            <div className="col-span-2 min-w-0">
              <dt className="text-xs text-fg-mut">Pessoa</dt>
              <dd className="mt-1">
                <UserIdentity u={r.person} size={28} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-fg-mut">Plataforma</dt>
              <dd className="truncate font-semibold">{detail.host ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-fg-mut">Dispositivo</dt>
              <dd className="font-semibold">
                {isDeviceKind(detail.device) ? (
                  <span className="inline-flex items-center gap-1.5">
                    {DEVICE_ICON[detail.device]}
                    {DEVICE_LABEL[detail.device]}
                  </span>
                ) : (
                  "Não registrado"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-fg-mut">Sentimento</dt>
              <dd className="font-semibold capitalize">{detail.sentiment ?? "—"}</dd>
            </div>
          </dl>
          <ol className="flex flex-col gap-3">
            {detail.answers.map((a, i) => (
              <li key={i} className="rounded-xl border border-line p-4">
                <div className="text-xs font-semibold text-fg-mut">{a.question}</div>
                <div className="mt-1 whitespace-pre-line text-sm font-medium text-fg">{a.value}</div>
              </li>
            ))}
            {detail.answers.length === 0 && <li className="text-sm text-fg-mut">Nenhuma resposta registrada.</li>}
          </ol>
        </Dialog>
      )}
    </article>
  );
}
