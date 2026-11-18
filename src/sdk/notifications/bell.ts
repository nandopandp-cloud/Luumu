/*
  Sino de notificações (public/sdk-notifications.js), baixado pelo core só quando o /config traz
  `notif` (sino ligado no projeto e nesta plataforma). Regras em lib/notifications/model.ts.

  - Só aparece com o usuário identificado (Luumu.identify com id ou e-mail): é do ambiente logado.
  - Onde: no elemento #luumu-bell (espaço reservado pelo produto), num seletor CSS configurado no
    painel, ou flutuante num canto. Num produto SPA o header é desmontado e remontado a cada rota:
    um MutationObserver devolve o sino ao lugar sempre que ele sai.
  - O painel abre num host próprio no <body> (position: fixed): dentro do header ele herdaria
    overflow/transform do produto e poderia ser cortado.
  - Shadow DOM nos dois: o CSS do produto não vaza para o sino e vice-versa.
  - Lidas: guardadas neste navegador, por usuário. Abrir o painel zera o contador; ao fechar, o
    que estava em "Novas" passa para "Anteriores".
  - Métricas: cada (recado, tipo) vai uma vez por usuário, em lote (POST /notifications/events).
*/
import {
  audienceHash,
  BELL_SLOT_ID,
  categoryOf,
  userKeyOf,
  visibleTo,
  whenLabel,
  type NotificationEventKind,
  type PublicNotification,
  type PublicNotifications,
} from "../../lib/notifications/model";
import { svg } from "./icons";
import { bellCss, panelCss } from "./styles";

export interface BellBootConfig {
  api: string;
  key: string;
  data: PublicNotifications;
  /** traits atuais do identify (com o ano escolar lido da tela, quando houver) */
  identity: () => Record<string, unknown>;
}

export interface BellWidget {
  boot(c: BellBootConfig): void;
  update(data: PublicNotifications): void;
  /** o produto chamou Luumu.identify (login, troca de usuário) */
  identify(): void;
  open(): void;
  close(): void;
  destroy(): void;
}

const READ_CAP = 300;
const SENT_CAP = 1000;
const SENT_KEY = "luumu_ntf_sent";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {}
}

function createBell(): BellWidget {
  let cfg: BellBootConfig | null = null;
  let user = ""; // hash do usuário identificado ("" = ninguém: sino escondido)
  let items: PublicNotification[] = [];
  let read = new Set<string>();
  let isOpen = false;
  let tab: "all" | "unread" = "all";
  /** "Novas" desta abertura do painel: congeladas até fechar, para a lista não pular. */
  let openUnread = new Set<string>();

  let bellHost: HTMLElement | null = null;
  let bellRoot: ShadowRoot | null = null;
  let panelHost: HTMLElement | null = null;
  let panelRoot: ShadowRoot | null = null;
  let observer: MutationObserver | null = null;
  let tick: ReturnType<typeof setInterval> | null = null;
  let ensureTimer: ReturnType<typeof setTimeout> | null = null;
  let lastFocus: Element | null = null;

  // cada evento leva o usuário: se outro estudante entrar antes do envio, não se misturam
  const queue: { user: string; id: string; kind: NotificationEventKind }[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  const readKey = () => `luumu_ntf_read_${user}`;

  /* ---------- usuário, recados visíveis, lidas ---------- */

  function refreshUser() {
    if (!cfg) return;
    const k = userKeyOf(cfg.identity());
    user = k ? audienceHash(cfg.data.salt, k) : "";
    read = new Set(user ? readJson<string[]>(readKey(), []) : []);
  }

  function computeItems() {
    if (!cfg || !user) {
      items = [];
      return;
    }
    const traits = cfg.identity();
    items = cfg.data.items.filter((n) => visibleTo(n, traits, cfg!.data.salt));
    for (const n of items) track(n.id, "delivered");
  }

  const unreadCount = () => items.filter((n) => !read.has(n.id)).length;

  function markRead(ids: string[]) {
    if (!ids.length) return;
    ids.forEach((id) => read.add(id));
    // guarda só as mais recentes (as antigas já saíram do catálogo)
    const keep = [...read].slice(-READ_CAP);
    read = new Set(keep);
    writeJson(readKey(), keep);
  }

  /* ---------- métricas ---------- */

  function track(id: string, kind: NotificationEventKind) {
    if (!user) return;
    const sent = readJson<string[]>(SENT_KEY, []);
    const tag = `${user}|${id}|${kind}`;
    if (sent.includes(tag)) return;
    sent.push(tag);
    writeJson(SENT_KEY, sent.slice(-SENT_CAP));
    queue.push({ user, id, kind });
    if (!flushTimer) flushTimer = setTimeout(flush, 3000);
  }

  function flush() {
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = null;
    if (!cfg || !queue.length) return;
    // um envio por usuário (o primeiro da fila); o resto sai em seguida
    const who = queue[0].user;
    const batch = queue.filter((e) => e.user === who).slice(0, 60);
    for (const e of batch) queue.splice(queue.indexOf(e), 1);
    const body = JSON.stringify({ key: cfg.key, user: who, events: batch.map(({ id, kind }) => ({ id, kind })) });
    try {
      // text/plain: sem preflight (ver SIMPLE_CONTENT_TYPE no core)
      void fetch(`${cfg.api}/notifications/events`, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body,
        keepalive: true,
      }).catch(() => {});
    } catch {}
    if (queue.length) flushTimer = setTimeout(flush, 1000);
  }

  const onHide = () => {
    if (document.visibilityState === "hidden") flush();
  };

  /* ---------- onde o sino entra ---------- */

  function target(): { el: HTMLElement; floating: boolean } | null {
    const c = cfg!.data.cfg;
    if (c.m === "floating") return document.body ? { el: document.body, floating: true } : null;
    if (c.m === "selector" && c.sel) {
      try {
        const el = document.querySelector<HTMLElement>(c.sel);
        if (el) return { el, floating: false };
      } catch {
        // seletor inválido: cai no espaço reservado
      }
    }
    const slot = document.getElementById(BELL_SLOT_ID);
    return slot ? { el: slot, floating: false } : null;
  }

  function ensureMounted() {
    if (!cfg) return;
    if (!user) return unmountBell();
    const t = target();
    if (!t) return unmountBell();
    if (bellHost && bellHost.parentElement === t.el && bellHost.isConnected) return;
    if (!bellHost) {
      bellHost = document.createElement("span");
      bellHost.setAttribute("data-luumu-bell", "");
      bellRoot = bellHost.attachShadow({ mode: "open" });
    }
    bellHost.style.cssText = t.floating
      ? `position:fixed;z-index:2147483000;${cornerCss(cfg.data.cfg.cor)}`
      : "display:inline-flex;align-items:center;vertical-align:middle;";
    t.el.appendChild(bellHost);
    renderBell();
  }

  function cornerCss(c: string) {
    if (c === "top-right") return "top:16px;right:16px;";
    if (c === "bottom-left") return "bottom:20px;left:20px;";
    return "bottom:20px;right:20px;";
  }

  function scheduleEnsure() {
    if (ensureTimer) return;
    ensureTimer = setTimeout(() => {
      ensureTimer = null;
      ensureMounted();
    }, 250);
  }

  function unmountBell() {
    if (isOpen) closePanel(false);
    bellHost?.remove();
  }

  /* ---------- render ---------- */

  function renderBell() {
    if (!bellRoot || !cfg) return;
    const n = isOpen ? 0 : unreadCount();
    const floating = cfg.data.cfg.m === "floating";
    bellRoot.innerHTML = `<style>${bellCss(cfg.data.cfg.ac, floating)}</style>
      <button class="bell" type="button" aria-haspopup="dialog" aria-expanded="${isOpen}"
        aria-label="${n ? `Notificações: ${n} não ${n === 1 ? "lida" : "lidas"}` : "Notificações"}">
        ${svg("bell", floating ? 22 : 20)}${n ? `<span class="badge">${n > 9 ? "9+" : n}</span>` : ""}
      </button>`;
    bellRoot.querySelector("button")!.addEventListener("click", (e) => {
      e.stopPropagation();
      if (isOpen) closePanel();
      else openPanel();
    });
  }

  function itemHtml(n: PublicNotification, isNew: boolean) {
    const cat = categoryOf(n.c);
    return `<article class="ntf${isNew ? " unread" : ""}${n.u ? " link" : ""}" data-id="${esc(n.id)}" ${n.u ? 'tabindex="0" role="link"' : ""}>
      <span class="ic" style="color:${cat.color};background:${cat.bg}">${svg(n.c, 16)}</span>
      <div class="nb">
        <div class="nt">${n.p ? '<span class="pin">Fixado</span>' : ""}${esc(n.t)}</div>
        ${n.b ? `<div class="nd">${esc(n.b)}</div>` : ""}
        ${n.l && n.u ? `<button type="button" class="cta" data-id="${esc(n.id)}">${esc(n.l)}</button>` : ""}
        <div class="nw">${whenLabel(n.s)}</div>
      </div>
      ${isNew ? '<span class="dot" aria-label="Não lida"></span>' : ""}
    </article>`;
  }

  function renderPanel() {
    if (!panelRoot || !cfg) return;
    const fresh = items.filter((n) => openUnread.has(n.id));
    const older = items.filter((n) => !openUnread.has(n.id));
    const list = tab === "unread" ? fresh : items;
    let body: string;
    if (!list.length) {
      body = `<div class="empty">
        <span class="eic">${svg(tab === "unread" ? "check" : "bell", 26)}</span>
        <strong>${tab === "unread" ? "Tudo em dia!" : "Ainda não há notificações"}</strong>
        <p>${tab === "unread" ? "Você não tem notificações não lidas." : esc(cfg.data.cfg.em)}</p>
      </div>`;
    } else if (tab === "unread") {
      body = fresh.map((n) => itemHtml(n, true)).join("");
    } else {
      body =
        (fresh.length ? `<div class="sec">Novas</div>${fresh.map((n) => itemHtml(n, true)).join("")}` : "") +
        (older.length ? `<div class="sec">Anteriores</div>${older.map((n) => itemHtml(n, false)).join("")}` : "");
    }
    panelRoot.innerHTML = `<style>${panelCss(cfg.data.cfg.ac)}</style>
      <div class="panel" role="dialog" aria-label="Notificações">
        <header><h2>Notificações</h2><button type="button" class="x" aria-label="Fechar">${svg("x", 16)}</button></header>
        <div class="tabs" role="tablist">
          <button type="button" role="tab" data-tab="all" aria-selected="${tab === "all"}" class="${tab === "all" ? "on" : ""}">Todas</button>
          <button type="button" role="tab" data-tab="unread" aria-selected="${tab === "unread"}" class="${tab === "unread" ? "on" : ""}">Não lidas${fresh.length ? ` <b>${fresh.length}</b>` : ""}</button>
        </div>
        <div class="list">${body}</div>
        <footer>notificações por <strong>luumu</strong></footer>
      </div>`;
    position();
    const root = panelRoot;
    root.querySelector(".x")!.addEventListener("click", () => closePanel());
    root.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((b) =>
      b.addEventListener("click", () => {
        tab = b.dataset.tab === "unread" ? "unread" : "all";
        renderPanel();
      })
    );
    root.querySelectorAll<HTMLElement>(".ntf.link, .cta").forEach((el) => {
      const go = (e: Event) => {
        e.stopPropagation();
        follow(el.dataset.id || "");
      };
      el.addEventListener("click", go);
      el.addEventListener("keydown", (e) => {
        if ((e as KeyboardEvent).key === "Enter") go(e);
      });
    });
  }

  function position() {
    const panel = panelRoot?.querySelector<HTMLElement>(".panel");
    if (!panel || !bellHost) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(380, vw - 16);
    const r = bellHost.getBoundingClientRect();
    const below = r.bottom + 8;
    const roomBelow = vh - below - 12;
    // sino embaixo (flutuante no rodapé): o painel abre para cima
    const up = roomBelow < 320 && r.top > roomBelow;
    const left = Math.max(8, Math.min(r.right - width, vw - width - 8));
    panel.style.width = `${width}px`;
    panel.style.left = `${left}px`;
    if (up) {
      panel.style.top = "";
      panel.style.bottom = `${vh - r.top + 8}px`;
      panel.style.maxHeight = `${Math.max(240, r.top - 20)}px`;
    } else {
      panel.style.bottom = "";
      panel.style.top = `${below}px`;
      panel.style.maxHeight = `${Math.max(240, roomBelow)}px`;
    }
  }

  function follow(id: string) {
    const n = items.find((x) => x.id === id);
    if (!n?.u) return;
    track(id, "click");
    markRead([id]);
    flush();
    closePanel(false);
    if (n.u.startsWith("/")) location.assign(n.u);
    else window.open(n.u, "_blank", "noopener");
  }

  /* ---------- abrir e fechar ---------- */

  const onDocClick = (e: MouseEvent) => {
    const path = e.composedPath();
    if (panelHost && path.includes(panelHost)) return;
    if (bellHost && path.includes(bellHost)) return;
    closePanel();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") closePanel();
  };
  const onReflow = () => position();

  function openPanel() {
    if (!cfg || !user || !bellHost) return;
    computeItems();
    isOpen = true;
    tab = "all";
    openUnread = new Set(items.filter((n) => !read.has(n.id)).map((n) => n.id));
    lastFocus = document.activeElement;
    if (!panelHost) {
      panelHost = document.createElement("div");
      panelHost.setAttribute("data-luumu-notifications", "");
      panelHost.style.cssText = "position:fixed;inset:0 auto auto 0;z-index:2147483001;";
      panelRoot = panelHost.attachShadow({ mode: "open" });
    }
    document.body.appendChild(panelHost);
    renderPanel();
    renderBell();
    for (const n of items) track(n.id, "seen");
    setTimeout(() => panelRoot?.querySelector<HTMLElement>(".x")?.focus(), 0);
    document.addEventListener("click", onDocClick, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);
  }

  function closePanel(restoreFocus = true) {
    if (!isOpen) return;
    isOpen = false;
    markRead([...openUnread]);
    openUnread = new Set();
    panelHost?.remove();
    document.removeEventListener("click", onDocClick, true);
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("resize", onReflow);
    window.removeEventListener("scroll", onReflow, true);
    renderBell();
    if (restoreFocus) {
      const btn = bellRoot?.querySelector<HTMLElement>("button");
      (btn ?? (lastFocus as HTMLElement | null))?.focus?.();
    }
  }

  function refresh() {
    refreshUser();
    computeItems();
    ensureMounted();
    renderBell();
    if (isOpen) renderPanel();
  }

  return {
    boot(c) {
      cfg = c;
      refresh();
      observer = new MutationObserver(scheduleEnsure);
      observer.observe(document.documentElement, { childList: true, subtree: true });
      // recados agendados entram na hora certa sem esperar o catálogo vencer
      tick = setInterval(() => {
        const before = items.map((n) => n.id).join();
        computeItems();
        if (items.map((n) => n.id).join() !== before) {
          renderBell();
          if (isOpen) renderPanel();
        }
      }, 60_000);
      document.addEventListener("visibilitychange", onHide);
    },
    update(data) {
      if (!cfg) return;
      cfg = { ...cfg, data };
      refresh();
    },
    identify() {
      if (!cfg) return;
      if (isOpen) closePanel(false);
      refresh();
    },
    open: () => {
      ensureMounted();
      openPanel();
    },
    close: () => closePanel(),
    destroy() {
      closePanel(false);
      flush();
      observer?.disconnect();
      observer = null;
      if (tick) clearInterval(tick);
      if (ensureTimer) clearTimeout(ensureTimer);
      document.removeEventListener("visibilitychange", onHide);
      bellHost?.remove();
      panelHost?.remove();
      bellHost = panelHost = null;
      bellRoot = panelRoot = null;
      cfg = null;
    },
  };
}

(window as unknown as { __luumuBell?: BellWidget }).__luumuBell = createBell();
