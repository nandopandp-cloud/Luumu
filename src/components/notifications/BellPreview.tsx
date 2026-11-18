"use client";

import { AlarmClock, Bell, CalendarDays, Megaphone, Sparkles, Trophy, X, type LucideIcon } from "lucide-react";
import { categoryOf, type NotificationCategory } from "@/lib/notifications/model";

/*
  Prévia do sino e do painel no painel da Luumu: o mesmo desenho do SDK
  (src/sdk/notifications/styles.ts), em React, para o editor e a configuração do sino.
*/

export const CATEGORY_ICON: Record<NotificationCategory, LucideIcon> = {
  aviso: Megaphone,
  novidade: Sparkles,
  evento: CalendarDays,
  lembrete: AlarmClock,
  conquista: Trophy,
};

export interface PreviewItem {
  id: string;
  title: string;
  body: string;
  category: NotificationCategory;
  ctaLabel?: string;
  when: string;
  pinned?: boolean;
  unread?: boolean;
}

const FONT = `-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, "Helvetica Neue", Arial, sans-serif`;

export function CategoryIcon({ category, size = 34 }: { category: NotificationCategory; size?: number }) {
  const c = categoryOf(category);
  const Icon = CATEGORY_ICON[category];
  return (
    <span className="grid shrink-0 place-items-center rounded-[9px]" style={{ width: size, height: size, background: c.bg, color: c.color }}>
      <Icon style={{ width: size * 0.47, height: size * 0.47 }} />
    </span>
  );
}

export function BellButton({ accent, count, floating = false }: { accent: string; count: number; floating?: boolean }) {
  return (
    <span
      className="relative inline-grid place-items-center"
      style={{
        width: floating ? 48 : 38,
        height: floating ? 48 : 38,
        borderRadius: floating ? "50%" : 10,
        background: floating ? "#fff" : "rgba(127,127,127,.12)",
        color: floating ? accent : "#3D3850",
        boxShadow: floating ? "0 8px 24px rgba(20,16,50,.18), 0 0 0 1px rgba(20,16,50,.06)" : undefined,
      }}
    >
      <Bell style={{ width: floating ? 22 : 20, height: floating ? 22 : 20 }} />
      {count > 0 && (
        <span
          className="absolute grid place-items-center rounded-full border-2 border-white text-[10px] font-bold text-white"
          style={{ top: floating ? 2 : 3, right: 2, minWidth: 18, height: 18, padding: "0 4px", background: "#E5484D" }}
        >
          {count > 9 ? "9+" : count}
        </span>
      )}
    </span>
  );
}

function Row({ n, accent }: { n: PreviewItem; accent: string }) {
  return (
    <div
      className="relative flex gap-3 border-b px-4 py-3.5"
      style={{ borderColor: "#EEECF3", background: n.unread ? `color-mix(in srgb, ${accent} 8%, #fff)` : "#fff" }}
    >
      <CategoryIcon category={n.category} />
      <div className="min-w-0 pr-2.5">
        <div className="text-[14px] font-semibold text-[#191526]">
          {n.pinned && <span className="mr-1.5 inline-block rounded-full bg-[#F4F3F7] px-1.5 py-px align-[1px] text-[10.5px] font-semibold text-[#55516A]">Fixado</span>}
          {n.title || "Título da notificação"}
        </div>
        {n.body && <div className="mt-0.5 text-[13px] [overflow-wrap:anywhere] text-[#6E6982]">{n.body}</div>}
        {n.ctaLabel && (
          <span className="mt-2.5 inline-block rounded-[7px] px-3 py-[7px] text-[13px] font-semibold text-white" style={{ background: accent }}>
            {n.ctaLabel}
          </span>
        )}
        <div className="mt-2 text-[11.5px] text-[#9A96AA]">{n.when}</div>
      </div>
      {n.unread && <span className="absolute right-3.5 top-[18px] size-[7px] rounded-full bg-[#E5484D]" />}
    </div>
  );
}

export function PanelPreview({ items, accent, emptyText, maxHeight }: { items: PreviewItem[]; accent: string; emptyText: string; maxHeight?: number }) {
  const fresh = items.filter((n) => n.unread);
  const older = items.filter((n) => !n.unread);
  return (
    <div
      className="w-full max-w-[380px] overflow-hidden rounded-[14px] border bg-white text-[#191526] shadow-[0_18px_48px_rgba(30,20,70,.22)]"
      style={{ borderColor: "#E7E4EE", fontFamily: FONT }}
    >
      <div className="flex items-center justify-between px-4 pb-2.5 pt-3.5">
        <span className="text-[16px] font-bold">Notificações</span>
        <X className="size-4" />
      </div>
      <div className="mx-3.5 mb-3 grid grid-cols-2 gap-0.5 rounded-[10px] border p-[3px]" style={{ background: "#F4F3F7", borderColor: "#ECEAF1" }}>
        <span className="rounded-lg py-[7px] text-center text-[13px] font-semibold text-white" style={{ background: accent }}>
          Todas
        </span>
        <span className="py-[7px] text-center text-[13px] font-medium text-[#55516A]">
          Não lidas
          {fresh.length > 0 && (
            <b className="ml-1 inline-grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[11px] text-white" style={{ background: accent }}>
              {fresh.length}
            </b>
          )}
        </span>
      </div>
      <div className="overflow-y-auto border-t" style={{ borderColor: "#EEECF3", maxHeight }}>
        {items.length === 0 ? (
          <div className="flex flex-col items-center px-6 pb-11 pt-10 text-center text-[#6E6982]">
            <span className="mb-3 grid size-14 place-items-center rounded-full" style={{ background: `color-mix(in srgb, ${accent} 12%, #fff)`, color: accent }}>
              <Bell className="size-6" />
            </span>
            <strong className="text-[15px] text-[#191526]">Ainda não há notificações</strong>
            <p className="mt-1.5 max-w-[260px] text-[13px]">{emptyText}</p>
          </div>
        ) : (
          <>
            {fresh.length > 0 && <Section label="Novas" />}
            {fresh.map((n) => (
              <Row key={n.id} n={n} accent={accent} />
            ))}
            {older.length > 0 && <Section label="Anteriores" />}
            {older.map((n) => (
              <Row key={n.id} n={n} accent={accent} />
            ))}
          </>
        )}
      </div>
      <div className="border-t py-2 text-center text-[10px] font-medium uppercase tracking-[.08em] text-[#8E88A3]" style={{ borderColor: "#EEECF3" }}>
        notificações por <strong className="text-[#6B2BD9]">luumu</strong>
      </div>
    </div>
  );
}

function Section({ label }: { label: string }) {
  return (
    <div className="border-b px-4 py-[7px] text-[11px] font-semibold uppercase tracking-[.08em] text-[#6E6982]" style={{ background: "#F7F6FA", borderColor: "#EEECF3" }}>
      {label}
    </div>
  );
}
