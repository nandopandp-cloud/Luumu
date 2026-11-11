/*
  CSS do widget de acessibilidade, isolado no Shadow DOM.

  `:host` usa !important de propósito: propriedades HERDÁVEIS (letter-spacing, line-height,
  font-size) atravessam o Shadow DOM, e o próprio plugin muda essas propriedades na página
  (espaçamento, tamanho do texto). Sem o reset, ligar "Espaçamento" bagunçaria o painel.
  Declarações !important do :host vencem as do documento (contexto do shadow ganha no !important).
*/
import { LEGIBLE_FONT } from "./page-effects";

const Z = 2147483000;

export const WIDGET_CSS = `
:host{all:initial!important;letter-spacing:normal!important;word-spacing:normal!important;line-height:normal!important;font-size:16px!important;filter:none}
*,*::before,*::after{box-sizing:border-box}
[hidden]{display:none!important}
.root{--acc:#4F46E5;--acc-ink:#fff;--acc-soft:#EEF2FF;--acc-line:#C7D2FE;--bg:#fff;--card:#fff;--fg:#0F172A;--mut:#5B6478;--line:#E2E8F0;--tile:#F1F5F9;--shadow:0 24px 64px rgba(15,23,42,.24),0 4px 12px rgba(15,23,42,.08);
  font:15px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color:var(--fg);-webkit-font-smoothing:antialiased;text-align:left}
.root.dark{--bg:#0F172A;--card:#131D35;--fg:#F1F5F9;--mut:#A3AEC4;--line:#24314F;--tile:#1C2742}
.root.legible{font-family:${LEGIBLE_FONT}}
button{font:inherit;color:inherit;cursor:pointer;border:0;background:none;padding:0;margin:0;text-align:inherit}
button:focus-visible,[tabindex]:focus-visible,a:focus-visible{outline:3px solid var(--acc);outline-offset:2px}
.sr{position:absolute!important;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}

/* ---------- launcher ---------- */
.launcher{position:fixed;z-index:${Z};display:flex;flex-direction:column;gap:12px;align-items:flex-end}
.launcher.left{align-items:flex-start}
.lb{display:flex;align-items:center;position:relative}
.launcher.left .lb{flex-direction:row-reverse}
.lb-label{background:var(--bg);color:var(--fg);font-weight:800;font-size:15px;letter-spacing:.03em;height:46px;display:flex;align-items:center;padding:0 30px 0 20px;margin-right:-22px;border-radius:999px;box-shadow:0 6px 20px rgba(15,23,42,.14);white-space:nowrap;opacity:0;transform:translateX(10px);transition:opacity .2s,transform .2s;pointer-events:none}
.launcher.left .lb-label{padding:0 20px 0 30px;margin:0 0 0 -22px;transform:translateX(-10px)}
.launcher.labels .lb-label,.lb:hover .lb-label,.lb:focus-visible .lb-label{opacity:1;transform:none}
.lb-icon{position:relative;width:58px;height:58px;border-radius:50%;background:var(--acc);color:var(--acc-ink);display:grid;place-items:center;box-shadow:0 0 0 3px var(--bg),0 10px 26px rgba(15,23,42,.3);transition:transform .2s}
.lb:hover .lb-icon{transform:scale(1.06)}
.lb.on .lb-icon{box-shadow:0 0 0 3px var(--bg),0 0 0 6px var(--acc),0 10px 26px rgba(15,23,42,.3)}
.lb-badge{position:absolute;top:-5px;right:-5px;min-width:22px;height:22px;padding:0 5px;border-radius:11px;background:#16A34A;color:#fff;font-size:12px;font-weight:800;display:grid;place-items:center;box-shadow:0 0 0 2px var(--bg)}
.launcher.left .lb-badge{right:auto;left:-5px}

/* ---------- painel ---------- */
.scrim{position:fixed;inset:0;background:rgba(15,23,42,.4);z-index:${Z + 1};opacity:0;transition:opacity .25s;pointer-events:none}
.scrim.open{opacity:1;pointer-events:auto}
.panel{position:fixed;top:0;bottom:0;right:0;width:min(440px,100vw);background:var(--bg);color:var(--fg);z-index:${Z + 2};display:flex;flex-direction:column;box-shadow:var(--shadow);transform:translateX(105%);transition:transform .34s cubic-bezier(.16,1,.3,1),visibility 0s .34s;visibility:hidden}
.panel.left{right:auto;left:0;transform:translateX(-105%)}
.panel.open{transform:none;visibility:visible;transition:transform .34s cubic-bezier(.16,1,.3,1)}
.p-head{display:flex;gap:14px;align-items:flex-start;padding:22px 20px 18px 22px;border-bottom:1px solid var(--line)}
.p-logo{width:50px;height:50px;border-radius:50%;background:var(--acc);color:var(--acc-ink);display:grid;place-items:center;flex:none;overflow:hidden}
.p-logo img{width:100%;height:100%;object-fit:contain;background:#fff;padding:6px}
.p-title{font-size:23px;font-weight:800;letter-spacing:-.01em;margin:3px 0 4px;line-height:1.15}
.p-sub{color:var(--mut);font-size:14.5px;margin:0}
.x{margin-left:auto;width:40px;height:40px;border-radius:12px;display:grid;place-items:center;color:var(--mut);flex:none}
.x:hover{background:var(--tile);color:var(--fg)}
.p-body{flex:1;overflow:auto;padding:4px 22px 24px;overscroll-behavior:contain}
.sec{margin-top:22px}
.sec-t{font-size:12.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--mut);margin:0 0 12px}
.profiles{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.prof{position:relative;background:var(--acc-soft);border:2px solid transparent;border-radius:16px;padding:18px 10px 14px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:6px;transition:border-color .15s,transform .15s}
.prof:hover{border-color:var(--acc-line)}
.prof .pi{color:var(--acc);margin-bottom:2px}
.prof b{font-size:14.5px;line-height:1.2;font-weight:800}
.prof span{font-size:12.5px;color:var(--mut);line-height:1.3}
.prof[aria-pressed="true"]{border-color:var(--acc);background:var(--bg);box-shadow:0 0 0 4px var(--acc-soft)}
.prof .ck{position:absolute;top:8px;right:8px;width:20px;height:20px;border-radius:50%;background:var(--acc);color:var(--acc-ink);display:none;place-items:center}
.prof[aria-pressed="true"] .ck{display:grid}
.row{display:flex;flex-wrap:wrap;align-items:center;gap:12px 14px;padding:14px 16px;border:1px solid var(--line);border-radius:16px;background:var(--card);margin-bottom:10px;transition:border-color .15s}
.row.on{border-color:var(--acc-line)}
.tile{width:46px;height:46px;border-radius:12px;background:var(--tile);display:grid;place-items:center;flex:none;color:var(--fg)}
.row.on .tile{background:var(--acc-soft);color:var(--acc)}
.txt{flex:1;min-width:0}
.txt b{display:block;font-size:16.5px;font-weight:700;line-height:1.25}
.txt span{display:block;color:var(--mut);font-size:14px;margin-top:2px;line-height:1.35}
.sw{width:50px;height:30px;border-radius:15px;background:#CBD5E1;position:relative;flex:none;transition:background .2s}
.root.dark .sw{background:#334155}
.sw::after{content:"";position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:transform .2s}
.sw[aria-checked="true"]{background:var(--acc)}
.sw[aria-checked="true"]::after{transform:translateX(20px)}
.chips{display:flex;gap:6px;flex-wrap:wrap;width:100%;padding-left:60px}
.chip{padding:7px 13px;border-radius:999px;border:1.5px solid var(--line);font-size:13.5px;font-weight:700;background:var(--bg)}
.chip:hover{border-color:var(--acc-line)}
.chip[aria-checked="true"]{background:var(--acc);border-color:var(--acc);color:var(--acc-ink)}
.stepper{display:flex;align-items:center;gap:8px;flex:none}
.stepper button{width:40px;height:40px;border-radius:12px;border:1.5px solid var(--line);display:grid;place-items:center;font-weight:800;font-size:14px;background:var(--bg)}
.stepper button:disabled{opacity:.35;cursor:default}
.bars{display:flex;gap:3px}
.bars i{width:7px;height:20px;border-radius:4px;background:var(--line)}
.bars i.on{background:var(--acc)}
.pct{display:block;color:var(--mut);font-size:14px;margin-top:2px}
.p-foot{display:flex;gap:12px;padding:16px 22px 12px;border-top:1px solid var(--line);background:var(--bg)}
.btn{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:50px;padding:0 16px;border-radius:14px;font-weight:800;font-size:16px;text-align:center}
.btn.ghost{border:1.5px solid var(--line);background:var(--bg)}
.btn.ghost:hover{border-color:var(--acc-line)}
.btn.primary{background:var(--acc);color:var(--acc-ink)}
.btn.primary:hover{filter:brightness(1.06)}
.powered{font-size:11.5px;color:var(--mut);text-align:center;padding:0 0 12px;background:var(--bg)}
.empty{color:var(--mut);font-size:14px;padding:12px 0}

/* ---------- aviso ---------- */
.toast{position:fixed;top:22px;left:50%;transform:translate(-50%,-16px);background:#111827;color:#fff;padding:12px 18px;border-radius:14px;font-weight:600;font-size:15px;display:flex;gap:10px;align-items:center;z-index:${Z + 9};opacity:0;transition:opacity .2s,transform .2s;pointer-events:none;box-shadow:0 12px 32px rgba(0,0,0,.25);max-width:calc(100vw - 32px)}
.toast.show{opacity:1;transform:translate(-50%,0)}

/* ---------- máscara e régua ---------- */
.mask{position:fixed;left:0;right:0;background:rgba(15,23,42,.66);pointer-events:none;z-index:${Z - 10}}
.mask-top{top:0}
.mask-bot{bottom:0}
.guide{position:fixed;left:0;right:0;height:8px;background:var(--acc);opacity:.9;border-radius:4px;pointer-events:none;z-index:${Z - 9};box-shadow:0 0 0 2px #fff,0 6px 18px rgba(15,23,42,.35)}

/* ---------- modais (convite e navegação por rosto) ---------- */
.mwrap{position:fixed;inset:0;background:rgba(15,23,42,.5);display:grid;place-items:center;z-index:${Z + 6};padding:16px;animation:lu-fade .2s ease-out}
.modal{position:relative;background:var(--bg);color:var(--fg);border-radius:28px;max-width:540px;width:100%;padding:36px 32px 28px;box-shadow:var(--shadow);text-align:center;max-height:calc(100vh - 32px);overflow:auto;animation:lu-pop .28s cubic-bezier(.16,1,.3,1)}
.modal .x{position:absolute;top:16px;right:16px}
.m-icon{width:112px;height:112px;border-radius:50%;background:var(--acc);color:var(--acc-ink);display:grid;place-items:center;margin:4px auto 20px;box-shadow:0 0 0 14px var(--acc-soft)}
.m-title{font-size:27px;font-weight:800;margin:0 0 8px;letter-spacing:-.01em;line-height:1.2}
.m-text{color:var(--mut);font-size:16.5px;margin:0 auto 22px;max-width:440px}
.steps{display:flex;flex-direction:column;gap:10px;text-align:left;margin-bottom:16px}
.step{display:flex;gap:14px;align-items:center;background:var(--acc-soft);border-radius:16px;padding:14px 16px;font-size:15.5px;line-height:1.4}
.root.dark .step{background:var(--tile)}
.step i{width:38px;height:38px;border-radius:11px;background:var(--acc);color:var(--acc-ink);display:grid;place-items:center;flex:none}
.priv{display:flex;gap:10px;align-items:flex-start;color:#15803D;font-size:14px;text-align:left;margin:0 0 22px}
.root.dark .priv{color:#4ADE80}
.m-actions{display:flex;gap:12px}
.sugg{display:flex;gap:14px;align-items:center;text-align:left;border:1.5px solid var(--acc-line);border-radius:18px;padding:14px 16px;margin:0 0 22px;background:var(--acc-soft)}
.root.dark .sugg{background:var(--tile)}
.sugg .pi{width:44px;height:44px;border-radius:12px;background:var(--bg);color:var(--acc);display:grid;place-items:center;flex:none}
.sugg small{display:block;font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--acc)}
.sugg b{display:block;font-size:16px}
.sugg span{display:block;font-size:13.5px;color:var(--mut)}
.spin{width:18px;height:18px;border-radius:50%;border:2.5px solid currentColor;border-right-color:transparent;animation:lu-spin .8s linear infinite}

/* ---------- navegação por rosto ---------- */
.fn-cursor{position:fixed;left:0;top:0;width:38px;height:38px;margin:-19px 0 0 -19px;border-radius:50%;pointer-events:none;z-index:${Z + 8};background:conic-gradient(var(--acc) calc(var(--p,0) * 1turn),rgba(255,255,255,.35) 0);box-shadow:0 0 0 3px #fff,0 4px 14px rgba(0,0,0,.35);transition:transform .12s}
.fn-cursor::after{content:"";position:absolute;inset:9px;border-radius:50%;background:#fff;box-shadow:inset 0 0 0 3px var(--acc)}
.fn-cursor.click{transform:scale(.7)}
.fn-cam{position:fixed;bottom:24px;right:96px;width:212px;border-radius:18px;overflow:hidden;background:var(--bg);box-shadow:var(--shadow);z-index:${Z + 3};animation:lu-pop .28s cubic-bezier(.16,1,.3,1)}
.fn-cam.left{right:auto;left:96px}
.fn-cam video{display:block;width:100%;height:150px;object-fit:cover;transform:scaleX(-1);background:#0F172A}
.fn-cam .fn-bar{display:flex;align-items:center;gap:6px;padding:8px 10px;font-size:13px;font-weight:700}
.fn-cam .fn-bar span{flex:1;display:flex;align-items:center;gap:6px}
.fn-cam .dot{width:8px;height:8px;border-radius:50%;background:#16A34A;box-shadow:0 0 0 3px rgba(22,163,74,.2)}
.fn-cam .fn-bar button{padding:6px 10px;border-radius:9px;background:var(--tile);font-weight:800;font-size:12.5px}

@keyframes lu-fade{from{opacity:0}}
@keyframes lu-pop{from{opacity:0;transform:translateY(10px) scale(.98)}}
@keyframes lu-spin{to{transform:rotate(360deg)}}
@media (max-width:520px){
  .profiles{grid-template-columns:repeat(2,1fr)}
  .lb-icon{width:52px;height:52px}
  .chips{padding-left:0}
  .modal{padding:30px 20px 22px;border-radius:24px}
  .m-actions{flex-direction:column-reverse}
  .fn-cam{right:16px;left:auto;bottom:96px}
}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important}}
`;
